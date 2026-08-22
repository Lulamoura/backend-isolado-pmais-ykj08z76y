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
  titulo: string
}

export interface NegocioSelectProps {
  value: string[]
  onChange: (ids: string[]) => void
  placeholder?: string
  disabled?: boolean
}

export function NegocioSelect({ value, onChange, placeholder, disabled }: NegocioSelectProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<NegocioOption[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [nameMap, setNameMap] = useState<Record<string, string>>({})
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
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
          .getOne(id, { fields: 'id,titulo' })
          .catch(() => null),
      ),
    ).then((recs) => {
      if (rid !== reqIdRef.current) return
      setNameMap((prev) => {
        const next = { ...prev }
        for (const rec of recs) {
          if (!rec) continue
          const t = rec['titulo']
          if (typeof t === 'string') next[rec.id] = t
        }
        return next
      })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  // Busca sob demanda com debounce de 300ms
  useEffect(() => {
    if (!open) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      const rid = ++reqIdRef.current
      setLoading(true)
      setError(false)
      const filter = query.trim() ? `titulo~"${escapeFilter(query)}"` : ''
      pb.collection('com_negocios')
        .getList(1, 20, { filter, fields: 'id,titulo', sort: 'titulo' })
        .then((res) => {
          if (rid !== reqIdRef.current) return
          const mapped = res.items.map((r) => ({
            id: r.id,
            titulo: typeof r['titulo'] === 'string' ? (r['titulo'] as string) : '',
          }))
          setItems(mapped)
          setNameMap((prev) => {
            const next = { ...prev }
            for (const m of mapped) next[m.id] = m.titulo
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
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [open, query])

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
                        <span className="truncate">{item.titulo}</span>
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
