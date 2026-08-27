import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { atualizarParametroSla, type FilaSla, type ParametroSlaChave } from '@/services/slas'

const OPCOES: Array<{ chave: ParametroSlaChave; nome: string; explicacao: string }> = [
  {
    chave: 'sla.lead_dias_uteis',
    nome: 'Prazo de Prospect',
    explicacao: 'Tempo para tratar um novo prospect.',
  },
  {
    chave: 'sla.proposta_dias_uteis',
    nome: 'Prazo de Produção de Proposta',
    explicacao: 'Tempo para elaborar e enviar a proposta.',
  },
  {
    chave: 'sla.negociacao_dias_uteis',
    nome: 'Tolerância crítica da Negociação',
    explicacao: 'Dias úteis tolerados após o vencimento da próxima ação.',
  },
  {
    chave: 'sla.alerta_antecedencia_dias_uteis',
    nome: 'Antecedência do alerta',
    explicacao: 'Quantos dias úteis antes do vencimento o alerta deve começar.',
  },
]

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  dados: FilaSla
  onSaved: () => Promise<void>
}

export function SlaParametrosDialog({ open, onOpenChange, dados, onSaved }: Props) {
  const [chave, setChave] = useState<ParametroSlaChave>('sla.lead_dias_uteis')
  const [valor, setValor] = useState('1')
  const [justificativa, setJustificativa] = useState('')
  const [salvando, setSalvando] = useState(false)
  const opcao = useMemo(() => OPCOES.find((item) => item.chave === chave)!, [chave])

  useEffect(() => {
    if (!open) return
    setValor(String(dados.parametros_controle[chave]?.valor ?? 1))
    setJustificativa('')
  }, [open, chave, dados])

  const salvar = async () => {
    const numero = Number(valor)
    if (!Number.isInteger(numero) || numero < 1 || numero > 60) {
      toast.error('Informe um número inteiro entre 1 e 60 dias úteis.')
      return
    }
    if (!justificativa.trim()) {
      toast.error('A justificativa da alteração é obrigatória.')
      return
    }
    setSalvando(true)
    try {
      await atualizarParametroSla({
        chave,
        valor: numero,
        justificativa: justificativa.trim(),
        updated_esperado: dados.parametros_controle[chave]?.updated || 'DEFAULT',
      })
      await onSaved()
      toast.success(`${opcao.nome} atualizado com auditoria.`)
      onOpenChange(false)
    } catch {
      toast.error(
        'O parâmetro foi alterado por outra sessão ou não pôde ser salvo. Recarregue e tente novamente.',
      )
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajustar parâmetros do SLA</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Parâmetro</Label>
            <Select value={chave} onValueChange={(value) => setChave(value as ParametroSlaChave)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OPCOES.map((item) => (
                  <SelectItem key={item.chave} value={item.chave}>
                    {item.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{opcao.explicacao}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="sla-valor">Prazo em dias úteis</Label>
            <Input
              id="sla-valor"
              type="number"
              min={1}
              max={60}
              step={1}
              value={valor}
              onChange={(event) => setValor(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sla-justificativa">Justificativa da alteração</Label>
            <Textarea
              id="sla-justificativa"
              value={justificativa}
              onChange={(event) => setJustificativa(event.target.value)}
              placeholder="Explique por que o prazo está sendo alterado."
            />
          </div>
          <p className="text-xs text-muted-foreground">
            A alteração registrará valor anterior, valor novo, autor, data, hora e justificativa.
          </p>
          <Button className="w-full" onClick={salvar} disabled={salvando}>
            {salvando ? 'Salvando…' : 'Salvar alteração'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
