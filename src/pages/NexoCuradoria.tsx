import { useEffect, useState } from 'react'
import { AlertCircle, BellRing, Bot, CheckCircle2, MessageSquareText, ShieldCheck } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  buscarDecisaoSuperiorExistenteCuradoriaNexo,
  obterDecisoesSuperioresCuradoriaNexo,
  obterHistoricoDecisoesSuperioresCuradoriaNexo,
  obterResumoCuradoriaNexo,
  obterRevisoesIpcpPendentesCuradoriaNexo,
  salvarDecisaoSuperiorCuradoriaNexo,
  salvarEntrevistaCuradoriaNexo,
  sincronizarDecisaoSegundoCerebroCuradoriaNexo,
  atualizarDecisaoSuperiorCuradoriaNexo,
  type ImpactoDecisaoCuradoria,
  type NexoCuradoriaDecisaoSuperior,
  type NexoCuradoriaEvento,
  type NexoCuradoriaResumo,
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
  if (status === 'aprovada_uso_operacional') return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  if (status === 'rejeitada') return 'border-slate-300 bg-slate-100 text-slate-700'
  return 'border-blue-200 bg-blue-50 text-blue-700'
}

function rotuloStatusRevisaoIpcp(status?: string) {
  if (status === 'alteracao_formula_aprovada') return 'Fórmula aplicada'
  if (status === 'estudo_autorizado') return 'Fórmula aplicada'
  if (status === 'ajuste_solicitado') return 'Ajuste solicitado'
  if (status === 'rejeitada') return 'Alteração rejeitada'
  return 'Pendente de decisão'
}

function estiloStatusRevisaoIpcp(status?: string) {
  if (status === 'alteracao_formula_aprovada') return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  if (status === 'estudo_autorizado') return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  if (status === 'ajuste_solicitado') return 'border-violet-200 bg-violet-50 text-violet-700'
  if (status === 'rejeitada') return 'border-slate-300 bg-slate-100 text-slate-700'
  return 'border-amber-300 bg-amber-50 text-amber-700'
}

function revisaoIpcpTerminal(status?: string) {
  return status === 'alteracao_formula_aprovada' || status === 'estudo_autorizado' || status === 'rejeitada'
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
  'Qual regra comercial precisa ser confirmada neste caso?',
  'Existe alguma exceção ou condição que o Nexo deve considerar?',
  'Quem é o responsável pela decisão ou validação final deste alinhamento?',
]

const DECISAO_SUPERIOR_ALLOWLIST = new Set(['superadministrador', 'leitura-executiva'])

function classificarImpactoDecisaoNexo(respostas: string[]): ImpactoDecisaoCuradoria {
  const texto = respostas.join(' ').toLowerCase()
  return {
    altera_funil: /funil|etapa|fase/.test(texto),
    altera_risco: /risco|prioridade|probabilidade/.test(texto),
    altera_perda: /perda|perdido|desinteresse/.test(texto),
    altera_indicador: /indicador|ipcp|meta|conversão|conversao/.test(texto),
    altera_politica_comercial: /política comercial|politica comercial|procedimento|norma|regra padrão|regra padrao/.test(texto),
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
  const [revisoesIpcpPendentes, setRevisoesIpcpPendentes] = useState<NexoCuradoriaDecisaoSuperior[]>([])
  const [decisoesRelacionadas, setDecisoesRelacionadas] = useState<NexoCuradoriaDecisaoSuperior[]>([])
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
  const [decisaoExistenteParaPendencia, setDecisaoExistenteParaPendencia] = useState<NexoCuradoriaDecisaoSuperior | null>(null)
  const [decisaoEmAjuste, setDecisaoEmAjuste] = useState<NexoCuradoriaDecisaoSuperior | null>(null)
  const [revisaoIpcpEmAjuste, setRevisaoIpcpEmAjuste] = useState<NexoCuradoriaDecisaoSuperior | null>(null)
  const [historicoAberto, setHistoricoAberto] = useState(false)
  const [historicoEmDetalhe, setHistoricoEmDetalhe] = useState<NexoCuradoriaDecisaoSuperior | null>(null)
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
      setErro('Já existe decisão superior para este caso. Use Ajustar decisão existente para evitar conflito decisório.')
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
          decisaoEmAjuste.status === 'aprovada_uso_operacional' || decisaoEmAjuste.status === 'rejeitada'
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
        return sincronizada.status === 'aprovada_uso_operacional' || sincronizada.status === 'rejeitada'
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
      setDecisoesHistorico((atuais) => [sincronizada, ...atuais.filter((item) => item.id !== sincronizada.id)])
      setDecisoesRelacionadas((atuais) =>
        atuais.map((item) => (item.id === sincronizada.id ? sincronizada : item)),
      )
      setMensagemDecisaoSuperior('Decisão aprovada para uso operacional e sincronizada com o conhecimento operacional.')
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
      setDecisoesHistorico((atuais) => [sincronizada, ...atuais.filter((item) => item.id !== sincronizada.id)])
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
      setRevisoesIpcpPendentes((atuais) => [atualizada, ...atuais.filter((item) => item.id !== atualizada.id)])
      setDecisoesHistorico((atuais) =>
        atuais.map((item) => (item.id === atualizada.id ? atualizada : item)),
      )
      setMensagemDecisaoSuperior('Ajuste solicitado nas condições da regra. A proposta permanece visível para acompanhamento.')
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
      <section className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 via-white to-slate-50 p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl space-y-3">
            <Badge className="rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700 hover:bg-violet-100">
              Curadoria do conhecimento operacional
            </Badge>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold tracking-tight text-slate-950">Curadoria Nexo</h2>
              <p className="text-sm leading-relaxed text-slate-600">
                Canal exclusivo para o Nexo conduzir entrevista guiada com usuários habilitados
                quando houver decisões ou padrões que precisam ser curados antes de virar
                conhecimento operacional.
              </p>
            </div>
          </div>
          <Button
            onClick={() => iniciarCuradoria()}
            className="shrink-0 bg-violet-600 text-white hover:bg-violet-700"
          >
            <MessageSquareText className="mr-2 h-4 w-4" aria-hidden="true" />
            Iniciar curadoria
          </Button>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="rounded-xl border-slate-200 bg-white shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base text-slate-900">
              <Bot className="h-4 w-4 text-violet-600" aria-hidden="true" />
              Pendências do Nexo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-slate-950">
              {loading ? '...' : resumo.pendencias}
            </p>
            <p className="mt-1 text-xs text-slate-500">Itens aguardando curadoria humana.</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl border-slate-200 bg-white shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base text-slate-900">
              <ShieldCheck className="h-4 w-4 text-emerald-600" aria-hidden="true" />
              Governança
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-semibold text-slate-800">
              Entrevistas para alinhamento de processos comerciais
            </p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              O Nexo organiza perguntas e respostas para apoiar decisões comerciais.
            </p>
          </CardContent>
        </Card>
        <Card className="rounded-xl border-slate-200 bg-white shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base text-slate-900">
              <CheckCircle2 className="h-4 w-4 text-blue-600" aria-hidden="true" />
              Canal guiado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-semibold text-slate-800">
              Espaço para ajuda aberta em decisões estratégicas e operacionais
            </p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              O Nexo conduz o diálogo e registra os pontos necessários para a próxima decisão.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-xl border-slate-200 bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg text-slate-950">Aguardando curadoria</CardTitle>
          <CardDescription>
            Sinais gerados pelo uso do Ajuda do Nexo que precisam ser analisados antes de virar
            regra ou playbook.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-slate-500">Carregando pendências...</p>
          ) : resumo.itens.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
              Não há pendências de curadoria neste momento.
            </p>
          ) : (
            <div className="space-y-3">
              {resumo.itens.map((item) => {
                const decisaoDoItem = [...decisoesSuperiores, ...decisoesRelacionadas].find(
                  (decisao) => decisao.evento_id === item.id || (!!item.external_id && decisao.external_id === item.external_id),
                )
                return (
                <div
                  key={item.id}
                  className="rounded-xl border border-slate-200 bg-slate-50/80 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-slate-900">{resumoEvento(item)}</p>
                      <p className="text-xs text-slate-500">Recebido em {dataCurta(item.created_at || item.created)}</p>
                    </div>
                    <Badge variant="outline" className="rounded-full border-amber-200 bg-amber-50 text-amber-700">
                      Revisão obrigatória
                    </Badge>
                  </div>
                  {item.contexto_resumo && (
                    <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-slate-600">
                      {item.contexto_resumo}
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {decisaoDoItem ? (
                      <>
                        <Badge variant="outline" className="rounded-full border-blue-200 bg-blue-50 text-blue-700">
                          Já existe decisão superior para este caso
                        </Badge>
                        <Button variant="outline" size="sm" onClick={() => ajustarDecisaoSuperior(decisaoDoItem)}>
                          Ajustar decisão existente
                        </Button>
                      </>
                    ) : (
                      <Button variant="outline" size="sm" onClick={() => iniciarCuradoria(item)}>
                        Entrevistar sobre esta pendência
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



      {podeVerDecisaoSuperior && (
        <Card className="rounded-xl border-blue-200 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg text-slate-950">Decisões aguardando validação superior</CardTitle>
            <CardDescription>
              Fila para superadmin ou leitor executivo tomar ciência e tratar regras comerciais escaladas.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingDecisoesSuperiores ? (
              <p className="text-sm text-slate-500">Carregando decisões superiores...</p>
            ) : decisoesSuperiores.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
                Não há decisões superiores aguardando validação neste momento.
              </p>
            ) : (
              <div className="space-y-3">
                {decisoesSuperiores.map((decisao) => (
                  <div key={decisao.id} className="rounded-xl border border-blue-100 bg-blue-50/60 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-slate-950">
                          {resumoDecisaoSuperior(decisao)}
                        </p>
                        <p className="text-xs text-slate-500">
                          Recebido em {dataCurta(decisao.created_at || decisao.created)}
                        </p>
                      </div>
                      <Badge variant="outline" className="rounded-full border-blue-200 bg-white text-blue-700">
                        {decisao.escalar_direcao ? 'Escalar para direção' : 'Gestor comercial'}
                      </Badge>
                    </div>
                    <div className="mt-3 space-y-2 text-sm text-slate-700">
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
                        Aprovar, ajustar ou rejeitar a regra candidata antes de virar orientação operacional.
                      </p>
                      {decisao.responsavel_validacao && (
                        <p>
                          <span className="font-semibold text-slate-900">Responsável indicado:</span>{' '}
                          {decisao.responsavel_validacao}
                        </p>
                      )}
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={() => aprovarDecisaoSuperior(decisao)} disabled={salvandoAcaoDecisao}>
                        Aprovar
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => ajustarDecisaoSuperior(decisao)} disabled={salvandoAcaoDecisao}>
                        Ajustar
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => rejeitarDecisaoSuperior(decisao)} disabled={salvandoAcaoDecisao}>
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

      {podeVerDecisaoSuperior && (
        <Card className="rounded-xl border-amber-200 bg-amber-50/70 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-slate-950">
              <BellRing className="h-4 w-4 text-amber-600" aria-hidden="true" />
              Proposta de alteração da fórmula IPCP
            </CardTitle>
            <CardDescription>
              Decisões aprovadas que podem alterar bloco, sub-bloco, peso ou critério do IPCP. Ajuste as condições, rejeite a alteração ou aprove a mudança da fórmula.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingRevisoesIpcp ? (
              <p className="text-sm text-slate-500">Carregando revisões IPCP pendentes...</p>
            ) : revisoesIpcpPendentes.length === 0 ? (
              <p className="rounded-xl border border-dashed border-amber-200 bg-white/70 p-6 text-sm text-slate-600">
                Não há proposta de alteração da fórmula IPCP neste momento.
              </p>
            ) : (
              <div className="space-y-3">
                {revisoesIpcpPendentes.map((decisao) => {
                  const revisaoTerminal = revisaoIpcpTerminal(decisao.ipcp_revisao_status)
                  const audit = auditoriaFormulaIpcp(decisao)
                  const formulaAplicadaEm = decisao.ipcp_formula_aplicada_em || audit?.aplicada_em
                  return (
                  <div key={decisao.id} className={`rounded-xl border bg-white ${revisaoTerminal ? 'border-emerald-200 p-3' : 'border-amber-200 p-4'}`}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-slate-950">
                          {resumoDecisaoSuperior(decisao)}
                        </p>
                        <p className="text-xs text-slate-500">
                          Sinalizado em {dataCurta(decisao.updated_at || decisao.created_at || decisao.created)}
                        </p>
                      </div>
                      <Badge variant="outline" className={`rounded-full ${estiloStatusRevisaoIpcp(decisao.ipcp_revisao_status)}`}>
                        {rotuloStatusRevisaoIpcp(decisao.ipcp_revisao_status)}
                      </Badge>
                    </div>
                    {revisaoTerminal ? (
                      <div className="mt-2 space-y-2 text-xs text-slate-600">
                        <div className="flex flex-wrap gap-x-4 gap-y-1">
                          <span><span className="font-semibold text-slate-800">Bloco:</span> {decisao.ipcp_revisao_blocos || 'IPCP geral'}</span>
                          {decisao.ipcp_revisao_status === 'alteracao_formula_aprovada' && (
                            <span><span className="font-semibold text-slate-800">Versão ativa:</span> {decisao.ipcp_formula_versao || 'versão registrada'}</span>
                          )}
                          {decisao.ipcp_revisao_status === 'alteracao_formula_aprovada' && (
                            <span><span className="font-semibold text-slate-800">Aplicada em:</span> {dataCurta(formulaAplicadaEm)}</span>
                          )}
                        </div>
                        {decisao.ipcp_revisao_status === 'alteracao_formula_aprovada' && (
                          <p className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-emerald-900">
                            <span className="font-semibold">Alteração aplicada com segurança.</span> Versão governada ativa para os próximos cálculos diários.
                            {audit?.aprovada_por_nome ? ` Aprovada por ${audit.aprovada_por_nome}.` : ''}
                          </p>
                        )}
                        <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                          Decisão encerrada. Ações bloqueadas para evitar nova alteração sem abertura de nova proposta governada.
                        </p>
                      </div>
                    ) : (
                      <>
                        <div className="mt-3 space-y-2 text-sm text-slate-700">
                          <p>
                            <span className="font-semibold text-slate-900">Regra aprovada:</span>{' '}
                            {decisao.regra_proposta || 'Regra não informada'}
                          </p>
                          <p>
                            <span className="font-semibold text-slate-900">Bloco ou sub-bloco afetado:</span>{' '}
                            {decisao.ipcp_revisao_blocos || 'IPCP geral'}
                          </p>
                          <p>
                            <span className="font-semibold text-slate-900">Gatilho:</span>{' '}
                            decisão aprovada envolve indicador, política comercial, follow-up, conversão, valor estratégico, risco, perda ou registro comercial.
                          </p>
                          <p className="text-xs text-slate-600">
                            Ajuste as condições se a regra precisar de refinamento. Ao aprovar, a mudança passa a ser aplicada como versão governada da fórmula IPCP, com origem, responsável e auditoria.
                          </p>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <Button variant="outline" size="sm" onClick={() => abrirAjusteRevisaoIpcp(decisao)} disabled={salvandoAcaoDecisao}>
                            Ajuste as condições da regra
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => atualizarRevisaoIpcp(decisao, 'rejeitada')} disabled={salvandoAcaoDecisao}>
                            Rejeitar alteração da fórmula
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => atualizarRevisaoIpcp(decisao, 'alteracao_formula_aprovada')} disabled={salvandoAcaoDecisao}>
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

      <Card className="rounded-xl border-blue-200 bg-blue-50/60 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg text-slate-950">Canal de decisão superior</CardTitle>
          <CardDescription>
            Regras propostas para validação sobem para gestão ou direção quando afetarem funil,
            risco, perda, indicador ou política comercial.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-blue-100 bg-white p-3">
              <p className="text-sm font-semibold text-slate-900">Aguardando revisão</p>
              <p className="mt-1 text-xs text-slate-500">Regra candidata recebida após entrevista guiada.</p>
            </div>
            <div className="rounded-xl border border-emerald-100 bg-white p-3">
              <p className="text-sm font-semibold text-slate-900">Aprovada para uso operacional</p>
              <p className="mt-1 text-xs text-slate-500">Orientação validada para uso pelo Comercial.</p>
            </div>
            <div className="rounded-xl border border-amber-100 bg-white p-3">
              <p className="text-sm font-semibold text-slate-900">Escalar para direção</p>
              <p className="mt-1 text-xs text-slate-500">Decisão exige diretoria quando altera critério sensível.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {podeVerDecisaoSuperior && (
        <div className="flex justify-end">
          <Button variant="outline" onClick={() => setHistoricoAberto(true)} disabled={loadingHistoricoDecisoes}>
            Histórico de decisões
          </Button>
        </div>
      )}

      {mensagemDecisaoSuperior && (
        <Alert>
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          <AlertTitle>Decisão superior atualizada</AlertTitle>
          <AlertDescription>{mensagemDecisaoSuperior}</AlertDescription>
        </Alert>
      )}

      <Dialog open={Boolean(revisaoIpcpEmAjuste)} onOpenChange={(open) => {
        if (!open) setRevisaoIpcpEmAjuste(null)
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Ajustar condições da regra IPCP</DialogTitle>
            <DialogDescription>
              Registre quais condições precisam ser alteradas antes de aprovar a mudança da fórmula.
            </DialogDescription>
          </DialogHeader>
          {revisaoIpcpEmAjuste && (
            <div className="space-y-4">
              <div className="rounded-xl border border-amber-100 bg-amber-50 p-3 text-sm text-amber-900">
                <p className="font-semibold">{resumoDecisaoSuperior(revisaoIpcpEmAjuste)}</p>
                <p className="mt-1 text-xs">Bloco ou sub-bloco: {revisaoIpcpEmAjuste.ipcp_revisao_blocos || 'IPCP geral'}</p>
              </div>
              <label className="block space-y-2 text-sm font-medium text-slate-700">
                Regra e condições a ajustar
                <textarea
                  value={condicoesAjusteIpcp}
                  onChange={(event) => setCondicoesAjusteIpcp(event.target.value)}
                  className="min-h-32 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-800 outline-none ring-blue-200 focus:ring-2"
                  placeholder="Ex.: exigir nome do decisor, limitar validade a 15 dias, ajustar peso sugerido ou transformar parte da regra em orientação operacional."
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <Button onClick={salvarAjusteRevisaoIpcp} disabled={salvandoAcaoDecisao} className="bg-blue-600 text-white hover:bg-blue-700">
                  {salvandoAcaoDecisao ? 'Salvando ajuste...' : 'Salvar ajuste'}
                </Button>
                <Button variant="outline" onClick={() => setRevisaoIpcpEmAjuste(null)} disabled={salvandoAcaoDecisao}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(historicoAberto)} onOpenChange={setHistoricoAberto}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Histórico de decisões</DialogTitle>
            <DialogDescription>
              Decisões resumidas com status, data e ações. Use Ver detalhes para abrir o conteúdo completo.
            </DialogDescription>
          </DialogHeader>
          {loadingHistoricoDecisoes ? (
            <p className="text-sm text-slate-500">Carregando histórico de decisões...</p>
          ) : decisoesHistorico.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
              Ainda não há decisões superiores aprovadas ou rejeitadas.
            </p>
          ) : (
            <div className="space-y-2">
              {decisoesHistorico.map((decisao) => (
                <div key={decisao.id} className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-slate-950">
                        {resumoDecisaoSuperior(decisao)}
                      </p>
                      <p className="text-xs text-slate-500">
                        Decidido em {dataCurta(decisao.updated_at || decisao.created_at || decisao.created)}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className={`rounded-full ${estiloStatusDecisao(decisao.status)}`}>
                        {rotuloStatusDecisao(decisao.status)}
                      </Badge>
                      <Button variant="outline" size="sm" onClick={() => setHistoricoEmDetalhe(decisao)} disabled={salvandoAcaoDecisao}>
                        Ver detalhes
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => ajustarDecisaoSuperior(decisao)} disabled={salvandoAcaoDecisao}>
                        Revisar
                      </Button>
                      {decisao.status === 'aprovada_uso_operacional' && (
                        <Button variant="outline" size="sm" onClick={() => rejeitarDecisaoSuperior(decisao)} disabled={salvandoAcaoDecisao}>
                          Retirar do uso
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(historicoEmDetalhe)} onOpenChange={(open) => {
        if (!open) setHistoricoEmDetalhe(null)
      }}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhe da decisão superior</DialogTitle>
            <DialogDescription>Histórico completo preservado para auditoria da decisão.</DialogDescription>
          </DialogHeader>
          {historicoEmDetalhe && (
            <div className="space-y-3 text-sm text-slate-700">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="font-semibold text-slate-950">{resumoDecisaoSuperior(historicoEmDetalhe)}</p>
                <Badge variant="outline" className={`rounded-full ${estiloStatusDecisao(historicoEmDetalhe.status)}`}>
                  {rotuloStatusDecisao(historicoEmDetalhe.status)}
                </Badge>
              </div>
              <p><span className="font-semibold text-slate-900">Data:</span> {dataCurta(historicoEmDetalhe.updated_at || historicoEmDetalhe.created_at || historicoEmDetalhe.created)}</p>
              <p><span className="font-semibold text-slate-900">Regra proposta:</span> {historicoEmDetalhe.regra_proposta || 'Regra não informada'}</p>
              {historicoEmDetalhe.excecao_condicao && <p><span className="font-semibold text-slate-900">Condição:</span> {historicoEmDetalhe.excecao_condicao}</p>}
              {historicoEmDetalhe.decisao_observacao && <p><span className="font-semibold text-slate-900">Observação:</span> {historicoEmDetalhe.decisao_observacao}</p>}
              <div className="flex flex-wrap gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => ajustarDecisaoSuperior(historicoEmDetalhe)} disabled={salvandoAcaoDecisao}>
                  Revisar decisão
                </Button>
                {historicoEmDetalhe.status === 'aprovada_uso_operacional' && (
                  <Button variant="outline" size="sm" onClick={() => rejeitarDecisaoSuperior(historicoEmDetalhe)} disabled={salvandoAcaoDecisao}>
                    Retirar do uso operacional
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {decisaoEmAjuste && (
        <Card className="rounded-xl border-blue-200 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg text-slate-950">Ajuste da decisão superior</CardTitle>
            <CardDescription>
              Ajuste a regra existente sem abrir uma nova resposta do zero para o mesmo caso.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm text-blue-900">
              <p className="font-semibold">{resumoDecisaoSuperior(decisaoEmAjuste)}</p>
              <p className="mt-1 text-xs">
                {decisaoEmAjuste.status === 'aguardando_revisao'
                  ? 'A decisão continua aguardando validação superior após o ajuste.'
                  : 'Ao salvar, a decisão volta para aguardando validação superior antes de qualquer novo uso operacional.'}
              </p>
            </div>
            <label className="block space-y-2 text-sm font-medium text-slate-700">
              Regra proposta
              <textarea
                value={regraAjuste}
                onChange={(event) => setRegraAjuste(event.target.value)}
                className="min-h-24 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-800 outline-none ring-blue-200 focus:ring-2"
              />
            </label>
            <label className="block space-y-2 text-sm font-medium text-slate-700">
              Exceção ou condição
              <textarea
                value={excecaoAjuste}
                onChange={(event) => setExcecaoAjuste(event.target.value)}
                className="min-h-20 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-800 outline-none ring-blue-200 focus:ring-2"
              />
            </label>
            <label className="block space-y-2 text-sm font-medium text-slate-700">
              Responsável pela validação
              <textarea
                value={responsavelAjuste}
                onChange={(event) => setResponsavelAjuste(event.target.value)}
                className="min-h-16 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-800 outline-none ring-blue-200 focus:ring-2"
              />
            </label>
            <label className="block space-y-2 text-sm font-medium text-slate-700">
              Observação da decisão
              <textarea
                value={observacaoAjuste}
                onChange={(event) => setObservacaoAjuste(event.target.value)}
                className="min-h-16 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-800 outline-none ring-blue-200 focus:ring-2"
                placeholder="Opcional: registre o motivo do ajuste."
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <Button onClick={salvarAjusteDecisaoSuperior} disabled={salvandoAcaoDecisao} className="bg-blue-600 text-white hover:bg-blue-700">
                {salvandoAcaoDecisao ? 'Salvando ajuste...' : 'Salvar ajuste'}
              </Button>
              <Button variant="outline" onClick={() => setDecisaoEmAjuste(null)} disabled={salvandoAcaoDecisao}>
                Cancelar ajuste
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {erro && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          <AlertTitle>Curadoria indisponível</AlertTitle>
          <AlertDescription>{erro}</AlertDescription>
        </Alert>
      )}



      {entrevistaAberta && (
        <Card className="rounded-xl border-violet-200 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg text-slate-950">Entrevista guiada do Nexo</CardTitle>
            <CardDescription>
              Primeira versão do canal. O próximo passo será conectar esta conversa às pendências
              selecionadas e salvar respostas estruturadas para revisão.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {pendenciaSelecionada && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Pendência selecionada
                </p>
                <p className="mt-1 font-semibold text-slate-900">
                  {resumoEvento(pendenciaSelecionada)}
                </p>
              </div>
            )}
            {decisaoExistenteParaPendencia && (
              <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm leading-relaxed text-blue-900">
                <p className="font-semibold">Já existe decisão superior para este caso.</p>
                <p className="mt-1">
                  Para evitar conflito decisório, este caso não deve ser respondido do zero. Use
                  Ajustar decisão existente para revisar a regra já encaminhada.
                </p>
              </div>
            )}
            {etapaEntrevista === 0 ? (
              <>
                <div className="rounded-xl border border-violet-100 bg-violet-50 p-4 text-sm leading-relaxed text-slate-700">
                  <p className="font-semibold text-slate-900">Nexo</p>
                  <p className="mt-1">
                    Vou conduzir perguntas objetivas sobre um padrão identificado no App Comercial.
                    Responda de forma curta, validando regra, exceção e responsável pela decisão.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => setEtapaEntrevista(1)}
                    disabled={!pendenciaSelecionada || Boolean(decisaoExistenteParaPendencia)}
                    className="bg-violet-600 text-white hover:bg-violet-700"
                  >
                    Começar entrevista
                  </Button>
                  <Button variant="outline" onClick={fecharEntrevista}>
                    Fechar
                  </Button>
                </div>
              </>
            ) : etapaEntrevista <= perguntasEntrevista.length ? (
              <>
                <div className="rounded-xl border border-violet-100 bg-violet-50 p-4 text-sm leading-relaxed text-slate-700">
                  <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">
                    Pergunta {etapaEntrevista} de {perguntasEntrevista.length}
                  </p>
                  <p className="mt-2 font-semibold text-slate-900">
                    {perguntasEntrevista[etapaEntrevista - 1]}
                  </p>
                </div>
                <label className="block space-y-2 text-sm font-medium text-slate-700">
                  Resposta curta para curadoria
                  <textarea
                    value={respostasEntrevista[etapaEntrevista - 1] || ''}
                    onChange={(event) => atualizarRespostaEntrevista(event.target.value)}
                    className="min-h-24 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-800 outline-none ring-violet-200 focus:ring-2"
                    placeholder="Digite a orientação, regra ou observação validada."
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={avancarEntrevista}
                    disabled={salvandoEntrevista}
                    className="bg-violet-600 text-white hover:bg-violet-700"
                  >
                    {salvandoEntrevista
                      ? 'Enviando...'
                      : etapaEntrevista === perguntasEntrevista.length
                        ? 'Enviar para revisão'
                        : 'Próxima pergunta'}
                  </Button>
                  <Button variant="outline" onClick={fecharEntrevista}>
                    Fechar
                  </Button>
                </div>
              </>
            ) : (
              <div className="space-y-3 rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm leading-relaxed text-emerald-900">
                <p>
                  {entrevistaSalva ? 'Entrevista enviada para revisão.' : 'Entrevista registrada para revisão.'} As respostas serão tratadas antes de virar regra
                  ou playbook comercial.
                </p>
                <div className="rounded-lg border border-emerald-100 bg-white/80 p-3 text-slate-700">
                  <p className="font-semibold text-slate-900">Regra candidata para decisão</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">
                    O Nexo classifica se a proposta fica com o gestor comercial ou se deve escalar
                    para direção quando envolver funil, risco, perda, indicador ou política comercial.
                  </p>
                  <p className="mt-2 text-xs font-semibold text-slate-700">
                    Nível sugerido:{' '}
                    {precisaDirecao(classificarImpactoDecisaoNexo(respostasEntrevista))
                      ? 'Escalar para direção'
                      : 'Gestor comercial'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={encaminharDecisaoSuperior}
                    disabled={salvandoDecisaoSuperior || decisaoSuperiorSalva || Boolean(decisaoExistenteParaPendencia)}
                    className="bg-blue-600 text-white hover:bg-blue-700"
                  >
                    {decisaoSuperiorSalva
                      ? 'Encaminhada para decisão superior'
                      : salvandoDecisaoSuperior
                        ? 'Encaminhando...'
                        : 'Encaminhar para decisão superior'}
                  </Button>
                  <Button variant="outline" onClick={fecharEntrevista}>
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
