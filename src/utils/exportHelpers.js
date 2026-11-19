// Puts quotes around a value if it contains a comma, a quote or a new line
function cell(value) {
  const text = String(value ?? "")
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

// Builds the planning schedule as text: one row for every step of every order
export function buildScheduleCsv(orders, details) {
  const header = [
    "SO number",
    "Customer",
    "Order type",
    "Requested date",
    "Recommended date",
    "Step",
    "Machine",
    "Done",
    "Start date",
    "Start shift",
    "End date",
    "End shift",
  ]

  const rows = []

  orders.forEach((order) => {
    const steps = details[order.soNumber]?.steps ?? []

    steps.forEach((step) => {
      rows.push([
        order.soNumber,
        order.customer,
        order.type,
        order.requested,
        order.recommended,
        step.name,
        step.machine,
        step.outside ? "Outside" : "In the factory",
        step.start.date,
        // Work done outside has no shifts
        step.outside ? "" : step.start.shift,
        step.end.date,
        step.outside ? "" : step.end.shift,
      ])
    })
  })

  return [header, ...rows].map((row) => row.map(cell).join(",")).join("\r\n")
}

// Saves the text as a file on the computer. The first character makes Excel read the letters correctly.
export function downloadCsv(fileName, csvText) {
  const blob = new Blob(["\uFEFF" + csvText], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)

  const link = document.createElement("a")
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()

  URL.revokeObjectURL(url)
}