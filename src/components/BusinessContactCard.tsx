import { Mail, Phone } from 'lucide-react'

export interface BusinessContactCardProps {
  empresa?: { nome?: string | null } | null
  contato?: {
    nome?: string | null
    email?: string | null
    telefone?: string | null
  } | null
}

export function BusinessContactCard({ empresa, contato }: BusinessContactCardProps) {
  return (
    <div className="rounded-md border bg-white/70 p-3 text-sm">
      <p className="text-xs text-muted-foreground">{empresa?.nome || 'Empresa não informada'}</p>
      <p className="mt-1 font-medium">{contato?.nome || 'Contato não informado'}</p>
      <p className="mt-1 flex items-center gap-2 text-muted-foreground">
        <Mail className="h-4 w-4 shrink-0" /> {contato?.email || 'E-mail não informado'}
      </p>
      <p className="mt-1 flex items-center gap-2 text-muted-foreground">
        <Phone className="h-4 w-4 shrink-0" /> {contato?.telefone || 'Telefone não informado'}
      </p>
    </div>
  )
}
