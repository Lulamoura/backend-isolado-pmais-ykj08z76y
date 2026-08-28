export interface CommercialContext {
  external_id: string | null
  empresa: { id: string; nome: string | null } | null
  contato: {
    id: string
    nome: string | null
    email: string | null
    telefone: string | null
  } | null
  responsavel: { id: string; name: string | null } | null
  valor_centavos: number
  modalidade: string | null
  fase_crm: string | null
  fonte_prospeccao: string | null
  proxima_acao_em: string | null
  follow_up_pendente?: boolean
  proxima_acao_reagendada_em?: string | null
  ultima_nota_em?: string | null
  crm_created_at: string | null
  crm_updated_at: string | null
  origem_canal: string | null
  somente_leitura: boolean
}

export type ActionStatus = 'vencida' | 'hoje' | 'futura' | 'ausente'
export type CommercialSort = 'proxima_acao' | 'maior_valor' | 'mais_antigo' | 'atualizado'

const validDate = (value: string | null) => {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const civilDateKey = (value: string | null) => {
  const match = value?.match(/^(\d{4}-\d{2}-\d{2})/)
  return match?.[1] ?? null
}

const recifeDateKey = (date: Date) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Recife',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${value.year}-${value.month}-${value.day}`
}

export const actionStatus = (value: string | null, now = new Date()): ActionStatus => {
  const target = civilDateKey(value)
  if (!target) return 'ausente'
  const today = recifeDateKey(now)
  return target < today ? 'vencida' : target === today ? 'hoje' : 'futura'
}

export const followUpPendente = (
  reagendadaEm: string | null | undefined,
  ultimaNotaEm: string | null | undefined,
) => {
  const reagendamento = validDate(reagendadaEm ?? null)
  if (!reagendamento) return false
  const nota = validDate(ultimaNotaEm ?? null)
  return !nota || nota.getTime() <= reagendamento.getTime()
}

export const commercialActionCardClass = (value: string | null, now = new Date()) => {
  const status = actionStatus(value, now)
  if (status === 'vencida') return 'border-l-4 border-l-rose-600 bg-rose-50/70'
  if (status === 'ausente') return 'border-l-4 border-l-amber-500 bg-amber-50/70'
  return 'border-l-4 border-l-emerald-600 bg-emerald-50/70'
}

export const commercialOutcomeCardClass = (outcome: string | null) => {
  if (outcome === 'ganho') return 'border-l-4 border-l-blue-900 bg-blue-50/70'
  if (outcome === 'perdido') return 'border-l-4 border-l-orange-500 bg-orange-50/70'
  return ''
}

export const ageInDays = (value: string | null, now = new Date()) => {
  const date = validDate(value)
  if (!date) return null
  return Math.max(0, Math.floor((now.getTime() - date.getTime()) / 86_400_000))
}

export const formatDate = (value: string | null) => {
  const key = civilDateKey(value)
  if (!key) return 'Não informada'
  const [year, month, day] = key.split('-')
  return `${day}/${month}/${year}`
}

export const formatMoney = (cents: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)

export interface ContextualItem {
  negocio: { titulo: string; data_periodo?: string | null }
  contexto: CommercialContext
}

export const filterAndSortCommercial = <T extends ContextualItem>(
  items: T[],
  search: string,
  owner: string,
  status: string,
  sort: CommercialSort,
  periodStart = '',
  periodEnd = '',
) => {
  const term = search.trim().toLocaleLowerCase('pt-BR')
  return items
    .filter((item) => {
      const c = item.contexto
      const haystack = [item.negocio.titulo, c.empresa?.nome, c.contato?.nome]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('pt-BR')
      const periodDate = validDate(item.negocio.data_periodo || c.crm_created_at)
      const dateKey = periodDate?.toISOString().slice(0, 10) || ''
      return (
        (!term || haystack.includes(term)) &&
        (!owner || c.responsavel?.id === owner) &&
        (!status || actionStatus(c.proxima_acao_em) === status) &&
        (!periodStart || (dateKey && dateKey >= periodStart)) &&
        (!periodEnd || (dateKey && dateKey <= periodEnd))
      )
    })
    .sort((a, b) => {
      if (sort === 'maior_valor') return b.contexto.valor_centavos - a.contexto.valor_centavos
      if (sort === 'mais_antigo')
        return (
          (validDate(a.contexto.crm_created_at)?.getTime() ?? Infinity) -
          (validDate(b.contexto.crm_created_at)?.getTime() ?? Infinity)
        )
      if (sort === 'atualizado')
        return (
          (validDate(b.contexto.crm_updated_at)?.getTime() ?? 0) -
          (validDate(a.contexto.crm_updated_at)?.getTime() ?? 0)
        )
      return (
        (validDate(a.contexto.proxima_acao_em)?.getTime() ?? Infinity) -
        (validDate(b.contexto.proxima_acao_em)?.getTime() ?? Infinity)
      )
    })
}
