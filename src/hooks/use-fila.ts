import { useCallback, useEffect, useRef, useState } from 'react'
import {
  getFilaSemCobertura,
  type FilaSemCoberturaParams,
  type FilaSemCoberturaResponse,
} from '@/services/fila'

// ─────────────────────────────────────────────────────────────────────
// useFilaSemCobertura
// ─────────────────────────────────────────────────────────────────────

export interface UseFilaSemCoberturaResult {
  data: FilaSemCoberturaResponse | null
  loading: boolean
  error: string | null
  refresh: () => void
  negocios: FilaSemCoberturaResponse['negocios_sem_cobertura']
  pagina: number
  porPagina: number
  hasMore: boolean
}

export function useFilaSemCobertura(params?: FilaSemCoberturaParams): UseFilaSemCoberturaResult {
  const latestIdRef = useRef(0)
  const paramsRef = useRef(params)
  paramsRef.current = params
  const paramsKey = JSON.stringify(params)

  const [data, setData] = useState<FilaSemCoberturaResponse | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(() => {
    const requestId = ++latestIdRef.current
    setLoading(true)
    getFilaSemCobertura(paramsRef.current)
      .then((result) => {
        if (requestId !== latestIdRef.current) return
        setData(result)
        setError(null)
        setLoading(false)
      })
      .catch((err) => {
        if (requestId !== latestIdRef.current) return
        setError(err instanceof Error ? err.message : 'Erro ao carregar')
        setLoading(false)
      })
  }, [paramsKey])

  useEffect(() => {
    fetchData()
    return () => {
      ++latestIdRef.current
    }
  }, [fetchData])

  return {
    data,
    loading,
    error,
    refresh: fetchData,
    negocios: data?.negocios_sem_cobertura ?? [],
    pagina: data?.pagina ?? 0,
    porPagina: data?.por_pagina ?? 0,
    hasMore: data?.has_more ?? false,
  }
}
