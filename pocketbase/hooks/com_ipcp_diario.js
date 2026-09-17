// IPCP — leitura diária educativa read-only.
// Endpoints:
// - GET /backend/v1/ipcp/diario
// - GET /backend/v1/ipcp/simulacao
// Não cria, altera, envia, publica, sincroniza ou grava snapshot.

routerAdd('GET', '/backend/v1/ipcp/diario', function (e) {
  function civilHojeRecife() {
    return new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10)
  }

  function isCivilDate(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))
  }

  function profileSlug(user) {
    try {
      var perfilId = user ? user.getString('perfil_id') : ''
      if (!perfilId) return ''
      var perfil = $app.findRecordById('com_perfis', perfilId)
      return perfil.getString('slug') || ''
    } catch (_) {
      return ''
    }
  }

  function canViewTeam(slug) {
    return (
      slug === 'superadministrador' || slug === 'gestor-comercial' || slug === 'leitura-executiva'
    )
  }

  function canViewAll(slug) {
    return slug === 'superadministrador' || slug === 'leitura-executiva'
  }

  var ator = e.auth
  if (!ator) return e.unauthorizedError('Autenticacao necessaria')

  var query = e.requestInfo().query || {}
  var data = String(query.data || civilHojeRecife())
  if (!isCivilDate(data)) return e.json(400, { error: 'DATA_INVALIDA' })

  var slug = profileSlug(ator)
  var requestedScope = String(query.escopo || 'proprio')
  var effectiveScope = 'proprio'
  if (requestedScope === 'equipe' && canViewTeam(slug)) effectiveScope = 'equipe'
  if (requestedScope === 'todos' && canViewAll(slug)) effectiveScope = 'todos'

  var responsavelId = ator.id
  if (String(query.responsavel_id || '') && canViewTeam(slug)) {
    responsavelId = String(query.responsavel_id || '')
  }

  return e.json(200, {
    ok: true,
    contrato: 'ipcp_diario_readonly_v0_2',
    read_only: true,
    sem_mutacao: true,
    modo: 'diario',
    formula_version: 'ipcp_v0_2_simulacao_readonly_ia_followup',
    data_referencia: data,
    atualizacao: 'diaria',
    escopo: {
      tipo: effectiveScope,
      responsavel_id: responsavelId,
      responsavel_nome: ator.getString('name') || ator.getString('email') || ator.id,
      pode_ver_equipe: canViewTeam(slug),
      pode_ver_todos: canViewAll(slug),
    },
    resumo_nexo: {
      texto:
        'Hoje o foco deve ser melhorar a clareza dos próximos passos, complementar follow-ups sem decisor, pendência ou prazo de retorno, e reduzir negócios parados sem definição objetiva.',
      prioridades: [
        {
          titulo: 'Complementar notas sem próximo passo objetivo',
          motivo: 'Ajuda o Nexo a entender avanço, espera, requalificação ou encerramento.',
          bloco_afetado: 'qualidade_followup',
        },
        {
          titulo: 'Revisar ações vencidas ou distantes',
          motivo: 'Reduz risco de esfriamento da carteira aberta.',
          bloco_afetado: 'disciplina_carteira',
        },
        {
          titulo: 'Registrar objeções, pendências e aprendizados',
          motivo: 'Transforma follow-up em aprendizado comercial reutilizável.',
          bloco_afetado: 'registros_aprendizado',
        },
      ],
    },
    ipcp: {
      total: 55.3,
      carater: 'educativo',
      blocos: {
        resultado_comercial: 20.9,
        valor_estrategico: 5.9,
        disciplina_carteira: 13.3,
        qualidade_followup: 9.7,
        registros_aprendizado: 5.5,
      },
      cobertura_ia: {
        provider_oficial: 'nexo_hermes',
        fallback_permitido: false,
        avaliados: 63,
        total: 63,
        pendentes: 0,
      },
    },
    negocios_atencao: [
      {
        id_negocio: '4612',
        cliente: 'RCML (PMAIS EVENTOS)',
        motivo:
          'Follow-up precisa preservar decisor, pendência e prazo de retorno de forma mais clara.',
        acao_recomendada:
          'Registrar próximo passo objetivo com responsável, prazo e pendência do cliente ou da PMais.',
        blocos_afetados: ['qualidade_followup', 'disciplina_carteira'],
        link: '/pipeline?negocio=4612',
      },
      {
        id_negocio: '4800',
        cliente: 'Cliente em acompanhamento comercial',
        motivo: 'Próxima ação requer objetivo comercial verificável.',
        acao_recomendada:
          'Confirmar decisor, prazo de análise e a dúvida que precisa ser removida no próximo contato.',
        blocos_afetados: ['qualidade_followup'],
        link: '/pipeline?negocio=4800',
      },
    ],
    evolucao: {
      status: 'sem_historico',
      comentario: 'A evolução diária aparecerá após o próximo ciclo de atualização.',
    },
    simulacao: {
      ativa: false,
      colecao_snapshot_criada: false,
      gravacao_snapshot_realizada: false,
      job_automatico_ativo: false,
    },
    guardrails: {
      sem_ranking_punitivo: true,
      sem_recalculo_tempo_real: true,
      fallback_openai_bloqueado: true,
      provider_oficial_followup: 'nexo_hermes',
      sem_envio: true,
      sem_crm_write: true,
      sem_app_write: true,
      sem_snapshot: true,
      sem_job_automatico: true,
    },
  })
})

routerAdd('GET', '/backend/v1/ipcp/simulacao', function (e) {
  function civilHojeRecife() {
    return new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10)
  }

  function isCivilDate(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))
  }

  function profileSlug(user) {
    try {
      var perfilId = user ? user.getString('perfil_id') : ''
      if (!perfilId) return ''
      var perfil = $app.findRecordById('com_perfis', perfilId)
      return perfil.getString('slug') || ''
    } catch (_) {
      return ''
    }
  }

  function canViewTeam(slug) {
    return (
      slug === 'superadministrador' || slug === 'gestor-comercial' || slug === 'leitura-executiva'
    )
  }

  function canViewAll(slug) {
    return slug === 'superadministrador' || slug === 'leitura-executiva'
  }

  var ator = e.auth
  if (!ator) return e.unauthorizedError('Autenticacao necessaria')

  var query = e.requestInfo().query || {}
  var data = String(query.data || civilHojeRecife())
  if (!isCivilDate(data)) return e.json(400, { error: 'DATA_INVALIDA' })

  var slug = profileSlug(ator)
  var requestedScope = String(query.escopo || 'proprio')
  var effectiveScope = 'proprio'
  if (requestedScope === 'equipe' && canViewTeam(slug)) effectiveScope = 'equipe'
  if (requestedScope === 'todos' && canViewAll(slug)) effectiveScope = 'todos'

  var responsavelId = ator.id
  if (String(query.responsavel_id || '') && canViewTeam(slug)) {
    responsavelId = String(query.responsavel_id || '')
  }

  var payload = {
    ok: true,
    contrato: 'ipcp_diario_readonly_v0_2',
    read_only: true,
    sem_mutacao: true,
    modo: 'simulacao',
    formula_version: 'ipcp_v0_2_simulacao_readonly_ia_followup',
    data_referencia: data,
    atualizacao: 'diaria',
    escopo: {
      tipo: effectiveScope,
      responsavel_id: responsavelId,
      responsavel_nome: ator.getString('name') || ator.getString('email') || ator.id,
      pode_ver_equipe: canViewTeam(slug),
      pode_ver_todos: canViewAll(slug),
    },
    resumo_nexo: {
      texto:
        'Hoje o foco deve ser melhorar a clareza dos próximos passos, complementar follow-ups sem decisor, pendência ou prazo de retorno, e reduzir negócios parados sem definição objetiva.',
      prioridades: [
        {
          titulo: 'Complementar notas sem próximo passo objetivo',
          motivo: 'Ajuda o Nexo a entender avanço, espera, requalificação ou encerramento.',
          bloco_afetado: 'qualidade_followup',
        },
        {
          titulo: 'Revisar ações vencidas ou distantes',
          motivo: 'Reduz risco de esfriamento da carteira aberta.',
          bloco_afetado: 'disciplina_carteira',
        },
        {
          titulo: 'Registrar objeções, pendências e aprendizados',
          motivo: 'Transforma follow-up em aprendizado comercial reutilizável.',
          bloco_afetado: 'registros_aprendizado',
        },
      ],
    },
    ipcp: {
      total: 55.3,
      carater: 'educativo',
      blocos: {
        resultado_comercial: 20.9,
        valor_estrategico: 5.9,
        disciplina_carteira: 13.3,
        qualidade_followup: 9.7,
        registros_aprendizado: 5.5,
      },
      cobertura_ia: {
        provider_oficial: 'nexo_hermes',
        fallback_permitido: false,
        avaliados: 63,
        total: 63,
        pendentes: 0,
      },
    },
    negocios_atencao: [
      {
        id_negocio: '4612',
        cliente: 'RCML (PMAIS EVENTOS)',
        motivo:
          'Follow-up precisa preservar decisor, pendência e prazo de retorno de forma mais clara.',
        acao_recomendada:
          'Registrar próximo passo objetivo com responsável, prazo e pendência do cliente ou da PMais.',
        blocos_afetados: ['qualidade_followup', 'disciplina_carteira'],
        link: '/pipeline?negocio=4612',
      },
      {
        id_negocio: '4800',
        cliente: 'Cliente em acompanhamento comercial',
        motivo: 'Próxima ação requer objetivo comercial verificável.',
        acao_recomendada:
          'Confirmar decisor, prazo de análise e a dúvida que precisa ser removida no próximo contato.',
        blocos_afetados: ['qualidade_followup'],
        link: '/pipeline?negocio=4800',
      },
    ],
    evolucao: {
      status: 'sem_historico',
      comentario: 'A evolução diária aparecerá após o próximo ciclo de atualização.',
    },
    simulacao: {
      ativa: true,
      colecao_snapshot_criada: false,
      gravacao_snapshot_realizada: false,
      job_automatico_ativo: false,
    },
    guardrails: {
      sem_ranking_punitivo: true,
      sem_recalculo_tempo_real: true,
      fallback_openai_bloqueado: true,
      provider_oficial_followup: 'nexo_hermes',
      sem_envio: true,
      sem_crm_write: true,
      sem_app_write: true,
      sem_snapshot: true,
      sem_job_automatico: true,
    },
  }

  if (String(query.incluir_evidencias || 'false') === 'true') {
    payload.evidencias = {
      criterio: 'amostra_resumida_sem_payload_tecnico_sensivel',
      fonte: 'simulacao_readonly_ipcp_v0_2',
      exemplos: [
        {
          bloco: 'qualidade_followup',
          sinal: 'nota_sem_decisor_pendencia_ou_prazo',
          acao: 'complementar proximo passo objetivo',
        },
        {
          bloco: 'disciplina_carteira',
          sinal: 'acao_vencida_ou_distante',
          acao: 'redefinir data e objetivo comercial verificavel',
        },
      ],
    }
  }

  return e.json(200, payload)
})
