/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   useFetch — Generic data fetching hook
   Returns { data, loading, error, reload }
   Guarantees independent state per widget so one failure
   never blanks the whole dashboard.
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
import { useState, useEffect, useCallback, useRef } from 'react'
import { errorMessage } from '../api/client'

export function useFetch(fetcher, deps = []) {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  // Track mounted state to avoid updating state on unmounted components
  const isMounted = useRef(true)

  const execute = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await fetcher()
      if (isMounted.current) {
        setData(result)
      }
    } catch (err) {
      if (isMounted.current) {
        setError(errorMessage(err))
      }
    } finally {
      if (isMounted.current) {
        setLoading(false)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => {
    isMounted.current = true
    execute()
    return () => {
      isMounted.current = false
    }
  }, [execute])

  return { data, loading, error, reload: execute }
}

