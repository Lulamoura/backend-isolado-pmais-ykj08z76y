import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import NexoAssistente from '@/pages/NexoAssistente'

const frentes = [
  'Recomendações do dia',
  'Negócios com risco de esfriamento',
  'Propostas sem retorno',
  'Notas ruins/incompletas',
  'Follow-ups atrasados ou mal definidos',
  'Aprendizados comerciais',
]

describe('NexoAssistente', () => {
  it('exibe a Central operacional do Nexo com as seis frentes aprovadas', () => {
    render(<NexoAssistente />)

    expect(screen.getByRole('heading', { name: /Assistente Nexo/i })).toBeInTheDocument()
    expect(screen.getByText(/visão geral/i)).toBeInTheDocument()
    frentes.forEach((frente) => expect(screen.getAllByText(frente).length).toBeGreaterThan(0))
    expect(screen.queryByText('Prospect ou nova oportunidade')).not.toBeInTheDocument()
    expect(screen.queryByText('Gerar sugestão assistida')).not.toBeInTheDocument()
  })

  it('troca a leitura operacional conforme a frente escolhida', async () => {
    const user = userEvent.setup()
    render(<NexoAssistente />)

    expect(screen.getByText(/Consolida o que merece atenção hoje/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Propostas sem retorno/i }))

    expect(screen.getByText(/proposta recém-enviada/i)).toBeInTheDocument()
    expect(screen.getByText('A proposta foi aberta?')).toBeInTheDocument()
    expect(screen.getByText(/fila de propostas por urgência/i)).toBeInTheDocument()
  })

  it('mantém escopo seguro sem envio automático nem mutação de negócios', () => {
    render(<NexoAssistente />)

    expect(screen.getByText(/não envia mensagens/i)).toBeInTheDocument()
    expect(screen.getByText(/não altera negócios/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Gerar painel com dados reais/i })).toBeDisabled()
  })
})
