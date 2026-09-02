import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import pb from '@/lib/pocketbase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface PropostaPublicaDados {
  identificador: string
  numero: number
  cliente: string
  contato: string
  responsavel: string
  modalidade: string
  valor_total_centavos: number
  validade: string | null
  expira_em: string
  decisao: string
}
const reais = (valor: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor / 100)
export default function PropostaPublica() {
  const { token = '' } = useParams()
  const [dados, setDados] = useState<PropostaPublicaDados | null>(null)
  const [indisponivel, setIndisponivel] = useState(false)
  useEffect(() => {
    document.title = 'Proposta comercial | PMais'
    void pb
      .send<PropostaPublicaDados>(`/backend/v1/public/propostas/${encodeURIComponent(token)}`, {
        method: 'GET',
      })
      .then(setDados)
      .catch(() => setIndisponivel(true))
  }, [token])
  if (indisponivel)
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <Card className="max-w-lg">
          <CardHeader>
            <CardTitle>Proposta indisponível</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Este link não está ativo, expirou ou foi revogado. Solicite um novo link ao
              responsável comercial.
            </p>
          </CardContent>
        </Card>
      </main>
    )
  if (!dados)
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <p>Carregando proposta…</p>
      </main>
    )
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-primary">
            PMais Serviços
          </p>
          <h1 className="mt-2 text-3xl font-bold">Proposta comercial</h1>
          <p className="text-muted-foreground">
            {dados.identificador} · versão {dados.numero}
          </p>
        </header>
        <Card>
          <CardContent className="grid gap-5 p-6 sm:grid-cols-2">
            <div>
              <p className="text-xs uppercase text-muted-foreground">Cliente</p>
              <p className="font-medium">{dados.cliente || 'Cliente PMais'}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-muted-foreground">Contato</p>
              <p className="font-medium">{dados.contato || '—'}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-muted-foreground">Investimento</p>
              <p className="text-2xl font-bold text-primary">{reais(dados.valor_total_centavos)}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-muted-foreground">Responsável PMais</p>
              <p className="font-medium">{dados.responsavel || 'Equipe comercial'}</p>
            </div>
          </CardContent>
        </Card>
        <p className="text-center text-xs text-muted-foreground">
          Documento protegido. Não indexado por mecanismos de busca.
        </p>
      </div>
    </main>
  )
}
