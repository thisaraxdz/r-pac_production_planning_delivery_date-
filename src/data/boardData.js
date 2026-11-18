// Sample data only. Later this will come from the real machine calendar and the factory floor.

// Orders whose printing is already running, so it cannot be moved
export const lockedPrinting = [2001]

// Times when a machine cannot be used
export const machineDowntime = [
  {
    machine: "SM52-B",
    label: "Maintenance",
    start: { date: "2026-11-14", shift: "B" },
    end: { date: "2026-11-14", shift: "B" },
  },
]