import { outsourcePrinters, stepNames } from "./machines"

// The schedule board still takes the printing machine list from this file, so we pass it on
export { printMachines } from "./machines"

// Sample data only. Later this will come from the ASP and Monte Carlo results.
// Each step has a start and an end. A point is a date (year-month-day) plus a shift (A or B).
// A step uses every shift from its start to its end, including both.
// For outside work the shifts do not matter: we use A at the start and B at the end (whole days).

// A small helper that builds one step, so the lists below stay short and readable
function makeStep(type, machine, startDate, startShift, endDate, endShift) {
  return {
    id: type,
    type,
    name: stepNames[type],
    machine,
    outside: outsourcePrinters.includes(machine),
    start: { date: startDate, shift: startShift },
    end: { date: endDate, shift: endShift },
  }
}

export const orderDetails = {
  2001: {
    steps: [
      makeStep("printing", "SM-A", "2026-11-13", "A", "2026-11-13", "A"),
      makeStep("varnish", "GTO", "2026-11-13", "B", "2026-11-13", "B"),
      makeStep("pasting", "Pasting 1", "2026-11-14", "A", "2026-11-14", "A"),
      makeStep("dieCutting", "KSB", "2026-11-14", "B", "2026-11-16", "A"),
    ],
    chances: [
      { date: "Mon 16 Nov", chance: 63 },
      { date: "Tue 17 Nov", chance: 91 },
      { date: "Wed 18 Nov", chance: 98 },
    ],
  },
  2002: {
    steps: [
      makeStep("printing", "SM-B", "2026-11-13", "A", "2026-11-13", "B"),
      makeStep("varnish", "KORD", "2026-11-14", "A", "2026-11-14", "A"),
      makeStep("pasting", "Pasting 2", "2026-11-14", "B", "2026-11-14", "B"),
      makeStep("dieCutting", "Flat bed", "2026-11-16", "A", "2026-11-16", "A"),
    ],
    chances: [
      { date: "Sat 14 Nov", chance: 58 },
      { date: "Mon 16 Nov", chance: 94 },
      { date: "Tue 17 Nov", chance: 99 },
    ],
  },
  2003: {
    steps: [
      makeStep("printing", "SM-A", "2026-11-13", "B", "2026-11-13", "B"),
      makeStep("varnish", "GTO", "2026-11-14", "A", "2026-11-14", "A"),
      makeStep("pasting", "Pasting 3", "2026-11-14", "B", "2026-11-14", "B"),
      makeStep("dieCutting", "SBG", "2026-11-16", "A", "2026-11-17", "B"),
    ],
    chances: [
      { date: "Tue 17 Nov", chance: 54 },
      { date: "Wed 18 Nov", chance: 88 },
      { date: "Thu 19 Nov", chance: 96 },
    ],
  },
  2004: {
    steps: [
      makeStep("printing", "SM-A", "2026-11-16", "B", "2026-11-17", "A"),
      makeStep("varnish", "KORD", "2026-11-17", "B", "2026-11-18", "A"),
      makeStep("softTouch", "Soft touch", "2026-11-18", "B", "2026-11-19", "A"),
      makeStep("pasting", "Pasting 1", "2026-11-19", "B", "2026-11-20", "A"),
      makeStep("dieCutting", "KSB", "2026-11-20", "B", "2026-11-21", "B"),
    ],
    chances: [
      { date: "Sat 21 Nov", chance: 47 },
      { date: "Mon 23 Nov", chance: 82 },
      { date: "Tue 24 Nov", chance: 95 },
    ],
  },
  2005: {
    steps: [
      makeStep("printing", "7-K", "2026-11-14", "B", "2026-11-16", "A"),
      makeStep("varnish", "GTO", "2026-11-16", "B", "2026-11-17", "A"),
      makeStep("pasting", "Pasting 4", "2026-11-17", "B", "2026-11-18", "A"),
      makeStep("doubleTape", "Double tape pasting", "2026-11-18", "B", "2026-11-18", "B"),
      makeStep("dieCutting", "Flat bed", "2026-11-19", "A", "2026-11-19", "B"),
    ],
    chances: [
      { date: "Thu 19 Nov", chance: 44 },
      { date: "Fri 20 Nov", chance: 71 },
      { date: "Sat 21 Nov", chance: 90 },
    ],
  },
  2006: {
    steps: [
      makeStep("printing", "SM-C", "2026-11-14", "A", "2026-11-14", "B"),
      makeStep("varnish", "KORD", "2026-11-23", "A", "2026-11-23", "A"),
      makeStep("pasting", "Pasting 5", "2026-11-23", "B", "2026-11-24", "A"),
      makeStep("dieCutting", "Hand plating", "2026-11-24", "B", "2026-11-24", "B"),
    ],
    chances: [
      { date: "Tue 24 Nov", chance: 66 },
      { date: "Wed 25 Nov", chance: 90 },
      { date: "Thu 26 Nov", chance: 97 },
    ],
  },
}