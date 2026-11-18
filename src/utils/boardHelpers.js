import { addDays, daysBetween, isSunday } from "./calendarHelpers"

// Empty days shown after the last job, so boxes can be moved later
const EXTRA_DAYS = 5

// The seat number of a date and shift on the board
function slotNumber(days, point) {
  return days.indexOf(point.date) * 2 + (point.shift === "A" ? 0 : 1)
}

function nameOf(block) {
  return block.kind === "job" ? `SO ${block.soNumber}` : block.label.toLowerCase()
}

// Prepares everything the board needs: the days, the boxes, and any clashes
export function buildBoard({ orders, details, lockedPrinting, machineDowntime }) {
  // 1. One box for every step of every order, and one box for every machine breakdown
  const blocks = []

  orders.forEach((order) => {
    const steps = details[order.soNumber]?.steps ?? []

    steps.forEach((step) => {
      blocks.push({
        id: `job-${order.soNumber}-${step.id}`,
        kind: "job",
        soNumber: order.soNumber,
        stepId: step.id,
        stepType: step.type,
        stepName: step.name,
        machine: step.machine,
        outside: step.outside,
        label: `${order.soNumber} ${order.customer}`,
        locked: step.type === "printing" && lockedPrinting.includes(order.soNumber),
        start: step.start,
        end: step.end,
      })
    })
  })

  machineDowntime.forEach((item, index) => {
    blocks.push({
      id: `down-${index}`,
      kind: "downtime",
      downtimeIndex: index,
      machine: item.machine,
      outside: false,
      label: item.label,
      locked: false,
      start: item.start,
      end: item.end,
    })
  })

  if (blocks.length === 0) {
    return { days: [], blocks: [], conflictIds: new Set(), messages: [] }
  }

  // 2. Decide which days to show: from the earliest date to a few days after the latest date.
  //    Sundays are hidden, unless a box starts or ends on one.
  const usedDates = [...new Set(blocks.flatMap((block) => [block.start.date, block.end.date]))].sort()
  const lastDate = addDays(usedDates[usedDates.length - 1], EXTRA_DAYS)
  const allDays = daysBetween(usedDates[0], lastDate)
  const days = allDays.filter((day) => !isSunday(day) || usedDates.includes(day))

  // 3. Give every box its first and last seat number
  const placed = blocks.map((block) => ({
    ...block,
    startSlot: slotNumber(days, block.start),
    endSlot: slotNumber(days, block.end),
  }))

  // 4. Find boxes that share a machine and overlap in time.
  //    Jobs printed outside are skipped: they do not use a machine of ours.
  const conflictIds = new Set()
  const messages = []

  for (let i = 0; i < placed.length; i++) {
    for (let j = i + 1; j < placed.length; j++) {
      const a = placed[i]
      const b = placed[j]

      if (a.outside || b.outside) continue

      const sameMachine = a.machine === b.machine
      const overlap = a.startSlot <= b.endSlot && b.startSlot <= a.endSlot

      if (sameMachine && overlap) {
        conflictIds.add(a.id)
        conflictIds.add(b.id)
        messages.push(`${a.machine}: ${nameOf(a)} and ${nameOf(b)} overlap.`)
      }
    }
  }

  return { days, blocks: placed, conflictIds, messages }
}