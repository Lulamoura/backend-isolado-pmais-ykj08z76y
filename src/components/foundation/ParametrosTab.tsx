import { useState, useEffect } from 'react'
import { useRealtime } from '@/hooks/use-realtime'
import { getParametros, updateParametro } from '@/services/foundation'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Plus,
  Pencil,
  History,
  Ban,
  CheckCircle,
  Eye,
  ChevronDown,
  Settings2,
  ShieldAlert,
} from 'lucide-react'
import { ParametroForm } from './ParametroForm'
import { ParametroVersionHistory } from './ParametroVersionHistory'
import { ParametroDetail } from './ParametroDetail'
import { ParametroAmigavelCard } from './ParametroAmigavelCard'
import { BannerPropostaCard } from './BannerPropostaCard'
import { CHAVES_AMIGAVEIS, GRUPOS_PARAMETROS_AMIGAVEIS } from './parametros-amigaveis'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import type { RecordModel } from 'pocketbase'

export function ParametrosTab() {
  const { user } = useAuth()
  const [records, setRecords] = useState<RecordModel[]>([])
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<RecordModel | null>(null)
  const [histOpen, setHistOpen] = useState(false)
  const [histId, setHistId] = useState<string | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailParam, setDetailParam] = useState<RecordModel | null>(null)
  const [avancadoOpen, setAvancadoOpen] = useState(false)

  const load = async () => setRecords(await getParametros())
  useEffect(() => {
    load()
  }, [])
  useRealtime('com_parametros', () => {
    load()
  })

  const openNew = () => {
    setEditing(null)
    setFormOpen(true)
  }
  const openEdit = (r: RecordModel) => {
    setEditing(r)
    setFormOpen(true)
  }
  const openHistory = (id: string) => {
    setHistId(id)
    setHistOpen(true)
  }
  const openDetail = (r: RecordModel) => {
    setDetailParam(r)
    setDetailOpen(true)
  }

  const toggleAtivo = async (r: RecordModel) => {
    const action = r.ativo ? 'inativar' : 'ativar'
    const justificativa = prompt(`Justificativa para ${action} este parâmetro:`)
    if (!justificativa) return
    await updateParametro(r.id, {
      ativo: !r.ativo,
      autor_id: user?.id,
      data_hora: new Date().toISOString(),
      justificativa,
    })
  }

  const parametrosPorChave = new Map(records.map((record) => [String(record.chave), record]))
  const parametrosTecnicos = records.filter((record) => !CHAVES_AMIGAVEIS.has(String(record.chave)))

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-slate-900">Configurações e Parâmetros</h2>
        <p className="mt-1 text-xs text-slate-500">
          Ajuste as regras operacionais do aplicativo por assunto. Cada alteração exige
          justificativa e histórico permanente.
        </p>
      </div>

      {GRUPOS_PARAMETROS_AMIGAVEIS.map((grupo) => {
        const parametrosDisponiveis = grupo.parametros
          .map((definicao) => ({ definicao, parametro: parametrosPorChave.get(definicao.chave) }))
          .filter(
            (
              item,
            ): item is { definicao: (typeof grupo.parametros)[number]; parametro: RecordModel } =>
              Boolean(item.parametro),
          )

        if (!parametrosDisponiveis.length) return null

        return (
          <section key={grupo.id} className="space-y-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Grupo de Parâmetros
              </p>
              <h3 className="text-base font-semibold text-slate-900">{grupo.titulo}</h3>
              <p className="text-xs text-slate-500">{grupo.descricao}</p>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              {grupo.id === 'propostas' && <BannerPropostaCard />}
              {parametrosDisponiveis.map(({ definicao, parametro }) => (
                <ParametroAmigavelCard
                  key={definicao.chave}
                  definicao={definicao}
                  parametro={parametro}
                  autorId={user?.id}
                  onUpdated={load}
                  onDetails={() => openDetail(parametro)}
                  onHistory={() => openHistory(parametro.id)}
                />
              ))}
            </div>
          </section>
        )
      })}

      <Collapsible open={avancadoOpen} onOpenChange={setAvancadoOpen}>
        <div className="rounded-xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              className="flex h-auto w-full justify-between px-5 py-4 hover:bg-slate-50"
            >
              <span className="flex items-center gap-3 text-left">
                <Settings2 className="h-5 w-5 text-slate-500" />
                <span>
                  <span className="block font-semibold text-slate-900">
                    Configurações técnicas avançadas
                  </span>
                  <span className="block text-xs font-normal text-slate-500">
                    Chaves internas, integrações, versões e parâmetros descontinuados
                  </span>
                </span>
              </span>
              <ChevronDown
                className={`h-4 w-4 text-slate-500 transition-transform ${avancadoOpen ? 'rotate-180' : ''}`}
              />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4 border-t border-slate-100 p-5 bg-slate-50/40">
            <Alert variant="destructive" className="border-rose-200 bg-rose-50/60 text-rose-800">
              <ShieldAlert className="h-4 w-4 text-rose-600" />
              <AlertTitle className="font-semibold text-rose-900">Área técnica</AlertTitle>
              <AlertDescription className="text-rose-700 text-xs">
                Alterações incorretas podem interromper integrações e rotinas do sistema. Use esta
                área somente quando houver orientação técnica.
              </AlertDescription>
            </Alert>
            <div className="flex justify-end">
              <Button
                onClick={openNew}
                size="sm"
                variant="outline"
                className="border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-sm font-medium"
              >
                <Plus className="mr-1 h-4 w-4" />
                Adicionar parâmetro técnico
              </Button>
            </div>
            <div className="rounded-lg border border-slate-200/80 bg-white overflow-hidden shadow-sm">
              <Table>
                <TableHeader className="bg-slate-50/60">
                  <TableRow className="border-slate-200/80">
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Chave técnica
                    </TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Valor interno
                    </TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Tipo
                    </TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Versão
                    </TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Ativo
                    </TableHead>
                    <TableHead className="text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Ações
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parametrosTecnicos.map((r) => (
                    <TableRow key={r.id} className="border-slate-100 hover:bg-slate-50/50">
                      <TableCell className="font-mono text-xs font-medium text-slate-900">
                        {r.chave}
                      </TableCell>
                      <TableCell className="text-slate-500 font-mono text-xs">{r.valor}</TableCell>
                      <TableCell className="text-slate-500 text-xs">{r.tipo || '-'}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="rounded-full border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-700"
                        >
                          v{r.versao}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                            r.ativo
                              ? 'border-emerald-200/60 bg-emerald-50 text-emerald-700'
                              : 'border-slate-200/60 bg-slate-100 text-slate-600'
                          }`}
                        >
                          {r.ativo ? 'Sim' : 'Não'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openDetail(r)}
                          title="Detalhes"
                          className="text-slate-600 hover:text-slate-900"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openHistory(r.id)}
                          title="Histórico"
                          className="text-slate-600 hover:text-slate-900"
                        >
                          <History className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(r)}
                          title="Editar"
                          className="text-slate-600 hover:text-slate-900"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleAtivo(r)}
                          title={r.ativo ? 'Inativar' : 'Ativar'}
                          className="text-slate-600 hover:text-slate-900"
                        >
                          {r.ativo ? (
                            <Ban className="h-4 w-4 text-amber-500" />
                          ) : (
                            <CheckCircle className="h-4 w-4 text-emerald-600" />
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>
      <ParametroForm open={formOpen} onOpenChange={setFormOpen} editing={editing} />
      <ParametroVersionHistory parametroId={histId} open={histOpen} onOpenChange={setHistOpen} />
      <ParametroDetail parametro={detailParam} open={detailOpen} onOpenChange={setDetailOpen} />
    </div>
  )
}
