import { addDays, daysBetween, isSunday } from "./calendarHelpers"

function nameOf(block) {
  return block.kind === "job" ? `SO ${block.soNumber}` : block.label.toLowerCase()
}

// Prepares everything the board needs for a window of days (for example 14 days):
// the days, the boxes inside the window, and any clashes.
// "allBlocks" holds every box of every order. It is used to check moves against all the other jobs.
export function buildBoard({ orders, details, lockedPrinting, machineDowntime, windowStart, windowDays }) {
  const lockedSet = new Set(lockedPrinting)
  const allBlocks = []
  let firstDate = ""

  // 1. One box for every step of every order, and one box for every machine breakdown
  orders.forEach((order) => {
    const steps = details[order.soNumber]?.steps ?? []

    steps.forEach((step) => {
      allBlocks.push({
        id: `job-${order.soNumber}-${step.id}`,
        kind: "job",
        soNumber: order.soNumber,
        stepId: step.id,
        stepType: step.type,
        stepName: step.name,
        machine: step.machine,
        outside: step.outside,
        label: `${order.soNumber} ${order.customer}`,
        locked: step.type === "printing" && lockedSet.has(order.soNumber),
        start: step.start,
        end: step.end,
      })
    })
  })

  machineDowntime.forEach((item, index) => {
    allBlocks.push({
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

  const empty = {
    days: [],
    blocks: [],
    allBlocks,
    conflictIds: new Set(),
    messages: [],
    windowStart: "",
    firstDate: "",
  }

  if (allBlocks.length === 0) return empty

  allBlocks.forEach((block) => {
    if (firstDate === "" || block.start.date < firstDate) firstDate = block.start.date
  })

  // 2. The window: it starts on the chosen day (or on the first planned day) and lasts a number of days
  const start = windowStart || firstDate
  const end = addDays(start, windowDays - 1)

  // Only the boxes that touch the window are drawn
  const inWindow = allBlocks.filter((block) => block.start.date <= end && block.end.date >= start)

  // 3. The days to show. A box that starts before the window or ends after it is shown whole,
  //    so the window grows a little. Sundays are hidden, unless a box starts or ends on one.
  const usedDates = new Set()
  inWindow.forEach((block) => {
    usedDates.add(block.start.date)
    usedDates.add(block.end.date)
  })
  const sortedUsed = [...usedDates].sort()

  const rangeStart = sortedUsed.length > 0 && sortedUsed[0] < start ? sortedUsed[0] : start
  const rangeEnd =
    sortedUsed.length > 0 && sortedUsed[sortedUsed.length - 1] > end
      ? sortedUsed[sortedUsed.length - 1]
      : end

  const days = daysBetween(rangeStart, rangeEnd).filter((day) => !isSunday(day) || usedDates.has(day))
  const dayIndex = new Map(days.map((day, index) => [day, index]))

  // 4. Give every box its first and last seat number
  const blocks = inWindow.map((block) => ({
    ...block,
    startSlot: dayIndex.get(block.start.date) * 2 + (block.start.shift === "A" ? 0 : 1),
    endSlot: dayIndex.get(block.end.date) * 2 + (block.end.shift === "A" ? 0 : 1),
  }))

  // 5. Find boxes that share a machine and overlap in time. Machine by machine, so it stays fast.
  //    Jobs printed outside are skipped: they do not use a machine of ours.
  const byMachine = new Map()
  blocks.forEach((block) => {
    if (block.outside) return
    if (!byMachine.has(block.machine)) byMachine.set(block.machine, [])
    byMachine.get(block.machine).push(block)
  })

  const conflictIds = new Set()
  const messages = []

  byMachine.forEach((list, machine) => {
    list.sort((a, b) => a.startSlot - b.startSlot)

    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        // The list is sorted, so once a box starts after this one ends, no later box can overlap it
        if (list[j].startSlot > list[i].endSlot) break

        conflictIds.add(list[i].id)
        conflictIds.add(list[j].id)
        messages.push(`${machine}: ${nameOf(list[i])} and ${nameOf(list[j])} overlap.`)
      }
    }
  })

  return { days, blocks, allBlocks, conflictIds, messages, windowStart: start, firstDate }
}