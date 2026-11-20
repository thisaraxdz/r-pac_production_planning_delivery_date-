import { useState } from "react"
import { Link, useNavigate } from "react-router"
import { useSchedule } from "../context/ScheduleContext"
import { downloadPlanningWorkbook } from "../utils/excelExport"
import { SAMPLE_TODAY } from "../utils/scheduleHelpers"
import StatusTag from "../components/StatusTag"
import "./OrdersPage.css"

function OrdersPage() {
  const navigate = useNavigate()
  const { orders, details } = useSchedule()

  // The Excel download: "exporting" is true while the file is being made
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState("")

  // The three cards are counted from the table data, so they always match it
  const totalOrders = orders.length
  const confirmedOrders = orders.filter((order) => order.status === "Met").length
  const notConfirmedOrders = totalOrders - confirmedOrders

  // Saves the planning schedule as an Excel file
  async function downloadSchedule() {
    if (exporting) return
    setExporting(true)
    setExportError("")

    try {
      await downloadPlanningWorkbook({ orders, details, planDate: SAMPLE_TODAY })
    } catch (error) {
      console.error(error)
      setExportError(
        "Sorry, the Excel file could not be created. Please check that the library is installed (npm install exceljs)."
      )
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="page">
      <div className="orders-header">
        <div>
          <h1>Delivery dates</h1>
          <p className="subtitle">
            Thursday 12 November 2026 · Offset non-RFID orders · Sample data
          </p>
        </div>
        <button
          className="btn-primary"
          type="button"
          onClick={downloadSchedule}
          title="Download the planning schedule as an Excel file"
        >
          {exporting ? "Preparing the file..." : "Download Excel"}
        </button>
      </div>

      {exportError && (
        <div className="problems" role="alert">
          {exportError}
        </div>
      )}

      <div className="summary-cards">
        <div className="card summary-card">
          <span className="summary-label">No of Orders</span>
          <span className="summary-value">{totalOrders}</span>
        </div>
        <div className="card summary-card">
          <span className="summary-label">Confirmed</span>
          <span className="summary-value">{confirmedOrders}</span>
        </div>
        <div className="card summary-card">
          <span className="summary-label">Not confirmed</span>
          <span className="summary-value">{notConfirmedOrders}</span>
        </div>
      </div>

      <div className="card table-card">
        <table className="orders-table">
          <thead>
            <tr>
              <th>Order</th>
              <th>Customer</th>
              <th>Type</th>
              <th>Requested</th>
              <th>Recommended</th>
              <th>Chance of meeting it</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr
                key={order.soNumber}
                onClick={() => navigate(`/orders/${order.soNumber}`)}
              >
                <td>
                  <Link
                    to={`/orders/${order.soNumber}`}
                    className="so-link"
                    onClick={(event) => event.stopPropagation()}
                  >
                    SO {order.soNumber}
                  </Link>
                </td>
                <td>{order.customer}</td>
                <td>{order.type}</td>
                <td>{order.requested}</td>
                <td className="recommended">{order.recommended}</td>
                <td>
                  {order.chance === null ? (
                    <span style={{ color: "#4b5563" }}>Not calculated yet</span>
                  ) : (
                    <div className="chance">
                      <b>{order.chance}%</b>
                      <div className="chance-bar">
                        <div
                          className="chance-bar-fill"
                          style={{ width: `${order.chance}%` }}
                        />
                      </div>
                    </div>
                  )}
                </td>
                <td>
                  <StatusTag status={order.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default OrdersPage