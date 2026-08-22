import { useCallback, useEffect, useRef, useState } from 'react'
import {
  consultarSubstituicoes,
  obterSubstituicao,
  type ConsultaSubstituicoesParams,
  type ConsultaSubstituicoesResponse,
  type SubstituicaoView,
} from '@/services/substituicoes'

// ─────────────────────────────────────────────────────────────────────
// useConsultaSubstituicoes
// ─────────────────────────────────────────────────────────────────────

export interface UseConsultaSubstituicoesResult {
  data: ConsultaSubstituicoesResponse | null
  loading: boolean
  error: string | null
  refresh: () => void
  substituicoes: ConsultaSubstituicoesResponse['substituicoes']
  pagina: number
  porPagina: number
  hasMore: boolean
}

export function useConsultaSubstituicoes(
  params: Omit<ConsultaSubstituicoesParams, 'id'>,
): UseConsultaSubstituicoesResult {
  const latestIdRef = useRef(0)
  const paramsRef = useRef(params)
  paramsRef.current = params
  const paramsKey = JSON.stringify(params)

  const [data, setData] = useState<ConsultaSubstituicoesResponse | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(() => {
    const requestId = ++latestIdRef.current
    setLoading(true)
    consultarSubstituicoes(paramsRef.current)
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
    substituicoes: data?.substituicoes ?? [],
    pagina: data?.pagina ?? 0,
    porPagina: data?.por_pagina ?? 0,
    hasMore: data?.has_more ?? false,
  }
}

// ─────────────────────────────────────────────────────────────────────
// useSubstituicaoView
// ─────────────────────────────────────────────────────────────────────

export interface UseSubstituicaoViewState {
  data: SubstituicaoView | null
  loading: boolean
  error: string | null
  notFound: boolean
}

export interface UseSubstituicaoViewResult extends UseSubstituicaoViewState {
  refresh: () => void
}

export function useSubstituicaoView(id: string | undefined): UseSubstituicaoViewResult {
  const latestIdRef = useRef(0)
  const [refreshToken, setRefreshToken] = useState(0)
  const [state, setState] = useState<UseSubstituicaoViewState>({
    data: null,
    loading: false,
    error: null,
    notFound: false,
  })

  const refresh = useCallback(() => setRefreshToken((t) => t + 1), [])

  useEffect(() => {
    // 1. INVALIDA request do efeito anterior ANTES de qualquer decisão
    ++latestIdRef.current

    // 2. Se id vazio/undefined → notFound, sem request
    if (!id) {
      setState({ data: null, loading: false, error: null, notFound: true })
      return
      // NOTA: o return é antecipado e NÃO registra o cleanup abaixo.
      // Isso é CORRETO: não há request em voo para invalidar,
      // e a invalidação prévia (passo 1) já encerrou qualquer race.
      // O cleanup só é registrado quando o fluxo NÃO entra neste ramo.
    }

    // 3. Reserva requestId exclusivo para este efeito
    const requestId = ++latestIdRef.current
    setState((s) => ({ ...s, loading: true, error: null, notFound: false }))

    obterSubstituicao(id)
      .then((result) => {
        if (requestId !== latestIdRef.current) return
        setState({ data: result, loading: false, error: null, notFound: false })
      })
      .catch((err) => {
        if (requestId !== latestIdRef.current) return
        const is404 =
          (err && typeof err === 'object' && 'status' in err && err.status === 404) ||
          (err &&
            typeof err === 'object' &&
            'response' in err &&
            typeof err.response === 'object' &&
            err.response !== null &&
            'code' in err.response &&
            err.response.code === 404)
        setState({
          data: null,
          loading: false,
          error: is404 ? null : err instanceof Error ? err.message : 'Erro ao carregar',
          notFound: is404,
        })
      })

    // 4. Cleanup: invalida ESTA request quando as dependências mudarem
    return () => {
      ++latestIdRef.current
    }
  }, [id, refreshToken])

  return { ...state, refresh }
}
