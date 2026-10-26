import { useCallback, useEffect, useState } from 'react'
import type { RoutineDayStateDto } from '../../../../contracts/routine-records'

type DayRead =
  | { readonly key: string; readonly status: 'ready'; readonly data: RoutineDayStateDto }
  | { readonly key: string; readonly status: 'error' }

// Reading a fact never starts/cancels a recording context or changes draft inputs.
export function useRoutineDayState(
  routineId: string,
  capturedOn: string | undefined,
  initialState: RoutineDayStateDto | null | undefined
) {
  const [revision, setRevision] = useState(0)
  const [read, setRead] = useState<DayRead | null>(null)
  const refresh = useCallback(() => setRevision((value) => value + 1), [])
  const supplied =
    initialState?.routineId === routineId && (!capturedOn || initialState.localDate === capturedOn)
      ? initialState
      : null
  const key = `${routineId}:${capturedOn ?? 'current'}:${revision}`

  useEffect(() => {
    if (supplied) return
    let current = true
    void window.myTracer.routines
      .getDayState({ routineId, ...(capturedOn ? { localDate: capturedOn } : {}) })
      .then(
        (result) => {
          if (!current) return
          setRead(
            result.ok ? { key, status: 'ready', data: result.value } : { key, status: 'error' }
          )
        },
        () => {
          if (current) setRead({ key, status: 'error' })
        }
      )
    return () => {
      current = false
    }
  }, [routineId, capturedOn, supplied, key])

  useEffect(() => {
    // An open draft keeps its captured date, including across midnight.
    // Today owns refreshes for its supplied state; standalone details read on
    // focus and once per minute so an idle panel does not keep yesterday's fact.
    if (initialState || capturedOn) return
    window.addEventListener('focus', refresh)
    const timer = window.setInterval(refresh, 60_000)
    return () => {
      window.removeEventListener('focus', refresh)
      window.clearInterval(timer)
    }
  }, [initialState, capturedOn, refresh])

  const current = read?.key === key ? read : null
  return {
    data: supplied ?? (current?.status === 'ready' ? current.data : null),
    status: supplied ? ('ready' as const) : (current?.status ?? ('loading' as const)),
    refresh
  }
}
