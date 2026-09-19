import { useMemo } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { Eye, Plus, SearchX } from 'lucide-react'

import { useConsultaSubstituicoes } from '@/hooks/use-substituicoes'
import { useIsSuperAdmin } from '@/hooks/use-is-superadmin'
import { MUTATIONS_ENABLED } from '@/lib/feature-flags'
import { formatDateOnly } from '@/lib/date-only'
import type { SubstituicaoItem } from '@/services/substituicoes'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

// ─────────────────────────────────────────────────────────────────────
// Normalização de search params
// ─────────────────────────────────────────────────────────────────────

const SITUACOES_VALIDAS = new Set(['futura', 'vigente', 'encerrada', 'cancelada'])
const ORDENAR_POR_VALIDOS = new Set(['data_inicio', 'data_fim', 'created'])
const ORDEM_VALIDOS = new Set(['asc', 'desc'])

function formatPeriodo(inicio: string, fim: string): string {
  return `${formatDateOnly(inicio)} – ${formatDateOnly(fim)}`
}

function SituacaoBadge({ situacao }: { situacao: SubstituicaoItem['situacao'] }) {
  switch (situacao) {
    case 'vigente':
      return (
        <Badge
          variant="outline"
          className="rounded-full border-emerald-200/60 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700"
        >
          Vigente
        </Badge>
      )
    case 'futura':
      return (
        <Badge
          variant="outline"
          className="rounded-full border-sky-200/60 bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700"
        >
          Futura
        </Badge>
      )
    case 'encerrada':
      return (
        <Badge
          variant="outline"
          className="rounded-full border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600"
        >
          Encerrada
        </Badge>
      )
    case 'cancelada':
      return (
        <Badge
          variant="outline"
          className="rounded-full border-rose-200/60 bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-700"
        >
          Cancelada
        </Badge>
      )
    default:
      return (
        <Badge
          variant="outline"
          className="rounded-full border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600"
        >
          {situacao}
        </Badge>
      )
  }
}

function TipoCoberturaBadge({ tipo }: { tipo: SubstituicaoItem['tipo_cobertura'] }) {
  switch (tipo) {
    case 'integral':
      return (
        <Badge
          variant="outline"
          className="rounded-full border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-700"
        >
          Integral
        </Badge>
      )
    case 'por_negocios':
      return (
        <Badge
          variant="outline"
          className="rounded-full border-violet-200/60 bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700"
        >
          Por Negócios
        </Badge>
      )
    default:
      return (
        <Badge
          variant="outline"
          className="rounded-full border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600"
        >
          {tipo}
        </Badge>
      )
  }
}

function MotivoBadge({ motivo }: { motivo: SubstituicaoItem['motivo'] }) {
  switch (motivo) {
    case 'ferias':
      return (
        <Badge
          variant="outline"
          className="rounded-full border-sky-200/60 bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700"
        >
          Férias
        </Badge>
      )
    case 'licenca':
      return (
        <Badge
          variant="outline"
          className="rounded-full border-amber-200/60 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700"
        >
          Licença
        </Badge>
      )
    case 'falta':
      return (
        <Badge
          variant="outline"
          className="rounded-full border-rose-200/60 bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-700"
        >
          Falta
        </Badge>
      )
    case 'suporte_interno':
      return (
        <Badge
          variant="outline"
          className="rounded-full border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-700"
        >
          Suporte Interno
        </Badge>
      )
    default:
      return (
        <Badge
          variant="outline"
          className="rounded-full border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600"
        >
          {motivo}
        </Badge>
      )
  }
}

const NOVA_ALLOWLIST = new Set([
  'superadministrador',
  'gestor',
  'gestor-comercial',
  'operador-comercial',
  'prospeccao',
])

export default function SubstituicoesLista() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const { perfilSlug } = useIsSuperAdmin()

  const podeCriar = MUTATIONS_ENABLED && !!perfilSlug && NOVA_ALLOWLIST.has(perfilSlug)

  const situacaoRaw = searchParams.get('situacao')
  const situacao =
    situacaoRaw && SITUACOES_VALIDAS.has(situacaoRaw)
      ? (situacaoRaw as 'futura' | 'vigente' | 'encerrada' | 'cancelada')
      : undefined

  const paginaRaw = searchParams.get('pagina')
  const paginaNum = paginaRaw ? Number(paginaRaw) : NaN
  const pagina = Number.isFinite(paginaNum) && paginaNum > 0 ? Math.floor(paginaNum) : 1

  const porPaginaRaw = searchParams.get('por_pagina')
  const porPaginaNum = porPaginaRaw ? Number(porPaginaRaw) : NaN
  const porPagina =
    Number.isFinite(porPaginaNum) && porPaginaNum > 0 ? Math.floor(porPaginaNum) : 20

  const ordenarPorRaw = searchParams.get('ordenar_por')
  const ordenarPor =
    ordenarPorRaw && ORDENAR_POR_VALIDOS.has(ordenarPorRaw)
      ? (ordenarPorRaw as 'data_inicio' | 'data_fim' | 'created')
      : undefined

  const ordemRaw = searchParams.get('ordem')
  const ordem = ordemRaw && ORDEM_VALIDOS.has(ordemRaw) ? (ordemRaw as 'asc' | 'desc') : undefined

  const params = useMemo(
    () => ({
      situacao,
      pagina,
      por_pagina: porPagina,
      ordenar_por: ordenarPor,
      ordem,
    }),
    [situacao, pagina, porPagina, ordenarPor, ordem],
  )

  const { substituicoes, loading, error, refresh, hasMore } = useConsultaSubstituicoes(params)

  const handleSetParam = (key: string, value: string | undefined) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value === undefined || value === '') {
          next.delete(key)
        } else {
          next.set(key, value)
        }
        // Mudança de filtro/ordenação reinicia a paginação
        if (key !== 'pagina' && key !== 'por_pagina') {
          next.delete('pagina')
        }
        return next
      },
      { replace: false },
    )
  }

  const handlePaginaAnterior = () => {
    if (pagina <= 1) return
    handleSetParam('pagina', String(pagina - 1))
  }

  const handlePaginaProxima = () => {
    if (!hasMore) return
    handleSetParam('pagina', String(pagina + 1))
  }

  const irParaDetalhe = (item: SubstituicaoItem) => {
    navigate(`/substituicoes/${item.id}`, {
      state: { returnTo: `/substituicoes?${searchParams.toString()}` },
    })
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <section className="flex flex-wrap items-end justify-between gap-4 rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Operação Comercial · Coberturas
          </p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Substituições</h2>
          <p className="mt-1.5 max-w-2xl text-sm text-slate-600">
            Consulta e acompanhamento de substituições comerciais e coberturas de atendimento.
          </p>
        </div>
        {podeCriar && (
          <Link to="/substituicoes/nova">
            <Button className="gap-2 bg-slate-900 hover:bg-slate-800 text-white shadow-sm font-medium">
              <Plus className="h-4 w-4" />
              Nova substituição
            </Button>
          </Link>
        )}
      </section>

      {!MUTATIONS_ENABLED && (
        <Alert className="border-amber-200/80 bg-amber-50/70 text-amber-900">
          <AlertTitle className="text-sm font-semibold text-amber-900">
            Consulta disponível; gestão ainda não ativada
          </AlertTitle>
          <AlertDescription className="text-xs text-amber-800">
            A listagem permanece disponível para consulta. A criação e o ajuste estão bloqueados
            durante a pré-operação e serão liberados após o gate funcional específico desta rotina.
          </AlertDescription>
        </Alert>
      )}

      {/* Filtros */}
      <Card className="rounded-xl border border-slate-200/80 bg-white shadow-sm">
        <CardContent className="p-4 bg-slate-50/60 rounded-xl">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor="filtro-situacao"
                className="text-xs font-semibold uppercase tracking-wider text-slate-500"
              >
                Situação
              </Label>
              <Select
                value={situacao ?? 'todas'}
                onValueChange={(v) => handleSetParam('situacao', v === 'todas' ? undefined : v)}
              >
                <SelectTrigger
                  id="filtro-situacao"
                  className="w-[180px] h-9 border-slate-200 bg-white text-xs font-medium text-slate-800 shadow-sm"
                >
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  <SelectItem value="futura">Futura</SelectItem>
                  <SelectItem value="vigente">Vigente</SelectItem>
                  <SelectItem value="encerrada">Encerrada</SelectItem>
                  <SelectItem value="cancelada">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor="filtro-ordenacao"
                className="text-xs font-semibold uppercase tracking-wider text-slate-500"
              >
                Ordenar por
              </Label>
              <Select
                value={ordenarPor ?? 'default'}
                onValueChange={(v) =>
                  handleSetParam('ordenar_por', v === 'default' ? undefined : v)
                }
              >
                <SelectTrigger
                  id="filtro-ordenacao"
                  className="w-[180px] h-9 border-slate-200 bg-white text-xs font-medium text-slate-800 shadow-sm"
                >
                  <SelectValue placeholder="Padrão" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Padrão</SelectItem>
                  <SelectItem value="data_inicio">Data Início</SelectItem>
                  <SelectItem value="data_fim">Data Fim</SelectItem>
                  <SelectItem value="created">Criação</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor="filtro-ordem"
                className="text-xs font-semibold uppercase tracking-wider text-slate-500"
              >
                Ordem
              </Label>
              <Select
                value={ordem ?? 'default'}
                onValueChange={(v) => handleSetParam('ordem', v === 'default' ? undefined : v)}
              >
                <SelectTrigger
                  id="filtro-ordem"
                  className="w-[180px] h-9 border-slate-200 bg-white text-xs font-medium text-slate-800 shadow-sm"
                >
                  <SelectValue placeholder="Padrão" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Padrão</SelectItem>
                  <SelectItem value="asc">Ascendente</SelectItem>
                  <SelectItem value="desc">Descendente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Erro */}
      {error && !loading && (
        <Alert variant="destructive" role="alert">
          <AlertTitle>Erro ao carregar</AlertTitle>
          <AlertDescription>
            Não foi possível carregar os dados. Verifique sua conexão e tente novamente.
          </AlertDescription>
          <div className="mt-3">
            <Button
              variant="outline"
              size="sm"
              onClick={refresh}
              className="border-rose-200 bg-white text-rose-700 hover:bg-rose-50"
            >
              Tentar novamente
            </Button>
          </div>
        </Alert>
      )}

      {/* Conteúdo encapsulado */}
      {!error && (
        <Card className="rounded-xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
          <CardContent className="p-0">
            {loading && (
              <p className="sr-only" role="status" aria-live="polite">
                Carregando substituições
              </p>
            )}
            <Table scrollContainerLabel="Tabela de substituições — deslize horizontalmente para ver todas as colunas">
              <TableHeader>
                <TableRow className="bg-slate-50/60 hover:bg-slate-50/60 border-b border-slate-200/80">
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 py-3.5">
                    Titular
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 py-3.5">
                    Substituto Principal
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 py-3.5">
                    Período
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 py-3.5">
                    Tipo
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 py-3.5">
                    Motivo
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 py-3.5">
                    Situação
                  </TableHead>
                  <TableHead className="w-[60px] text-xs font-semibold uppercase tracking-wider text-slate-500 py-3.5 text-right">
                    Ações
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={`skeleton-${i}`} className="border-b border-slate-100">
                      <TableCell className="py-3.5">
                        <Skeleton className="h-4 w-[120px]" />
                      </TableCell>
                      <TableCell className="py-3.5">
                        <Skeleton className="h-4 w-[120px]" />
                      </TableCell>
                      <TableCell className="py-3.5">
                        <Skeleton className="h-4 w-[160px]" />
                      </TableCell>
                      <TableCell className="py-3.5">
                        <Skeleton className="h-5 w-[80px] rounded-full" />
                      </TableCell>
                      <TableCell className="py-3.5">
                        <Skeleton className="h-5 w-[70px] rounded-full" />
                      </TableCell>
                      <TableCell className="py-3.5">
                        <Skeleton className="h-5 w-[80px] rounded-full" />
                      </TableCell>
                      <TableCell className="py-3.5 text-right">
                        <Skeleton className="h-4 w-4 ml-auto" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : substituicoes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-14">
                      <div className="flex flex-col items-center gap-3">
                        <span className="rounded-full bg-slate-100 p-3 text-slate-500">
                          <SearchX className="h-6 w-6" />
                        </span>
                        <div>
                          <p className="text-base font-semibold text-slate-900">
                            Nenhuma substituição encontrada
                          </p>
                          <p className="text-sm text-slate-500 mt-0.5">
                            Nenhum registro corresponde aos filtros selecionados.
                          </p>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  substituicoes.map((item) => (
                    <TableRow
                      key={item.id}
                      className="border-b border-slate-100 transition-colors hover:bg-slate-50/50"
                    >
                      <TableCell className="py-3.5 font-semibold text-slate-900">
                        {item.titular?.name ?? '—'}
                      </TableCell>
                      <TableCell className="py-3.5 text-sm text-slate-700">
                        {item.substituto_principal?.name ?? '—'}
                      </TableCell>
                      <TableCell className="py-3.5 text-xs text-slate-600 font-medium">
                        {formatPeriodo(item.data_inicio, item.data_fim)}
                      </TableCell>
                      <TableCell className="py-3.5">
                        <TipoCoberturaBadge tipo={item.tipo_cobertura} />
                      </TableCell>
                      <TableCell className="py-3.5">
                        <MotivoBadge motivo={item.motivo} />
                      </TableCell>
                      <TableCell className="py-3.5">
                        <SituacaoBadge situacao={item.situacao} />
                      </TableCell>
                      <TableCell className="py-3.5 text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
                          aria-label="Ver detalhes da substituição"
                          onClick={() => irParaDetalhe(item)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Paginação */}
      {!error && !loading && substituicoes.length > 0 && (
        <div className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-sm">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePaginaAnterior}
            disabled={pagina <= 1}
            className="border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-sm"
          >
            Anterior
          </Button>
          <span className="text-xs font-medium text-slate-500">
            Página <span className="font-semibold text-slate-800">{pagina === 0 ? 1 : pagina}</span>
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={handlePaginaProxima}
            disabled={!hasMore}
            className="border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-sm"
          >
            Próximo
          </Button>
        </div>
      )}
    </div>
  )
}
