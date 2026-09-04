import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { FileText, Loader2 } from 'lucide-react'
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import pdfWorkerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'
import pb from '@/lib/pocketbase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

interface PropostaPublicaDados {
  identificacao_obrigatoria: boolean
  publicacao_id: string
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
  visitante_nome?: string | null
}

interface PreflightPublico {
  identificacao_obrigatoria: boolean
  publicacao_id: string
  identificador?: string
}

const reais = (valor: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor / 100)

GlobalWorkerOptions.workerSrc = pdfWorkerUrl

const acessoIdDaPagina = () => {
  const state = (window.history.state || {}) as Record<string, unknown>
  if (typeof state.propostaAccessId === 'string') return state.propostaAccessId
  const propostaAccessId = crypto.randomUUID()
  window.history.replaceState({ ...state, propostaAccessId }, '')
  return propostaAccessId
}

function MobilePdfPages({ url }: { url: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [renderizadas, setRenderizadas] = useState(0)
  const [total, setTotal] = useState(0)
  const [falhou, setFalhou] = useState(false)

  useEffect(() => {
    const container = containerRef.current
    if (!container || !url) return
    let ativo = true
    let loadingTask: ReturnType<typeof getDocument> | null = null
    const renderTasks: Array<{ cancel: () => void }> = []
    container.replaceChildren()
    setRenderizadas(0)
    setTotal(0)
    setFalhou(false)

    void (async () => {
      const arquivo = await fetch(url).then((response) => response.arrayBuffer())
      if (!ativo) return
      loadingTask = getDocument({ data: new Uint8Array(arquivo) })
      const pdf = await loadingTask.promise
      if (!ativo) return
      setTotal(pdf.numPages)
      for (let numero = 1; numero <= pdf.numPages && ativo; numero += 1) {
        const pagina = await pdf.getPage(numero)
        const base = pagina.getViewport({ scale: 1 })
        const largura = Math.max(280, container.clientWidth)
        const viewport = pagina.getViewport({ scale: largura / base.width })
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
        const wrapper = document.createElement('section')
        wrapper.className = 'overflow-hidden rounded-md border bg-white shadow-sm'
        wrapper.setAttribute('aria-label', `Página ${numero} de ${pdf.numPages}`)
        const canvas = document.createElement('canvas')
        canvas.width = Math.floor(viewport.width * pixelRatio)
        canvas.height = Math.floor(viewport.height * pixelRatio)
        canvas.style.width = `${Math.floor(viewport.width)}px`
        canvas.style.height = `${Math.floor(viewport.height)}px`
        canvas.className = 'block h-auto max-w-full'
        wrapper.appendChild(canvas)
        container.appendChild(wrapper)
        const context = canvas.getContext('2d')
        if (!context) throw new Error('Canvas indisponível')
        const task = pagina.render({
          canvas,
          canvasContext: context,
          viewport,
          transform: pixelRatio === 1 ? undefined : [pixelRatio, 0, 0, pixelRatio, 0, 0],
        })
        renderTasks.push(task)
        await task.promise
        if (ativo) setRenderizadas(numero)
      }
    })().catch((error) => {
      console.error('Falha ao montar PDF no celular', error)
      if (ativo) setFalhou(true)
    })

    return () => {
      ativo = false
      renderTasks.forEach((task) => task.cancel())
      if (loadingTask) void loadingTask.destroy()
      container.replaceChildren()
    }
  }, [url])

  if (falhou)
    return (
      <p className="rounded-md border bg-muted p-4 text-sm text-muted-foreground">
        Não foi possível montar as páginas no celular. Use “Baixar proposta em PDF”.
      </p>
    )

  return (
    <div className="space-y-3">
      {renderizadas < total || total === 0 ? (
        <p className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Preparando páginas {total ? `${renderizadas + 1} de ${total}` : 'do PDF'}…
        </p>
      ) : (
        <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <FileText className="h-4 w-4" /> {total} página(s) — role para continuar
        </p>
      )}
      <div ref={containerRef} className="space-y-4" />
    </div>
  )
}

export default function PropostaPublica() {
  const { token = '' } = useParams()
  const [dados, setDados] = useState<PropostaPublicaDados | null>(null)
  const [publicacaoId, setPublicacaoId] = useState('')
  const [identificacaoObrigatoria, setIdentificacaoObrigatoria] = useState(true)
  const [visitanteNome, setVisitanteNome] = useState('')
  const [nomeDigitado, setNomeDigitado] = useState('')
  const [solicitarNome, setSolicitarNome] = useState(false)
  const [indisponivel, setIndisponivel] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [pdfUrl, setPdfUrl] = useState('')
  const [pdfErro, setPdfErro] = useState(false)
  const [baixando, setBaixando] = useState(false)
  const [visualizacaoMovel, setVisualizacaoMovel] = useState(
    () => window.matchMedia('(max-width: 639px)').matches,
  )
  const acessoId = useMemo(acessoIdDaPagina, [])
  const storageKey = publicacaoId ? `pmais-proposta-visitante:${publicacaoId}` : ''

  useEffect(() => {
    const media = window.matchMedia('(max-width: 639px)')
    const atualizar = () => setVisualizacaoMovel(media.matches)
    atualizar()
    media.addEventListener('change', atualizar)
    return () => media.removeEventListener('change', atualizar)
  }, [])

  const acessar = async (nome: string, preflightPublicacaoId = publicacaoId) => {
    const nomeNormalizado = nome.replace(/\s+/g, ' ').trim()
    const resposta = await pb.send<PropostaPublicaDados>(
      `/backend/v1/public/propostas/${encodeURIComponent(token)}/acessar`,
      {
        method: 'POST',
        body: { visitante_nome: nomeNormalizado, acesso_id: acessoId },
      },
    )
    const key = `pmais-proposta-visitante:${preflightPublicacaoId || resposta.publicacao_id}`
    if (nomeNormalizado) localStorage.setItem(key, nomeNormalizado)
    setVisitanteNome(nomeNormalizado)
    setDados(resposta)
    setSolicitarNome(false)
  }

  useEffect(() => {
    document.title = 'Proposta comercial | PMais'
    let ativo = true
    void pb
      .send<PreflightPublico>(`/backend/v1/public/propostas/${encodeURIComponent(token)}`, {
        method: 'GET',
      })
      .then(async (resposta) => {
        if (!ativo) return
        setPublicacaoId(resposta.publicacao_id)
        setIdentificacaoObrigatoria(resposta.identificacao_obrigatoria)
        if (!resposta.identificacao_obrigatoria && resposta.identificador) {
          setDados(resposta as PropostaPublicaDados)
          return
        }
        const key = `pmais-proposta-visitante:${resposta.publicacao_id}`
        const nomeSalvo = localStorage.getItem(key)?.trim() || ''
        if (nomeSalvo) await acessar(nomeSalvo, resposta.publicacao_id)
        else if (ativo) setSolicitarNome(true)
      })
      .catch(() => ativo && setIndisponivel(true))
    return () => {
      ativo = false
    }
    // acessoId representa um único carregamento; não repetir por mudanças de estado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  useEffect(() => {
    if (!dados) return
    let ativo = true
    let objectUrl = ''
    const carregarPdf = async () => {
      try {
        const response = await fetch(
          `${pb.baseURL}/backend/v1/public/propostas/${encodeURIComponent(token)}/pdf/visualizar`,
          {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ visitante_nome: visitanteNome, acesso_id: acessoId }),
            cache: 'no-store',
          },
        )
        if (!response.ok) throw new Error('PDF indisponível')
        const blob = await response.blob()
        if (!ativo || blob.type !== 'application/pdf') throw new Error('PDF inválido')
        objectUrl = URL.createObjectURL(blob)
        setPdfUrl(objectUrl)
        await pb.send(`/backend/v1/public/propostas/${encodeURIComponent(token)}/visualizacao`, {
          method: 'POST',
          body: {
            visitante_nome: visitanteNome,
            visualizacao_id: `${acessoId}-pdf`,
          },
        })
      } catch (_) {
        if (ativo) setPdfErro(true)
      }
    }
    void carregarPdf()
    return () => {
      ativo = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [acessoId, dados, token, visitanteNome])

  const confirmarNome = async () => {
    setErro('')
    const nome = nomeDigitado.replace(/\s+/g, ' ').trim()
    if (identificacaoObrigatoria && (nome.length < 2 || nome.length > 120)) {
      setErro('Informe seu nome para continuar.')
      return
    }
    setSalvando(true)
    try {
      await acessar(nome)
    } catch (_) {
      setErro('Não foi possível abrir a proposta. Atualize a página e verifique o link.')
    } finally {
      setSalvando(false)
    }
  }

  const alterarNome = () => {
    if (storageKey) localStorage.removeItem(storageKey)
    setNomeDigitado(visitanteNome)
    setDados(null)
    setPdfUrl('')
    setPdfErro(false)
    setSolicitarNome(true)
  }

  const baixarPdf = async () => {
    setBaixando(true)
    setErro('')
    try {
      const response = await fetch(
        `${pb.baseURL}/backend/v1/public/propostas/${encodeURIComponent(token)}/pdf`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ visitante_nome: visitanteNome, acesso_id: acessoId }),
          cache: 'no-store',
        },
      )
      if (!response.ok) throw new Error('Download indisponível')
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = 'proposta-pmais.pdf'
      anchor.click()
      URL.revokeObjectURL(url)
    } catch (_) {
      setErro('Não foi possível baixar o PDF. Atualize a página e tente novamente.')
    } finally {
      setBaixando(false)
    }
  }

  const decidir = async (decisao: 'aceita' | 'recusada') => {
    setErro('')
    if (decisao === 'recusada' && motivo.trim().length < 5) {
      setErro('Informe o motivo da recusa.')
      return
    }
    setSalvando(true)
    try {
      await pb.send(`/backend/v1/public/propostas/${encodeURIComponent(token)}/decisao`, {
        method: 'POST',
        body: {
          decisao,
          motivo: decisao === 'recusada' ? motivo.trim() : '',
          command_idempotency_key: crypto.randomUUID(),
        },
      })
      setDados((atual) => (atual ? { ...atual, decisao } : atual))
    } catch {
      setErro('Não foi possível registrar a decisão. Atualize a página e verifique o link.')
    } finally {
      setSalvando(false)
    }
  }

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

  if (solicitarNome)
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <p className="text-sm font-semibold uppercase tracking-widest text-primary">
              PMais Serviços
            </p>
            <CardTitle>Identificação para acesso</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Informe seu nome para visualizar a proposta. O nome, a data e a hora do acesso serão
              registrados no histórico comercial.
            </p>
            <div className="space-y-2">
              <Label htmlFor="visitante-nome">Seu nome</Label>
              <Input
                id="visitante-nome"
                autoComplete="name"
                maxLength={120}
                value={nomeDigitado}
                onChange={(event) => setNomeDigitado(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void confirmarNome()
                }}
              />
            </div>
            {erro && <p className="text-sm text-destructive">{erro}</p>}
            <Button className="w-full" disabled={salvando} onClick={() => void confirmarNome()}>
              Visualizar proposta
            </Button>
            <p className="text-xs text-muted-foreground">
              O nome é informado pelo visitante e não constitui validação formal de identidade.
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
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-primary">
            PMais Serviços
          </p>
          <h1 className="mt-2 text-3xl font-bold">Proposta comercial</h1>
          <p className="text-muted-foreground">
            {dados.identificador} · versão {dados.numero}
          </p>
          {visitanteNome && (
            <div className="mt-2 flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <span>Acesso identificado como {visitanteNome}</span>
              <Button variant="link" size="sm" onClick={alterarNome}>
                Alterar nome
              </Button>
            </div>
          )}
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
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
            <CardTitle>Visualização da proposta em PDF</CardTitle>
            <Button variant="outline" disabled={baixando} onClick={() => void baixarPdf()}>
              Baixar proposta em PDF
            </Button>
          </CardHeader>
          <CardContent>
            {pdfUrl ? (
              visualizacaoMovel ? (
                <MobilePdfPages url={pdfUrl} />
              ) : (
                <iframe
                  className="h-[70vh] min-h-[520px] w-full rounded-md border bg-white"
                  src={pdfUrl}
                  title="Visualização da proposta em PDF"
                />
              )
            ) : pdfErro ? (
              <p className="rounded-md border bg-muted p-4 text-sm text-muted-foreground">
                A visualização no navegador não está disponível. Use o botão “Baixar proposta em
                PDF”.
              </p>
            ) : (
              <p className="py-12 text-center text-sm text-muted-foreground">Carregando PDF…</p>
            )}
            {erro && <p className="mt-3 text-sm text-destructive">{erro}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Decisão</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {dados.decisao === 'pendente' ? (
              <div className="space-y-3">
                <p className="font-medium">Registre sua decisão sobre esta proposta</p>
                <Textarea
                  value={motivo}
                  maxLength={1000}
                  onChange={(event) => setMotivo(event.target.value)}
                  placeholder="Se optar pela recusa, informe o motivo."
                  aria-label="Motivo da recusa"
                />
                {erro && <p className="text-sm text-destructive">{erro}</p>}
                <div className="flex flex-wrap gap-2">
                  <Button disabled={salvando} onClick={() => void decidir('aceita')}>
                    Aceitar proposta
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={salvando || motivo.trim().length < 5}
                    onClick={() => void decidir('recusada')}
                  >
                    Recusar proposta
                  </Button>
                </div>
              </div>
            ) : (
              <p className="rounded-md bg-muted p-3 font-medium">
                Decisão registrada:{' '}
                {dados.decisao === 'aceita' ? 'proposta aceita' : 'proposta recusada'}.
              </p>
            )}
          </CardContent>
        </Card>
        <p className="text-center text-xs text-muted-foreground">
          Documento protegido. Não indexado por mecanismos de busca.
        </p>
      </div>
    </main>
  )
}
