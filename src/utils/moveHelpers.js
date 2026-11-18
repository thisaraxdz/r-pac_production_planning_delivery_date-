import { machinesByStep, printMachines } from "../data/machines"
import { canShareShift, formatDate, slotOf } from "./scheduleHelpers"
import { countSlots, isSunday, moveForward, nextSlot } from "./calendarHelpers"

function fail(reason) {
  return { ok: false, reason }
}

// The Sundays that are open on the board (some box already uses them)
function openSundaysOf(days) {
  return new Set(days.filter((day) => isSunday(day)))
}

function overlaps(startA, endA, startB, endB) {
  return slotOf(startA) <= slotOf(endB) && slotOf(startB) <= slotOf(endA)
}

// The earliest point at which the step after this one may start
function earliestNextStart(step, openSundays) {
  return canShareShift(step) ? step.end : nextSlot(step.end, openSundays)
}

function whoUses(box) {
  return box.kind === "job" ? `SO ${box.soNumber}` : box.label.toLowerCase()
}

// Looks for another box on the same machine at the same time. Returns that box, or null.
function findClash(machine, start, end, blocks, shouldIgnore) {
  const found = blocks.find(
    (other) =>
      !other.outside &&
      other.machine === machine &&
      !shouldIgnore(other) &&
      overlaps(start, end, other.start, other.end)
  )
  return found ?? null
}

// Plans the move of a job box (one step of an order).
// block: the box that is dragged
// target: the row where it is dropped: { machine, outsideId }
// newStart: the date and shift where the box would begin
export function planJobMove({ block, target, newStart, days, orderSteps, blocks }) {
  if (block.locked) return fail("This job is locked because it is already running.")

  const openSundays = openSundaysOf(days)
  const steps = structuredClone(orderSteps)
  const index = steps.findIndex((item) => item.id === block.stepId)
  const step = steps[index]

  // 1. Is this the right kind of row?
  if (block.outside) {
    if (target.outsideId !== block.id) {
      return fail("A job printed outside can only be moved to another day, not to a machine.")
    }
  } else {
    if (target.outsideId) return fail("That row is for jobs printed outside.")
    if (!machinesByStep[step.type].includes(target.machine)) {
      return fail(`${step.name} cannot be done on ${target.machine}.`)
    }
  }

  // 2. Nothing to do if the box is dropped where it already is
  const sameMachine = block.outside || target.machine === step.machine
  const sameSpot = block.outside
    ? newStart.date === step.start.date
    : slotOf(newStart) === slotOf(step.start)
  if (sameMachine && sameSpot) return { ok: true, unchanged: true }

  // 3. Move the step. It keeps its length.
  const length = countSlots(step.start, step.end, openSundays)
  step.start = block.outside ? { date: newStart.date, shift: "A" } : newStart
  step.end = moveForward(step.start, length - 1, openSundays)
  if (block.outside) step.end = { ...step.end, shift: "B" }
  if (!block.outside) step.machine = target.machine

  // 4. The step before must have ended
  if (index > 0) {
    const previous = steps[index - 1]
    const earliest = earliestNextStart(previous, openSundays)

    if (slotOf(step.start) < slotOf(earliest)) {
      if (canShareShift(previous)) {
        return fail(`${step.name} cannot start before ${previous.name} has ended.`)
      }
      if (previous.outside) {
        return fail(`${step.name} cannot start before ${previous.name} (outside) is finished.`)
      }
      return fail(
        `${step.name} must start in a later shift than ${previous.name} on ${previous.machine}, because that machine cannot be followed by another step in the same shift.`
      )
    }
  }

  // 5. Later steps move only as much as needed to keep the right order
  const changed = [step]
  const pushedNames = []

  for (let i = index + 1; i < steps.length; i++) {
    const current = steps[i]
    let earliest = earliestNextStart(steps[i - 1], openSundays)

    // Work done outside always starts in shift A
    if (current.outside && earliest.shift === "B") earliest = nextSlot(earliest, openSundays)

    if (slotOf(current.start) < slotOf(earliest)) {
      const currentLength = countSlots(current.start, current.end, openSundays)
      current.start = earliest
      current.end = moveForward(earliest, currentLength - 1, openSundays)
      changed.push(current)
      pushedNames.push(current.name)
    }
  }

  // 6. No clash with other jobs or breakdowns on the machines that are used
  for (const item of changed) {
    if (item.outside) continue

    const other = findClash(
      item.machine,
      item.start,
      item.end,
      blocks,
      (box) => box.soNumber === block.soNumber
    )

    if (other) {
      if (item === step) {
        return fail(`${item.machine} is already used by ${whoUses(other)} at that time.`)
      }
      return fail(
        `This would push ${item.name} onto ${item.machine}, where ${whoUses(other)} is already planned.`
      )
    }
  }

  // 7. All good. Describe what happened.
  const stepText = step.outside ? `${step.name} (${step.machine})` : step.name
  const placeText = step.outside
    ? formatDate(step.start.date)
    : `${step.machine}, ${formatDate(step.start.date)}, shift ${step.start.shift}`

  let summary = `Moved ${block.label} · ${stepText} to ${placeText}.`
  if (pushedNames.length > 0) {
    summary += ` ${pushedNames.join(" and ")} moved later to keep the right order.`
  }

  return { ok: true, kind: "job", soNumber: block.soNumber, newSteps: steps, summary }
}

// Plans the move of a machine breakdown box
export function planDowntimeMove({ block, target, newStart, days, blocks }) {
  if (target.outsideId) return fail("A breakdown cannot be moved to a job printed outside.")

  const groupOf = (machine) => (printMachines.includes(machine) ? "printing" : "finishing")
  if (groupOf(target.machine) !== groupOf(block.machine)) {
    return fail("A breakdown can only be moved within its own schedule (printing or finishing).")
  }

  if (target.machine === block.machine && slotOf(newStart) === slotOf(block.start)) {
    return { ok: true, unchanged: true }
  }

  const openSundays = openSundaysOf(days)
  const length = countSlots(block.start, block.end, openSundays)
  const start = newStart
  const end = moveForward(start, length - 1, openSundays)

  const other = findClash(target.machine, start, end, blocks, (box) => box.id === block.id)
  if (other) {
    return fail(`${target.machine} is already used by ${whoUses(other)} at that time.`)
  }

  return {
    ok: true,
    kind: "downtime",
    index: block.downtimeIndex,
    machine: target.machine,
    start,
    end,
    summary: `Moved ${block.label.toLowerCase()} to ${target.machine}, ${formatDate(start.date)}, shift ${start.shift}.`,
  }
}