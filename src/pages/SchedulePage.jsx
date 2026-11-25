import { Fragment, useMemo, useRef, useState } from "react"
import { Link } from "react-router"
import { finishingGroups, printMachines, stepNames } from "../data/machines"
import { lockedPrinting } from "../data/boardData"
import { useSchedule } from "../context/ScheduleContext"
import { buildBoard } from "../utils/boardHelpers"
import { addDays, pointFromSlot } from "../utils/calendarHelpers"
import { planDowntimeMove, planJobMove } from "../utils/moveHelpers"
import { formatDate, todayIso } from "../utils/scheduleHelpers"
import "./SchedulePage.css"
import "./BoardControls.css"

// How many days the board shows at a time
const WINDOW_DAYS = 14

function LockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <rect x="2" y="5.5" width="8" height="5.5" rx="1" fill="currentColor" />
      <path d="M4 5.5V4a2 2 0 0 1 4 0v1.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  )
}

// Chooses the look of a box: its colour comes from the kind of step
function barClassName(block, hasClash) {
  let name = "job-bar"
  if (block.kind === "downtime") {
    name += " job-bar-down"
  } else {
    name += ` job-bar-${block.stepType}`
    if (block.locked) name += " job-bar-locked"
  }
  if (hasClash) name += " job-bar-clash"
  return name
}

// One box on the board: a job (a link to its SO profile) or a machine breakdown
function Bar({ block, hasClash, slotCount, onDragStart, onDragEnd }) {
  const position = {
    left: `${(block.startSlot / slotCount) * 100}%`,
    width: `${((block.endSlot - block.startSlot + 1) / slotCount) * 100}%`,
  }
  const className = barClassName(block, hasClash)

  if (block.kind === "downtime") {
    return (
      <div
        className={className}
        style={position}
        title={`${block.label} (drag to move)`}
        draggable
        onDragStart={(event) => onDragStart(block, event)}
        onDragEnd={onDragEnd}
      >
        <span className="bar-text">{block.label}</span>
      </div>
    )
  }

  const canDrag = !block.locked

  return (
    <Link
      to={`/orders/${block.soNumber}`}
      className={className}
      style={position}
      title={`${block.label} · ${block.stepName}${canDrag ? " (drag to move)" : " (locked)"}`}
      draggable={canDrag}
      onDragStart={canDrag ? (event) => onDragStart(block, event) : undefined}
      onDragEnd={canDrag ? onDragEnd : undefined}
    >
      {block.locked && <LockIcon />}
      <span className="bar-text">{block.label}</span>
    </Link>
  )
}

// The row with the days and shifts, shown at the top of each schedule
function DayHeader({ days }) {
  return (
    <div className="board-row board-head">
      <div className="machine-cell" />
      <div className="day-row" style={{ gridTemplateColumns: `repeat(${days.length}, 1fr)` }}>
        {days.map((day) => (
          <div className="day-cell" key={day}>
            {formatDate(day)}
            <div className="shift-row">
              <span>Shift A</span>
              <span>Shift B</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// A small heading row inside a schedule, for example "Varnish"
function GroupHeading({ title }) {
  return (
    <div className="board-row group-row">
      <div className="machine-cell group-label">{title}</div>
      <div />
    </div>
  )
}

// One machine with its boxes. Boxes can be dropped on its track.
function MachineRow({
  target,
  boxes,
  conflictIds,
  slotCount,
  preview,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}) {
  const rowKey = target.outsideId ?? target.machine

  return (
    <div className="board-row">
      <div className="machine-cell machine-name">{target.machine}</div>
      <div
        className="board-track"
        style={{ backgroundSize: `${100 / slotCount}% 100%` }}
        onDragOver={(event) => onDragOver(target, event)}
        onDrop={(event) => onDrop(target, event)}
      >
        {boxes.map((block) => (
          <Bar
            key={block.id}
            block={block}
            hasClash={conflictIds.has(block.id)}
            slotCount={slotCount}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
          />
        ))}

        {preview && preview.rowKey === rowKey && (
          <div
            className={preview.ok ? "drop-preview drop-preview-ok" : "drop-preview drop-preview-bad"}
            style={{
              left: `${(preview.startSlot / slotCount) * 100}%`,
              width: `${(preview.length / slotCount) * 100}%`,
            }}
          />
        )}
      </div>
    </div>
  )
}

function SchedulePage() {
  const { details, orders, downtime, saveSteps, moveDowntime } = useSchedule()

  // dragRef remembers which box is being dragged and where it was grabbed
  const dragRef = useRef(null)
  // preview: the place under the mouse while dragging (green = allowed, red = not allowed)
  const [preview, setPreview] = useState(null)
  // notice: the message shown after a drop
  const [notice, setNotice] = useState(null)
  // The first day of the window. "" means: start at the first planned job.
  const [windowStart, setWindowStart] = useState("")

  // The board is rebuilt only when the data or the window changes (not while dragging)
  const board = useMemo(
    () =>
      buildBoard({
        orders,
        details,
        lockedPrinting,
        machineDowntime: downtime,
        windowStart,
        windowDays: WINDOW_DAYS,
      }),
    [orders, details, downtime, windowStart]
  )
  const { days, blocks, allBlocks, conflictIds, messages } = board

  if (days.length === 0) {
    return (
      <div className="page">
        <h1>Schedule board</h1>
        <p className="subtitle">There are no jobs to show.</p>
      </div>
    )
  }

  const slotCount = days.length * 2

  // The jobs that are printed outside the factory
  const outsideBlocks = blocks.filter((block) => block.outside)

  // The boxes of one machine (jobs and breakdowns), not counting jobs printed outside
  function boxesOf(machine) {
    return blocks.filter((block) => block.machine === machine && !block.outside)
  }

  // A normal machine row accepts boxes for that machine
  function machineTarget(machine) {
    return { machine, outsideId: null }
  }

  // ---- Moving the window ----

  function moveWindow(dayCount) {
    setWindowStart(addDays(board.windowStart, dayCount))
  }

  // ---- Drag and drop ----

  function startDrag(block, event) {
    // Where inside the box did the planner take hold? (counted in shifts)
    const boxRect = event.currentTarget.getBoundingClientRect()
    const trackRect = event.currentTarget.parentElement.getBoundingClientRect()
    const slotWidth = trackRect.width / slotCount
    const length = block.endSlot - block.startSlot + 1
    const grabSlots = Math.min(Math.max(Math.floor((event.clientX - boxRect.left) / slotWidth), 0), length - 1)

    dragRef.current = { block, grabSlots }
    event.dataTransfer.effectAllowed = "move"
    event.dataTransfer.setData("text/plain", block.id)
    setNotice(null)
  }

  function endDrag() {
    dragRef.current = null
    setPreview(null)
  }

  // Works out what would happen if the box were dropped under the mouse now
  function planFor(target, event) {
    const drag = dragRef.current
    if (!drag) return null

    const { block, grabSlots } = drag
    const length = block.endSlot - block.startSlot + 1
    const trackRect = event.currentTarget.getBoundingClientRect()
    const slotWidth = trackRect.width / slotCount
    const cursorSlot = Math.floor((event.clientX - trackRect.left) / slotWidth)
    const startSlot = cursorSlot - grabSlots
    const shownStart = Math.min(Math.max(startSlot, 0), Math.max(slotCount - length, 0))

    if (startSlot < 0 || startSlot + length > slotCount) {
      return {
        plan: { ok: false, reason: "That is outside the days shown on the board." },
        shownStart,
        length,
      }
    }

    const newStart = pointFromSlot(days, startSlot)

    // The move is checked against ALL boxes, also the ones outside the days shown
    const plan =
      block.kind === "downtime"
        ? planDowntimeMove({ block, target, newStart, days, blocks: allBlocks })
        : planJobMove({
            block,
            target,
            newStart,
            days,
            orderSteps: details[block.soNumber].steps,
            blocks: allBlocks,
          })

    return { plan, shownStart, length }
  }

  function handleDragOver(target, event) {
    if (!dragRef.current) return
    event.preventDefault()
    event.dataTransfer.dropEffect = "move"

    const result = planFor(target, event)
    const next = {
      rowKey: target.outsideId ?? target.machine,
      startSlot: result.shownStart,
      length: result.length,
      ok: result.plan.ok,
      reason: result.plan.ok ? "" : result.plan.reason,
    }

    // Only update when something changed, so the page does not redraw for nothing
    setPreview((current) =>
      current &&
      current.rowKey === next.rowKey &&
      current.startSlot === next.startSlot &&
      current.ok === next.ok &&
      current.reason === next.reason
        ? current
        : next
    )
  }

  function handleDrop(target, event) {
    if (!dragRef.current) return
    event.preventDefault()

    const drag = dragRef.current
    const result = planFor(target, event)
    dragRef.current = null
    setPreview(null)

    if (!result) return
    const { plan } = result

    // Not allowed: nothing changes, and the box stays where it was
    if (!plan.ok) {
      setNotice({ kind: "error", text: plan.reason })
      return
    }
    if (plan.unchanged) return

    if (plan.kind === "job") {
      const before = details[plan.soNumber]
      saveSteps(plan.soNumber, plan.newSteps)
      setNotice({
        kind: "ok",
        text: plan.summary,
        undo: () => saveSteps(plan.soNumber, before.steps, before.editedByPlanner ?? false),
      })
    } else {
      const before = {
        machine: drag.block.machine,
        start: drag.block.start,
        end: drag.block.end,
      }
      moveDowntime(plan.index, { machine: plan.machine, start: plan.start, end: plan.end })
      setNotice({
        kind: "ok",
        text: plan.summary,
        undo: () => moveDowntime(plan.index, before),
      })
    }
  }

  function undoLastMove() {
    notice.undo()
    setNotice({ kind: "ok", text: "The move was undone." })
  }

  // The properties every row needs for dragging and dropping
  const dragProps = {
    conflictIds,
    slotCount,
    preview,
    onDragStart: startDrag,
    onDragEnd: endDrag,
    onDragOver: handleDragOver,
    onDrop: handleDrop,
  }

  const shownMessages = messages.slice(0, 8)

  return (
    <div className="page">
      <h1>Schedule board</h1>
      <p className="subtitle">Printing and finishing · Sample data</p>

      <div className="board-controls">
        <button className="btn-secondary" type="button" onClick={() => moveWindow(-7)}>
          Previous week
        </button>
        <button className="btn-secondary" type="button" onClick={() => moveWindow(7)}>
          Next week
        </button>
        <button className="btn-secondary" type="button" onClick={() => setWindowStart(todayIso())}>
          Today
        </button>
        <button className="btn-secondary" type="button" onClick={() => setWindowStart("")}>
          First job
        </button>
        <label className="board-goto">
          <span>Go to</span>
          <input
            type="date"
            value={board.windowStart}
            onChange={(event) => {
              if (event.target.value) setWindowStart(event.target.value)
            }}
          />
        </label>
        <span className="board-range">
          Showing {formatDate(days[0])} to {formatDate(days[days.length - 1])}
        </span>
      </div>

      <div className="legend">
        {Object.entries(stepNames).map(([type, name]) => (
          <span className="legend-item" key={type}>
            <span className={`swatch swatch-${type}`} />
            {name}
          </span>
        ))}
        <span className="legend-item">
          <span className="swatch swatch-locked" />
          Locked (already running)
        </span>
        <span className="legend-item">
          <span className="swatch swatch-down" />
          Machine down
        </span>
      </div>

      <div className="move-bar-wrap">
        {preview ? (
          <div className={preview.ok ? "move-bar move-bar-ok" : "move-bar move-bar-bad"} role="status">
            {preview.ok ? "Release to move the box here." : preview.reason}
          </div>
        ) : notice ? (
          <div
            className={notice.kind === "ok" ? "move-bar move-bar-ok" : "move-bar move-bar-bad"}
            role={notice.kind === "ok" ? "status" : "alert"}
          >
            <span>{notice.text}</span>
            <span className="move-bar-actions">
              {notice.undo && (
                <button type="button" className="move-bar-button" onClick={undoLastMove}>
                  Undo
                </button>
              )}
              <button type="button" className="move-bar-button" onClick={() => setNotice(null)}>
                Close
              </button>
            </span>
          </div>
        ) : (
          <div className="move-bar move-bar-idle">
            Drag a box to another slot or machine to move it. Click a box to open its order.
          </div>
        )}
      </div>

      {messages.length > 0 && (
        <div className="clash-box" role="alert">
          <b>Machine clashes found (red rings):</b>
          <ul>
            {shownMessages.map((message) => (
              <li key={message}>{message}</li>
            ))}
            {messages.length > shownMessages.length && (
              <li>and {messages.length - shownMessages.length} more</li>
            )}
          </ul>
          <span>Open the order and change its machine, date or shift.</span>
        </div>
      )}

      <div className="board-scroll">
        <div className="board-wide" style={{ minWidth: 130 + days.length * 170 }}>
          <section className="board-section">
            <h2 className="board-title">Printing schedule</h2>
            <div className="card board-card">
              <DayHeader days={days} />

              {printMachines.map((machine) => (
                <MachineRow
                  key={machine}
                  target={machineTarget(machine)}
                  boxes={boxesOf(machine)}
                  {...dragProps}
                />
              ))}

              {outsideBlocks.length > 0 && (
                <>
                  <GroupHeading title="Printed outside" />
                  {outsideBlocks.map((block) => (
                    <MachineRow
                      key={block.id}
                      target={{ machine: block.machine, outsideId: block.id }}
                      boxes={[block]}
                      {...dragProps}
                    />
                  ))}
                </>
              )}
            </div>
          </section>

          <section className="board-section">
            <h2 className="board-title">Finishing schedule</h2>
            <div className="card board-card">
              <DayHeader days={days} />

              {finishingGroups.map((group) => (
                <Fragment key={group.step}>
                  {group.machines.length > 1 && <GroupHeading title={group.title} />}
                  {group.machines.map((machine) => (
                    <MachineRow
                      key={machine}
                      target={machineTarget(machine)}
                      boxes={boxesOf(machine)}
                      {...dragProps}
                    />
                  ))}
                </Fragment>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

export default SchedulePage