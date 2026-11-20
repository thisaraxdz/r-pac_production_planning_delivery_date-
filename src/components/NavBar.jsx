import { Link, useLocation } from "react-router"
import { formatLongDate, todayIso } from "../utils/scheduleHelpers"
import "./NavBar.css"

function NavBar() {
  const { pathname } = useLocation()

  // The "Delivery dates" tab stays highlighted on the list and on every SO profile
  const onDeliveryDates = pathname === "/" || pathname.startsWith("/orders")
  const onSchedule = pathname.startsWith("/schedule")

  return (
    <>
      <header className="app-header">
        <span className="app-title">Delivery Date Dashboard</span>
        <span className="app-date">{formatLongDate(todayIso())}</span>
      </header>

      <nav className="navbar" aria-label="Main">
        <Link to="/" className={onDeliveryDates ? "nav-tab active" : "nav-tab"}>
          Delivery dates
        </Link>
        <Link to="/schedule" className={onSchedule ? "nav-tab active" : "nav-tab"}>
          Schedule board
        </Link>
      </nav>
    </>
  )
}

export default NavBar