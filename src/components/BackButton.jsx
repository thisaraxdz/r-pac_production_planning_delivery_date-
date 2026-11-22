import { useLocation, useNavigate } from "react-router"
import "./BackButton.css"

function BackButton() {
  const navigate = useNavigate()
  const location = useLocation()

  // Goes back to the page the planner came from (for example the schedule board).
  // If this page was the first one opened, there is nothing to go back to, so we go to the home page.
  function goBack() {
    if (location.key === "default") {
      navigate("/")
    } else {
      navigate(-1)
    }
  }

  return (
    <button type="button" className="back-button" onClick={goBack}>
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
        <path
          d="M9 2L4 7l5 5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      Back
    </button>
  )
}

export default BackButton