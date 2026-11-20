// All machines and outside printers.
// The names are written exactly as in the planner's Excel file.
// To add a machine later, add its name to the right list below.

// The kinds of work (steps) an order can go through
export const stepNames = {
  printing: "Printing",
  varnish: "Varnish",
  softTouch: "Soft touch",
  pasting: "Pasting",
  doubleTape: "Double tape pasting",
  dieCutting: "Die cutting",
}

// Printing machines inside the factory
export const printMachines = ["SM-A", "SM-B", "SM-C", "7-K", "INK-JET", "SCREEN (UV)"]

// Printing machines after which the next step can start in the same shift.
// Right now only the 7-K machine. To allow another machine, add its name here.
export const sameShiftPrinters = ["7-K"]

// Printing done outside the factory. Only the company and the dates are noted (no shifts).
export const outsourcePrinters = ["RANPATH", "PRINTCARE", "PRINT USA"]

// Finishing machines, grouped by the kind of work
export const finishingMachines = {
  varnish: ["GTO", "KORD"],
  softTouch: ["Soft touch"],
  pasting: ["Pasting 1", "Pasting 2", "Pasting 3", "Pasting 4", "Pasting 5"],
  doubleTape: ["Double tape pasting"],
  dieCutting: ["KSB", "Flat bed", "SBG", "Hand plating"],
}

// The finishing machines as a list of groups, in the order they are shown on the board
export const finishingGroups = Object.entries(finishingMachines).map(([step, machines]) => ({
  step,
  title: stepNames[step],
  machines,
}))

// Which machines can do each kind of work
export const machinesByStep = {
  printing: printMachines,
  ...finishingMachines,
}