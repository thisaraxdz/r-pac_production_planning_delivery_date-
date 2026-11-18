import { useState } from "react"
import { ScheduleContext } from "./ScheduleContext"
import { orderDetails } from "../data/orderDetails"
import { orders as sampleOrders } from "../data/orders"
import { machineDowntime as sampleDowntime } from "../data/boardData"
import { formatDate, statusFor } from "../utils/scheduleHelpers"

function ScheduleProvider({ children }) {
  // We start from the sample data. Changes made by the planner are kept here.
  const [details, setDetails] = useState(orderDetails)
  const [orders, setOrders] = useState(sampleOrders)
  const [downtime, setDowntime] = useState(sampleDowntime)

  // "edited" says whether the order page shows the "edited by the planner" note
  function saveSteps(soNumber, steps, edited = true) {
    setDetails((current) => ({
      ...current,
      [soNumber]: { ...current[soNumber], steps, editedByPlanner: edited },
    }))
  }

  // Changes one machine breakdown (its machine, start or end)
  function moveDowntime(index, changes) {
    setDowntime((current) =>
      current.map((item, i) => (i === index ? { ...item, ...changes } : item))
    )
  }

  // The planner accepts a date. It becomes the recommended date of that order.
  function acceptDate(soNumber, isoDate) {
    const dateText = formatDate(isoDate)

    // If this date is in the chance list we know its chance. If not, the chance is null (unknown).
    const found = details[soNumber].chances.find((item) => item.date === dateText)
    const chance = found ? found.chance : null

    setOrders((current) =>
      current.map((order) =>
        order.soNumber === Number(soNumber)
          ? {
              ...order,
              // Remember the system's own date the first time, so we can still warn later
              systemRecommended: order.systemRecommended ?? order.recommended,
              recommended: dateText,
              chance,
              status: statusFor(order.requested, isoDate, chance),
              acceptedByPlanner: true,
            }
          : order
      )
    )
  }

  return (
    <ScheduleContext.Provider
      value={{ details, orders, downtime, saveSteps, acceptDate, moveDowntime }}
    >
      {children}
    </ScheduleContext.Provider>
  )
}

export default ScheduleProvider