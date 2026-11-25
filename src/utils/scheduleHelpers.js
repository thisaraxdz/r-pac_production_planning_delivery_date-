import { sameShiftPrinters } from "../data/machines"

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

const LONG_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
const LONG_MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

// Today's real date as text like "2026-11-20".
// It is read from the computer's clock each time, so it changes every day.
export function todayIso() {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${now.getFullYear()}-${month}-${day}`
}

// "2026-11-20" becomes "Friday 20 November 2026"
export function formatLongDate(isoDate) {
  const [year, month, day] = isoDate.split("-").map(Number)
  const dayName = LONG_DAYS[new Date(year, month - 1, day).getDay()]
  return `${dayName} ${day} ${LONG_MONTHS[month - 1]} ${year}`
}

// The sample dates in our data (like "Tue 17 Nov") have no year. They start in this year.
// When real data with full dates arrives, this is no longer needed.
export const SAMPLE_YEAR = "2026"

// Today's date, read when the page opens. (The name is old: it is now the real date of today.
// It is kept so the other files keep working. We will rename it when we clean up.)
export const SAMPLE_TODAY = todayIso()

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

// "Wed 18 Nov" becomes "2026-11-18".
// The text has no year, so the weekday tells which year is meant (it looks at 5 years from startYear).
export function shortDateToIso(shortText, startYear) {
  const [dayName, day, monthName] = shortText.split(" ")
  const month = MONTHS.indexOf(monthName)
  const first = Number(startYear)

  for (let year = first; year <= first + 4; year++) {
    if (DAYS[new Date(year, month, Number(day)).getDay()] === dayName) {
      return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
    }
  }

  // The weekday did not match any of these years, so we use the first year
  return `${startYear}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

// Works out the status of an order after its date changes
// requestedText: the customer's date, like "Tue 17 Nov"
// recommendedIso: the new date, like "2026-11-18"
// chance: the chance in percent, or null if it is not calculated yet
export function statusFor(requestedText, recommendedIso, chance) {
  const requestedIso = shortDateToIso(requestedText, SAMPLE_YEAR)

  if (recommendedIso > requestedIso) return "Not met"
  if (chance !== null && chance < AT_RISK_BELOW_PERCENT) return "At risk"
  return "Met"
}

// The machine shown under the step name, for example "SM-A" or "RANPATH (outside)".
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

  // Printing: only on machines that can finish in the same shift (right now the 7-K machine)
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