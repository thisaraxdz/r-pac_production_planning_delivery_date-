import { useEffect, useLayoutEffect, useRef } from "react"
import { useLocation, useNavigationType } from "react-router"

// How far down each page was scrolled, remembered for every visit (each visit has its own key)
const savedScroll = new Map()

function ScrollManager() {
  const location = useLocation()
  const navigationType = useNavigationType()
  const currentKey = useRef(location.key)

  // While the planner scrolls, remember the position of the page that is open now
  useEffect(() => {
    function remember() {
      savedScroll.set(currentKey.current, window.scrollY)
    }
    window.addEventListener("scroll", remember, { passive: true })
    return () => window.removeEventListener("scroll", remember)
  }, [])

  // When the page changes: a new page starts at the top,
  // and going back returns to the place where the planner was
  useLayoutEffect(() => {
    currentKey.current = location.key

    if (navigationType === "POP") {
      window.scrollTo(0, savedScroll.get(location.key) ?? 0)
    } else {
      window.scrollTo(0, 0)
    }
  }, [location.key, navigationType])

  return null
}

export default ScrollManager