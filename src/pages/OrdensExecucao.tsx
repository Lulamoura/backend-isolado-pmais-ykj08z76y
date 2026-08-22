import { useCallback, useEffect, useState } from 'react'
import { ClipboardCheck, RefreshCw } from 'lucide-react'
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
  listarOrdensExecucao,
  novaChaveOE,
  registrarOrdemExecucao,
  type ItemOE,
  type ResponsavelOE,
} from '@/services/ordens-execucao'

export default function OrdensExecucao() {
  const [itens, setItens] = useState<ItemOE[]>([])
  const [responsaveis, setResponsaveis] = useState<ResponsavelOE[]>([])
  const [loading, setLoading] = useState(true)
  const [numero, setNumero] = useState<Record<string, string>>({})
  const [dataEnvio, setDataEnvio] = useState<Record<string, string>>({})
  const [responsavel, setResponsavel] = useState<Record<string, string>>({})

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const resposta = await listarOrdensExecucao()
      setItens(resposta.itens)
      setResponsaveis(resposta.responsaveis_envio)
    } catch (_) {
      toast.error('Não foi possível carregar as Ordens de Execução.')
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => void carregar(), [carregar])

  const registrar = async (item: ItemOE) => {
    try {
      await registrarOrdemExecucao({
        negocio_id: item.negocio.id,
        oe_numero: numero[item.negocio.id],
        oe_data_envio: dataEnvio[item.negocio.id],
        oe_responsavel_envio_id: responsavel[item.negocio.id],
        updated_esperado: item.negocio.updated,
        command_idempotency_key: novaChaveOE(item.negocio.id),
        justificativa: 'Registro da referência da OE pelo Comercial',
      })
      toast.success('Ordem de Execução registrada.')
      await carregar()
    } catch (_) {
      toast.error('A Ordem de Execução não pôde ser registrada.')
    }
  }

  return (
    <div className="container mx-auto max-w-6xl space-y-6 px-4 py-8">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Ordens de Execução</h1>
          <p className="text-sm text-slate-500">Referência do ERP após o ganho comercial</p>
        </div>
        <Button variant="outline" onClick={() => void carregar()} disabled={loading}>
          <RefreshCw className="mr-2 h-4 w-4" /> Atualizar
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {itens.map((item) => {
          const concluida = item.estado_operacional === 'em_processo_de_entrega'
          return (
            <Card key={item.negocio.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">{item.negocio.titulo}</CardTitle>
                    <CardDescription>Negócio ganho</CardDescription>
                  </div>
                  <Badge variant={concluida ? 'default' : 'secondary'}>
                    {concluida ? 'Em processo de entrega' : 'Aguardando OE'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {concluida && item.oe ? (
                  <dl className="grid gap-2 text-sm text-slate-600">
                    <div>
                      <dt className="font-medium text-slate-900">Número da OE</dt>
                      <dd>{item.oe.numero}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-slate-900">Data de envio</dt>
                      <dd>{item.oe.data_envio}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-slate-900">Responsável pelo envio</dt>
                      <dd>{item.oe.responsavel_envio?.name || 'Não identificado'}</dd>
                    </div>
                  </dl>
                ) : (
                  <>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Número da OE</Label>
                        <Input
                          value={numero[item.negocio.id] || ''}
                          onChange={(event) =>
                            setNumero((atual) => ({
                              ...atual,
                              [item.negocio.id]: event.target.value,
                            }))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Data de envio</Label>
                        <Input
                          type="date"
                          value={dataEnvio[item.negocio.id] || ''}
                          onChange={(event) =>
                            setDataEnvio((atual) => ({
                              ...atual,
                              [item.negocio.id]: event.target.value,
                            }))
                          }
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Responsável pelo envio</Label>
                      <Select
                        value={responsavel[item.negocio.id]}
                        onValueChange={(value) =>
                          setResponsavel((atual) => ({ ...atual, [item.negocio.id]: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o responsável" />
                        </SelectTrigger>
                        <SelectContent>
                          {responsaveis.map((usuario) => (
                            <SelectItem key={usuario.id} value={usuario.id}>
                              {usuario.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      disabled={
                        !numero[item.negocio.id]?.trim() ||
                        !dataEnvio[item.negocio.id] ||
                        !responsavel[item.negocio.id]
                      }
                      onClick={() => void registrar(item)}
                    >
                      <ClipboardCheck className="mr-2 h-4 w-4" /> Registrar OE
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
