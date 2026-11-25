import { useEffect, useMemo, useRef, useState } from "react"
import { Link, useNavigate } from "react-router"
import { useSchedule } from "../context/ScheduleContext"
import { downloadPlanningWorkbook } from "../utils/excelExport"
import { SAMPLE_TODAY } from "../utils/scheduleHelpers"
import StatusTag from "../components/StatusTag"
import "./OrdersPage.css"
import "./OrdersTools.css"

const PAGE_SIZES = [25, 50, 100]
const SAMPLE_COUNT = 5000

// The text the search looks in, for one order
function searchTextOf(order) {
  return [
    order.soNumber,
    `so ${order.soNumber}`,
    order.reference,
    order.customer,
    order.type,
    order.requested,
    order.recommended,
    order.status,
  ]
    .join(" ")
    .toLowerCase()
}

function TrashIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M6 6l1 14h10l1-14" />
      <path d="M10 10v6" />
      <path d="M14 10v6" />
    </svg>
  )
}

function OrdersPage() {
  const navigate = useNavigate()
  const { orders, details, deleteOrders, restoreOrders, loadSample, resetSample } = useSchedule()

  // The Excel download: "exporting" is true while the file is being made
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState("")

  // Search, pages and selection
  const [query, setQuery] = useState("")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [selectMode, setSelectMode] = useState(false) // true after the planner presses "Select"
  const [selected, setSelected] = useState(() => new Set())

  // Deleting: "confirm" is the question being asked, "notice" is the message with Undo
  const [confirm, setConfirm] = useState(null)
  const [notice, setNotice] = useState(null)

  const dialogRef = useRef(null)
  const headerCheckRef = useRef(null)

  // The search texts are rebuilt only when the orders change
  const searchTexts = useMemo(() => orders.map(searchTextOf), [orders])

  // The orders that match the search. Every word typed must be found.
  const matches = useMemo(() => {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
    if (terms.length === 0) return orders
    return orders.filter((order, index) => terms.every((term) => searchTexts[index].includes(term)))
  }, [orders, searchTexts, query])

  // The rows of the page being shown
  const totalPages = Math.max(1, Math.ceil(matches.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const firstIndex = (currentPage - 1) * pageSize
  const pageRows = matches.slice(firstIndex, firstIndex + pageSize)
  const firstShown = matches.length === 0 ? 0 : firstIndex + 1
  const lastShown = firstIndex + pageRows.length

  // Selection facts
  const allPageSelected = pageRows.length > 0 && pageRows.every((order) => selected.has(order.soNumber))
  const somePageSelected = pageRows.some((order) => selected.has(order.soNumber))
  const allMatchingSelected = matches.length > 0 && matches.every((order) => selected.has(order.soNumber))

  // The three cards are counted from all orders
  const totalOrders = orders.length
  const confirmedOrders = orders.filter((order) => order.status === "Met").length
  const notConfirmedOrders = totalOrders - confirmedOrders

  // The header checkbox shows a dash when only some rows of the page are selected
  useEffect(() => {
    if (headerCheckRef.current) {
      headerCheckRef.current.indeterminate = somePageSelected && !allPageSelected
    }
  }, [somePageSelected, allPageSelected, selectMode])

  // Opens or closes the "Are you sure?" window
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (confirm && !dialog.open) dialog.showModal()
    if (!confirm && dialog.open) dialog.close()
  }, [confirm])

  // The message with Undo disappears after 15 seconds
  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(null), 15000)
    return () => clearTimeout(timer)
  }, [notice])

  // ---- Search and pages ----

  function changeQuery(value) {
    setQuery(value)
    setPage(1)
  }

  function changePageSize(value) {
    setPageSize(Number(value))
    setPage(1)
  }

  // ---- Selecting ----

  function startSelecting() {
    setSelectMode(true)
  }

  function stopSelecting() {
    setSelectMode(false)
    setSelected(new Set())
  }

  function toggleOne(soNumber) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(soNumber)) next.delete(soNumber)
      else next.add(soNumber)
      return next
    })
  }

  function togglePage() {
    setSelected((current) => {
      const next = new Set(current)
      pageRows.forEach((order) => {
        if (allPageSelected) next.delete(order.soNumber)
        else next.add(order.soNumber)
      })
      return next
    })
  }

  function selectAllMatching() {
    setSelected(new Set(matches.map((order) => order.soNumber)))
  }

  function clearSelection() {
    setSelected(new Set())
  }

  // A click on a row: in select mode it ticks the row, otherwise it opens the order
  function clickRow(soNumber) {
    if (selectMode) toggleOne(soNumber)
    else navigate(`/orders/${soNumber}`)
  }

  // ---- Deleting ----

  function askDelete(ids) {
    if (ids.length === 0) return

    const single = ids.length === 1 ? orders.find((order) => order.soNumber === ids[0]) : null

    setConfirm({
      ids,
      title: single ? `Delete SO ${single.soNumber}?` : `Delete ${ids.length.toLocaleString()} orders?`,
      message: single
        ? `${single.customer}. Its delivery date and its steps on the schedule board will be removed. You can undo it right after.`
        : "Their delivery dates and their steps on the schedule board will be removed. You can undo it right after.",
    })
  }

  function runDelete() {
    const ids = confirm.ids
    const snapshot = deleteOrders(ids)

    setSelected((current) => {
      const next = new Set(current)
      ids.forEach((id) => next.delete(id))
      return next
    })
    setConfirm(null)
    setNotice({
      text: `Deleted ${ids.length.toLocaleString()} order${ids.length === 1 ? "" : "s"}.`,
      undo: () => restoreOrders(snapshot),
    })
  }

  function undoDelete() {
    notice.undo()
    setNotice({ text: "Undone. The orders are back." })
  }

  // ---- Test data ----

  function loadTestOrders() {
    loadSample(SAMPLE_COUNT)
    setQuery("")
    setPage(1)
    setSelected(new Set())
    setNotice({ text: `Loaded ${SAMPLE_COUNT.toLocaleString()} sample orders for testing.` })
  }

  function backToSmallSample() {
    resetSample()
    setQuery("")
    setPage(1)
    setSelected(new Set())
    setNotice({ text: "Back to the 6 sample orders." })
  }

  // ---- Excel ----

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
          <p className="subtitle">Offset non-RFID orders · Sample data</p>
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

      {notice && (
        <div className="orders-notice" role="status">
          <span>{notice.text}</span>
          <span className="orders-notice-actions">
            {notice.undo && (
              <button type="button" className="orders-notice-button" onClick={undoDelete}>
                Undo
              </button>
            )}
            <button type="button" className="orders-notice-button" onClick={() => setNotice(null)}>
              Close
            </button>
          </span>
        </div>
      )}

      <div className="summary-cards">
        <div className="card summary-card">
          <span className="summary-label">No of Orders</span>
          <span className="summary-value">{totalOrders.toLocaleString()}</span>
        </div>
        <div className="card summary-card">
          <span className="summary-label">Confirmed</span>
          <span className="summary-value">{confirmedOrders.toLocaleString()}</span>
        </div>
        <div className="card summary-card">
          <span className="summary-label">Not confirmed</span>
          <span className="summary-value">{notConfirmedOrders.toLocaleString()}</span>
        </div>
      </div>

      <div className="orders-toolbar">
        <div className="orders-search">
          <input
            type="text"
            value={query}
            onChange={(event) => changeQuery(event.target.value)}
            placeholder="Search SO number, reference, customer, date or status"
            aria-label="Search orders"
          />
          {query !== "" && (
            <button
              type="button"
              className="icon-button orders-search-clear"
              aria-label="Clear the search"
              onClick={() => changeQuery("")}
            >
              ×
            </button>
          )}
        </div>
        <span className="orders-count">
          {matches.length === orders.length
            ? `${orders.length.toLocaleString()} orders`
            : `${matches.length.toLocaleString()} of ${orders.length.toLocaleString()} orders match`}
        </span>
        <button
          type="button"
          className={selectMode ? "btn-secondary select-toggle select-toggle-on" : "btn-secondary select-toggle"}
          aria-pressed={selectMode}
          onClick={selectMode ? stopSelecting : startSelecting}
        >
          {selectMode ? "Done" : "Select"}
        </button>
      </div>

      {selectMode && (
        <div className="bulk-bar">
          <span>
            {selected.size === 0 ? (
              "Tick the orders you want to delete."
            ) : (
              <>
                <b>{selected.size.toLocaleString()}</b> selected
              </>
            )}
          </span>
          {allPageSelected && matches.length > pageRows.length && !allMatchingSelected && (
            <button type="button" className="link-button" onClick={selectAllMatching}>
              Select all {matches.length.toLocaleString()} orders that match
            </button>
          )}
          {allMatchingSelected && matches.length > pageRows.length && (
            <span>All {matches.length.toLocaleString()} matching orders are selected.</span>
          )}
          <span className="bulk-actions">
            <button
              type="button"
              className="btn-danger"
              disabled={selected.size === 0}
              onClick={() => askDelete([...selected])}
            >
              Delete selected
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={selected.size === 0}
              onClick={clearSelection}
            >
              Clear selection
            </button>
          </span>
        </div>
      )}

      <div className="card table-card orders-table-card">
        <table className="orders-table">
          <colgroup>
            {selectMode && <col className="col-check" />}
            <col className="col-order" />
            <col className="col-reference" />
            <col />
            <col className="col-type" />
            <col className="col-requested" />
            <col className="col-recommended" />
            <col className="col-chance" />
            <col className="col-status" />
            <col className="col-delete" />
          </colgroup>
          <thead>
            <tr>
              {selectMode && (
                <th className="check-cell">
                  <input
                    type="checkbox"
                    ref={headerCheckRef}
                    checked={allPageSelected}
                    onChange={togglePage}
                    aria-label="Select all orders on this page"
                  />
                </th>
              )}
              <th>Order</th>
              <th>Reference</th>
              <th>Customer</th>
              <th>Type</th>
              <th>Requested</th>
              <th>Recommended</th>
              <th>Chance of meeting it</th>
              <th>Status</th>
              <th className="delete-cell">
                <span className="visually-hidden">Delete</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 && (
              <tr>
                <td colSpan={selectMode ? 10 : 9} className="empty-cell">
                  {orders.length === 0
                    ? "There are no orders. You can load test orders below."
                    : "No orders match your search."}
                </td>
              </tr>
            )}

            {pageRows.map((order) => (
              <tr
                key={order.soNumber}
                className={selected.has(order.soNumber) ? "row-selected" : ""}
                onClick={() => clickRow(order.soNumber)}
              >
                {selectMode && (
                  <td className="check-cell" onClick={(event) => event.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected.has(order.soNumber)}
                      onChange={() => toggleOne(order.soNumber)}
                      aria-label={`Select SO ${order.soNumber}`}
                    />
                  </td>
                )}
                <td>
                  <Link
                    to={`/orders/${order.soNumber}`}
                    className="so-link"
                    onClick={(event) => event.stopPropagation()}
                  >
                    SO {order.soNumber}
                  </Link>
                </td>
                <td className="reference-cell">{order.reference}</td>
                <td>{order.customer}</td>
                <td>{order.type}</td>
                <td className="date-cell">{order.requested}</td>
                <td className="date-cell recommended">{order.recommended}</td>
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
                <td className="delete-cell" onClick={(event) => event.stopPropagation()}>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Delete SO ${order.soNumber}`}
                    title="Delete this order"
                    onClick={() => askDelete([order.soNumber])}
                  >
                    <TrashIcon />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="pagination">
        <span>
          Showing {firstShown.toLocaleString()} to {lastShown.toLocaleString()} of{" "}
          {matches.length.toLocaleString()} orders
        </span>
        <span className="pagination-controls">
          <label className="pagination-size">
            <span>Rows per page</span>
            <select value={pageSize} onChange={(event) => changePageSize(event.target.value)}>
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setPage(1)}
            disabled={currentPage === 1}
          >
            First
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setPage(currentPage - 1)}
            disabled={currentPage === 1}
          >
            Previous
          </button>
          <span>
            Page {currentPage.toLocaleString()} of {totalPages.toLocaleString()}
          </span>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setPage(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            Next
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setPage(totalPages)}
            disabled={currentPage === totalPages}
          >
            Last
          </button>
        </span>
      </div>

      <div className="test-data">
        <span>Test data:</span>
        <button type="button" className="btn-secondary" onClick={loadTestOrders}>
          Load {SAMPLE_COUNT.toLocaleString()} sample orders
        </button>
        <button type="button" className="btn-secondary" onClick={backToSmallSample}>
          Back to the 6 sample orders
        </button>
      </div>

      <dialog ref={dialogRef} className="confirm-dialog" onClose={() => setConfirm(null)}>
        {confirm && (
          <>
            <h2>{confirm.title}</h2>
            <p>{confirm.message}</p>
            <div className="confirm-actions">
              <button type="button" className="btn-secondary" onClick={() => setConfirm(null)}>
                Cancel
              </button>
              <button type="button" className="btn-danger" onClick={runDelete}>
                Delete
              </button>
            </div>
          </>
        )}
      </dialog>
    </div>
  )
}

export default OrdersPage