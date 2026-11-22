import { Routes, Route, useLocation } from "react-router"
import BackButton from "./components/BackButton"
import NavBar from "./components/NavBar"
import ScrollManager from "./components/ScrollManager"
import OrdersPage from "./pages/OrdersPage"
import OrderDetailPage from "./pages/OrderDetailPage"
import SchedulePage from "./pages/SchedulePage"

function App() {
  const { pathname } = useLocation()

  // The Back button is shown on every page except the home page (Delivery dates)
  const showBack = pathname !== "/"

  return (
    <div className="app-shell">
      <ScrollManager />
      <NavBar />

      {showBack && (
        <div className="back-row">
          <BackButton />
        </div>
      )}

      <Routes>
        <Route path="/" element={<OrdersPage />} />
        <Route path="/orders/:soNumber" element={<OrderDetailPage />} />
        <Route path="/schedule" element={<SchedulePage />} />
      </Routes>
    </div>
  )
}

export default App