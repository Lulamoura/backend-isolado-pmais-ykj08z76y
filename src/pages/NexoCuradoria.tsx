import { useEffect, useState } from 'react'
import {
  AlertCircle,
  BellRing,
  Bot,
  CheckCircle2,
  Clock,
  History,
  MessageSquareText,
  ShieldCheck,
} from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  buscarDecisaoSuperiorExistenteCuradoriaNexo,
  obterDecisoesSuperioresCuradoriaNexo,
  obterHistoricoDecisoesSuperioresCuradoriaNexo,
  obterResumoCuradoriaNexo,
  obterRevisoesIpcpPendentesCuradoriaNexo,
  listarNotasCuradoriaNexo,
  salvarDecisaoSuperiorCuradoriaNexo,
  salvarEntrevistaCuradoriaNexo,
  sincronizarDecisaoSegundoCerebroCuradoriaNexo,
  atualizarDecisaoSuperiorCuradoriaNexo,
  type ImpactoDecisaoCuradoria,
  type NexoCuradoriaDecisaoSuperior,
  type NexoCuradoriaEvento,
  type NexoCuradoriaResumo,
  type NexoCuradoriaNota,
  atualizarRevisaoIpcpCuradoriaNexo,
} from '@/services/nexo-curadoria'
import { useIsSuperAdmin } from '@/hooks/use-is-superadmin'

function dataCurta(value?: string) {
  if (!value) return 'sem data'
  const date = new Date(value.replace(' ', 'T'))
  if (Number.isNaN(date.getTime())) return 'sem data'
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}


function textoContextoSemResumoDeNotas(texto?: string) {
  return String(texto || '')
    .split('\n')
    .filter((linha) => !/^Follow-ups\/notas:/i.test(linha.trim()))
    .join('\n')
    .trim()
}

function formatarDataNota(value?: string | null) {
  if (!value) return 'sem data'
  return dataCurta(value)
}

function NotasCuradoriaDialog({
  externalId,
  notasIniciais = [],
}: {
  externalId?: string
  notasIniciais?: NexoCuradoriaNota[]
}) {
  const [aberto, setAberto] = useState(false)
  const [notas, setNotas] = useState<NexoCuradoriaNota[]>(notasIniciais)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function carregarNotas() {
    if (!externalId) {
      setErro('Negócio não identificado para carregar notas.')
      return
    }
    setLoading(true)
    setErro(null)
    try {
      setNotas(await listarNotasCuradoriaNexo(externalId))
    } catch (_) {
      setErro('Não foi possível carregar as notas deste negócio agora.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog
      open={aberto}
      onOpenChange={(open) => {
        setAberto(open)
        if (open && notas.length === 0 && notasIniciais.length === 0 && !loading) void carregarNotas()
      }}
    >
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setAberto(true)}
        className="border-slate-200 bg-white text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 hover:text-slate-900 h-8"
      >
        <History className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
        Notas do negócio{(notas.length || notasIniciais.length) > 0 ? ` (${notas.length || notasIniciais.length})` : ''}
      </Button>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Notas do negócio</DialogTitle>
          <DialogDescription>
            Histórico completo de follow-ups disponível para apoiar as respostas da entrevista.
          </DialogDescription>
        </DialogHeader>
        {loading && <p className="text-sm text-slate-500">Carregando notas...</p>}
        {erro && <p className="text-sm font-medium text-rose-700">{erro}</p>}
        {!loading && !erro && notas.length === 0 && (
          <p className="text-sm text-slate-500">Nenhuma nota registrada para este negócio.</p>
        )}
        <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
          {notas.map((nota) => (
            <article key={nota.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="mb-2 flex flex-wrap justify-between gap-2 text-xs text-slate-500">
                <span>{nota.autor_nome || `Usuário AC #${nota.autor_external_id || 'não informado'}`}</span>
                <span>{formatarDataNota(nota.criada_em)}</span>
              </div>
              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-900">
                {nota.texto}
              </p>
              {nota.alterada_em && nota.alterada_em !== nota.criada_em && (
                <p className="mt-2 text-xs text-slate-500">
                  Editada em {formatarDataNota(nota.alterada_em)}
                </p>
              )}
            </article>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function resumoEvento(evento: NexoCuradoriaEvento) {
  const acao = evento.acao?.replace(/_/g, ' ') || 'consulta do Nexo'
  const partes = [
    evento.empresa_nome || evento.negocio_titulo || 'Empresa não informada',
    evento.contato_nome || 'Contato não informado',
    evento.external_id ? `Negócio ${evento.external_id}` : 'Negócio não identificado',
  ]
  return `${partes.join(' · ')} · ${acao}`
}

function resumoDecisaoSuperior(decisao: NexoCuradoriaDecisaoSuperior) {
  const partes = [
    decisao.empresa_nome || decisao.negocio_titulo || 'Empresa não informada',
    decisao.contato_nome || 'Contato não informado',
    decisao.external_id ? `Negócio ${decisao.external_id}` : 'Negócio não identificado',
  ]
  return partes.join(' · ')
}

function motivoEscalada(decisao: NexoCuradoriaDecisaoSuperior) {
  if (decisao.escalar_direcao) {
    return 'Impacto potencial em funil, risco, perda, indicador ou política comercial.'
  }
  return 'Validação operacional pelo gestor comercial.'
}

function rotuloStatusDecisao(status?: string) {
  if (status === 'aprovada_uso_operacional') return 'Aprovada para uso operacional'
  if (status === 'rejeitada') return 'Rejeitada'
  return 'Aguardando revisão'
}

function estiloStatusDecisao(status?: string) {
  if (status === 'aprovada_uso_operacional')
    return 'border-emerald-200/60 bg-emerald-50 text-emerald-700'
  if (status === 'rejeitada') return 'border-rose-200/60 bg-rose-50 text-rose-700'
  return 'border-sky-200/60 bg-sky-50 text-sky-700'
}

function rotuloStatusRevisaoIpcp(status?: string) {
  if (status === 'alteracao_formula_aprovada') return 'Fórmula aplicada'
  if (status === 'estudo_autorizado') return 'Fórmula aplicada'
  if (status === 'ajuste_solicitado') return 'Ajuste solicitado'
  if (status === 'rejeitada') return 'Alteração rejeitada'
  return 'Pendente de decisão'
}

function estiloStatusRevisaoIpcp(status?: string) {
  if (status === 'alteracao_formula_aprovada')
    return 'border-emerald-200/60 bg-emerald-50 text-emerald-700'
  if (status === 'estudo_autorizado') return 'border-emerald-200/60 bg-emerald-50 text-emerald-700'
  if (status === 'ajuste_solicitado') return 'border-violet-200/60 bg-violet-50 text-violet-700'
  if (status === 'rejeitada') return 'border-rose-200/60 bg-rose-50 text-rose-700'
  return 'border-amber-200/60 bg-amber-50 text-amber-700'
}

function revisaoIpcpTerminal(status?: string) {
  return (
    status === 'alteracao_formula_aprovada' ||
    status === 'estudo_autorizado' ||
    status === 'rejeitada'
  )
}

function auditoriaFormulaIpcp(decisao: NexoCuradoriaDecisaoSuperior) {
  if (!decisao.ipcp_formula_audit_json) return null
  try {
    const audit = JSON.parse(decisao.ipcp_formula_audit_json) as {
      aprovada_por_nome?: string
      aplicada_em?: string
      retirada_em?: string
      motivo?: string
    }
    return audit && typeof audit === 'object' ? audit : null
  } catch {
    return null
  }
}

const perguntasEntrevista = [
  'Qual orientação comercial única deve valer para este negócio ou situação consolidada?',
  'Existe alguma exceção, limite ou condição que o Nexo deve considerar antes de repetir essa orientação?',
  'Quem valida essa orientação final e em quais casos ela deve subir para decisão superior?',
]

const DECISAO_SUPERIOR_ALLOWLIST = new Set(['superadministrador', 'leitura-executiva'])

function classificarImpactoDecisaoNexo(respostas: string[]): ImpactoDecisaoCuradoria {
  const texto = respostas.join(' ').toLowerCase()
  return {
    altera_funil: /funil|etapa|fase/.test(texto),
    altera_risco: /risco|prioridade|probabilidade/.test(texto),
    altera_perda: /perda|perdido|desinteresse/.test(texto),
    altera_indicador: /indicador|ipcp|meta|conversão|conversao/.test(texto),
    altera_politica_comercial:
      /política comercial|politica comercial|procedimento|norma|regra padrão|regra padrao/.test(
        texto,
      ),
  }
}

function precisaDirecao(impacto: ImpactoDecisaoCuradoria) {
  return Object.values(impacto).some(Boolean)
}

export default function NexoCuradoria() {
  const { perfilSlug } = useIsSuperAdmin()
  const podeVerDecisaoSuperior = DECISAO_SUPERIOR_ALLOWLIST.has(perfilSlug ?? '')
  const [resumo, setResumo] = useState<NexoCuradoriaResumo>({ pendencias: 0, itens: [] })
  const [decisoesSuperiores, setDecisoesSuperiores] = useState<NexoCuradoriaDecisaoSuperior[]>([])
  const [decisoesHistorico, setDecisoesHistorico] = useState<NexoCuradoriaDecisaoSuperior[]>([])
  const [revisoesIpcpPendentes, setRevisoesIpcpPendentes] = useState<
    NexoCuradoriaDecisaoSuperior[]
  >([])
  const [decisoesRelacionadas, setDecisoesRelacionadas] = useState<NexoCuradoriaDecisaoSuperior[]>(
    [],
  )
  const [loading, setLoading] = useState(true)
  const [loadingDecisoesSuperiores, setLoadingDecisoesSuperiores] = useState(true)
  const [loadingHistoricoDecisoes, setLoadingHistoricoDecisoes] = useState(true)
  const [loadingRevisoesIpcp, setLoadingRevisoesIpcp] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [entrevistaAberta, setEntrevistaAberta] = useState(false)
  const [etapaEntrevista, setEtapaEntrevista] = useState(0)
  const [respostasEntrevista, setRespostasEntrevista] = useState<string[]>([])
  const [pendenciaSelecionada, setPendenciaSelecionada] = useState<NexoCuradoriaEvento | null>(null)
  const [salvandoEntrevista, setSalvandoEntrevista] = useState(false)
  const [entrevistaSalva, setEntrevistaSalva] = useState(false)
  const [entrevistaSalvaId, setEntrevistaSalvaId] = useState<string | undefined>()
  const [salvandoDecisaoSuperior, setSalvandoDecisaoSuperior] = useState(false)
  const [decisaoSuperiorSalva, setDecisaoSuperiorSalva] = useState(false)
  const [decisaoExistenteParaPendencia, setDecisaoExistenteParaPendencia] =
    useState<NexoCuradoriaDecisaoSuperior | null>(null)
  const [decisaoEmAjuste, setDecisaoEmAjuste] = useState<NexoCuradoriaDecisaoSuperior | null>(null)
  const [revisaoIpcpEmAjuste, setRevisaoIpcpEmAjuste] =
    useState<NexoCuradoriaDecisaoSuperior | null>(null)
  const [historicoAberto, setHistoricoAberto] = useState(false)
  const [historicoEmDetalhe, setHistoricoEmDetalhe] = useState<NexoCuradoriaDecisaoSuperior | null>(
    null,
  )
  const [regraAjuste, setRegraAjuste] = useState('')
  const [excecaoAjuste, setExcecaoAjuste] = useState('')
  const [responsavelAjuste, setResponsavelAjuste] = useState('')
  const [observacaoAjuste, setObservacaoAjuste] = useState('')
  const [condicoesAjusteIpcp, setCondicoesAjusteIpcp] = useState('')
  const [salvandoAcaoDecisao, setSalvandoAcaoDecisao] = useState(false)
  const [mensagemDecisaoSuperior, setMensagemDecisaoSuperior] = useState<string | null>(null)

  async function iniciarCuradoria(item?: NexoCuradoriaEvento) {
    const selecionada = item || resumo.itens[0] || null
    setPendenciaSelecionada(selecionada)
    setEntrevistaAberta(true)
    setEtapaEntrevista(0)
    setRespostasEntrevista([])
    setEntrevistaSalva(false)
    setEntrevistaSalvaId(undefined)
    setDecisaoSuperiorSalva(false)
    setDecisaoExistenteParaPendencia(null)
    setErro(null)
    if (selecionada) {
      try {
        const existente = await buscarDecisaoSuperiorExistenteCuradoriaNexo(selecionada)
        setDecisaoExistenteParaPendencia(existente)
      } catch (_) {
        setDecisaoExistenteParaPendencia(null)
      }
    }
  }

  function fecharEntrevista() {
    setEntrevistaAberta(false)
    setEtapaEntrevista(0)
    setRespostasEntrevista([])
    setPendenciaSelecionada(null)
    setEntrevistaSalva(false)
    setEntrevistaSalvaId(undefined)
    setDecisaoSuperiorSalva(false)
    setDecisaoExistenteParaPendencia(null)
  }

  function atualizarRespostaEntrevista(valor: string) {
    setRespostasEntrevista((atuais) => {
      const proximas = [...atuais]
      proximas[etapaEntrevista - 1] = valor
      return proximas
    })
  }

  async function avancarEntrevista() {
    if (etapaEntrevista === perguntasEntrevista.length) {
      if (!pendenciaSelecionada) {
        setErro('Selecione uma pendência antes de enviar a entrevista para revisão.')
        return
      }
      setSalvandoEntrevista(true)
      try {
        const entrevista = await salvarEntrevistaCuradoriaNexo({
          evento: pendenciaSelecionada,
          perguntas: perguntasEntrevista,
          respostas: respostasEntrevista,
        })
        setEntrevistaSalvaId(entrevista?.id)
        setEntrevistaSalva(true)
        setEtapaEntrevista(perguntasEntrevista.length + 1)
        setErro(null)
      } catch (_) {
        setErro('Não foi possível enviar a entrevista para revisão agora.')
      } finally {
        setSalvandoEntrevista(false)
      }
      return
    }
    setEtapaEntrevista((atual) => Math.min(atual + 1, perguntasEntrevista.length + 1))
  }

  async function recarregarDecisoes() {
    const [abertas, historico, revisoesIpcp] = await Promise.all([
      obterDecisoesSuperioresCuradoriaNexo(10),
      obterHistoricoDecisoesSuperioresCuradoriaNexo(20),
      obterRevisoesIpcpPendentesCuradoriaNexo(10),
    ])
    setDecisoesSuperiores(abertas)
    setDecisoesHistorico(historico)
    setRevisoesIpcpPendentes(revisoesIpcp)
    return { abertas, historico, revisoesIpcp }
  }

  async function encaminharDecisaoSuperior() {
    if (!pendenciaSelecionada) {
      setErro('Selecione uma pendência antes de encaminhar para decisão superior.')
      return
    }
    if (decisaoExistenteParaPendencia) {
      setErro(
        'Já existe decisão superior para este caso. Use Ajustar decisão existente para evitar conflito decisório.',
      )
      return
    }
    setSalvandoDecisaoSuperior(true)
    try {
      await salvarDecisaoSuperiorCuradoriaNexo({
        evento: pendenciaSelecionada,
        entrevistaId: entrevistaSalvaId,
        respostas: respostasEntrevista,
        impacto: classificarImpactoDecisaoNexo(respostasEntrevista),
      })
      await recarregarDecisoes()
      setDecisaoSuperiorSalva(true)
      setErro(null)
    } catch (_) {
      setErro('Não foi possível encaminhar a regra para decisão superior agora.')
    } finally {
      setSalvandoDecisaoSuperior(false)
    }
  }

  function ajustarDecisaoSuperior(decisao: NexoCuradoriaDecisaoSuperior) {
    setDecisaoEmAjuste(decisao)
    setRegraAjuste(decisao.regra_proposta || '')
    setExcecaoAjuste(decisao.excecao_condicao || '')
    setResponsavelAjuste(decisao.responsavel_validacao || '')
    setObservacaoAjuste(decisao.decisao_observacao || '')
    setMensagemDecisaoSuperior(null)
    setErro(null)
  }

  async function salvarAjusteDecisaoSuperior() {
    if (!decisaoEmAjuste) return
    setSalvandoAcaoDecisao(true)
    try {
      const atualizada = await atualizarDecisaoSuperiorCuradoriaNexo({
        id: decisaoEmAjuste.id,
        status:
          decisaoEmAjuste.status === 'aprovada_uso_operacional' ||
          decisaoEmAjuste.status === 'rejeitada'
            ? decisaoEmAjuste.status
            : 'aguardando_revisao',
        regra_proposta: regraAjuste,
        excecao_condicao: excecaoAjuste,
        responsavel_validacao: responsavelAjuste,
        decisao_observacao: observacaoAjuste,
      })
      const sincronizada =
        atualizada.status === 'aprovada_uso_operacional' || atualizada.status === 'rejeitada'
          ? await sincronizarDecisaoSegundoCerebroCuradoriaNexo(atualizada.id)
          : atualizada
      setDecisoesSuperiores((atuais) => {
        const semAtual = atuais.filter((decisao) => decisao.id !== sincronizada.id)
        return sincronizada.status === 'aguardando_revisao' ? [sincronizada, ...semAtual] : semAtual
      })
      setDecisoesHistorico((atuais) => {
        const semAtual = atuais.filter((decisao) => decisao.id !== sincronizada.id)
        return sincronizada.status === 'aprovada_uso_operacional' ||
          sincronizada.status === 'rejeitada'
          ? [sincronizada, ...semAtual]
          : semAtual
      })
      setDecisoesRelacionadas((atuais) =>
        atuais.map((decisao) => (decisao.id === sincronizada.id ? sincronizada : decisao)),
      )
      setDecisaoEmAjuste(null)
      setMensagemDecisaoSuperior(
        sincronizada.status === 'aguardando_revisao'
          ? 'Ajuste da decisão superior salvo. A pendência continua aguardando validação superior.'
          : 'Ajuste da decisão superior salvo e sincronizado com o conhecimento operacional.',
      )
      setErro(null)
    } catch (_) {
      setErro('Não foi possível salvar o ajuste da decisão superior agora.')
    } finally {
      setSalvandoAcaoDecisao(false)
    }
  }

  async function aprovarDecisaoSuperior(decisao: NexoCuradoriaDecisaoSuperior) {
    setSalvandoAcaoDecisao(true)
    try {
      const atualizada = await atualizarDecisaoSuperiorCuradoriaNexo({
        id: decisao.id,
        status: 'aprovada_uso_operacional',
        decisao_observacao: 'Decisão aprovada para uso operacional.',
      })
      const sincronizada = await sincronizarDecisaoSegundoCerebroCuradoriaNexo(atualizada.id)
      setDecisoesSuperiores((atuais) => atuais.filter((item) => item.id !== decisao.id))
      setDecisoesHistorico((atuais) => [
        sincronizada,
        ...atuais.filter((item) => item.id !== sincronizada.id),
      ])
      setDecisoesRelacionadas((atuais) =>
        atuais.map((item) => (item.id === sincronizada.id ? sincronizada : item)),
      )
      setMensagemDecisaoSuperior(
        'Decisão aprovada para uso operacional e sincronizada com o conhecimento operacional.',
      )
      setErro(null)
    } catch (_) {
      setErro('Não foi possível aprovar a decisão superior agora.')
    } finally {
      setSalvandoAcaoDecisao(false)
    }
  }

  async function rejeitarDecisaoSuperior(decisao: NexoCuradoriaDecisaoSuperior) {
    setSalvandoAcaoDecisao(true)
    try {
      const atualizada = await atualizarDecisaoSuperiorCuradoriaNexo({
        id: decisao.id,
        status: 'rejeitada',
        decisao_observacao:
          decisao.status === 'aprovada_uso_operacional'
            ? 'Decisão rejeitada após aprovação anterior; sai do uso operacional.'
            : 'Decisão rejeitada pelo decisor superior.',
      })
      const sincronizada = await sincronizarDecisaoSegundoCerebroCuradoriaNexo(atualizada.id)
      setDecisoesSuperiores((atuais) => atuais.filter((item) => item.id !== decisao.id))
      setDecisoesHistorico((atuais) => [
        sincronizada,
        ...atuais.filter((item) => item.id !== sincronizada.id),
      ])
      setRevisoesIpcpPendentes((atuais) => atuais.filter((item) => item.id !== decisao.id))
      setDecisoesRelacionadas((atuais) =>
        atuais.map((item) => (item.id === sincronizada.id ? sincronizada : item)),
      )
      setMensagemDecisaoSuperior(
        decisao.status === 'aprovada_uso_operacional'
          ? 'Decisão rejeitada. Ela sai do uso operacional e permanece registrada no histórico.'
          : 'Decisão rejeitada. Ela saiu da fila aberta e permanece registrada no histórico.',
      )
      setErro(null)
    } catch (_) {
      setErro('Não foi possível rejeitar a decisão superior agora.')
    } finally {
      setSalvandoAcaoDecisao(false)
    }
  }

  async function atualizarRevisaoIpcp(decisao: NexoCuradoriaDecisaoSuperior, status: string) {
    setSalvandoAcaoDecisao(true)
    try {
      const mensagem =
        status === 'alteracao_formula_aprovada'
          ? 'Alteração de fórmula IPCP aprovada e aplicada como versão governada. A mudança fica registrada com versão, origem, responsável e auditoria.'
          : status === 'ajuste_solicitado'
            ? 'Ajuste solicitado nas condições da regra antes de alterar a fórmula IPCP. A proposta permanece visível em acompanhamento.'
            : 'Alteração da fórmula IPCP rejeitada para esta decisão. A regra permanece apenas como orientação operacional.'
      const atualizada = await atualizarRevisaoIpcpCuradoriaNexo(decisao.id, status, mensagem)
      setRevisoesIpcpPendentes((atuais) => {
        if (status === 'rejeitada') return atuais.filter((item) => item.id !== decisao.id)
        const semAtual = atuais.filter((item) => item.id !== decisao.id)
        return [atualizada, ...semAtual]
      })
      setDecisoesHistorico((atuais) =>
        atuais.map((item) => (item.id === atualizada.id ? atualizada : item)),
      )
      setMensagemDecisaoSuperior(mensagem)
      setErro(null)
    } catch (_) {
      setErro('Não foi possível atualizar a revisão IPCP agora.')
    } finally {
      setSalvandoAcaoDecisao(false)
    }
  }

  function abrirAjusteRevisaoIpcp(decisao: NexoCuradoriaDecisaoSuperior) {
    setRevisaoIpcpEmAjuste(decisao)
    setCondicoesAjusteIpcp(decisao.regra_proposta || decisao.ipcp_revisao_motivo || '')
    setErro(null)
  }

  async function salvarAjusteRevisaoIpcp() {
    if (!revisaoIpcpEmAjuste) return
    const texto = condicoesAjusteIpcp.trim()
    if (!texto) {
      setErro('Informe quais condições da regra precisam ser ajustadas antes de salvar.')
      return
    }
    setSalvandoAcaoDecisao(true)
    try {
      const atualizada = await atualizarRevisaoIpcpCuradoriaNexo(
        revisaoIpcpEmAjuste.id,
        'ajuste_solicitado',
        texto,
      )
      setRevisoesIpcpPendentes((atuais) => [
        atualizada,
        ...atuais.filter((item) => item.id !== atualizada.id),
      ])
      setDecisoesHistorico((atuais) =>
        atuais.map((item) => (item.id === atualizada.id ? atualizada : item)),
      )
      setMensagemDecisaoSuperior(
        'Ajuste solicitado nas condições da regra. A proposta permanece visível para acompanhamento.',
      )
      setRevisaoIpcpEmAjuste(null)
      setCondicoesAjusteIpcp('')
      setErro(null)
    } catch (_) {
      setErro('Não foi possível salvar o ajuste da revisão IPCP agora.')
    } finally {
      setSalvandoAcaoDecisao(false)
    }
  }

  useEffect(() => {
    let ativo = true
    setLoading(true)
    setLoadingDecisoesSuperiores(true)
    setLoadingHistoricoDecisoes(true)
    setLoadingRevisoesIpcp(true)
    obterResumoCuradoriaNexo(8)
      .then((data) => {
        if (!ativo) return
        setResumo(data)
        Promise.all(data.itens.map((item) => buscarDecisaoSuperiorExistenteCuradoriaNexo(item)))
          .then((decisoes) => {
            if (!ativo) return
            setDecisoesRelacionadas(
              decisoes.filter(
                (decisao): decisao is NexoCuradoriaDecisaoSuperior =>
                  Boolean(decisao) && decisao.status === 'aguardando_revisao',
              ),
            )
          })
          .catch(() => {
            if (ativo) setDecisoesRelacionadas([])
          })
        setErro(null)
      })
      .catch(() => {
        if (!ativo) return
        setErro('Não foi possível carregar as pendências de curadoria agora.')
      })
      .finally(() => {
        if (ativo) setLoading(false)
      })
    if (podeVerDecisaoSuperior) {
      obterDecisoesSuperioresCuradoriaNexo(10)
        .then((data) => {
          if (!ativo) return
          setDecisoesSuperiores(data)
        })
        .catch(() => {
          if (!ativo) return
          setErro('Não foi possível carregar as decisões superiores agora.')
        })
        .finally(() => {
          if (ativo) setLoadingDecisoesSuperiores(false)
        })
      obterHistoricoDecisoesSuperioresCuradoriaNexo(20)
        .then((data) => {
          if (!ativo) return
          setDecisoesHistorico(data)
        })
        .catch(() => {
          if (!ativo) return
          setErro('Não foi possível carregar o histórico de decisões superiores agora.')
        })
        .finally(() => {
          if (ativo) setLoadingHistoricoDecisoes(false)
        })
      obterRevisoesIpcpPendentesCuradoriaNexo(10)
        .then((data) => {
          if (!ativo) return
          setRevisoesIpcpPendentes(data)
        })
        .catch(() => {
          if (!ativo) return
          setErro('Não foi possível carregar as revisões IPCP pendentes agora.')
        })
        .finally(() => {
          if (ativo) setLoadingRevisoesIpcp(false)
        })
    } else {
      setDecisoesSuperiores([])
      setDecisoesHistorico([])
      setRevisoesIpcpPendentes([])
      setLoadingDecisoesSuperiores(false)
      setLoadingHistoricoDecisoes(false)
      setLoadingRevisoesIpcp(false)
    }
    return () => {
      ativo = false
    }
  }, [podeVerDecisaoSuperior])

  return (
    <div className="space-y-6">
      {/* Cabeçalho neutro limpo padrão institucional */}
      <section className="flex flex-wrap items-end justify-between gap-4 rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Inteligência Comercial PMais · Governança
          </p>
          <h2 className="mt-1 flex items-center gap-2.5 text-2xl font-bold tracking-tight text-slate-900">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-100 text-violet-700 shadow-sm">
              <MessageSquareText aria-hidden="true" className="h-5 w-5" />
            </span>
            Curadoria Nexo
          </h2>
          <p className="mt-1.5 text-sm text-slate-600">
            Canal exclusivo para o Nexo consolidar pedidos de ajuda por negócio e conduzir uma
            entrevista objetiva quando houver decisões ou padrões que precisam virar conhecimento
            operacional.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className="rounded-full border-violet-200/80 bg-violet-50 px-2.5 py-1 text-[11px] font-medium text-violet-700"
          >
            Curadoria do conhecimento operacional
          </Badge>
          <Button
            onClick={() => iniciarCuradoria()}
            className="shrink-0 bg-slate-900 hover:bg-slate-800 text-white shadow-sm h-9 px-4 text-xs font-medium"
          >
            <MessageSquareText className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            Iniciar curadoria
          </Button>
        </div>
      </section>

      {/* Cards de Métricas / Contexto Governança */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="rounded-xl border border-slate-200/80 border-l-4 border-l-violet-500 bg-white shadow-sm transition-all duration-150 hover:shadow-md hover:border-slate-300">
          <CardHeader className="pb-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Fila de Curadoria
            </p>
            <CardTitle className="mt-1 flex items-center gap-2 text-base font-bold text-slate-900">
              <Bot className="h-4 w-4 text-violet-600" aria-hidden="true" />
              Pendências do Nexo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tracking-tight leading-none text-slate-900">
              {loading ? '...' : resumo.pendencias}
            </p>
            <p className="mt-2 text-xs text-slate-500">Itens aguardando curadoria humana.</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl border border-slate-200/80 border-l-4 border-l-emerald-500 bg-white shadow-sm transition-all duration-150 hover:shadow-md hover:border-slate-300">
          <CardHeader className="pb-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Diretrizes de Governança
            </p>
            <CardTitle className="mt-1 flex items-center gap-2 text-base font-bold text-slate-900">
              <ShieldCheck className="h-4 w-4 text-emerald-600" aria-hidden="true" />
              Governança
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-semibold text-slate-800">
              Entrevistas para alinhamento de processos comerciais
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
              O Nexo organiza perguntas e respostas para apoiar decisões comerciais.
            </p>
          </CardContent>
        </Card>
        <Card className="rounded-xl border border-slate-200/80 border-l-4 border-l-sky-500 bg-white shadow-sm transition-all duration-150 hover:shadow-md hover:border-slate-300">
          <CardHeader className="pb-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Diálogo Assistido
            </p>
            <CardTitle className="mt-1 flex items-center gap-2 text-base font-bold text-slate-900">
              <CheckCircle2 className="h-4 w-4 text-sky-600" aria-hidden="true" />
              Canal guiado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-semibold text-slate-800">
              Espaço para ajuda aberta em decisões estratégicas e operacionais
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
              O Nexo conduz o diálogo e registra os pontos necessários para a próxima decisão.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Seção 1: Aguardando curadoria */}
      <Card className="rounded-xl border border-slate-200/80 bg-white shadow-sm">
        <CardHeader className="border-b border-slate-100 pb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Triagem Operacional
              </p>
              <CardTitle className="text-lg font-bold text-slate-900">
                Aguardando curadoria
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Pedidos de ajuda do Nexo agrupados por negócio para validação da curadoria.
              </CardDescription>
            </div>
            <Badge
              variant="outline"
              className="rounded-full border-slate-200/80 bg-slate-50 px-2.5 py-0.5 text-[11px] font-medium text-slate-600"
            >
              {loading ? 'Carregando...' : `${resumo.itens.length} pendência(s)`}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {loading ? (
            <p className="text-xs text-slate-500">Carregando pendências...</p>
          ) : resumo.itens.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-3">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <p className="text-sm font-medium text-slate-700">Tudo em dia com a curadoria</p>
              <p className="mt-1 text-xs text-slate-500 max-w-sm">
                Não há pendências de curadoria neste momento. Novos sinais gerados pelo Ajuda do
                Nexo aparecerão aqui.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {resumo.itens.map((item) => {
                const decisaoDoItem = [...decisoesSuperiores, ...decisoesRelacionadas].find(
                  (decisao) =>
                    decisao.evento_id === item.id ||
                    (!!item.external_id && decisao.external_id === item.external_id),
                )
                return (
                  <div
                    key={item.id}
                    className="rounded-xl border border-slate-200/80 border-l-4 border-l-amber-500 bg-white p-4 shadow-sm transition-all duration-150 hover:shadow-md hover:border-slate-300"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-slate-900">{resumoEvento(item)}</p>
                        <p className="flex items-center gap-1 text-xs text-slate-500">
                          <Clock className="h-3 w-3 text-slate-400" />
                          Recebido em {dataCurta(item.created_at || item.created)}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className="rounded-full border-amber-200/60 bg-amber-50 px-2.5 py-0.5 text-[11px] font-medium text-amber-700"
                      >
                        Revisão obrigatória
                      </Badge>
                    </div>
                    {item.motivo_curadoria && (
                      <div className="mt-2.5 rounded-lg border border-amber-100 bg-amber-50/70 p-2.5 text-xs leading-relaxed text-amber-900">
                        <span className="font-semibold">Motivo da curadoria: </span>
                        {item.motivo_curadoria}
                      </div>
                    )}
                    {item.total_consultas && item.total_consultas > 1 && (
                      <Badge
                        variant="outline"
                        className="mt-2.5 rounded-full border-violet-200/60 bg-violet-50 px-2.5 py-0.5 text-[11px] font-medium text-violet-700"
                      >
                        {item.total_consultas} consultas agrupadas neste negócio
                      </Badge>
                    )}
                    {textoContextoSemResumoDeNotas(item.contexto_resumo) && (
                      <div className="mt-2.5 max-h-56 overflow-y-auto whitespace-pre-wrap break-words rounded-lg border border-slate-100 bg-slate-50/70 p-2.5 text-xs leading-relaxed text-slate-700">
                        {textoContextoSemResumoDeNotas(item.contexto_resumo)}
                      </div>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <NotasCuradoriaDialog
                        externalId={item.external_id}
                        notasIniciais={item.notas_followups || []}
                      />
                      {decisaoDoItem ? (
                        <>
                          <Badge
                            variant="outline"
                            className="rounded-full border-sky-200/60 bg-sky-50 px-2.5 py-0.5 text-[11px] font-medium text-sky-700"
                          >
                            Já existe decisão superior para este caso
                          </Badge>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => ajustarDecisaoSuperior(decisaoDoItem)}
                            className="border-slate-200 bg-white text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 hover:text-slate-900 h-8"
                          >
                            Ajustar decisão existente
                          </Button>
                        </>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => iniciarCuradoria(item)}
                          className="border-slate-200 bg-white text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 hover:text-slate-900 h-8"
                        >
                          Entrevistar sobre este negócio
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Seção 2: Decisões aguardando validação superior */}
      {podeVerDecisaoSuperior && (
        <Card className="rounded-xl border border-slate-200/80 bg-white shadow-sm">
          <CardHeader className="border-b border-slate-100 pb-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Alçada Executiva
                </p>
                <CardTitle className="text-lg font-bold text-slate-900">
                  Decisões aguardando validação superior
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Fila para superadmin ou leitor executivo tomar ciência e tratar regras comerciais
                  escaladas.
                </CardDescription>
              </div>
              <Badge
                variant="outline"
                className="rounded-full border-sky-200/60 bg-sky-50 px-2.5 py-0.5 text-[11px] font-medium text-sky-700"
              >
                {loadingDecisoesSuperiores
                  ? 'Carregando...'
                  : `${decisoesSuperiores.length} decisão(ões)`}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            {loadingDecisoesSuperiores ? (
              <p className="text-xs text-slate-500">Carregando decisões superiores...</p>
            ) : decisoesSuperiores.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-3">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <p className="text-sm font-medium text-slate-700">Fila executiva zerada</p>
                <p className="mt-1 text-xs text-slate-500 max-w-sm">
                  Não há decisões superiores aguardando validação neste momento.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {decisoesSuperiores.map((decisao) => (
                  <div
                    key={decisao.id}
                    className="rounded-xl border border-slate-200/80 border-l-4 border-l-sky-500 bg-white p-4 shadow-sm transition-all duration-150 hover:shadow-md hover:border-slate-300"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-slate-900">
                          {resumoDecisaoSuperior(decisao)}
                        </p>
                        <p className="flex items-center gap-1 text-xs text-slate-500">
                          <Clock className="h-3 w-3 text-slate-400" />
                          Recebido em {dataCurta(decisao.created_at || decisao.created)}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className="rounded-full border-sky-200/60 bg-sky-50 px-2.5 py-0.5 text-[11px] font-medium text-sky-700"
                      >
                        {decisao.escalar_direcao ? 'Escalar para direção' : 'Gestor comercial'}
                      </Badge>
                    </div>
                    <div className="mt-3 space-y-1.5 rounded-lg border border-slate-100 bg-slate-50/70 p-3 text-xs leading-relaxed text-slate-700">
                      <p>
                        <span className="font-semibold text-slate-900">Regra proposta:</span>{' '}
                        {decisao.regra_proposta || 'Regra não informada'}
                      </p>
                      <p>
                        <span className="font-semibold text-slate-900">Motivo da escalada:</span>{' '}
                        {motivoEscalada(decisao)}
                      </p>
                      <p>
                        <span className="font-semibold text-slate-900">Ação necessária:</span>{' '}
                        Aprovar, ajustar ou rejeitar a regra candidata antes de virar orientação
                        operacional.
                      </p>
                      {decisao.responsavel_validacao && (
                        <p>
                          <span className="font-semibold text-slate-900">
                            Responsável indicado:
                          </span>{' '}
                          {decisao.responsavel_validacao}
                        </p>
                      )}
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => aprovarDecisaoSuperior(decisao)}
                        disabled={salvandoAcaoDecisao}
                        className="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800 text-xs font-medium h-8 shadow-sm"
                      >
                        Aprovar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => ajustarDecisaoSuperior(decisao)}
                        disabled={salvandoAcaoDecisao}
                        className="border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 text-xs font-medium h-8 shadow-sm"
                      >
                        Ajustar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => rejeitarDecisaoSuperior(decisao)}
                        disabled={salvandoAcaoDecisao}
                        className="border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 hover:text-rose-800 text-xs font-medium h-8 shadow-sm"
                      >
                        Rejeitar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Seção 3: Proposta de alteração da fórmula IPCP */}
      {podeVerDecisaoSuperior && (
        <Card className="rounded-xl border border-slate-200/80 bg-white shadow-sm">
          <CardHeader className="border-b border-slate-100 pb-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Governança do IPCP
                </p>
                <CardTitle className="flex items-center gap-2 text-lg font-bold text-slate-900">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                    <BellRing className="h-4 w-4" aria-hidden="true" />
                  </span>
                  Proposta de alteração da fórmula IPCP
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Decisões aprovadas que podem alterar bloco, sub-bloco, peso ou critério do IPCP.
                  Ajuste as condições, rejeite a alteração ou aprove a mudança da fórmula.
                </CardDescription>
              </div>
              <Badge
                variant="outline"
                className="rounded-full border-amber-200/60 bg-amber-50 px-2.5 py-0.5 text-[11px] font-medium text-amber-700"
              >
                {loadingRevisoesIpcp
                  ? 'Carregando...'
                  : `${revisoesIpcpPendentes.length} proposta(s)`}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            {loadingRevisoesIpcp ? (
              <p className="text-xs text-slate-500">Carregando revisões IPCP pendentes...</p>
            ) : revisoesIpcpPendentes.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-3">
                  <BellRing className="h-5 w-5" />
                </div>
                <p className="text-sm font-medium text-slate-700">Fórmula governada estável</p>
                <p className="mt-1 text-xs text-slate-500 max-w-sm">
                  Não há proposta de alteração da fórmula IPCP neste momento.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {revisoesIpcpPendentes.map((decisao) => {
                  const revisaoTerminal = revisaoIpcpTerminal(decisao.ipcp_revisao_status)
                  const audit = auditoriaFormulaIpcp(decisao)
                  const formulaAplicadaEm = decisao.ipcp_formula_aplicada_em || audit?.aplicada_em
                  const borderTone = revisaoTerminal
                    ? decisao.ipcp_revisao_status === 'rejeitada'
                      ? 'border-l-4 border-l-rose-500'
                      : 'border-l-4 border-l-emerald-500'
                    : 'border-l-4 border-l-amber-500'
                  return (
                    <div
                      key={decisao.id}
                      className={`rounded-xl border bg-white shadow-sm transition-all duration-150 hover:shadow-md ${borderTone} ${
                        revisaoTerminal ? 'border-emerald-200 p-3' : 'border-amber-200 p-4'
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1">
                          <p className="text-sm font-bold text-slate-900">
                            {resumoDecisaoSuperior(decisao)}
                          </p>
                          <p className="flex items-center gap-1 text-xs text-slate-500">
                            <Clock className="h-3 w-3 text-slate-400" />
                            Sinalizado em{' '}
                            {dataCurta(decisao.updated_at || decisao.created_at || decisao.created)}
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${estiloStatusRevisaoIpcp(decisao.ipcp_revisao_status)}`}
                        >
                          {rotuloStatusRevisaoIpcp(decisao.ipcp_revisao_status)}
                        </Badge>
                      </div>
                      {revisaoTerminal ? (
                        <div className="mt-2 space-y-2 text-xs text-slate-600">
                          <div className="flex flex-wrap gap-x-4 gap-y-1">
                            <span>
                              <span className="font-semibold text-slate-800">Bloco:</span>{' '}
                              {decisao.ipcp_revisao_blocos || 'IPCP geral'}
                            </span>
                            {decisao.ipcp_revisao_status === 'alteracao_formula_aprovada' && (
                              <span>
                                <span className="font-semibold text-slate-800">Versão ativa:</span>{' '}
                                {decisao.ipcp_formula_versao || 'versão registrada'}
                              </span>
                            )}
                            {decisao.ipcp_revisao_status === 'alteracao_formula_aprovada' && (
                              <span>
                                <span className="font-semibold text-slate-800">Aplicada em:</span>{' '}
                                {dataCurta(formulaAplicadaEm)}
                              </span>
                            )}
                          </div>
                          {decisao.ipcp_revisao_status === 'alteracao_formula_aprovada' && (
                            <p className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-emerald-900">
                              <span className="font-semibold">
                                Alteração aplicada com segurança.
                              </span>{' '}
                              Versão governada ativa para os próximos cálculos diários.
                              {audit?.aprovada_por_nome
                                ? ` Aprovada por ${audit.aprovada_por_nome}.`
                                : ''}
                            </p>
                          )}
                          <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                            Decisão encerrada. Ações bloqueadas para evitar nova alteração sem
                            abertura de nova proposta governada.
                          </p>
                        </div>
                      ) : (
                        <>
                          <div className="mt-3 space-y-1.5 rounded-lg border border-amber-100 bg-amber-50/50 p-3 text-xs leading-relaxed text-slate-700">
                            <p>
                              <span className="font-semibold text-slate-900">Regra aprovada:</span>{' '}
                              {decisao.regra_proposta || 'Regra não informada'}
                            </p>
                            <p>
                              <span className="font-semibold text-slate-900">
                                Bloco ou sub-bloco afetado:
                              </span>{' '}
                              {decisao.ipcp_revisao_blocos || 'IPCP geral'}
                            </p>
                            <p>
                              <span className="font-semibold text-slate-900">Gatilho:</span> decisão
                              aprovada envolve indicador, política comercial, follow-up, conversão,
                              valor estratégico, risco, perda ou registro comercial.
                            </p>
                            <p className="text-slate-500 pt-1">
                              Ajuste as condições se a regra precisar de refinamento. Ao aprovar, a
                              mudança passa a ser aplicada como versão governada da fórmula IPCP,
                              com origem, responsável e auditoria.
                            </p>
                          </div>
                          <div className="mt-4 flex flex-wrap gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => abrirAjusteRevisaoIpcp(decisao)}
                              disabled={salvandoAcaoDecisao}
                              className="border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 text-xs font-medium h-8 shadow-sm"
                            >
                              Ajuste as condições da regra
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => atualizarRevisaoIpcp(decisao, 'rejeitada')}
                              disabled={salvandoAcaoDecisao}
                              className="border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 hover:text-rose-800 text-xs font-medium h-8 shadow-sm"
                            >
                              Rejeitar alteração da fórmula
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                atualizarRevisaoIpcp(decisao, 'alteracao_formula_aprovada')
                              }
                              disabled={salvandoAcaoDecisao}
                              className="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800 text-xs font-medium h-8 shadow-sm"
                            >
                              Aprovar e aplicar alteração de fórmula
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Botão de Histórico de decisões */}
      {podeVerDecisaoSuperior && (
        <div className="flex justify-end">
          <Button
            variant="outline"
            onClick={() => setHistoricoAberto(true)}
            disabled={loadingHistoricoDecisoes}
            className="border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 text-xs font-medium h-9 shadow-sm"
          >
            <History className="mr-1.5 h-3.5 w-3.5 text-slate-500" />
            Histórico de decisões
          </Button>
        </div>
      )}

      {mensagemDecisaoSuperior && (
        <Alert className="rounded-xl border border-emerald-200/80 bg-emerald-50/70 text-emerald-900">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
          <AlertTitle className="text-sm font-semibold text-emerald-950">
            Decisão superior atualizada
          </AlertTitle>
          <AlertDescription className="text-xs text-emerald-800">
            {mensagemDecisaoSuperior}
          </AlertDescription>
        </Alert>
      )}

      {/* Modal: Ajustar condições da regra IPCP */}
      <Dialog
        open={Boolean(revisaoIpcpEmAjuste)}
        onOpenChange={(open) => {
          if (!open) setRevisaoIpcpEmAjuste(null)
        }}
      >
        <DialogContent className="max-w-2xl rounded-xl border border-slate-200/80 bg-white shadow-lg">
          <DialogHeader>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Governança IPCP
            </p>
            <DialogTitle className="text-lg font-bold text-slate-900">
              Ajustar condições da regra IPCP
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Registre quais condições precisam ser alteradas antes de aprovar a mudança da fórmula.
            </DialogDescription>
          </DialogHeader>
          {revisaoIpcpEmAjuste && (
            <div className="space-y-4 pt-2">
              <div className="rounded-xl border border-slate-200/80 border-l-4 border-l-amber-500 bg-slate-50/70 p-3 text-xs text-slate-800">
                <p className="font-bold text-slate-900">
                  {resumoDecisaoSuperior(revisaoIpcpEmAjuste)}
                </p>
                <p className="mt-1 text-slate-500">
                  Bloco ou sub-bloco:{' '}
                  <span className="font-semibold text-slate-700">
                    {revisaoIpcpEmAjuste.ipcp_revisao_blocos || 'IPCP geral'}
                  </span>
                </p>
              </div>
              <label className="block space-y-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Regra e condições a ajustar
                <textarea
                  value={condicoesAjusteIpcp}
                  onChange={(event) => setCondicoesAjusteIpcp(event.target.value)}
                  className="min-h-32 w-full rounded-lg border border-slate-200 bg-white p-3 text-xs font-normal text-slate-800 shadow-sm outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 leading-relaxed"
                  placeholder="Ex.: exigir nome do decisor, limitar validade a 15 dias, ajustar peso sugerido ou transformar parte da regra em orientação operacional."
                />
              </label>
              <div className="flex flex-wrap gap-2 pt-2">
                <Button
                  onClick={salvarAjusteRevisaoIpcp}
                  disabled={salvandoAcaoDecisao}
                  className="bg-slate-900 hover:bg-slate-800 text-white shadow-sm text-xs font-medium h-9"
                >
                  {salvandoAcaoDecisao ? 'Salvando ajuste...' : 'Salvar ajuste'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setRevisaoIpcpEmAjuste(null)}
                  disabled={salvandoAcaoDecisao}
                  className="border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 text-xs font-medium h-9 shadow-sm"
                >
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal: Histórico de decisões */}
      <Dialog open={Boolean(historicoAberto)} onOpenChange={setHistoricoAberto}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto rounded-xl border border-slate-200/80 bg-white shadow-lg">
          <DialogHeader>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Trilha de Auditoria
            </p>
            <DialogTitle className="text-lg font-bold text-slate-900">
              Histórico de decisões
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Decisões resumidas com status, data e ações. Use Ver detalhes para abrir o conteúdo
              completo.
            </DialogDescription>
          </DialogHeader>
          {loadingHistoricoDecisoes ? (
            <p className="text-xs text-slate-500">Carregando histórico de decisões...</p>
          ) : decisoesHistorico.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center my-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-3">
                <History className="h-5 w-5" />
              </div>
              <p className="text-sm font-medium text-slate-700">Sem histórico recente</p>
              <p className="mt-1 text-xs text-slate-500 max-w-sm">
                Ainda não há decisões superiores aprovadas ou rejeitadas.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5 pt-2">
              {decisoesHistorico.map((decisao) => {
                const borderTone =
                  decisao.status === 'aprovada_uso_operacional'
                    ? 'border-l-4 border-l-emerald-500'
                    : decisao.status === 'rejeitada'
                      ? 'border-l-4 border-l-rose-500'
                      : 'border-l-4 border-l-sky-500'
                return (
                  <div
                    key={decisao.id}
                    className={`rounded-xl border border-slate-200/80 bg-white p-3 shadow-sm transition-all duration-150 hover:shadow-md ${borderTone}`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-slate-900">
                          {resumoDecisaoSuperior(decisao)}
                        </p>
                        <p className="flex items-center gap-1 text-xs text-slate-500">
                          <Clock className="h-3 w-3 text-slate-400" />
                          Decidido em{' '}
                          {dataCurta(decisao.updated_at || decisao.created_at || decisao.created)}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge
                          variant="outline"
                          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${estiloStatusDecisao(decisao.status)}`}
                        >
                          {rotuloStatusDecisao(decisao.status)}
                        </Badge>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setHistoricoEmDetalhe(decisao)}
                          disabled={salvandoAcaoDecisao}
                          className="border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 text-xs font-medium h-7 shadow-sm"
                        >
                          Ver detalhes
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => ajustarDecisaoSuperior(decisao)}
                          disabled={salvandoAcaoDecisao}
                          className="border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 text-xs font-medium h-7 shadow-sm"
                        >
                          Revisar
                        </Button>
                        {decisao.status === 'aprovada_uso_operacional' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => rejeitarDecisaoSuperior(decisao)}
                            disabled={salvandoAcaoDecisao}
                            className="border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 hover:text-rose-800 text-xs font-medium h-7 shadow-sm"
                          >
                            Retirar do uso
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal: Detalhe da decisão superior */}
      <Dialog
        open={Boolean(historicoEmDetalhe)}
        onOpenChange={(open) => {
          if (!open) setHistoricoEmDetalhe(null)
        }}
      >
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto rounded-xl border border-slate-200/80 bg-white shadow-lg">
          <DialogHeader>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Auditoria de Decisão
            </p>
            <DialogTitle className="text-lg font-bold text-slate-900">
              Detalhe da decisão superior
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Histórico completo preservado para auditoria da decisão.
            </DialogDescription>
          </DialogHeader>
          {historicoEmDetalhe && (
            <div className="space-y-3 pt-2 text-xs leading-relaxed text-slate-700">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200/80 border-l-4 border-l-violet-500 bg-slate-50/70 p-3.5">
                <p className="font-bold text-slate-900">
                  {resumoDecisaoSuperior(historicoEmDetalhe)}
                </p>
                <Badge
                  variant="outline"
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${estiloStatusDecisao(historicoEmDetalhe.status)}`}
                >
                  {rotuloStatusDecisao(historicoEmDetalhe.status)}
                </Badge>
              </div>
              <div className="rounded-xl border border-slate-200/80 bg-white p-4 space-y-2.5 shadow-sm">
                <p>
                  <span className="font-semibold text-slate-900">Data:</span>{' '}
                  <span className="text-slate-600">
                    {dataCurta(
                      historicoEmDetalhe.updated_at ||
                        historicoEmDetalhe.created_at ||
                        historicoEmDetalhe.created,
                    )}
                  </span>
                </p>
                <p>
                  <span className="font-semibold text-slate-900">Regra proposta:</span>{' '}
                  <span className="text-slate-800 font-medium">
                    {historicoEmDetalhe.regra_proposta || 'Regra não informada'}
                  </span>
                </p>
                {historicoEmDetalhe.excecao_condicao && (
                  <p>
                    <span className="font-semibold text-slate-900">Condição:</span>{' '}
                    <span className="text-slate-700">{historicoEmDetalhe.excecao_condicao}</span>
                  </p>
                )}
                {historicoEmDetalhe.decisao_observacao && (
                  <p>
                    <span className="font-semibold text-slate-900">Observação:</span>{' '}
                    <span className="text-slate-700">{historicoEmDetalhe.decisao_observacao}</span>
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => ajustarDecisaoSuperior(historicoEmDetalhe)}
                  disabled={salvandoAcaoDecisao}
                  className="border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 text-xs font-medium h-8 shadow-sm"
                >
                  Revisar decisão
                </Button>
                {historicoEmDetalhe.status === 'aprovada_uso_operacional' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => rejeitarDecisaoSuperior(historicoEmDetalhe)}
                    disabled={salvandoAcaoDecisao}
                    className="border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 hover:text-rose-800 text-xs font-medium h-8 shadow-sm"
                  >
                    Retirar do uso operacional
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Card de Ajuste de decisão superior */}
      {decisaoEmAjuste && (
        <Card className="rounded-xl border border-slate-200/80 border-l-4 border-l-sky-500 bg-white shadow-sm">
          <CardHeader className="border-b border-slate-100 pb-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Edição Governada
            </p>
            <CardTitle className="text-lg font-bold text-slate-900">
              Ajuste da decisão superior
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Ajuste a regra existente sem abrir uma nova resposta do zero para o mesmo caso.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 p-6">
            <div className="rounded-xl border border-sky-100 bg-sky-50/70 p-3.5 text-xs text-sky-900">
              <p className="font-bold text-slate-900">{resumoDecisaoSuperior(decisaoEmAjuste)}</p>
              <p className="mt-1 text-slate-600">
                {decisaoEmAjuste.status === 'aguardando_revisao'
                  ? 'A decisão continua aguardando validação superior após o ajuste.'
                  : 'Ao salvar, a decisão volta para aguardando validação superior antes de qualquer novo uso operacional.'}
              </p>
            </div>
            <label className="block space-y-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Regra proposta
              <textarea
                value={regraAjuste}
                onChange={(event) => setRegraAjuste(event.target.value)}
                className="min-h-24 w-full rounded-lg border border-slate-200 bg-white p-3 text-xs font-normal text-slate-800 shadow-sm outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 leading-relaxed"
              />
            </label>
            <label className="block space-y-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Exceção ou condição
              <textarea
                value={excecaoAjuste}
                onChange={(event) => setExcecaoAjuste(event.target.value)}
                className="min-h-20 w-full rounded-lg border border-slate-200 bg-white p-3 text-xs font-normal text-slate-800 shadow-sm outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 leading-relaxed"
              />
            </label>
            <label className="block space-y-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Responsável pela validação
              <textarea
                value={responsavelAjuste}
                onChange={(event) => setResponsavelAjuste(event.target.value)}
                className="min-h-16 w-full rounded-lg border border-slate-200 bg-white p-3 text-xs font-normal text-slate-800 shadow-sm outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 leading-relaxed"
              />
            </label>
            <label className="block space-y-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Observação da decisão
              <textarea
                value={observacaoAjuste}
                onChange={(event) => setObservacaoAjuste(event.target.value)}
                className="min-h-16 w-full rounded-lg border border-slate-200 bg-white p-3 text-xs font-normal text-slate-800 shadow-sm outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 leading-relaxed"
                placeholder="Opcional: registre o motivo do ajuste."
              />
            </label>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button
                onClick={salvarAjusteDecisaoSuperior}
                disabled={salvandoAcaoDecisao}
                className="bg-slate-900 hover:bg-slate-800 text-white shadow-sm text-xs font-medium h-9"
              >
                {salvandoAcaoDecisao ? 'Salvando ajuste...' : 'Salvar ajuste'}
              </Button>
              <Button
                variant="outline"
                onClick={() => setDecisaoEmAjuste(null)}
                disabled={salvandoAcaoDecisao}
                className="border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 text-xs font-medium h-9 shadow-sm"
              >
                Cancelar ajuste
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {erro && (
        <Alert variant="destructive" className="rounded-xl">
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          <AlertTitle className="text-sm font-semibold">Curadoria indisponível</AlertTitle>
          <AlertDescription className="text-xs">{erro}</AlertDescription>
        </Alert>
      )}

      {/* Card da Entrevista Guiada do Nexo */}
      {entrevistaAberta && (
        <Card className="rounded-xl border border-slate-200/80 border-l-4 border-l-violet-500 bg-white shadow-sm">
          <CardHeader className="border-b border-slate-100 pb-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Assistente Nexo
                </p>
                <CardTitle className="text-lg font-bold text-slate-900">
                  Entrevista guiada do Nexo
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Primeira versão do canal. O próximo passo será conectar esta conversa às
                  pendências selecionadas e salvar respostas estruturadas para revisão.
                </CardDescription>
              </div>
              <Badge
                variant="outline"
                className="rounded-full border-violet-200/60 bg-violet-50 px-2.5 py-0.5 text-[11px] font-medium text-violet-700"
              >
                Conhecimento operacional
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 p-6">
            {pendenciaSelecionada && (
              <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5 text-xs text-slate-700">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Pendência selecionada
                </p>
                <p className="mt-1 font-bold text-slate-900">
                  {resumoEvento(pendenciaSelecionada)}
                </p>
              </div>
            )}
            {decisaoExistenteParaPendencia && (
              <div className="rounded-xl border border-sky-100 bg-sky-50/70 p-4 text-xs leading-relaxed text-sky-900">
                <p className="font-bold">Já existe decisão superior para este caso.</p>
                <p className="mt-1 text-slate-600">
                  Para evitar conflito decisório, este caso não deve ser respondido do zero. Use
                  Ajustar decisão existente para revisar a regra já encaminhada.
                </p>
              </div>
            )}
            {etapaEntrevista === 0 ? (
              <>
                <div className="rounded-xl border border-violet-100 bg-violet-50/60 p-4 text-xs leading-relaxed text-slate-700">
                  <p className="font-bold text-violet-900 flex items-center gap-1.5">
                    <Bot className="h-4 w-4 text-violet-600" />
                    Nexo
                  </p>
                  <p className="mt-1.5 text-slate-600">
                    Vou conduzir perguntas objetivas sobre um padrão identificado no App Comercial.
                    Responda de forma curta, validando regra, exceção e responsável pela decisão.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button
                    onClick={() => setEtapaEntrevista(1)}
                    disabled={!pendenciaSelecionada || Boolean(decisaoExistenteParaPendencia)}
                    className="bg-slate-900 hover:bg-slate-800 text-white shadow-sm text-xs font-medium h-9"
                  >
                    Começar entrevista
                  </Button>
                  <Button
                    variant="outline"
                    onClick={fecharEntrevista}
                    className="border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 text-xs font-medium h-9 shadow-sm"
                  >
                    Fechar
                  </Button>
                </div>
              </>
            ) : etapaEntrevista <= perguntasEntrevista.length ? (
              <>
                <div className="rounded-xl border border-violet-100 bg-violet-50/60 p-4 text-xs leading-relaxed text-slate-700">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-violet-700">
                    Pergunta {etapaEntrevista} de {perguntasEntrevista.length}
                  </p>
                  <p className="mt-2 text-sm font-bold text-slate-900">
                    {perguntasEntrevista[etapaEntrevista - 1]}
                  </p>
                </div>
                <label className="block space-y-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Resposta curta para curadoria
                  <textarea
                    value={respostasEntrevista[etapaEntrevista - 1] || ''}
                    onChange={(event) => atualizarRespostaEntrevista(event.target.value)}
                    className="min-h-24 w-full rounded-lg border border-slate-200 bg-white p-3 text-xs font-normal text-slate-800 shadow-sm outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 leading-relaxed"
                    placeholder="Digite a orientação, regra ou observação validada."
                  />
                </label>
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button
                    onClick={avancarEntrevista}
                    disabled={salvandoEntrevista}
                    className="bg-slate-900 hover:bg-slate-800 text-white shadow-sm text-xs font-medium h-9"
                  >
                    {salvandoEntrevista
                      ? 'Enviando...'
                      : etapaEntrevista === perguntasEntrevista.length
                        ? 'Enviar para revisão'
                        : 'Próxima pergunta'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={fecharEntrevista}
                    className="border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 text-xs font-medium h-9 shadow-sm"
                  >
                    Fechar
                  </Button>
                </div>
              </>
            ) : (
              <div className="space-y-3 rounded-xl border border-emerald-100 bg-emerald-50/60 p-4 text-xs leading-relaxed text-emerald-950">
                <p className="font-medium text-emerald-900">
                  {entrevistaSalva
                    ? 'Entrevista enviada para revisão.'
                    : 'Entrevista registrada para revisão.'}{' '}
                  As respostas serão tratadas pela curadoria antes de encerrar a pendência.
                </p>
                <div className="rounded-lg border border-emerald-100 bg-white/90 p-3.5 text-slate-700 shadow-sm">
                  <p className="font-bold text-slate-900">Regra candidata para decisão</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">
                    O Nexo classifica se a proposta fica com o gestor comercial ou se deve escalar
                    para direção quando envolver funil, risco, perda, indicador ou política
                    comercial.
                  </p>
                  <p className="mt-2 text-xs font-bold text-slate-800">
                    Nível sugerido:{' '}
                    <span className="text-violet-700 font-semibold">
                      {precisaDirecao(classificarImpactoDecisaoNexo(respostasEntrevista))
                        ? 'Escalar para direção'
                        : 'Gestor comercial'}
                    </span>
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    onClick={encaminharDecisaoSuperior}
                    disabled={
                      salvandoDecisaoSuperior ||
                      decisaoSuperiorSalva ||
                      Boolean(decisaoExistenteParaPendencia)
                    }
                    className="bg-slate-900 hover:bg-slate-800 text-white shadow-sm text-xs font-medium h-9"
                  >
                    {decisaoSuperiorSalva
                      ? 'Encaminhada para decisão superior'
                      : salvandoDecisaoSuperior
                        ? 'Encaminhando...'
                        : 'Encaminhar para decisão superior'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={fecharEntrevista}
                    className="border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 text-xs font-medium h-9 shadow-sm"
                  >
                    Fechar
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
