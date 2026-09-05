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
        <h2 className="text-lg font-semibold">Configurações do sistema</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Ajuste o funcionamento do aplicativo por assunto. Cada alteração exige uma justificativa e
          permanece registrada no histórico.
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
              <h3 className="font-semibold">{grupo.titulo}</h3>
              <p className="text-sm text-muted-foreground">{grupo.descricao}</p>
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
        <div className="rounded-lg border">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="flex h-auto w-full justify-between px-4 py-4">
              <span className="flex items-center gap-2 text-left">
                <Settings2 className="h-4 w-4" />
                <span>
                  <span className="block font-semibold">Configurações técnicas avançadas</span>
                  <span className="block text-xs font-normal text-muted-foreground">
                    Chaves internas, integrações, versões e parâmetros descontinuados
                  </span>
                </span>
              </span>
              <ChevronDown
                className={`h-4 w-4 transition-transform ${avancadoOpen ? 'rotate-180' : ''}`}
              />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4 border-t p-4">
            <Alert variant="destructive">
              <ShieldAlert className="h-4 w-4" />
              <AlertTitle>Área técnica</AlertTitle>
              <AlertDescription>
                Alterações incorretas podem interromper integrações e rotinas do sistema. Use esta
                área somente quando houver orientação técnica.
              </AlertDescription>
            </Alert>
            <div className="flex justify-end">
              <Button onClick={openNew} size="sm" variant="outline">
                <Plus className="mr-1 h-4 w-4" />
                Adicionar parâmetro técnico
              </Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Chave técnica</TableHead>
                  <TableHead>Valor interno</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Versão</TableHead>
                  <TableHead>Ativo</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parametrosTecnicos.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs font-medium">{r.chave}</TableCell>
                    <TableCell className="text-gray-500">{r.valor}</TableCell>
                    <TableCell className="text-gray-500">{r.tipo || '-'}</TableCell>
                    <TableCell>
                      <Badge variant="outline">v{r.versao}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={r.ativo ? 'default' : 'secondary'}>
                        {r.ativo ? 'Sim' : 'Não'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openDetail(r)}
                        title="Detalhes"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openHistory(r.id)}
                        title="Histórico"
                      >
                        <History className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => openEdit(r)} title="Editar">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleAtivo(r)}
                        title={r.ativo ? 'Inativar' : 'Ativar'}
                      >
                        {r.ativo ? (
                          <Ban className="h-4 w-4 text-amber-500" />
                        ) : (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CollapsibleContent>
        </div>
      </Collapsible>
      <ParametroForm open={formOpen} onOpenChange={setFormOpen} editing={editing} />
      <ParametroVersionHistory parametroId={histId} open={histOpen} onOpenChange={setHistOpen} />
      <ParametroDetail parametro={detailParam} open={detailOpen} onOpenChange={setDetailOpen} />
    </div>
  )
}
