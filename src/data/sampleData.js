import { addDays, isSunday } from "../utils/calendarHelpers"
import { formatDate, statusFor, todayIso } from "../utils/scheduleHelpers"
import { finishingMachines, outsourcePrinters, printMachines, stepNames } from "./machines"

const CUSTOMERS = ["Walmart", "Levi’s", "Nike", "Tesco", "Brandix", "MAS", "Lindex", "Avia"]
const CUSTOMER_CODES = ["WMT", "LEV", "NKE", "TSC", "BRX", "MAS", "LND", "AVA"]

// The order types and how often each one appears (in percent)
const TYPES = [
  ["Normal", 55],
  ["Customer Urgent", 15],
  ["Express", 10],
  ["Speed", 5],
  ["Core", 5],
  ["Replacement", 5],
  ["Sample", 5],
]

// A small random number generator that always gives the same numbers, so a test can be repeated
function seededRandom(seed) {
  let state = seed
  return function random() {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Moves a date by a number of working days (Sundays are skipped)
function moveWorkingDays(isoDate, delta) {
  const direction = delta < 0 ? -1 : 1
  let current = isoDate
  let moved = 0

  while (moved < Math.abs(delta)) {
    current = addDays(current, direction)
    if (!isSunday(current)) moved++
  }
  return current
}

// Creates test orders and their steps (for checking speed with thousands of orders)
export function makeSampleData(count) {
  const random = seededRandom(2026)
  const pick = (list) => list[Math.floor(random() * list.length)]

  // The working days, starting today (Sundays are skipped)
  const workingDays = []
  function dayAt(index) {
    while (workingDays.length <= index) {
      let next = workingDays.length === 0 ? todayIso() : addDays(workingDays[workingDays.length - 1], 1)
      while (isSunday(next)) next = addDays(next, 1)
      workingDays.push(next)
    }
    return workingDays[index]
  }

  // A "slot" is one shift: slot 0 = first day shift A, slot 1 = first day shift B, and so on
  function pointAt(slot) {
    return { date: dayAt(Math.floor(slot / 2)), shift: slot % 2 === 0 ? "A" : "B" }
  }

  function pickType() {
    let roll = random() * 100
    for (const [name, weight] of TYPES) {
      roll -= weight
      if (roll < 0) return name
    }
    return "Normal"
  }

  // Each machine remembers the first slot where it is free, so jobs never overlap
  const free = {}
  const printers = printMachines.filter((machine) => machine !== "SCREEN (UV)")
  const machinesFor = (type) => (type === "printing" ? printers : finishingMachines[type])

  function pickMachine(list) {
    let best = list[0]
    list.forEach((machine) => {
      if ((free[machine] ?? 0) < (free[best] ?? 0)) best = machine
    })
    return best
  }

  const orders = []
  const details = {}

  for (let i = 0; i < count; i++) {
    const soNumber = 3001 + i
    const customerIndex = Math.floor(random() * CUSTOMERS.length)
    const referenceNumber = Math.floor(random() * 800)

    // The steps of this order, in order
    const types = ["printing", "varnish"]
    if (random() < 0.15) types.push("softTouch")
    types.push("pasting")
    if (random() < 0.1) types.push("doubleTape")
    types.push("dieCutting")

    const steps = []
    let cursor = 0 // the first slot this order can use next

    types.forEach((type) => {
      const outside = type === "printing" && random() < 0.05
      let machine
      let startSlot
      let length

      if (outside) {
        // Printed outside: whole days, no machine of ours
        machine = pick(outsourcePrinters)
        startSlot = cursor % 2 === 0 ? cursor : cursor + 1
        length = 2 * (2 + Math.floor(random() * 3))
      } else {
        machine = pickMachine(machinesFor(type))
        startSlot = Math.max(cursor, free[machine] ?? 0)
        const longer = (type === "printing" && random() < 0.4) || (type === "dieCutting" && random() < 0.3)
        length = longer ? 2 : 1
        free[machine] = startSlot + length
      }

      const endSlot = startSlot + length - 1
      steps.push({
        id: type,
        type,
        name: stepNames[type],
        machine,
        outside,
        start: pointAt(startSlot),
        end: pointAt(endSlot),
      })
      cursor = endSlot + 1
    })

    // The recommended date is the day after the last step. The customer asked for a day close to it.
    const recommendedIso = moveWorkingDays(steps[steps.length - 1].end.date, 1)
    const requestedIso = moveWorkingDays(recommendedIso, Math.floor(random() * 4) - 2)
    const chance = 55 + Math.floor(random() * 45)
    const requestedText = formatDate(requestedIso)
    const recommendedText = formatDate(recommendedIso)

    orders.push({
      soNumber,
      reference: `FG_${CUSTOMER_CODES[customerIndex]}_${25000 + referenceNumber}_HT`,
      customer: CUSTOMERS[customerIndex],
      type: pickType(),
      requested: requestedText,
      recommended: recommendedText,
      chance,
      status: statusFor(requestedText, recommendedIso, chance),
    })

    details[soNumber] = {
      steps,
      chances: [
        { date: formatDate(moveWorkingDays(recommendedIso, -1)), chance: Math.max(20, chance - 25) },
        { date: recommendedText, chance },
        { date: formatDate(moveWorkingDays(recommendedIso, 1)), chance: Math.min(99, chance + 8) },
      ],
    }
  }

  return { orders, details }
}