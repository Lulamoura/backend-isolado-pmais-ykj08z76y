import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { CommercialContext, CommercialSort } from '@/lib/commercial-context'

export function CommercialFilters({
  contexts,
  search,
  owner,
  status,
  sort,
  onSearch,
  onOwner,
  onStatus,
  onSort,
  periodStart,
  periodEnd,
  onPeriodStart,
  onPeriodEnd,
}: {
  contexts: CommercialContext[]
  search: string
  owner: string
  status: string
  sort: CommercialSort
  onSearch: (value: string) => void
  onOwner: (value: string) => void
  onStatus: (value: string) => void
  onSort: (value: CommercialSort) => void
  periodStart: string
  periodEnd: string
  onPeriodStart: (value: string) => void
  onPeriodEnd: (value: string) => void
}) {
  const owners = Array.from(
    new Map(
      contexts.filter((c) => c.responsavel).map((c) => [c.responsavel!.id, c.responsavel!]),
    ).values(),
  ).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR'))
  return (
    <div className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-3 xl:grid-cols-6">
      <Input
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        placeholder="Buscar negócio, empresa ou contato"
      />
      <Select value={owner || 'todos'} onValueChange={(v) => onOwner(v === 'todos' ? '' : v)}>
        <SelectTrigger>
          <SelectValue placeholder="Responsável" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos os responsáveis</SelectItem>
          {owners.map((o) => (
            <SelectItem key={o.id} value={o.id}>
              {o.name || 'Sem nome'}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={status || 'todas'} onValueChange={(v) => onStatus(v === 'todas' ? '' : v)}>
        <SelectTrigger>
          <SelectValue placeholder="Próxima ação" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todas">Todas as ações</SelectItem>
          <SelectItem value="vencida">Vencidas</SelectItem>
          <SelectItem value="hoje">Para hoje</SelectItem>
          <SelectItem value="futura">Futuras</SelectItem>
          <SelectItem value="ausente">Sem próxima ação</SelectItem>
        </SelectContent>
      </Select>
      <Select value={sort} onValueChange={(v) => onSort(v as CommercialSort)}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="proxima_acao">Próxima ação</SelectItem>
          <SelectItem value="maior_valor">Maior valor</SelectItem>
          <SelectItem value="mais_antigo">Mais antigo</SelectItem>
          <SelectItem value="atualizado">Atualizado recentemente</SelectItem>
        </SelectContent>
      </Select>
      <Input
        type="date"
        aria-label="Período inicial"
        value={periodStart}
        max={periodEnd || undefined}
        onChange={(e) => onPeriodStart(e.target.value)}
      />
      <Input
        type="date"
        aria-label="Período final"
        value={periodEnd}
        min={periodStart || undefined}
        onChange={(e) => onPeriodEnd(e.target.value)}
      />
    </div>
  )
}
