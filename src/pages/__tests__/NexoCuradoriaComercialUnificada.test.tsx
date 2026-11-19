import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const listar = vi.hoisted(() => vi.fn())
const transicionar = vi.hoisted(() => vi.fn())
const processarPublicacao = vi.hoisted(() => vi.fn())

vi.mock('@/services/nexo-curadoria', () => ({
  listarCasosCuradoriaComercial: listar,
  processarPublicacaoCuradoriaComercial: processarPublicacao,
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
  negocio_numero: '4821',
  negocio_titulo: 'Proposta Qualificada',
  responsavel_nome: 'Marcos Silva',
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

const respostasEntrevista = [
  'Submeter condições excepcionais à direção antes de responder ao cliente.',
  'Não aplicar a orientação quando a condição já estiver prevista em contrato.',
  'A gestão comercial registra a decisão e o responsável pelo próximo passo.',
  'Pode ser encaminhada porque a exceção e a responsabilidade estão claramente registradas.',
]

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
        regra_candidata: respostasEntrevista[0],
        entrevista_respostas: respostasEntrevista,
        entrevista_etapa: 4,
      },
    ],
    publicacao_pendente: [
      {
        ...casoBase,
        id: 'technical-pending-publication-id',
        status: 'aprovado',
        titulo: 'Orientação aprovada aguardando publicação',
        regra_candidata: respostasEntrevista[0],
        entrevista_respostas: respostasEntrevista,
        entrevista_etapa: 4,
        conhecimento_status: 'pendente_publicacao',
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
      {
        ...casoBase,
        id: 'technical-discarded-id',
        status: 'descartado',
        titulo: 'Orientação descartada antes da publicação',
        conhecimento_status: 'nao_publicado',
        reabertura_elegivel: false,
      },
    ],
  },
  contadores: {
    para_tratar: 1,
    aguardando_decisao: 1,
    publicacao_pendente: 1,
    conhecimento_aprovado: 1,
    historico: 2,
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
    processarPublicacao.mockReset().mockResolvedValue({
      ok: true,
      processados: 1,
      falhas: 0,
      ignorados: 0,
      invalidados: 0,
    })
  })

  it('mostra as cinco visões, alçadas e referências humanas sem expor identificadores técnicos', async () => {
    const user = userEvent.setup()
    render(<NexoCuradoriaComercialUnificada podeDecidirPublicacao />)

    expect(
      await screen.findByText(/rotinas claras e rastreáveis são tratadas automaticamente/i),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Conflitos e matérias sensíveis chegam à revisão humana/i),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        /baixa confiança ou rastreabilidade ausente, isoladamente, não criam trabalho humano/i,
      ),
    ).toBeInTheDocument()
    expect(await screen.findByText('Preferência recorrente de comunicação')).toBeInTheDocument()
    expect(screen.getByText('Cliente Horizonte')).toBeInTheDocument()
    expect(screen.getByText('Negócio nº 4821')).toBeInTheDocument()
    expect(screen.queryByText('Proposta Qualificada')).not.toBeInTheDocument()
    expect(screen.getByText('Responsável comercial: Marcos Silva')).toBeInTheDocument()
    expect(screen.getByText('WhatsApp')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Origem dos fatos: conversa registrada no WhatsApp e registro no App Comercial',
      ),
    ).toBeInTheDocument()
    expect(screen.getByText('Consolidação: Nexo')).toBeInTheDocument()
    expect(screen.getByText('Fatos que originaram a curadoria')).toBeInTheDocument()
    expect(screen.getByText('Por que exige curadoria')).toBeInTheDocument()
    expect(screen.getByText('Alçada: gestão comercial')).toBeInTheDocument()
    expect(screen.queryByText('technical-case-id-should-not-be-visible')).not.toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: /Aguardando decisão/ }))
    expect(screen.getByText('Condição comercial para validação')).toBeInTheDocument()
    expect(screen.getByText('Alçada: direção')).toBeInTheDocument()
    expect(screen.getByText('Respostas da entrevista guiada')).toBeInTheDocument()
    respostasEntrevista.forEach((resposta) =>
      expect(screen.getByText(resposta)).toBeInTheDocument(),
    )

    await user.click(screen.getByRole('tab', { name: /Publicação pendente/ }))
    expect(screen.getByText('Orientação aprovada aguardando publicação')).toBeInTheDocument()
    expect(screen.getByText('Aprovada; ainda não está em uso pelo Nexo')).toBeInTheDocument()
    expect(screen.queryByText('Aprovado para uso operacional')).not.toBeInTheDocument()
    expect(screen.getByText('Respostas da entrevista guiada')).toBeInTheDocument()
    respostasEntrevista.forEach((resposta) =>
      expect(screen.getByText(resposta)).toBeInTheDocument(),
    )

    await user.click(screen.getByRole('tab', { name: /Conhecimento vigente/ }))
    expect(screen.getByText('Registrar o próximo passo após cada reunião.')).toBeInTheDocument()
    expect(screen.getByText('Orientação vigente')).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: /Histórico/ }))
    expect(screen.getByText('Sinal não confirmado')).toBeInTheDocument()
    expect(screen.getByText('Publicação descartada')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reabrir análise' })).not.toBeInTheDocument()
  })

  it('salva a entrevista guiada como rascunho com controle de revisão', async () => {
    const user = userEvent.setup()
    render(<NexoCuradoriaComercialUnificada podeDecidirPublicacao />)

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
    render(<NexoCuradoriaComercialUnificada podeDecidirPublicacao />)

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

  it('publica a orientação somente após confirmação explícita e leitura de retorno', async () => {
    const user = userEvent.setup()
    transicionar.mockResolvedValueOnce({
      ok: true,
      caso: {
        ...resposta.visoes.publicacao_pendente[0],
        revisao: 3,
      },
      outbox_id: 'outbox-publicacao-governada',
      automatic_send_allowed: false,
      promocao_automatica_realizada: false,
    })
    render(<NexoCuradoriaComercialUnificada podeDecidirPublicacao />)

    await user.click(await screen.findByRole('tab', { name: /Publicação pendente/ }))
    await user.click(screen.getByRole('button', { name: 'Publicar orientação' }))
    expect(
      screen.getByRole('dialog', { name: 'Publicar orientação para o Nexo' }),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Confirmar publicação' }))

    await waitFor(() =>
      expect(transicionar).toHaveBeenCalledWith('technical-pending-publication-id', {
        acao: 'publicar',
        expected_revision: 2,
        regra_candidata: respostasEntrevista[0],
        decisao_observacao: 'Publicação confirmada pelo superadministrador.',
        confirmacao_publicacao: true,
      }),
    )
    await waitFor(() =>
      expect(processarPublicacao).toHaveBeenCalledWith('outbox-publicacao-governada'),
    )
  })

  it('invalida a aprovação anterior e reabre as quatro respostas para ajuste', async () => {
    const user = userEvent.setup()
    transicionar.mockResolvedValueOnce({
      ok: true,
      caso: {
        ...resposta.visoes.publicacao_pendente[0],
        revisao: 3,
        status: 'em_entrevista',
        conhecimento_status: 'nao_publicado',
      },
      automatic_send_allowed: false,
      promocao_automatica_realizada: false,
    })
    render(<NexoCuradoriaComercialUnificada podeDecidirPublicacao />)

    await user.click(await screen.findByRole('tab', { name: /Publicação pendente/ }))
    await user.click(screen.getByRole('button', { name: 'Ajustar antes de publicar' }))
    expect(screen.getByRole('dialog', { name: 'Ajustar antes de publicar' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Reabrir para ajuste' }))

    await waitFor(() =>
      expect(transicionar).toHaveBeenCalledWith('technical-pending-publication-id', {
        acao: 'ajustar_publicacao',
        expected_revision: 2,
        regra_candidata: respostasEntrevista[0],
        decisao_observacao: 'Aprovação anterior invalidada para ajuste da orientação.',
      }),
    )
    expect(await screen.findByRole('heading', { name: 'Entrevista guiada' })).toBeInTheDocument()
    expect(screen.getByLabelText('Resposta da etapa atual')).toHaveValue(respostasEntrevista[3])
  })

  it('descarta a publicação somente com justificativa e sem apagar o caso', async () => {
    const user = userEvent.setup()
    render(<NexoCuradoriaComercialUnificada podeDecidirPublicacao />)

    await user.click(await screen.findByRole('tab', { name: /Publicação pendente/ }))
    await user.click(screen.getByRole('button', { name: 'Descartar publicação' }))
    expect(screen.getByRole('dialog', { name: 'Descartar publicação' })).toBeInTheDocument()
    const confirmar = screen.getByRole('button', { name: 'Confirmar descarte' })
    expect(confirmar).toBeDisabled()
    await user.type(
      screen.getByLabelText('Justificativa obrigatória'),
      'A orientação não deve integrar o conhecimento operacional.',
    )
    await user.click(confirmar)

    await waitFor(() =>
      expect(transicionar).toHaveBeenCalledWith('technical-pending-publication-id', {
        acao: 'descartar_publicacao',
        expected_revision: 2,
        regra_candidata: respostasEntrevista[0],
        decisao_observacao: 'A orientação não deve integrar o conhecimento operacional.',
      }),
    )
    expect(processarPublicacao).not.toHaveBeenCalled()
  })

  it('oculta decisões de publicação para quem pode editar a curadoria sem alçada executiva', async () => {
    const user = userEvent.setup()
    render(<NexoCuradoriaComercialUnificada podeDecidirPublicacao={false} />)

    expect(await screen.findByRole('button', { name: 'Iniciar revisão' })).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: /Publicação pendente/ }))
    expect(screen.queryByRole('button', { name: 'Publicar orientação' })).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Ajustar antes de publicar' }),
    ).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Descartar publicação' })).not.toBeInTheDocument()
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

    await user.click(screen.getByRole('tab', { name: /Publicação pendente/ }))
    expect(screen.queryByRole('button', { name: 'Publicar orientação' })).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Ajustar antes de publicar' }),
    ).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Descartar publicação' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: /Conhecimento vigente/ }))
    expect(screen.queryByRole('button', { name: 'Retirar orientação' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: /Histórico/ }))
    expect(screen.queryByRole('button', { name: 'Reabrir análise' })).not.toBeInTheDocument()
    expect(transicionar).not.toHaveBeenCalled()
  })
})
