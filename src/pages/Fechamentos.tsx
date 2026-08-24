import { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshCw, RotateCcw, Trophy, XCircle } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  decidirFechamento,
  listarFechamentos,
  novaChaveFechamento,
  reativarFechamento,
  type ItemFechamento,
  type MotivoPerda,
} from '@/services/fechamentos'
import { useIsSuperAdmin } from '@/hooks/use-is-superadmin'
import { CommercialContextCard } from '@/components/CommercialContextCard'
import { CommercialFilters } from '@/components/CommercialFilters'
import { filterAndSortCommercial, type CommercialSort } from '@/lib/commercial-context'

const motivos: Array<{ value: MotivoPerda; label: string }> = [
  { value: 'preco', label: 'Preço' },
  { value: 'fechou_com_outra_empresa', label: 'Fechou com outra empresa' },
  { value: 'perdeu_contato', label: 'Perdeu contato' },
  { value: 'desistiu', label: 'Desistiu' },
  { value: 'nao_atendido', label: 'Não atendido' },
]

export default function Fechamentos() {
  const { perfilSlug } = useIsSuperAdmin()
  const [itens, setItens] = useState<ItemFechamento[]>([])
  const [loading, setLoading] = useState(true)
  const [motivo, setMotivo] = useState<Record<string, MotivoPerda>>({})
  const [valor, setValor] = useState<Record<string, string>>({})
  const [evidencia, setEvidencia] = useState<Record<string, string>>({})
  const [dataAlvo, setDataAlvo] = useState<Record<string, string>>({})
  const [busca, setBusca] = useState('')
  const [responsavel, setResponsavel] = useState('')
  const [situacaoAcao, setSituacaoAcao] = useState('')
  const [ordenacao, setOrdenacao] = useState<CommercialSort>('proxima_acao')

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      setItens((await listarFechamentos()).itens)
    } catch (_) {
      toast.error('Não foi possível carregar os fechamentos.')
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => void carregar(), [carregar])
  const itensVisiveis = useMemo(
    () => filterAndSortCommercial(itens, busca, responsavel, situacaoAcao, ordenacao),
    [itens, busca, responsavel, situacaoAcao, ordenacao],
  )

  const ganhar = async (item: ItemFechamento) => {
    try {
      await decidirFechamento({
        negocio_id: item.negocio.id,
        decisao: 'ganho',
        valor_efetivo_centavos: Math.round(Number(valor[item.negocio.id]) * 100),
        evidencia_formal: evidencia[item.negocio.id],
        updated_esperado: item.negocio.updated,
        command_idempotency_key: novaChaveFechamento('ganho', item.negocio.id),
      })
      toast.success('Ganho registrado.')
      await carregar()
    } catch (_) {
      toast.error('O ganho não pôde ser registrado.')
    }
  }

  const perder = async (item: ItemFechamento) => {
    try {
      await decidirFechamento({
        negocio_id: item.negocio.id,
        decisao: 'perdido',
        motivo: motivo[item.negocio.id],
        data_alvo_recuperacao: dataAlvo[item.negocio.id] || null,
        antecedencia_dias: 60,
        updated_esperado: item.negocio.updated,
        command_idempotency_key: novaChaveFechamento('perda', item.negocio.id),
      })
      toast.success('Perda registrada.')
      await carregar()
    } catch (_) {
      toast.error('A perda não pôde ser registrada.')
    }
  }

  const reativar = async (item: ItemFechamento) => {
    try {
      await reativarFechamento({
        negocio_perdido_id: item.negocio.id,
        agenda_id: item.agenda?.id,
        updated_esperado: item.negocio.updated,
        command_idempotency_key: novaChaveFechamento('reativar', item.negocio.id),
      })
      toast.success('Novo negócio reativado e vinculado.')
      await carregar()
    } catch (_) {
      toast.error('O negócio não pôde ser reativado.')
    }
  }

  return (
    <div className="container mx-auto max-w-6xl space-y-6 px-4 py-8">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Ganho, perda e reativação</h1>
          <p className="text-sm text-slate-500">Decisões terminais e recuperação auditáveis</p>
        </div>
        <Button variant="outline" onClick={() => void carregar()} disabled={loading}>
          <RefreshCw className="mr-2 h-4 w-4" /> Atualizar
        </Button>
      </div>
      <CommercialFilters
        contexts={itens.map((item) => item.contexto)}
        search={busca}
        owner={responsavel}
        status={situacaoAcao}
        sort={ordenacao}
        onSearch={setBusca}
        onOwner={setResponsavel}
        onStatus={setSituacaoAcao}
        onSort={setOrdenacao}
      />
      <div className="grid gap-4 md:grid-cols-2">
        {itensVisiveis.map((item) => {
          const terminal = Boolean(item.negocio.resultado)
          const perdeuContato = motivo[item.negocio.id] === 'perdeu_contato'
          const contatoValido =
            !perdeuContato ||
            (item.tentativas_contato >= 5 && item.janela_tentativas_dias_uteis >= 10)
          return (
            <Card key={item.negocio.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">{item.negocio.titulo}</CardTitle>
                    <CardDescription>{item.negocio.etapa || 'Terminal'}</CardDescription>
                  </div>
                  <Badge variant={terminal ? 'secondary' : 'outline'}>
                    {item.negocio.resultado ||
                      (item.proposta_aceita
                        ? 'Apta a fechamento'
                        : item.proposta_emitida
                          ? 'Proposta emitida'
                          : item.proposta_estado
                            ? 'Proposta em elaboração'
                            : 'Sem proposta criada')}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <CommercialContextCard contexto={item.contexto} etapa={item.negocio.etapa} />
                {!terminal ? (
                  <>
                    {!item.elegivel_fechamento && (
                      <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                        Visível para acompanhamento gerencial; ainda não elegível como pendência de
                        fechamento.
                      </p>
                    )}
                    {!item.contexto.somente_leitura && (
                      <>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label>Valor efetivo do ganho</Label>
                            <Input
                              value={valor[item.negocio.id] || ''}
                              onChange={(e) =>
                                setValor((v) => ({
                                  ...v,
                                  [item.negocio.id]: e.target.value,
                                }))
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Evidência formal</Label>
                            <Input
                              value={evidencia[item.negocio.id] || ''}
                              onChange={(e) =>
                                setEvidencia((v) => ({
                                  ...v,
                                  [item.negocio.id]: e.target.value,
                                }))
                              }
                            />
                          </div>
                        </div>
                      </>
                    )}
                    <Button
                      disabled={
                        !item.proposta_emitida ||
                        !Number(valor[item.negocio.id]) ||
                        !evidencia[item.negocio.id]?.trim()
                      }
                      onClick={() => void ganhar(item)}
                    >
                      <Trophy className="mr-2 h-4 w-4" /> Registrar ganho
                    </Button>
                    <div className="border-t pt-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Select
                          value={motivo[item.negocio.id]}
                          onValueChange={(x) =>
                            setMotivo((v) => ({
                              ...v,
                              [item.negocio.id]: x as MotivoPerda,
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Motivo da perda" />
                          </SelectTrigger>
                          <SelectContent>
                            {motivos.map((x) => (
                              <SelectItem key={x.value} value={x.value}>
                                {x.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          type="date"
                          value={dataAlvo[item.negocio.id] || ''}
                          onChange={(e) =>
                            setDataAlvo((v) => ({
                              ...v,
                              [item.negocio.id]: e.target.value,
                            }))
                          }
                        />
                      </div>
                      {perdeuContato && (
                        <p className="mt-2 text-xs text-slate-500">
                          Tentativas: {item.tentativas_contato}/5 · janela:{' '}
                          {item.janela_tentativas_dias_uteis}/10 dias úteis
                        </p>
                      )}
                      <Button
                        className="mt-3"
                        variant="outline"
                        disabled={!motivo[item.negocio.id] || !contatoValido}
                        onClick={() => void perder(item)}
                      >
                        <XCircle className="mr-2 h-4 w-4" /> Registrar perda
                      </Button>
                    </div>
                  </>
                ) : item.negocio.resultado === 'perdido' ? (
                  <div className="space-y-3">
                    <p className="text-sm text-slate-600">
                      {item.agenda
                        ? `Recuperação em ${item.agenda.data_alvo}`
                        : 'Sem agenda de recuperação ativa'}
                    </p>
                    {perfilSlug !== 'negociacao-propria' && (
                      <Button disabled={!item.agenda} onClick={() => void reativar(item)}>
                        <RotateCcw className="mr-2 h-4 w-4" /> Reativar negócio
                      </Button>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">Negócio terminal preservado.</p>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
