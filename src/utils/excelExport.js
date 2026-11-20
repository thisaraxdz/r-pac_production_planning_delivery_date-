import { shortDateToIso } from "./scheduleHelpers"

// The title of the sheet, followed by the month and year of the planning date.
// (In the planner's file it says "AUGUST 2026", because those orders are from August.)
const TITLE_PREFIX = "OFFSET MAIN SHEET"

const MONTH_NAMES = [
  "JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
  "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER",
]

// The 33 columns, exactly as in sheet "12 (2)" of the planner's file (spelling included)
const HEADERS = [
  "Current Stage", "Docket Stage", "New S/O Nu", "Order type", "Quantity", "FG", "BALANCE", "NOC",
  "REFFERANCE", "CUSTOMER ", "ORDER PLACE DATE",
  "PRINTING", "VARNISH", "UV", "S/T", "PASTING", "EMBOSS", "DIE CUT", "CS DATE",
  "value", "IMPRESSION", "TOTAL IMPRESSION", "UP PLAN", "NO OF COLOURS", "NO OF SIDES", "TOTAL CLICKS",
  "COLOR WASH", "PLATE", "RUN TIME", "TOTAL TIME", "TOTAL HOURS", "MACHINE", "HOLD/UNHOLD",
]

// Column widths, copied from the planner's sheet (the "Order type" column is wider, so the words fit)
const COLUMN_WIDTHS = [
  31.9, 6.3, 11.9, 16, 8.7, 7.9, 8.1, 4, 56.1, 17.1, 8.7,
  9.3, 9.3, 9.3, 9.3, 9.3, 9.3, 9.3, 9.3,
  8.7, 8.9, 8.4, 6.4, 8.7, 8.7, 8.7, 8.7, 8.7, 8.7, 8.7, 8.7, 8.7, 9.9,
]

const DATE_FORMAT = "[$-409]d\\-mmm\\-yy;@"
const NUMBER_FORMAT = '_(* #,##0_);_(* \\(#,##0\\);_(* "-"??_);_(@_)'

// Column numbers (1 = column A)
const FIRST_DATE_COLUMN = 11 // ORDER PLACE DATE
const LAST_DATE_COLUMN = 19 // CS DATE
const MACHINE_COLUMN = 32

function isNumberColumn(column) {
  return (column >= 5 && column <= 8) || (column >= 20 && column <= 26)
}

// The three blocks, as in sheet "12": 7-K, then INK-JET with the outside printers, then the SM machines
function blockIndexOf(machine) {
  if (machine === "7-K") return 0
  if (["SM-A", "SM-B", "SM-C"].includes(machine)) return 2
  return 1
}

// "2026-11-13" becomes a real Excel date
function toExcelDate(isoDate) {
  if (!isoDate) return null
  const [year, month, day] = isoDate.split("-").map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

// "Customer Urgent" is written CUSTOMER URGENCY in the planner's sheet
function orderTypeText(type) {
  const text = type.toUpperCase()
  return text === "CUSTOMER URGENT" ? "CUSTOMER URGENCY" : text
}

function solidFill(argb) {
  return { type: "pattern", pattern: "solid", fgColor: { argb } }
}

function borderAll(style) {
  return { top: { style }, left: { style }, bottom: { style }, right: { style } }
}

// The cells of one order row. The formulas stay blank until Quantity, UP PLAN and so on are typed in.
function rowValues(item, row, csDate) {
  const { order, steps, machine } = item
  const startOf = (type) => steps.find((step) => step.type === type)?.start.date ?? ""

  const values = new Array(HEADERS.length).fill(null)
  values[2] = String(order.soNumber) // New S/O Nu
  values[3] = orderTypeText(order.type) // Order type
  values[6] = { formula: `IF(E${row}="","",E${row}-F${row})` } // BALANCE
  values[9] = order.customer // CUSTOMER
  values[11] = toExcelDate(startOf("printing")) // PRINTING
  values[12] = toExcelDate(startOf("varnish")) // VARNISH
  values[14] = toExcelDate(startOf("softTouch")) // S/T
  values[15] = toExcelDate(startOf("pasting")) // PASTING
  values[17] = toExcelDate(startOf("dieCutting")) // DIE CUT
  values[18] = toExcelDate(csDate) // CS DATE
  values[20] = { formula: `IF(OR(E${row}="",W${row}="",W${row}=0),"",E${row}/W${row})` } // IMPRESSION
  values[21] = {
    formula: `IF(OR(E${row}="",W${row}="",W${row}=0,Y${row}=""),"",(E${row}/W${row})*Y${row})`,
  } // TOTAL IMPRESSION
  values[25] = { formula: `IF(OR(U${row}="",X${row}=""),"",U${row}*X${row})` } // TOTAL CLICKS
  values[31] = machine // MACHINE
  return values
}

// Saves the file on the computer
function saveBlob(fileName, blob) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

// Builds the planning schedule as an Excel file with the structure of the planner's sheet "12 (2)"
export async function downloadPlanningWorkbook({ orders, details, planDate }) {
  // The library is loaded only now, when the button is pressed
  const excel = await import("exceljs")
  const ExcelJS = excel.default ?? excel

  const [year, month, day] = planDate.split("-")
  const title = `${TITLE_PREFIX} ${MONTH_NAMES[Number(month) - 1]} ${year}`

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet(String(Number(day)), {
    views: [{ state: "frozen", ySplit: 2, zoomScale: 90 }],
    pageSetup: { orientation: "landscape", paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  })

  COLUMN_WIDTHS.forEach((width, index) => {
    sheet.getColumn(index + 1).width = width
  })

  // 1. Put every order in its block
  const blocks = [[], [], []]

  orders.forEach((order) => {
    const steps = details[order.soNumber]?.steps ?? []
    const printing = steps.find((step) => step.type === "printing")
    const machine = printing ? printing.machine : ""

    blocks[blockIndexOf(machine)].push({
      order,
      steps,
      machine,
      printDate: printing ? printing.start.date : "",
    })
  })

  // Inside a block: by printing date, then by SO number
  blocks.forEach((rows) => {
    rows.sort((a, b) => a.printDate.localeCompare(b.printDate) || a.order.soNumber - b.order.soNumber)
  })

  // 2. Write the blocks one under the other (a block without orders is left out)
  let row = 1
  let written = 0

  blocks.forEach((rows) => {
    if (rows.length === 0) return

    // A blank row between blocks
    if (written > 0) row += 1
    written += 1

    // Title row
    sheet.mergeCells(row, 1, row, HEADERS.length)
    const titleCell = sheet.getCell(row, 1)
    titleCell.value = title
    titleCell.font = { name: "Calibri", size: 18, bold: true, color: { argb: "FF000000" } }
    titleCell.fill = solidFill("FFCAEEFB")
    titleCell.alignment = { horizontal: "center", vertical: "middle" }
    titleCell.border = borderAll("thin")
    sheet.getRow(row).height = 35.1
    row += 1

    // Header row
    HEADERS.forEach((text, index) => {
      const cell = sheet.getCell(row, index + 1)
      cell.value = text
      cell.font = { name: "Calibri", size: 8, bold: true }
      cell.fill = solidFill("FFD1D1D1")
      cell.alignment = { horizontal: "left", vertical: "top", wrapText: true }
      cell.border = borderAll("medium")
    })
    sheet.getRow(row).height = 34.5
    row += 1

    // One row for every order
    rows.forEach((item) => {
      const csDate = shortDateToIso(item.order.recommended, year)
      const values = rowValues(item, row, csDate)

      values.forEach((value, index) => {
        const column = index + 1
        const cell = sheet.getCell(row, column)
        cell.value = value
        cell.font = { name: "Calibri", size: 7 }
        cell.border = borderAll("thin")

        if (column >= FIRST_DATE_COLUMN && column <= LAST_DATE_COLUMN) {
          cell.numFmt = DATE_FORMAT
          cell.alignment = { horizontal: "left" }
        } else if (isNumberColumn(column)) {
          cell.numFmt = NUMBER_FORMAT
          cell.alignment = { horizontal: "right" }
        }

        if (column === MACHINE_COLUMN) {
          cell.font = { name: "Calibri", size: 7, bold: true, color: { argb: "FFFFFFFF" } }
          cell.fill = solidFill("FF996633")
          cell.alignment = { horizontal: "right" }
        }
      })

      row += 1
    })
  })

  // 3. Make the file and save it
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  })
  saveBlob(`planning-schedule-${planDate}.xlsx`, blob)
}