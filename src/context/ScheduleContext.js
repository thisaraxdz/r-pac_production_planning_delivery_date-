import { createContext, useContext } from "react"

export const ScheduleContext = createContext(null)

// Any page calls useSchedule() to read or change the shared order data
export function useSchedule() {
  return useContext(ScheduleContext)
}