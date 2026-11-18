import { Routes, Route } from "react-router"
import NavBar from "./components/NavBar"
import OrdersPage from "./pages/OrdersPage"
import OrderDetailPage from "./pages/OrderDetailPage"
import SchedulePage from "./pages/SchedulePage"

function App() {
  return (
    <>
      <NavBar />
      <Routes>
        <Route path="/" element={<OrdersPage />} />
        <Route path="/orders/:soNumber" element={<OrderDetailPage />} />
        <Route path="/schedule" element={<SchedulePage />} />
      </Routes>
    </>
  )
}

export default App