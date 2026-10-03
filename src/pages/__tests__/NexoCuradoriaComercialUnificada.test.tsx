import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const listar = vi.hoisted(() => vi.fn())
const transicionar = vi.hoisted(() => vi.fn())

vi.mock('@/services/nexo-curadoria', () => ({
  listarCasosCuradoriaComercial: listar,
  transicionarCasoCuradoriaComercial: transicionar,
}))

import NexoCuradoriaComercialUnificada from '@/components/nexo/NexoCuradoriaComercialUnificada'

const casoBase = {
  id: 'technical-case-id-should-not-be-visible',
  revisao: 2,
  status: 'aberto_curadoria',
  fonte_principal: 'whatsapp_uazapi',
  fontes: ['whatsapp_uazapi', 'nexo_app'],
  empresa_nome: 'Cliente Horizonte',
  contato_nome: 'Marina Cliente',
  negocio_numero: 'OE-501',
  negocio_titulo: 'Terceirização operacional',
  responsavel_nome: 'Equipe Comercial',
  assunto_chave: 'preferencia_comunicacao',
  titulo: 'Preferência recorrente de comunicação',
  resumo_factual: 'O cliente prefere receber resumos objetivos antes das reuniões.',
  motivo_curadoria: 'O padrão apareceu em três casos independentes.',
  regra_candidata: null,
  evidencia_contagem: 3,
  recorrencia_contagem: 3,
  risco_classe: 'medio',
  alcada: 'gestao_comercial',
  sensivel_motivos: [],
  confianca: 'media',
  human_review_required: true,
  automatic_promotion_allowed: false,
  entrevista_respostas: [],
  entrevista_etapa: 0,
  decisao_observacao: null,
  conhecimento_status: 'nao_publicado',
  last_seen_at: '2026-10-01 12:00:00.000Z',
  decisao_em: null,
}

const resposta = {
  ok: true,
  visoes: {
    para_tratar: [casoBase],
    aguardando_decisao: [
      {
        ...casoBase,
        id: 'technical-sensitive-id',
        revisao: 4,
        status: 'aguardando_direcao',
        titulo: 'Condição comercial para validação',
        assunto_chave: 'politica_comercial',
        alcada: 'direcao',
        risco_classe: 'alto',
        sensivel_motivos: ['politica_comercial'],
        regra_candidata: 'Submeter condições excepcionais à direção antes de responder ao cliente.',
      },
    ],
    conhecimento_aprovado: [
      {
        ...casoBase,
        id: 'technical-approved-id',
        status: 'aprovado',
        regra_candidata: 'Registrar o próximo passo após cada reunião.',
        conhecimento_status: 'ativo',
      },
    ],
    historico: [
      {
        ...casoBase,
        id: 'technical-history-id',
        status: 'rejeitado',
        titulo: 'Sinal não confirmado',
        reabertura_elegivel: false,
      },
    ],
  },
  contadores: {
    para_tratar: 1,
    aguardando_decisao: 1,
    conhecimento_aprovado: 1,
    historico: 1,
  },
  guardrails: {
    sem_payload_bruto: true,
    sem_ids_tecnicos_visiveis: true,
    automatic_send_allowed: false,
  },
}

describe('Curadoria Comercial Unificada', () => {
  beforeEach(() => {
    listar.mockReset().mockResolvedValue(resposta)
    transicionar.mockReset().mockResolvedValue({
      ok: true,
      caso: { ...casoBase, revisao: 3, status: 'em_entrevista' },
      automatic_send_allowed: false,
      promocao_automatica_realizada: false,
    })
  })

  it('mostra as quatro visões e referências humanas sem expor identificadores técnicos', async () => {
    const user = userEvent.setup()
    render(<NexoCuradoriaComercialUnificada />)

    expect(
      await screen.findByText(/Assuntos comuns só entram após três casos independentes/i),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/matérias sensíveis seguem imediatamente para decisão/i),
    ).toBeInTheDocument()
    expect(await screen.findByText('Preferência recorrente de comunicação')).toBeInTheDocument()
    expect(screen.getByText('Cliente Horizonte')).toBeInTheDocument()
    expect(screen.getByText(/OE-501/)).toBeInTheDocument()
    expect(screen.getByText('WhatsApp')).toBeInTheDocument()
    expect(screen.queryByText('technical-case-id-should-not-be-visible')).not.toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: /Aguardando decisão/ }))
    expect(screen.getByText('Condição comercial para validação')).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: /Conhecimento aprovado/ }))
    expect(screen.getByText('Registrar o próximo passo após cada reunião.')).toBeInTheDocument()
    expect(screen.getByText('Orientação vigente')).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: /Histórico/ }))
    expect(screen.getByText('Sinal não confirmado')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reabrir análise' })).not.toBeInTheDocument()
  })

  it('salva a entrevista guiada como rascunho com controle de revisão', async () => {
    const user = userEvent.setup()
    render(<NexoCuradoriaComercialUnificada />)

    await user.click(await screen.findByRole('button', { name: 'Iniciar revisão' }))
    expect(screen.getByRole('heading', { name: 'Entrevista guiada' })).toBeInTheDocument()
    expect(
      screen.getByText('Qual orientação comercial deve valer para situações como esta?'),
    ).toBeInTheDocument()

    await user.type(screen.getByLabelText('Resposta da etapa atual'), 'Enviar um resumo objetivo.')
    await user.click(screen.getByRole('button', { name: 'Salvar e continuar depois' }))

    await waitFor(() =>
      expect(transicionar).toHaveBeenCalledWith('technical-case-id-should-not-be-visible', {
        acao: 'salvar_rascunho',
        expected_revision: 2,
        entrevista_etapa: 1,
        entrevista_respostas: ['Enviar um resumo objetivo.'],
        regra_candidata: 'Enviar um resumo objetivo.',
      }),
    )
    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: 'Entrevista guiada' })).not.toBeInTheDocument(),
    )
  })

  it('envia aprovação somente pela transição governada do backend', async () => {
    const user = userEvent.setup()
    render(<NexoCuradoriaComercialUnificada />)

    await user.click(await screen.findByRole('tab', { name: /Aguardando decisão/ }))
    await user.click(screen.getByRole('button', { name: 'Aprovar orientação' }))

    await waitFor(() =>
      expect(transicionar).toHaveBeenCalledWith('technical-sensitive-id', {
        acao: 'aprovar',
        expected_revision: 4,
        regra_candidata: 'Submeter condições excepcionais à direção antes de responder ao cliente.',
        decisao_observacao: 'Aprovada após revisão humana.',
      }),
    )
  })

  it('fica estritamente somente leitura sem renderizar nem disparar ações mutáveis', async () => {
    const user = userEvent.setup()
    render(<NexoCuradoriaComercialUnificada somenteLeitura />)

    expect(await screen.findByText('Modo somente leitura')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Iniciar revisão' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: /Aguardando decisão/ }))
    expect(screen.queryByRole('button', { name: 'Aprovar orientação' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ajustar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Rejeitar' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: /Conhecimento aprovado/ }))
    expect(screen.queryByRole('button', { name: 'Retirar orientação' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: /Histórico/ }))
    expect(screen.queryByRole('button', { name: 'Reabrir análise' })).not.toBeInTheDocument()
    expect(transicionar).not.toHaveBeenCalled()
  })
})
