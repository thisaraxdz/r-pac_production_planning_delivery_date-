import { slotOf } from "./scheduleHelpers"

// Turns a Date into text like "2026-11-13"
function toIso(date) {
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${date.getFullYear()}-${month}-${day}`
}

// Adds days to a date text: addDays("2026-11-13", 2) gives "2026-11-15"
export function addDays(isoDate, count) {
  const [year, month, day] = isoDate.split("-").map(Number)
  const date = new Date(year, month - 1, day)
  date.setDate(date.getDate() + count)
  return toIso(date)
}

export function isSunday(isoDate) {
  const [year, month, day] = isoDate.split("-").map(Number)
  return new Date(year, month - 1, day).getDay() === 0
}

// Every day from the first date to the last date, as texts like "2026-11-13"
export function daysBetween(firstIso, lastIso) {
  const days = []
  let current = firstIso

  // The limit of 90 days protects the page if a wrong date ever gets in
  while (current <= lastIso && days.length < 90) {
    days.push(current)
    current = addDays(current, 1)
  }
  return days
}

// The next shift after a point (date + shift).
// Sundays are skipped, unless they are in openSundays (a Sunday that is being used).
export function nextSlot(point, openSundays) {
  if (point.shift === "A") return { date: point.date, shift: "B" }

  let date = addDays(point.date, 1)
  while (isSunday(date) && !openSundays.has(date)) {
    date = addDays(date, 1)
  }
  return { date, shift: "A" }
}

// Moves a point forward by a number of shifts
export function moveForward(point, count, openSundays) {
  let current = point
  for (let i = 0; i < count; i++) {
    current = nextSlot(current, openSundays)
  }
  return current
}

// How many shifts a step covers, counting its first and its last shift
export function countSlots(start, end, openSundays) {
  let current = start
  let count = 1

  while (slotOf(current) < slotOf(end) && count < 500) {
    current = nextSlot(current, openSundays)
    count++
  }
  return count
}

// The date and shift at a position on the board (position 0 = first day, shift A)
export function pointFromSlot(days, slotIndex) {
  const date = days[Math.floor(slotIndex / 2)]
  if (!date) return null
  return { date, shift: slotIndex % 2 === 0 ? "A" : "B" }
}