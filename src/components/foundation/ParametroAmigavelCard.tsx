import { useEffect, useState } from 'react'
import { AlertTriangle, Check, Eye, History, Loader2 } from 'lucide-react'
import type { RecordModel } from 'pocketbase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { updateParametro } from '@/services/foundation'
import type { ParametroAmigavel } from './parametros-amigaveis'

interface Props {
  definicao: ParametroAmigavel
  parametro: RecordModel
  autorId?: string
  onUpdated: () => Promise<void>
  onDetails: () => void
  onHistory: () => void
}

const rotuloValor = (definicao: ParametroAmigavel, valor: string) => {
  if (definicao.controle === 'booleano') return valor === 'true' ? 'Ligado' : 'Desligado'
  return definicao.opcoes?.find((opcao) => opcao.valor === valor)?.rotulo || valor
}

export function ParametroAmigavelCard({
  definicao,
  parametro,
  autorId,
  onUpdated,
  onDetails,
  onHistory,
}: Props) {
  const [valor, setValor] = useState(String(parametro.valor ?? ''))
  const [confirmacaoOpen, setConfirmacaoOpen] = useState(false)
  const [justificativa, setJustificativa] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => setValor(String(parametro.valor ?? '')), [parametro.valor])

  const valorAtual = String(parametro.valor ?? '')
  const alterado = valor !== valorAtual

  const salvar = async () => {
    if (!justificativa.trim()) {
      setErro('Informe o motivo da alteração.')
      return
    }
    setSalvando(true)
    setErro('')
    try {
      await updateParametro(parametro.id, {
        valor,
        autor_id: autorId,
        data_hora: new Date().toISOString(),
        justificativa: justificativa.trim(),
      })
      await onUpdated()
      setConfirmacaoOpen(false)
      setJustificativa('')
    } catch {
      setErro('Não foi possível salvar. Tente novamente.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Card className={!parametro.ativo ? 'opacity-60' : undefined}>
      <CardHeader className="space-y-1 pb-3">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-base leading-snug">{definicao.titulo}</CardTitle>
          {definicao.controle === 'booleano' && (
            <Switch
              aria-label={definicao.titulo}
              checked={valor === 'true'}
              disabled={!parametro.ativo}
              onCheckedChange={(checked) => setValor(String(checked))}
            />
          )}
        </div>
        <p className="text-sm font-normal text-muted-foreground">{definicao.descricao}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {definicao.controle === 'numero' && (
          <div className="flex items-center gap-2">
            <Input
              aria-label={definicao.titulo}
              className="max-w-28"
              type="number"
              min="0"
              step="1"
              value={valor}
              disabled={!parametro.ativo}
              onChange={(event) => setValor(event.target.value)}
            />
            <span className="text-sm text-muted-foreground">{definicao.unidade}</span>
          </div>
        )}
        {definicao.controle === 'selecao' && (
          <Select value={valor} disabled={!parametro.ativo} onValueChange={setValor}>
            <SelectTrigger aria-label={definicao.titulo}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {definicao.opcoes?.map((opcao) => (
                <SelectItem key={opcao.valor} value={opcao.valor}>
                  {opcao.rotulo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs text-muted-foreground">
            {!parametro.ativo
              ? 'Configuração inativa — consulte os detalhes técnicos.'
              : definicao.recomendado
                ? `Recomendado: ${definicao.recomendado}`
                : `Atual: ${rotuloValor(definicao, valorAtual)}`}
          </div>
          {alterado && (
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setValor(valorAtual)}>
                Cancelar
              </Button>
              <Button size="sm" onClick={() => setConfirmacaoOpen(true)}>
                Salvar alteração
              </Button>
            </div>
          )}
        </div>
        {definicao.alerta && (
          <div className="flex gap-2 rounded-md bg-amber-50 p-2 text-xs text-amber-900">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{definicao.alerta}</span>
          </div>
        )}
        <div className="flex gap-1 border-t pt-2">
          <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={onHistory}>
            <History className="mr-1 h-3.5 w-3.5" />
            Histórico
          </Button>
          <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={onDetails}>
            <Eye className="mr-1 h-3.5 w-3.5" />
            Detalhes técnicos
          </Button>
        </div>
      </CardContent>

      <Dialog open={confirmacaoOpen} onOpenChange={setConfirmacaoOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar alteração</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-md bg-muted p-3 text-sm">
              <p className="font-medium">{definicao.titulo}</p>
              <p className="mt-1 text-muted-foreground">
                {rotuloValor(definicao, valorAtual)} → {rotuloValor(definicao, valor)}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`justificativa-${parametro.id}`}>Motivo da alteração *</Label>
              <Textarea
                id={`justificativa-${parametro.id}`}
                value={justificativa}
                placeholder="Explique brevemente por que esta configuração está sendo alterada."
                onChange={(event) => setJustificativa(event.target.value)}
              />
              {erro && <p className="text-sm text-destructive">{erro}</p>}
            </div>
            <Button className="w-full" disabled={salvando} onClick={salvar}>
              {salvando ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Check className="mr-2 h-4 w-4" />
              )}
              Confirmar e salvar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
