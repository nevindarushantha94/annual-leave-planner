import { useCallback, useEffect, useState } from 'react'
import { fetchLeavePeriods, subscribeToLeavePeriods } from '../lib/leaveApi'

export function useLeavePeriods() {
  const [periods, setPeriods] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    try {
      const data = await fetchLeavePeriods()
      setPeriods(data)
      setError(null)
    } catch (e) {
      setError(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
    const unsubscribe = subscribeToLeavePeriods(refresh)
    return unsubscribe
  }, [refresh])

  return { periods, loading, error, refresh }
}
