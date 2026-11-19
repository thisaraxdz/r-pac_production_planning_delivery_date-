import { sameShiftPrinters } from "../data/machines"

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

// The sample data is set on this day. Later this becomes the real date of today.
export const SAMPLE_TODAY = "2026-11-12"

// An order with a chance (%) below this number is marked "At risk".
// This is an assumption taken from the sample data (71% = at risk, 82% = met).
// Please confirm the real rule with the planner.
const AT_RISK_BELOW_PERCENT = 75

// "2026-11-13" becomes "Fri 13 Nov"
export function formatDate(isoDate) {
  const [year, month, day] = isoDate.split("-").map(Number)
  const dayName = DAYS[new Date(year, month - 1, day).getDay()]
  return `${dayName} ${day} ${MONTHS[month - 1]}`
}

// "Wed 18 Nov" becomes "2026-11-18". The year must be given, because the short text has no year.
export function shortDateToIso(shortText, year) {
  const [, day, monthName] = shortText.split(" ")
  const month = MONTHS.indexOf(monthName) + 1
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

// Works out the status of an order after its date changes
// requestedText: the customer's date, like "Tue 17 Nov"
// recommendedIso: the new date, like "2026-11-18"
// chance: the chance in percent, or null if it is not calculated yet
export function statusFor(requestedText, recommendedIso, chance) {
  const requestedIso = shortDateToIso(requestedText, SAMPLE_TODAY.slice(0, 4))

  if (recommendedIso > requestedIso) return "Not met"
  if (chance !== null && chance < AT_RISK_BELOW_PERCENT) return "At risk"
  return "Met"
}

// The machine shown under the step name, for example "SM52-A" or "Ranpath (outside)".
// Nothing is shown when the machine has the same name as the step (for example "Soft touch").
export function machineLabel(step) {
  if (step.outside) return `${step.machine} (outside)`
  if (step.machine === step.name) return ""
  return step.machine
}

// The time of a step as one or two short lines, for example:
//   ["Fri 13 Nov, shift A"]
//   ["From Sat 14 Nov, shift B", "To Mon 16 Nov, shift A"]
export function stepTimeLines(step) {
  const { start, end } = step

  // Work done outside has no shifts, only dates
  if (step.outside) {
    if (start.date === end.date) return [formatDate(start.date)]
    return [`From ${formatDate(start.date)}`, `To ${formatDate(end.date)}`]
  }

  if (start.date === end.date && start.shift === end.shift) {
    return [`${formatDate(start.date)}, shift ${start.shift}`]
  }
  if (start.date === end.date) {
    return [`${formatDate(start.date)}, shifts ${start.shift} and ${end.shift}`]
  }
  return [
    `From ${formatDate(start.date)}, shift ${start.shift}`,
    `To ${formatDate(end.date)}, shift ${end.shift}`,
  ]
}

// Turns a date and shift into one text that can be compared (later text = later time)
export function slotOf(point) {
  return `${point.date}-${point.shift === "A" ? 0 : 1}`
}

// Can the next step start in the same shift in which this step ends?
export function canShareShift(step) {
  // Finishing steps (varnish, pasting, die cutting and so on) can follow each other in one shift
  if (step.type !== "printing") return true

  // Printing: only on machines that can finish in the same shift (right now the 7k machine)
  return sameShiftPrinters.includes(step.machine)
}

// Checks the edited steps. It returns a list of problems in plain words (empty list = all fine).
// Sundays are allowed, because on busy days the factory also works on Sunday.
export function validateSteps(steps) {
  const problems = []

  steps.forEach((step, index) => {
    if (!step.start.date || !step.end.date) {
      problems.push(`${step.name}: please choose both dates.`)
      return
    }

    if (slotOf(step.end) < slotOf(step.start)) {
      problems.push(`${step.name}: the end cannot be before the start.`)
    }

    if (index > 0) {
      const previous = steps[index - 1]

      if (previous.end.date) {
        const startSlot = slotOf(step.start)
        const previousEndSlot = slotOf(previous.end)

        if (canShareShift(previous)) {
          // Starting in the same shift is fine. Starting earlier is not.
          if (startSlot < previousEndSlot) {
            problems.push(`${step.name} cannot start before ${previous.name} has ended.`)
          }
        } else if (startSlot <= previousEndSlot) {
          // Starting in the same shift is not possible after this kind of printing
          problems.push(
            `${step.name} must start in a later shift, because ${previous.name} on ${previous.machine} cannot be followed by another step in the same shift.`
          )
        }
      }
    }
  })

  return problems
}