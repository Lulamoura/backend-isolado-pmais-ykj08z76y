import { useCallback, useEffect, useRef, useState } from 'react'
import {
  getDashboardResumo,
  type DashboardResumoParams,
  type DashboardResumoResponse,
} from '@/services/dashboard'

export interface UseDashboardResumoResult {
  data: DashboardResumoResponse | null
  loading: boolean
  error: string | null
  refresh: () => void
}

export function useDashboardResumo(params: DashboardResumoParams = {}): UseDashboardResumoResult {
  const latestRequestRef = useRef(0)
  const paramsKey = JSON.stringify(params)

  const [data, setData] = useState<DashboardResumoResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const invalidateRequests = useCallback(() => {
    ++latestRequestRef.current
  }, [])

  const fetchData = useCallback(() => {
    const requestId = ++latestRequestRef.current
    setLoading(true)
    setError(null)

    getDashboardResumo(JSON.parse(paramsKey) as DashboardResumoParams)
      .then((result) => {
        if (requestId !== latestRequestRef.current) return
        setData(result)
        setLoading(false)
      })
      .catch((err) => {
        if (requestId !== latestRequestRef.current) return
        setError(err instanceof Error ? err.message : 'Erro ao carregar o dashboard')
        setLoading(false)
      })
  }, [paramsKey])

  useEffect(() => {
    fetchData()
    return invalidateRequests
  }, [fetchData, invalidateRequests])

  return { data, loading, error, refresh: fetchData }
}
