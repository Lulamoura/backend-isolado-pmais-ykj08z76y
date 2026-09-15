import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  listarNotificacoesProposta,
  marcarNotificacoesPropostaComoLidas,
  type NotificacaoAberturaProposta,
} from '@/services/propostas'

export function ProposalNotifications() {
  const [itens, setItens] = useState<NotificacaoAberturaProposta[]>([])
  const [aberto, setAberto] = useState(false)
  const carregar = useCallback(async () => {
    try {
      setItens((await listarNotificacoesProposta()).itens)
    } catch (_) {
      // O cabeçalho continua disponível quando a fila está temporariamente indisponível.
    }
  }, [])

  useEffect(() => {
    void carregar()
    const timer = window.setInterval(() => void carregar(), 60000)
    const onFocus = () => void carregar()
    window.addEventListener('focus', onFocus)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', onFocus)
    }
  }, [carregar])

  const naoLidas = itens.filter((item) => !item.lida)
  const tituloNotificacao = (item: NotificacaoAberturaProposta) => {
    if (item.tipo === 'aceite_confirmado') return 'Proposta aceita'
    if (item.tipo === 'recusa_confirmada') return 'Proposta recusada'
    return 'Proposta aberta'
  }
  const detalheNotificacao = (item: NotificacaoAberturaProposta) => {
    const quando = new Date(item.ocorrido_em).toLocaleString('pt-BR')
    if (item.tipo === 'aceite_confirmado') return `Aceita em ${quando}`
    if (item.tipo === 'recusa_confirmada') return `Recusada em ${quando}`
    return `Aberta${item.visitante_nome ? ` por ${item.visitante_nome}` : ''} em ${quando}`
  }
  const marcarTodas = async () => {
    if (!naoLidas.length) return
    await marcarNotificacoesPropostaComoLidas(naoLidas.map((item) => item.id))
    setItens((atuais) => atuais.map((item) => ({ ...item, lida: true })))
  }

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9"
          aria-label="Notificações de abertura de proposta"
        >
          <Bell className="h-4 w-4" />
          {naoLidas.length > 0 && (
            <span className="absolute right-0.5 top-0.5 min-w-4 rounded-full bg-rose-600 px-1 text-[10px] font-bold leading-4 text-white">
              {Math.min(naoLidas.length, 99)}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b p-3">
          <p className="font-semibold">Notificações de propostas</p>
          <Button
            variant="ghost"
            size="sm"
            disabled={!naoLidas.length}
            onClick={() => void marcarTodas()}
          >
            Marcar como lidas
          </Button>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {!itens.length ? (
            <p className="p-4 text-sm text-muted-foreground">Nenhuma notificação registrada.</p>
          ) : (
            itens.slice(0, 20).map((item) => (
              <Link
                key={item.id}
                to={`/propostas?negocio=${item.negocio_id}`}
                onClick={() => setAberto(false)}
                className={`block border-b p-3 text-sm hover:bg-muted ${item.lida ? 'opacity-70' : 'bg-violet-50'}`}
              >
                <p className="font-medium">
                  {tituloNotificacao(item)} · AC #{item.external_id || '—'}
                </p>
                <p className="text-xs text-muted-foreground">{item.cliente || 'Cliente'}</p>
                <p className="mt-1 text-xs text-muted-foreground">{detalheNotificacao(item)}</p>
              </Link>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
