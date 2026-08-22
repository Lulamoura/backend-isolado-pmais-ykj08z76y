import { useEffect, useRef, useState } from 'react'
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react'
import pb from '@/lib/pocketbase/client'
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

// ─────────────────────────────────────────────────────────────────────
// escapeFilter — escapa aspas duplas e barra invertida para uso seguro
// dentro de um filter string do PocketBase. O input do usuário NUNCA deve
// ser interpolado cru no filter.
// ─────────────────────────────────────────────────────────────────────

export function escapeFilter(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

export interface UserOption {
  id: string
  name: string
}

export interface UserSelectProps {
  value: string | null
  onChange: (id: string | null) => void
  onSelect?: (option: UserOption | null) => void
  placeholder?: string
  disabled?: boolean
  excludeId?: string
  ariaLabel?: string
}

export function UserSelect({
  value,
  onChange,
  onSelect,
  placeholder,
  disabled,
  excludeId,
  ariaLabel = 'Selecionar usuário',
}: UserSelectProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<UserOption[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [selectedName, setSelectedName] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reqIdRef = useRef(0)
  const resolvedRef = useRef<string | null>(null)

  // Resolve o nome quando o value é definido externamente (ex.: prefill do ajuste)
  useEffect(() => {
    if (value === resolvedRef.current) return
    resolvedRef.current = value
    if (!value) {
      setSelectedName(null)
      return
    }
    const found = items.find((i) => i.id === value)
    if (found) {
      setSelectedName(found.name)
      return
    }
    const rid = ++reqIdRef.current
    pb.collection('users')
      .getOne(value, { fields: 'id,name' })
      .then((rec) => {
        if (rid !== reqIdRef.current) return
        const name = rec?.['name']
        setSelectedName(typeof name === 'string' ? name : null)
      })
      .catch(() => {
        if (rid !== reqIdRef.current) return
        setSelectedName(null)
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
      const parts: string[] = ['ativo_comercial=true']
      if (query.trim()) parts.push(`name~"${escapeFilter(query)}"`)
      if (excludeId) parts.push(`id != "${escapeFilter(excludeId)}"`)
      const filter = parts.join(' && ')
      pb.collection('users')
        .getList(1, 20, { filter, fields: 'id,name', sort: 'name' })
        .then((res) => {
          if (rid !== reqIdRef.current) return
          setItems(
            res.items.map((r) => ({
              id: r.id,
              name: typeof r['name'] === 'string' ? (r['name'] as string) : '',
            })),
          )
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
  }, [open, query, excludeId])

  const label = selectedName ?? items.find((i) => i.id === value)?.name ?? null

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-label={ariaLabel}
          disabled={disabled}
          className="w-full justify-between font-normal"
        >
          <span className="truncate">{label ?? placeholder ?? 'Selecionar usuário'}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Buscar usuário..."
            value={query}
            onValueChange={setQuery}
            aria-label="Buscar usuário"
          />
          <CommandList>
            {loading ? (
              <div
                className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground"
                role="status"
                aria-live="polite"
              >
                <Loader2 className="h-4 w-4 animate-spin" /> Buscando...
              </div>
            ) : error ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Erro ao buscar usuários
              </div>
            ) : items.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Nenhum usuário encontrado
              </div>
            ) : (
              <CommandGroup>
                {items.map((item) => (
                  <CommandItem
                    key={item.id}
                    value={item.id}
                    onSelect={() => {
                      onChange(item.id)
                      onSelect?.(item)
                      setSelectedName(item.name)
                      setOpen(false)
                      setQuery('')
                    }}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        value === item.id ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                    {item.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
