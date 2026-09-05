import { useEffect, useRef, useState } from 'react'
import { ImagePlus, Loader2, RotateCcw, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  obterBannerPropostaAdmin,
  restaurarBannerPropostaPadrao,
  salvarBannerProposta,
  type ConfiguracaoBannerProposta,
} from '@/services/configuracoes'

const PADRAO: ConfiguracaoBannerProposta = {
  personalizado: false,
  url: '/proposta-banner.jpg',
  arquivo_nome: 'proposta-banner.jpg',
  arquivo_bytes: 0,
  updated: '',
}

const tamanhoLegivel = (bytes: number) =>
  bytes ? `${(bytes / (1024 * 1024)).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} MB` : ''

const dimensoesDaImagem = (arquivo: File) =>
  new Promise<{ largura: number; altura: number }>((resolve, reject) => {
    const url = URL.createObjectURL(arquivo)
    const imagem = new Image()
    imagem.onload = () => {
      URL.revokeObjectURL(url)
      resolve({ largura: imagem.naturalWidth, altura: imagem.naturalHeight })
    }
    imagem.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Imagem inválida'))
    }
    imagem.src = url
  })

export function BannerPropostaCard() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [configuracao, setConfiguracao] = useState(PADRAO)
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [preview, setPreview] = useState('')
  const [justificativa, setJustificativa] = useState('')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [dialogo, setDialogo] = useState<'trocar' | 'restaurar' | null>(null)

  const carregar = async () => {
    try {
      setConfiguracao(await obterBannerPropostaAdmin())
    } catch {
      setErro('Não foi possível consultar o banner atual.')
    }
  }

  useEffect(() => {
    void carregar()
  }, [])

  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview)
    },
    [preview],
  )

  const selecionarArquivo = async (selecionado?: File) => {
    setErro('')
    if (!selecionado) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(selecionado.type)) {
      setErro('Use uma imagem JPG, PNG ou WebP.')
      return
    }
    if (selecionado.size > 5 * 1024 * 1024) {
      setErro('A imagem deve ter no máximo 5 MB.')
      return
    }
    try {
      const dimensoes = await dimensoesDaImagem(selecionado)
      if (dimensoes.largura < 1200 || dimensoes.largura / dimensoes.altura !== 4) {
        setErro('A imagem deve ter proporção 4:1 e largura mínima de 1200 px, como 1280 × 320 px.')
        return
      }
      if (preview) URL.revokeObjectURL(preview)
      setArquivo(selecionado)
      setPreview(URL.createObjectURL(selecionado))
      setJustificativa('')
      setDialogo('trocar')
    } catch {
      setErro('Não foi possível ler a imagem selecionada.')
    }
  }

  const concluir = async () => {
    if (!justificativa.trim()) {
      setErro('Informe o motivo da alteração.')
      return
    }
    setSalvando(true)
    setErro('')
    try {
      const resposta =
        dialogo === 'restaurar'
          ? await restaurarBannerPropostaPadrao(justificativa.trim())
          : await salvarBannerProposta(arquivo as File, justificativa.trim())
      setConfiguracao(resposta)
      setDialogo(null)
      setJustificativa('')
      setArquivo(null)
      if (preview) URL.revokeObjectURL(preview)
      setPreview('')
      if (inputRef.current) inputRef.current.value = ''
    } catch {
      setErro('Não foi possível salvar o banner. Tente novamente.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Card className="lg:col-span-2">
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <div className="rounded-md bg-primary/10 p-2 text-primary">
            <ImagePlus className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-base">Banner das propostas públicas</CardTitle>
            <p className="mt-1 text-sm font-normal text-muted-foreground">
              Imagem exibida no topo de todas as propostas abertas pelo cliente.
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <img
          src={configuracao.url}
          alt="Pré-visualização do banner das propostas"
          className="block h-auto w-full rounded-lg border object-contain"
        />
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <div>
            <p className="font-medium">
              {configuracao.personalizado ? 'Banner personalizado' : 'Banner padrão da PMais'}
            </p>
            <p className="text-xs text-muted-foreground">
              Recomendado: 1280 × 320 px · proporção 4:1 · JPG, PNG ou WebP · até 5 MB
              {configuracao.arquivo_bytes
                ? ` · arquivo atual: ${tamanhoLegivel(configuracao.arquivo_bytes)}`
                : ''}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {configuracao.personalizado && (
              <Button variant="outline" onClick={() => setDialogo('restaurar')}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Restaurar padrão
              </Button>
            )}
            <Button onClick={() => inputRef.current?.click()}>
              <Upload className="mr-2 h-4 w-4" />
              Trocar imagem
            </Button>
            <input
              ref={inputRef}
              className="hidden"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => void selecionarArquivo(event.target.files?.[0])}
            />
          </div>
        </div>
        {erro && !dialogo && <p className="text-sm text-destructive">{erro}</p>}
      </CardContent>

      <Dialog open={Boolean(dialogo)} onOpenChange={(open) => !open && setDialogo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogo === 'restaurar' ? 'Restaurar banner padrão' : 'Confirmar novo banner'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {dialogo === 'trocar' && preview && (
              <img src={preview} alt="Novo banner selecionado" className="rounded-md border" />
            )}
            <p className="text-sm text-muted-foreground">
              {dialogo === 'restaurar'
                ? 'O banner personalizado será removido e a imagem padrão da PMais voltará a aparecer em todas as propostas.'
                : 'A nova imagem passará a aparecer em todas as propostas públicas, inclusive nas que já foram enviadas.'}
            </p>
            <div className="space-y-2">
              <Label htmlFor="justificativa-banner">Motivo da alteração *</Label>
              <Textarea
                id="justificativa-banner"
                value={justificativa}
                placeholder="Explique brevemente por que o banner está sendo alterado."
                onChange={(event) => setJustificativa(event.target.value)}
              />
              {erro && <p className="text-sm text-destructive">{erro}</p>}
            </div>
            <Button className="w-full" disabled={salvando} onClick={concluir}>
              {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {dialogo === 'restaurar' ? 'Restaurar banner padrão' : 'Salvar novo banner'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
