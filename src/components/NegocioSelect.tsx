import { useEffect, useRef, useState } from 'react'
import { Check, Loader2, X } from 'lucide-react'
import pb from '@/lib/pocketbase/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { cn } from '@/lib/utils'
import { escapeFilter } from './UserSelect'

export interface NegocioOption {
  id: string
  label: string
  subtitle?: string
}

export interface NegocioSelectProps {
  value: string[]
  onChange: (ids: string[]) => void
  placeholder?: string
  disabled?: boolean
  titularId?: string
  onlyOpen?: boolean
  initialOpen?: boolean
}

export const NEGOCIO_EXPAND = 'empresa_id,contato_principal_id'
export const NEGOCIO_FIELDS =
  'id,titulo,etapa,oe_numero,external_id,expand.empresa_id.nome,expand.contato_principal_id.nome'
export const NEGOCIO_OPCOES_COBERTURA_PATH = '/backend/v1/negocios/opcoes-cobertura'

export function buildNegocioFilter(_query: string, titularId?: string, onlyOpen?: boolean): string {
  const filters: string[] = []
  if (titularId) filters.push(`responsavel_id="${escapeFilter(titularId)}"`)
  if (onlyOpen) {
    filters.push('inativo != true')
    filters.push('status = ""')
    filters.push('resultado = ""')
  }
  return filters.join(' && ')
}

function nestedString(obj: unknown, key: string): string {
  return typeof obj === 'object' && obj && typeof (obj as Record<string, unknown>)[key] === 'string'
    ? ((obj as Record<string, unknown>)[key] as string)
    : ''
}

function isGenericTitulo(titulo: string): boolean {
  return titulo.trim().toLowerCase() === 'proposta qualificada'
}

function normalizeBusca(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function optionMatchesQuery(option: NegocioOption, rawQuery: string): boolean {
  const query = normalizeBusca(rawQuery.trim())
  if (!query) return true
  return normalizeBusca(
    [option.label, option.subtitle, option.id].filter(Boolean).join(' '),
  ).includes(query)
}

export function negocioLabel(rec: Record<string, unknown>): NegocioOption {
  const titulo = typeof rec['titulo'] === 'string' ? (rec['titulo'] as string) : ''
  const expand =
    typeof rec['expand'] === 'object' && rec['expand']
      ? (rec['expand'] as Record<string, unknown>)
      : {}
  const empresa = nestedString(expand['empresa_id'], 'nome')
  const contato = nestedString(expand['contato_principal_id'], 'nome')
  const oeNumero = typeof rec['oe_numero'] === 'string' ? (rec['oe_numero'] as string) : ''
  const externalId = typeof rec['external_id'] === 'string' ? (rec['external_id'] as string) : ''
  const etapa =
    typeof rec['etapa'] === 'string' ? (rec['etapa'] as string).replaceAll('_', ' ') : ''
  const id = rec.id as string
  const businessId = oeNumero || externalId
  const labelParts = [
    empresa || (!isGenericTitulo(titulo) ? titulo : ''),
    contato,
    businessId ? `ID ${businessId}` : '',
  ].filter(Boolean)
  const subtitleParts = [
    !empresa && isGenericTitulo(titulo) ? titulo : '',
    oeNumero && externalId && oeNumero !== externalId ? `Externo ${externalId}` : '',
    etapa,
  ].filter(Boolean)

  return {
    id,
    label: labelParts.join(' — ') || titulo || 'Negócio sem identificação',
    subtitle: subtitleParts.join(' · '),
  }
}

export function NegocioSelect({
  value,
  onChange,
  placeholder,
  disabled,
  titularId,
  onlyOpen,
  initialOpen = false,
}: NegocioSelectProps) {
  const [open, setOpen] = useState(initialOpen)
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<NegocioOption[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [nameMap, setNameMap] = useState<Record<string, string>>({})
  const reqIdRef = useRef(0)
  const resolvedRef = useRef<string>('')

  // Resolve títulos para os IDs selecionados não presentes no mapa
  useEffect(() => {
    const sig = value.join(',')
    if (sig === resolvedRef.current) return
    resolvedRef.current = sig
    const missing = value.filter((id) => !nameMap[id])
    if (missing.length === 0) return
    const rid = ++reqIdRef.current
    Promise.all(
      missing.map((id) =>
        pb
          .collection('com_negocios')
          .getOne(id, {
            expand: NEGOCIO_EXPAND,
            fields: NEGOCIO_FIELDS,
          })
          .catch(() => null),
      ),
    ).then((recs) => {
      if (rid !== reqIdRef.current) return
      setNameMap((prev) => {
        const next = { ...prev }
        for (const rec of recs) {
          if (!rec) continue
          const option = negocioLabel(rec as Record<string, unknown>)
          next[option.id] = [option.label, option.subtitle].filter(Boolean).join(' — ')
        }
        return next
      })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  // Busca sob demanda quando o seletor é aberto ou o filtro muda.
  useEffect(() => {
    if (!open) return
    const rid = ++reqIdRef.current
    setLoading(true)
    setError(false)
    const useCoberturaEndpoint = !!titularId && !!onlyOpen
    const request = useCoberturaEndpoint
      ? pb.send(NEGOCIO_OPCOES_COBERTURA_PATH, {
          method: 'GET',
          query: { titular_id: titularId, q: query },
        })
      : pb.collection('com_negocios').getList(1, 50, {
          filter: buildNegocioFilter(query, titularId, onlyOpen),
        })
    request
      .then((res) => {
        if (rid !== reqIdRef.current) return
        const mapped = res.items.map((r) => negocioLabel(r as Record<string, unknown>))
        setItems(mapped.filter((item) => optionMatchesQuery(item, query)))
        setNameMap((prev) => {
          const next = { ...prev }
          for (const m of mapped) next[m.id] = [m.label, m.subtitle].filter(Boolean).join(' — ')
          return next
        })
        setLoading(false)
      })
      .catch(() => {
        if (rid !== reqIdRef.current) return
        setError(true)
        setLoading(false)
        setItems([])
      })
  }, [open, query, titularId, onlyOpen])

  const toggle = (id: string) => {
    if (value.includes(id)) onChange(value.filter((v) => v !== id))
    else onChange([...value, id])
  }

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((id) => (
            <Badge key={id} variant="secondary" className="gap-1">
              <span className="max-w-[200px] truncate">{nameMap[id] ?? id}</span>
              {!disabled && (
                <button
                  type="button"
                  aria-label={`Remover ${nameMap[id] ?? id}`}
                  className="ml-0.5 rounded-full p-0.5 hover:bg-black/10"
                  onClick={() => onChange(value.filter((v) => v !== id))}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </Badge>
          ))}
        </div>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-label="Selecionar negócios"
            disabled={disabled}
            className="w-full justify-between font-normal"
          >
            <span className="truncate">{placeholder ?? 'Selecionar negócios'}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Buscar negócio..."
              value={query}
              onValueChange={setQuery}
              aria-label="Buscar negócio"
            />
            <CommandList>
              {loading ? (
                <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Buscando...
                </div>
              ) : error ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  Erro ao buscar negócios
                </div>
              ) : items.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  Nenhum negócio encontrado
                </div>
              ) : (
                <CommandGroup>
                  {items.map((item) => {
                    const selected = value.includes(item.id)
                    return (
                      <CommandItem key={item.id} value={item.id} onSelect={() => toggle(item.id)}>
                        <div
                          className={cn(
                            'mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary',
                            selected && 'bg-primary text-primary-foreground',
                          )}
                        >
                          {selected && <Check className="h-3 w-3" />}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate">{item.label}</div>
                          {item.subtitle && (
                            <div className="truncate text-xs text-muted-foreground">
                              {item.subtitle}
                            </div>
                          )}
                        </div>
                      </CommandItem>
                    )
                  })}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}
