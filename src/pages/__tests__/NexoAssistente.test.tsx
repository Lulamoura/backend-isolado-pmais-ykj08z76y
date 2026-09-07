import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import NexoAssistente from '@/pages/NexoAssistente'

describe('NexoAssistente', () => {
  it('gera uma sugestão assistida abrangente quando o operador clica no botão', () => {
    render(<NexoAssistente />)

    fireEvent.click(screen.getByRole('button', { name: /Proposta enviada ou em produção/i }))
    fireEvent.click(screen.getByRole('button', { name: /Sugerir follow-up da proposta/i }))
    fireEvent.change(screen.getByLabelText('Orientação para o Nexo'), {
      target: {
        value: 'Cliente abriu a proposta há 5 dias e questionou prazo de mobilização.',
      },
    })

    expect(screen.queryByText('Mensagem WhatsApp sugerida')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Gerar sugestão assistida/i }))

    expect(screen.getByText('Diagnóstico comercial')).toBeInTheDocument()
    expect(screen.getByText('Recomendações do Nexo')).toBeInTheDocument()
    expect(screen.getByText('Mensagem WhatsApp sugerida')).toBeInTheDocument()
    expect(screen.getByText('E-mail sugerido')).toBeInTheDocument()
    expect(screen.getByText('Roteiro de ligação')).toBeInTheDocument()
    expect(screen.getByText('Pendências a conferir')).toBeInTheDocument()
    expect(screen.getByText('Próximos passos')).toBeInTheDocument()
    expect(screen.getByText('Cuidados antes de usar')).toBeInTheDocument()
    expect(
      screen.getAllByText(/Cliente abriu a proposta há 5 dias e questionou prazo de mobilização/i),
    ).toHaveLength(2)
  })

  it('não habilita geração antes de escolher contexto e ação', () => {
    render(<NexoAssistente />)

    expect(screen.getByRole('button', { name: /Gerar sugestão assistida/i })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: /Prospect ou nova oportunidade/i }))
    expect(screen.getByRole('button', { name: /Gerar sugestão assistida/i })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: /Sugerir abordagem inicial/i }))
    expect(screen.getByRole('button', { name: /Gerar sugestão assistida/i })).toBeEnabled()
  })
})
