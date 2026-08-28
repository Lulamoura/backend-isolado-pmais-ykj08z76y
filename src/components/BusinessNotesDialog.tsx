import { useEffect, useState } from 'react'
import { MessageSquareText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { listarNotasNegocio, type NotaNegocio } from '@/services/notas-negocio'
const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Recife',
  }).format(new Date(value))
export function BusinessNotesDialog({ negocioId }: { negocioId: string }) {
  const [notes, setNotes] = useState<NotaNegocio[]>([]),
    [loading, setLoading] = useState(false),
    [error, setError] = useState('')
  const load = async () => {
    setLoading(true)
    setError('')
    try {
      setNotes((await listarNotasNegocio(negocioId)).itens)
    } catch {
      setError('Não foi possível carregar as notas deste negócio.')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    void load()
  }, [negocioId])
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="gap-2">
          <MessageSquareText className="h-4 w-4" /> Notas{!loading ? ` (${notes.length})` : ''}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Histórico de follow-up</DialogTitle>
          <DialogDescription>
            Notas registradas no ActiveCampaign para este negócio.
          </DialogDescription>
        </DialogHeader>
        {loading && <p className="text-sm text-muted-foreground">Carregando notas…</p>}
        {error && <p className="text-sm font-medium text-rose-700">{error}</p>}
        {!loading && !error && notes.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhuma nota registrada.</p>
        )}
        <div className="space-y-3">
          {notes.map((note) => (
            <article key={note.id} className="rounded-lg border bg-slate-50 p-4">
              <div className="mb-2 flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
                <span>
                  {note.autor_nome || `Usuário AC #${note.autor_external_id || 'não informado'}`}
                </span>
                <span>{formatDateTime(note.criada_em)}</span>
              </div>
              <p className="whitespace-pre-wrap break-words text-sm text-slate-900">{note.texto}</p>
              {note.alterada_em && note.alterada_em !== note.criada_em && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Editada em {formatDateTime(note.alterada_em)}
                </p>
              )}
            </article>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
