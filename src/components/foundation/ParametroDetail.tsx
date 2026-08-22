import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import type { RecordModel } from 'pocketbase'

interface Props {
  parametro: RecordModel | null
  open: boolean
  onOpenChange: (v: boolean) => void
}

export function ParametroDetail({ parametro, open, onOpenChange }: Props) {
  if (!parametro) return null

  const fields = [
    { label: 'Chave', value: parametro.chave },
    { label: 'Valor', value: parametro.valor },
    { label: 'Descrição', value: parametro.descricao || '-' },
    { label: 'Tipo', value: parametro.tipo || '-' },
    { label: 'Unidade', value: parametro.unidade || '-' },
    {
      label: 'Regra de Validação',
      value: parametro.regra_validacao || '-',
    },
    {
      label: 'Início Vigência',
      value: parametro.inicio_vigencia
        ? new Date(parametro.inicio_vigencia).toLocaleDateString('pt-BR')
        : '-',
    },
    {
      label: 'Fim Vigência',
      value: parametro.fim_vigencia
        ? new Date(parametro.fim_vigencia).toLocaleDateString('pt-BR')
        : '-',
    },
    {
      label: 'Autor',
      value: parametro.expand?.autor_id?.name || parametro.expand?.autor_id?.email || '-',
    },
    {
      label: 'Data/Hora',
      value: parametro.data_hora ? new Date(parametro.data_hora).toLocaleString('pt-BR') : '-',
    },
    { label: 'Justificativa', value: parametro.justificativa || '-' },
    {
      label: 'Criado em',
      value: new Date(parametro.created).toLocaleString('pt-BR'),
    },
    {
      label: 'Atualizado em',
      value: new Date(parametro.updated).toLocaleString('pt-BR'),
    },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detalhes do Parâmetro</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge variant="outline">v{parametro.versao}</Badge>
            <Badge variant={parametro.ativo ? 'default' : 'secondary'}>
              {parametro.ativo ? 'Ativo' : 'Inativo'}
            </Badge>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {fields.map((f) => (
              <div key={f.label} className="space-y-1">
                <p className="text-xs font-medium text-gray-500">{f.label}</p>
                <p className="text-sm text-gray-900 break-words">{f.value}</p>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
