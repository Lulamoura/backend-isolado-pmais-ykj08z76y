import { describe, expect, it } from 'vitest'
import {
  CHAVES_AMIGAVEIS,
  GRUPOS_PARAMETROS_AMIGAVEIS,
  PARAMETROS_INTEGRACAO_ACTIVECAMPAIGN,
} from '../parametros-amigaveis'

const parametros = GRUPOS_PARAMETROS_AMIGAVEIS.flatMap((grupo) => grupo.parametros)
const parametrosAmigaveis = [...parametros, ...PARAMETROS_INTEGRACAO_ACTIVECAMPAIGN]

describe('configurações amigáveis do sistema', () => {
  it('não repete chaves e mantém os grupos operacionais', () => {
    expect(GRUPOS_PARAMETROS_AMIGAVEIS.map((grupo) => grupo.id)).toEqual([
      'propostas',
      'notificacoes',
      'prazos',
      'padroes',
    ])
    expect(CHAVES_AMIGAVEIS.size).toBe(parametrosAmigaveis.length)
  })

  it('usa controles adequados para booleanos, prazos e valores fechados', () => {
    const porChave = new Map(parametrosAmigaveis.map((parametro) => [parametro.chave, parametro]))

    expect(porChave.get('proposta.email_habilitado')?.controle).toBe('booleano')
    expect(porChave.get('proposta.sem_abertura_dias_uteis')).toMatchObject({
      controle: 'numero',
      unidade: 'dias úteis',
    })
    expect(porChave.get('activecampaign.deal_base_url')).toMatchObject({
      controle: 'url',
      recomendado: 'https://pmaisservicos89463.activehosted.com/app/deals/',
    })
    expect(porChave.get('comercial.escopo_padrao')?.opcoes?.map((opcao) => opcao.valor)).toEqual([
      'proprios',
      'equipe',
      'todos',
    ])
  })

  it('explica os controles críticos em linguagem orientada à ação', () => {
    const paginaPublica = parametros.find(
      (parametro) => parametro.chave === 'proposta.pagina_publica_habilitada',
    )
    const emailAbertura = parametros.find(
      (parametro) => parametro.chave === 'proposta.email_notificar_remetente_abertura',
    )

    expect(paginaPublica?.titulo).toBe('Página pública de propostas')
    expect(paginaPublica?.alerta).toContain('links públicos')
    expect(emailAbertura?.descricao).toContain('primeira vez')
  })
})
