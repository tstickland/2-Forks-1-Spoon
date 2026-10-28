import type { User } from 'firebase/auth'
import { createContext, useContext, type ReactNode } from 'react'
import type { Household } from '../domain/types'

interface HouseholdContextValue {
  user: User
  household: Household
}

const HouseholdContext = createContext<HouseholdContextValue | null>(null)

export function HouseholdProvider({ user, household, children }: HouseholdContextValue & { children: ReactNode }) {
  return <HouseholdContext.Provider value={{ user, household }}>{children}</HouseholdContext.Provider>
}

// eslint-disable-next-line react/only-export-components
export function useHouseholdContext(): HouseholdContextValue {
  const value = useContext(HouseholdContext)
  if (!value) throw new Error('useHouseholdContext must be used inside <HouseholdProvider>')
  return value
}
