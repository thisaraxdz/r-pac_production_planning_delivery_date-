// All machines and outside printers.
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
export const printMachines = ["SM52-A", "SM52-B", "SM52-C", "7k Offset", "Ink Jet", "Screen (UV)"]

// Printing machines after which the next step can start in the same shift.
// Right now only the 7k machine. To allow another machine, add its name here.
export const sameShiftPrinters = ["7k Offset"]

// Printing done outside the factory. Only the company and the dates are noted (no shifts).
export const outsourcePrinters = ["Ranpath", "Printcare", "Print USA"]

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