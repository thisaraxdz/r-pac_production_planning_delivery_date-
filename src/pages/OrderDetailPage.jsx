import { useEffect, useRef, useState } from "react"
import { Link, useParams } from "react-router"
import { machinesByStep, outsourcePrinters, printMachines } from "../data/machines"
import { useSchedule } from "../context/ScheduleContext"
import {
  SAMPLE_TODAY,
  describeStep,
  formatDate,
  formatStepTime,
  shortDateToIso,
  validateSteps,
} from "../utils/scheduleHelpers"
import StatusTag from "../components/StatusTag"
import "./OrderDetailPage.css"
import "./OrderDetailChooseDate.css"

const SAFETY_GAP_HOURS = 12

const LABEL_BY_STATUS = {
  "Met": "Requested date met",
  "At risk": "Requested date at risk",
  "Not met": "Requested date not met",
}

// The machine dropdown of one step. It lists only the machines that can do that kind of work.
function MachineSelect({ step, onChange }) {
  return (
    <label className="field">
      <span>Machine</span>
      <select value={step.machine} onChange={(event) => onChange(event.target.value)}>
        {step.type === "printing" ? (
          <>
            <optgroup label="In the factory">
              {printMachines.map((machine) => (
                <option key={machine} value={machine}>
                  {machine}
                </option>
              ))}
            </optgroup>
            <optgroup label="Outside (dates only)">
              {outsourcePrinters.map((company) => (
                <option key={company} value={company}>
                  {company}
                </option>
              ))}
            </optgroup>
          </>
        ) : (
          machinesByStep[step.type].map((machine) => (
            <option key={machine} value={machine}>
              {machine}
            </option>
          ))
        )}
      </select>
    </label>
  )
}

// One line of inputs: a date and (usually) a shift. It is used for both "From" and "To".
function TimeFields({ label, stepName, point, onChange, showShift = true }) {
  return (
    <div className="time-fields">
      <span className="time-label">{label}</span>
      <input
        type="date"
        value={point.date}
        onChange={(event) => onChange("date", event.target.value)}
        aria-label={`${stepName} ${label} date`}
      />
      {showShift && (
        <select
          value={point.shift}
          onChange={(event) => onChange("shift", event.target.value)}
          aria-label={`${stepName} ${label} shift`}
        >
          <option value="A">Shift A</option>
          <option value="B">Shift B</option>
        </select>
      )}
    </div>
  )
}

function OrderDetailPage() {
  // The address gives the SO number as text (for example "2003")
  const { soNumber } = useParams()
  const { details: allDetails, orders, saveSteps, acceptDate } = useSchedule()

  // Editing the steps: "draft" is the copy being edited. null means we are not editing.
  const [draft, setDraft] = useState(null)
  const [problems, setProblems] = useState([])

  // Choosing another date
  const [choosing, setChoosing] = useState(false) // true while the calendar panel is open
  const [pickedDate, setPickedDate] = useState("") // the date in the calendar box
  const [chosenDate, setChosenDate] = useState("") // the date picked but not accepted yet ("" = none)
  const dateInputRef = useRef(null) // a handle to the calendar box, so we can open it

  // When the panel opens, put the cursor in the box and show the calendar
  useEffect(() => {
    if (!choosing) return
    const input = dateInputRef.current
    if (!input) return
    input.focus()
    try {
      input.showPicker()
    } catch {
      // Some browsers do not allow this. The planner can click the box instead.
    }
  }, [choosing])

  // In the data the SO number is a number, so we convert before comparing
  const order = orders.find((item) => item.soNumber === Number(soNumber))
  const details = allDetails[soNumber]

  if (!order || !details) {
    return (
      <div className="page">
        <h1>Order not found</h1>
        <p className="subtitle">There is no order with the number {soNumber}.</p>
        <p>
          <Link to="/" className="back-link">Go back to Delivery dates</Link>
        </p>
      </div>
    )
  }

  // ---- Editing the steps ----

  function startEditing() {
    // We copy the steps, so nothing changes until the planner presses Save
    setDraft(structuredClone(details.steps))
    setProblems([])
  }

  function cancelEditing() {
    setDraft(null)
    setProblems([])
  }

  function saveEditing() {
    const found = validateSteps(draft)
    if (found.length > 0) {
      setProblems(found)
      return
    }
    saveSteps(soNumber, draft)
    setDraft(null)
    setProblems([])
  }

  // Change the machine of one step. Choosing an outside company switches to dates only.
  function changeMachine(index, machine) {
    const outside = outsourcePrinters.includes(machine)
    setDraft((current) =>
      current.map((step, i) => {
        if (i !== index) return step
        const updated = { ...step, machine, outside }
        if (outside) {
          // Whole days: shift A on the first day to shift B on the last day
          updated.start = { ...step.start, shift: "A" }
          updated.end = { ...step.end, shift: "B" }
        }
        return updated
      })
    )
  }

  // Change the date or the shift of the start ("start") or the end ("end") of one step
  function changePoint(index, which, field, value) {
    setDraft((current) =>
      current.map((step, i) =>
        i === index ? { ...step, [which]: { ...step[which], [field]: value } } : step
      )
    )
  }

  // ---- Dates ----

  const year = SAMPLE_TODAY.slice(0, 4)

  // The current recommended date as "2026-11-18", so it can be compared with the calendar date
  const recommendedIso = shortDateToIso(order.recommended, year)

  // The earliest date the schedule allows (the system's own date, kept even after the planner accepts another)
  const systemText = order.systemRecommended ?? order.recommended
  const systemIso = shortDateToIso(systemText, year)

  function openCalendar() {
    setPickedDate(chosenDate || recommendedIso)
    setChoosing(true)
  }

  function applyChosenDate() {
    setChosenDate(pickedDate)
    setChoosing(false)
  }

  function backToRecommended() {
    setChosenDate("")
  }

  // Accept: the chosen date (or the recommended date, if none was chosen) is saved
  function acceptSelectedDate() {
    acceptDate(soNumber, chosenDate || recommendedIso)
    setChosenDate("")
    setChoosing(false)
  }

  const pickedIsValid = pickedDate !== "" && pickedDate >= SAMPLE_TODAY
  const chosenText = chosenDate ? formatDate(chosenDate) : ""
  const chosenChance = details.chances.find((item) => item.date === chosenText)
  const earlierThanSystem = chosenDate !== "" && chosenDate < systemIso
  const acceptedAlready = order.acceptedByPlanner && chosenDate === ""
  const acceptedEarlier = order.acceptedByPlanner && recommendedIso < systemIso

  return (
    <div className="page">
      <h1>
        SO {order.soNumber} · {order.customer} · {order.type}
      </h1>

      <div className="detail-grid">
        <div className="detail-column">
          <div className="card detail-card">
            <h2>Recommended date</h2>
            <div className="date-row">
              <span className="big-date">{order.recommended}</span>
              <StatusTag status={order.status} label={LABEL_BY_STATUS[order.status]} />
            </div>

            {acceptedAlready && !choosing && (
              <>
                <div className="accepted-note">Date accepted by the planner.</div>
                {order.chance === null && (
                  <p className="accepted-extra">
                    The chance for this date has not been calculated yet.
                  </p>
                )}
                {acceptedEarlier && (
                  <p className="choose-warning">
                    This is earlier than the earliest date the schedule allows ({systemText}).
                    The plan must change to meet it.
                  </p>
                )}
              </>
            )}

            {chosenDate !== "" && !choosing && (
              <div className="choose-result">
                <p className="choose-line">
                  <span>
                    Your chosen date: <b>{chosenText}</b>
                  </span>
                  <button type="button" className="choose-link" onClick={backToRecommended}>
                    Back to recommended date
                  </button>
                </p>
                <p className="choose-line">
                  {chosenChance
                    ? `Chance of finishing by this date: ${chosenChance.chance}%`
                    : "The chance for this date has not been calculated yet."}
                </p>
                {earlierThanSystem && (
                  <p className="choose-warning">
                    This is earlier than the earliest date the schedule allows ({systemText}).
                    To meet it, the plan would have to change.
                  </p>
                )}
              </div>
            )}

            <div className="button-row">
              <button
                className="btn-primary"
                type="button"
                onClick={acceptSelectedDate}
                disabled={acceptedAlready}
              >
                {acceptedAlready ? "Date accepted" : `Accept ${chosenText || order.recommended}`}
              </button>
              <button className="btn-secondary" type="button" onClick={openCalendar}>
                Choose another date
              </button>
            </div>

            {choosing && (
              <div className="choose-panel">
                <label className="choose-label" htmlFor="chosen-date">
                  Pick a date from the calendar
                </label>
                <input
                  id="chosen-date"
                  ref={dateInputRef}
                  type="date"
                  min={SAMPLE_TODAY}
                  value={pickedDate}
                  onChange={(event) => setPickedDate(event.target.value)}
                />
                <div className="choose-actions">
                  <button className="btn-secondary" type="button" onClick={() => setChoosing(false)}>
                    Cancel
                  </button>
                  <button
                    className="btn-primary"
                    type="button"
                    onClick={applyChosenDate}
                    disabled={!pickedIsValid}
                  >
                    Use this date
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="card detail-card">
            <div className="card-head">
              <h2>Steps in the schedule</h2>
              <div className="card-actions">
                {draft === null ? (
                  <button className="btn-secondary" type="button" onClick={startEditing}>
                    Edit steps
                  </button>
                ) : (
                  <>
                    <button className="btn-secondary" type="button" onClick={cancelEditing}>
                      Cancel
                    </button>
                    <button className="btn-primary" type="button" onClick={saveEditing}>
                      Save changes
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="step-list">
              {draft === null
                ? details.steps.map((step) => (
                    <div className="step-row" key={step.id}>
                      <span>{describeStep(step)}</span>
                      <b>{formatStepTime(step)}</b>
                    </div>
                  ))
                : draft.map((step, index) => (
                    <div className="edit-step" key={step.id}>
                      <div className="edit-step-head">
                        <b>{step.name}</b>
                        <MachineSelect
                          step={step}
                          onChange={(machine) => changeMachine(index, machine)}
                        />
                      </div>
                      {step.outside && (
                        <p className="note">Done outside the factory: only dates are needed.</p>
                      )}
                      <div className="edit-times">
                        <TimeFields
                          label="From"
                          stepName={step.name}
                          point={step.start}
                          showShift={!step.outside}
                          onChange={(field, value) => changePoint(index, "start", field, value)}
                        />
                        <TimeFields
                          label="To"
                          stepName={step.name}
                          point={step.end}
                          showShift={!step.outside}
                          onChange={(field, value) => changePoint(index, "end", field, value)}
                        />
                      </div>
                    </div>
                  ))}

              <div className="step-row">
                <span>Safety gap before dispatch</span>
                <b>{SAFETY_GAP_HOURS} hours</b>
              </div>
            </div>

            {problems.length > 0 && (
              <div className="problems" role="alert">
                <b>Please fix this before saving:</b>
                <ul>
                  {problems.map((problem) => (
                    <li key={problem}>{problem}</li>
                  ))}
                </ul>
              </div>
            )}

            {draft === null && details.editedByPlanner && (
              <p className="edited-note">
                Steps edited by the planner. The recommended date and the chances have not been
                re-calculated yet.
              </p>
            )}
          </div>
        </div>

        <div className="card detail-card">
          <h2>Chance of finishing by each date</h2>
          <p className="note">1,000 simulated runs · sample numbers</p>
          {details.chances.map((item) => {
            const isRecommended = item.date === order.recommended
            return (
              <div className="chance-row" key={item.date}>
                <span className={isRecommended ? "chance-label strong" : "chance-label"}>
                  {item.date}
                  {isRecommended && (
                    <>
                      <br />
                      (recommended)
                    </>
                  )}
                </span>
                <div className="chance-track">
                  <div className="chance-fill" style={{ width: `${item.chance}%` }} />
                </div>
                <span className="chance-value">{item.chance}%</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default OrderDetailPage