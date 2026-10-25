import { createContext } from 'react'
import type { AssistantLaunch } from './assistant-controller'
export const AssistantContext = createContext<((launch: AssistantLaunch) => void) | null>(null)
