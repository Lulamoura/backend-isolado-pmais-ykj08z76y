import { describe, expect, it } from 'vitest'

import {
  ehOperadorComercial,
  formatarDataHoraRecife,
  rotuloDirecao,
  rotuloEstadoOperacional,
  rotuloEventoWhatsApp,
  rotuloMidia,
} from '@/lib/whatsapp-uazapi-display'

describe('exibição operacional do WhatsApp', () => {
  it('converte data UTC para o padrão regional de Recife', () => {
    expect(formatarDataHoraRecife('2026-09-30 20:44:18.000Z')).toBe('30/09/2026 às 17:44')
  })

  it('não apresenta valor inválido como data técnica', () => {
    expect(formatarDataHoraRecife('')).toBe('Não informada')
    expect(formatarDataHoraRecife('valor-inválido')).toBe('Não informada')
  })

  it('separa operadores comerciais de sondas técnicas', () => {
    expect(ehOperadorComercial('Cristiane PMais')).toBe(true)
    expect(ehOperadorComercial('prod_probe')).toBe(false)
    expect(ehOperadorComercial('forwarder_probe')).toBe(false)
    expect(ehOperadorComercial('redirect_probe')).toBe(false)
    expect(ehOperadorComercial('Monitoramento Produção PMais')).toBe(false)
  })

  it('humaniza códigos operacionais sem expor nomes técnicos', () => {
    expect(rotuloEventoWhatsApp('messages')).toBe('Mensagem recebida')
    expect(rotuloDirecao('enviada_operadora')).toBe('Enviada pela equipe comercial')
    expect(rotuloMidia('AudioMessage')).toBe('Áudio')
    expect(rotuloEstadoOperacional('pendente_transcricao')).toBe('Aguardando transcrição')
  })
})
