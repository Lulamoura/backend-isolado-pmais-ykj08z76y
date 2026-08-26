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
      return <Badge variant="default">Vigente</Badge>
    case 'futura':
      return <Badge variant="secondary">Futura</Badge>
    case 'encerrada':
      return <Badge variant="outline">Encerrada</Badge>
    case 'cancelada':
      return <Badge variant="destructive">Cancelada</Badge>
    default:
      return <Badge variant="outline">{situacao}</Badge>
  }
}

function TipoCoberturaBadge({ tipo }: { tipo: SubstituicaoItem['tipo_cobertura'] }) {
  switch (tipo) {
    case 'integral':
      return <Badge variant="secondary">Integral</Badge>
    case 'por_negocios':
      return <Badge variant="default">Por Negócios</Badge>
    default:
      return <Badge variant="outline">{tipo}</Badge>
  }
}

function MotivoBadge({ motivo }: { motivo: SubstituicaoItem['motivo'] }) {
  switch (motivo) {
    case 'ferias':
      return <Badge variant="secondary">Férias</Badge>
    case 'licenca':
      return <Badge variant="outline">Licença</Badge>
    case 'falta':
      return <Badge variant="destructive">Falta</Badge>
    default:
      return <Badge variant="outline">{motivo}</Badge>
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
    <div className="container mx-auto py-8 px-4 max-w-7xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Substituições</h1>
          <p className="text-sm text-muted-foreground">Consulta de substituições comerciais</p>
        </div>
        {podeCriar && (
          <Link to="/substituicoes/nova">
            <Button className="gap-1.5">
              <Plus className="h-4 w-4" />
              Nova substituição
            </Button>
          </Link>
        )}
      </div>

      {!MUTATIONS_ENABLED && (
        <Alert>
          <AlertTitle>Consulta disponível; gestão ainda não ativada</AlertTitle>
          <AlertDescription>
            A listagem permanece disponível para consulta. A criação e o ajuste estão bloqueados
            durante a pré-operação e serão liberados após o gate funcional específico desta rotina.
          </AlertDescription>
        </Alert>
      )}

      {/* Filtros */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="filtro-situacao" className="text-xs text-muted-foreground">
                Situação
              </Label>
              <Select
                value={situacao ?? 'todas'}
                onValueChange={(v) => handleSetParam('situacao', v === 'todas' ? undefined : v)}
              >
                <SelectTrigger id="filtro-situacao" className="w-[180px]">
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
              <Label htmlFor="filtro-ordenacao" className="text-xs text-muted-foreground">
                Ordenar por
              </Label>
              <Select
                value={ordenarPor ?? 'default'}
                onValueChange={(v) =>
                  handleSetParam('ordenar_por', v === 'default' ? undefined : v)
                }
              >
                <SelectTrigger id="filtro-ordenacao" className="w-[180px]">
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
              <Label htmlFor="filtro-ordem" className="text-xs text-muted-foreground">
                Ordem
              </Label>
              <Select
                value={ordem ?? 'default'}
                onValueChange={(v) => handleSetParam('ordem', v === 'default' ? undefined : v)}
              >
                <SelectTrigger id="filtro-ordem" className="w-[180px]">
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
            <Button variant="outline" size="sm" onClick={refresh}>
              Tentar novamente
            </Button>
          </div>
        </Alert>
      )}

      {/* Conteúdo */}
      {!error && (
        <Card>
          <CardContent className="p-0">
            {loading && (
              <p className="sr-only" role="status" aria-live="polite">
                Carregando substituições
              </p>
            )}
            <Table scrollContainerLabel="Tabela de substituições — deslize horizontalmente para ver todas as colunas">
              <TableHeader>
                <TableRow>
                  <TableHead>Titular</TableHead>
                  <TableHead>Substituto Principal</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead className="w-[60px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={`skeleton-${i}`}>
                      <TableCell>
                        <Skeleton className="h-4 w-[120px]" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-[120px]" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-[160px]" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-[80px] rounded-full" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-[70px] rounded-full" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-[80px] rounded-full" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-4" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : substituicoes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <SearchX className="h-8 w-8" />
                        <span className="text-sm">Nenhuma substituição encontrada.</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  substituicoes.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.titular?.name ?? '—'}</TableCell>
                      <TableCell>{item.substituto_principal?.name ?? '—'}</TableCell>
                      <TableCell>{formatPeriodo(item.data_inicio, item.data_fim)}</TableCell>
                      <TableCell>
                        <TipoCoberturaBadge tipo={item.tipo_cobertura} />
                      </TableCell>
                      <TableCell>
                        <MotivoBadge motivo={item.motivo} />
                      </TableCell>
                      <TableCell>
                        <SituacaoBadge situacao={item.situacao} />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
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
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={handlePaginaAnterior} disabled={pagina <= 1}>
            Anterior
          </Button>
          <span className="text-sm text-muted-foreground">Página {pagina === 0 ? 1 : pagina}</span>
          <Button variant="outline" size="sm" onClick={handlePaginaProxima} disabled={!hasMore}>
            Próximo
          </Button>
        </div>
      )}
    </div>
  )
}
