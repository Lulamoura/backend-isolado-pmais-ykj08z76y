import { useState, useEffect } from 'react'
import { getParametroVersoes } from '@/services/foundation'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import type { RecordModel } from 'pocketbase'

interface Props {
  parametroId: string | null
  open: boolean
  onOpenChange: (v: boolean) => void
}

export function ParametroVersionHistory({ parametroId, open, onOpenChange }: Props) {
  const [records, setRecords] = useState<RecordModel[]>([])

  useEffect(() => {
    if (parametroId && open) {
      getParametroVersoes(parametroId)
        .then(setRecords)
        .catch(() => setRecords([]))
    }
  }, [parametroId, open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Histórico de Versões</DialogTitle>
        </DialogHeader>
        {records.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">
            Nenhuma versão anterior registrada.
          </p>
        ) : (
          <div className="space-y-3">
            {records.map((v) => (
              <div key={v.id} className="border rounded-lg p-3 text-sm space-y-1">
                <div className="flex justify-between items-center">
                  <Badge variant="outline">v{v.versao}</Badge>
                  <span className="text-xs text-gray-400">
                    {new Date(v.created).toLocaleString('pt-BR')}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1 text-xs">
                  <span className="text-gray-500">
                    Chave: <strong>{v.chave}</strong>
                  </span>
                  <span className="text-gray-500">
                    Valor: <strong>{v.valor}</strong>
                  </span>
                  <span className="text-gray-500">Tipo: {v.tipo || '-'}</span>
                  <span className="text-gray-500">Unidade: {v.unidade || '-'}</span>
                </div>
                {v.descricao && <p className="text-xs text-gray-500">Descrição: {v.descricao}</p>}
                {v.justificativa && <p className="text-xs italic">"{v.justificativa}"</p>}
                <p className="text-xs text-gray-500">
                  Autor: {v.expand?.autor_id?.name || v.expand?.autor_id?.email || '-'}
                </p>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
