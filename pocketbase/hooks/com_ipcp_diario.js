// IPCP — leitura diária educativa read-only.
// Endpoints:
// - GET /backend/v1/ipcp/diario
// - GET /backend/v1/ipcp/simulacao
// - POST /backend/v1/ipcp/snapshots/simulado
// - POST /backend/v1/ipcp/processamento-diario/homologacao
// GETs permanecem read-only. POST grava somente snapshot simulado/homologação, sem CRM, sem envio e sem job automático.

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
    return slug === 'superadministrador' || slug === 'gestor-comercial' || slug === 'leitura-executiva'
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
    return slug === 'superadministrador' || slug === 'gestor-comercial' || slug === 'leitura-executiva'
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


routerAdd('POST', '/backend/v1/ipcp/snapshots/simulado', function (e) {
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
    return slug === 'superadministrador' || slug === 'gestor-comercial' || slug === 'leitura-executiva'
  }

  function canPersistSnapshot(slug) {
    return slug === 'superadministrador' || slug === 'gestor-comercial'
  }

  function ensureSnapshotCollection(app) {
    try {
      return app.findCollectionByNameOrId('com_ipcp_snapshots')
    } catch (_) {
      var collection = new Collection({
        name: 'com_ipcp_snapshots',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
          { name: 'snapshot_key', type: 'text', required: true, max: 180 },
          { name: 'modo', type: 'text', required: true, max: 40 },
          { name: 'data_referencia', type: 'text', required: true, max: 10 },
          { name: 'escopo', type: 'text', required: true, max: 20 },
          { name: 'responsavel_id', type: 'text', required: true, max: 80 },
          { name: 'responsavel_nome', type: 'text', max: 160 },
          { name: 'formula_version', type: 'text', required: true, max: 120 },
          { name: 'ipcp_total', type: 'number', required: true, min: 0, max: 100 },
          { name: 'status', type: 'text', required: true, max: 40 },
          { name: 'criado_por_id', type: 'text', required: true, max: 80 },
          { name: 'origem', type: 'text', required: true, max: 80 },
          { name: 'payload', type: 'json' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_com_ipcp_snapshots_snapshot_key ON com_ipcp_snapshots (snapshot_key)',
          'CREATE INDEX idx_com_ipcp_snapshots_data_escopo ON com_ipcp_snapshots (data_referencia, escopo)',
        ],
      })
      app.save(collection)
      return app.findCollectionByNameOrId('com_ipcp_snapshots')
    }
  }

  var ator = e.auth
  if (!ator) return e.unauthorizedError('Autenticacao necessaria')

  var slug = profileSlug(ator)
  if (!canPersistSnapshot(slug)) return e.forbiddenError('Perfil sem permissao para snapshot simulado')

  var body = {}
  try {
    body = e.requestInfo().body || {}
  } catch (_) {
    body = {}
  }

  if (String(body.confirmacao || '') !== 'CRIAR_SNAPSHOT_SIMULADO_IPCP') {
    return e.json(400, { error: 'CONFIRMACAO_OBRIGATORIA' })
  }

  var data = String(body.data_referencia || civilHojeRecife())
  if (!isCivilDate(data)) return e.json(400, { error: 'DATA_INVALIDA' })

  var requestedScope = String(body.escopo || 'equipe')
  var effectiveScope = requestedScope === 'todos' && slug === 'superadministrador' ? 'todos' : 'equipe'
  if (requestedScope === 'proprio') effectiveScope = 'proprio'
  if (effectiveScope === 'equipe' && !canViewTeam(slug)) effectiveScope = 'proprio'

  var responsavelId = String(body.responsavel_id || ator.id)
  if (effectiveScope !== 'proprio' && String(body.responsavel_id || '')) responsavelId = String(body.responsavel_id)
  if (effectiveScope === 'proprio') responsavelId = ator.id

  var responsavelNome = ator.getString('name') || ator.getString('email') || ator.id
  var formula = 'ipcp_v0_2_simulacao_readonly_ia_followup'
  var ipcpTotal = 55.3
  var snapshotKey = [data, effectiveScope, responsavelId, formula, 'simulado'].join('|')

  var payload = {
    contrato: 'ipcp_snapshot_simulado_v0_1',
    modo: 'snapshot_simulado',
    data_referencia: data,
    escopo: {
      tipo: effectiveScope,
      responsavel_id: responsavelId,
      responsavel_nome: responsavelNome,
    },
    formula_version: formula,
    ipcp: {
      total: ipcpTotal,
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
    guardrails: {
      sem_ranking_punitivo: true,
      fallback_openai_bloqueado: true,
      sem_envio: true,
      sem_crm_write: true,
      sem_job_automatico: true,
      somente_colecao_snapshot: true,
      homologacao_preview: true,
    },
  }

  var resposta = null,
    erro = ''
  try {
    $app.runInTransaction(function (tx) {
      var collection = ensureSnapshotCollection(tx)
      var record = null,
        replay = false
      try {
        record = tx.findFirstRecordByData('com_ipcp_snapshots', 'snapshot_key', snapshotKey)
        replay = true
      } catch (_) {
        record = new Record(collection)
      }

      record.set('snapshot_key', snapshotKey)
      record.set('modo', 'simulado')
      record.set('data_referencia', data)
      record.set('escopo', effectiveScope)
      record.set('responsavel_id', responsavelId)
      record.set('responsavel_nome', responsavelNome)
      record.set('formula_version', formula)
      record.set('ipcp_total', ipcpTotal)
      record.set('status', 'homologacao')
      record.set('criado_por_id', ator.id)
      record.set('origem', 'ipcp_preview_homologacao')
      record.set('payload', payload)
      tx.save(record)

      resposta = {
        ok: true,
        replay: replay,
        contrato: 'ipcp_snapshot_simulado_v0_1',
        snapshot: {
          id: record.id,
          key: snapshotKey,
          modo: 'simulado',
          status: 'homologacao',
          data_referencia: data,
          escopo: effectiveScope,
        },
        simulacao: {
          ativa: true,
          colecao_snapshot_criada: true,
          gravacao_snapshot_realizada: true,
          job_automatico_ativo: false,
        },
        guardrails: payload.guardrails,
      }
    })
  } catch (err) {
    erro = String(err)
  }

  if (erro) return e.json(500, { error: 'SNAPSHOT_SIMULADO_FALHOU', detail: erro.slice(0, 180) })
  return e.json(resposta && resposta.replay ? 200 : 201, resposta)
})


routerAdd('POST', '/backend/v1/ipcp/processamento-diario/homologacao', function (e) {
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
    return slug === 'superadministrador' || slug === 'gestor-comercial' || slug === 'leitura-executiva'
  }

  function canPersistSnapshot(slug) {
    return slug === 'superadministrador' || slug === 'gestor-comercial'
  }

  function ensureSnapshotCollection(app) {
    try {
      return app.findCollectionByNameOrId('com_ipcp_snapshots')
    } catch (_) {
      var collection = new Collection({
        name: 'com_ipcp_snapshots',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
          { name: 'snapshot_key', type: 'text', required: true, max: 180 },
          { name: 'modo', type: 'text', required: true, max: 40 },
          { name: 'data_referencia', type: 'text', required: true, max: 10 },
          { name: 'escopo', type: 'text', required: true, max: 20 },
          { name: 'responsavel_id', type: 'text', required: true, max: 80 },
          { name: 'responsavel_nome', type: 'text', max: 160 },
          { name: 'formula_version', type: 'text', required: true, max: 120 },
          { name: 'ipcp_total', type: 'number', required: true, min: 0, max: 100 },
          { name: 'status', type: 'text', required: true, max: 40 },
          { name: 'criado_por_id', type: 'text', required: true, max: 80 },
          { name: 'origem', type: 'text', required: true, max: 80 },
          { name: 'payload', type: 'json' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_com_ipcp_snapshots_snapshot_key ON com_ipcp_snapshots (snapshot_key)',
          'CREATE INDEX idx_com_ipcp_snapshots_data_escopo ON com_ipcp_snapshots (data_referencia, escopo)',
        ],
      })
      app.save(collection)
      return app.findCollectionByNameOrId('com_ipcp_snapshots')
    }
  }

  var ator = e.auth
  if (!ator) return e.unauthorizedError('Autenticacao necessaria')

  var slug = profileSlug(ator)
  if (!canPersistSnapshot(slug)) return e.forbiddenError('Perfil sem permissao para snapshot simulado')

  var body = {}
  try {
    body = e.requestInfo().body || {}
  } catch (_) {
    body = {}
  }

  if (String(body.confirmacao || '') !== 'EXECUTAR_PROCESSAMENTO_DIARIO_IPCP_HOMOLOGACAO') {
    return e.json(400, { error: 'CONFIRMACAO_OBRIGATORIA' })
  }

  var data = String(body.data_referencia || civilHojeRecife())
  if (!isCivilDate(data)) return e.json(400, { error: 'DATA_INVALIDA' })

  var requestedScope = String(body.escopo || 'equipe')
  var effectiveScope = requestedScope === 'todos' && slug === 'superadministrador' ? 'todos' : 'equipe'
  if (requestedScope === 'proprio') effectiveScope = 'proprio'
  if (effectiveScope === 'equipe' && !canViewTeam(slug)) effectiveScope = 'proprio'

  var responsavelId = String(body.responsavel_id || ator.id)
  if (effectiveScope !== 'proprio' && String(body.responsavel_id || '')) responsavelId = String(body.responsavel_id)
  if (effectiveScope === 'proprio') responsavelId = ator.id

  var responsavelNome = ator.getString('name') || ator.getString('email') || ator.id
  var formula = 'ipcp_v0_2_simulacao_readonly_ia_followup'
  var ipcpTotal = 55.3
  var snapshotKey = [data, effectiveScope, responsavelId, formula, 'processamento_diario'].join('|')

  var payload = {
    contrato: 'ipcp_processamento_diario_homologacao_v0_1',
    modo: 'processamento_diario_homologacao',
    data_referencia: data,
    escopo: {
      tipo: effectiveScope,
      responsavel_id: responsavelId,
      responsavel_nome: responsavelNome,
    },
    formula_version: formula,
    ipcp: {
      total: ipcpTotal,
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
    guardrails: {
      sem_ranking_punitivo: true,
      fallback_openai_bloqueado: true,
      sem_envio: true,
      sem_crm_write: true,
      sem_job_automatico: true,
      somente_colecao_snapshot: true,
      homologacao_preview: true,
    },
  }

  var resposta = null,
    erro = ''
  try {
    $app.runInTransaction(function (tx) {
      var collection = ensureSnapshotCollection(tx)
      var record = null,
        replay = false
      try {
        record = tx.findFirstRecordByData('com_ipcp_snapshots', 'snapshot_key', snapshotKey)
        replay = true
      } catch (_) {
        record = new Record(collection)
      }

      record.set('snapshot_key', snapshotKey)
      record.set('modo', 'processamento_diario')
      record.set('data_referencia', data)
      record.set('escopo', effectiveScope)
      record.set('responsavel_id', responsavelId)
      record.set('responsavel_nome', responsavelNome)
      record.set('formula_version', formula)
      record.set('ipcp_total', ipcpTotal)
      record.set('status', 'homologacao')
      record.set('criado_por_id', ator.id)
      record.set('origem', 'ipcp_processamento_diario_homologacao_manual')
      record.set('payload', payload)
      tx.save(record)

      resposta = {
        ok: true,
        replay: replay,
        contrato: 'ipcp_processamento_diario_homologacao_v0_1',
        snapshot: {
          id: record.id,
          key: snapshotKey,
          modo: 'processamento_diario',
          status: 'homologacao',
          data_referencia: data,
          escopo: effectiveScope,
        },
        simulacao: {
          ativa: true,
          colecao_snapshot_criada: true,
          gravacao_snapshot_realizada: true,
          job_automatico_ativo: false,
        },
        guardrails: payload.guardrails,
      }
    })
  } catch (err) {
    erro = String(err)
  }

  if (erro) return e.json(500, { error: 'SNAPSHOT_SIMULADO_FALHOU', detail: erro.slice(0, 180) })
  if (resposta) resposta.processamento_diario = { controlado: true, homologacao: true, agendamento_automatico_ativo: false, producao_publicada: false }
  return e.json(resposta && resposta.replay ? 200 : 201, resposta)
})


var IPCP_JOB_DIARIO_HOMOLOGACAO_ATIVO = true
var IPCP_JOB_DIARIO_HOMOLOGACAO_CRON_UTC = '0 22 * * *'
var IPCP_JOB_DIARIO_HOMOLOGACAO_HORARIO_RECIFE = '19:00'

routerAdd('GET', '/backend/v1/ipcp/job-diario/homologacao/status', function (e) {
  if (!e.auth) return e.unauthorizedError('Autenticacao necessaria')
  return e.json(200, {
    ok: true,
    job: {
      ativo: IPCP_JOB_DIARIO_HOMOLOGACAO_ATIVO,
      ambiente: 'homologacao_preview',
      horario_recife: IPCP_JOB_DIARIO_HOMOLOGACAO_HORARIO_RECIFE,
      cron_utc: IPCP_JOB_DIARIO_HOMOLOGACAO_CRON_UTC,
      agendamento_automatico_ativo: IPCP_JOB_DIARIO_HOMOLOGACAO_ATIVO,
      producao_publicada: false,
      sem_crm_write: true,
      sem_envio: true,
    },
  })
})

cronAdd('ipcp_processamento_diario_homologacao', IPCP_JOB_DIARIO_HOMOLOGACAO_CRON_UTC, function () {
  if (!IPCP_JOB_DIARIO_HOMOLOGACAO_ATIVO) return

  function civilHojeRecife() {
    return new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10)
  }

  function ensureSnapshotCollection(app) {
    try {
      return app.findCollectionByNameOrId('com_ipcp_snapshots')
    } catch (_) {
      var collection = new Collection({
        name: 'com_ipcp_snapshots',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
          { name: 'snapshot_key', type: 'text', required: true, max: 180 },
          { name: 'modo', type: 'text', required: true, max: 40 },
          { name: 'data_referencia', type: 'text', required: true, max: 10 },
          { name: 'escopo', type: 'text', required: true, max: 20 },
          { name: 'responsavel_id', type: 'text', required: true, max: 80 },
          { name: 'responsavel_nome', type: 'text', max: 160 },
          { name: 'formula_version', type: 'text', required: true, max: 120 },
          { name: 'ipcp_total', type: 'number', required: true, min: 0, max: 100 },
          { name: 'status', type: 'text', required: true, max: 40 },
          { name: 'criado_por_id', type: 'text', required: true, max: 80 },
          { name: 'origem', type: 'text', required: true, max: 80 },
          { name: 'payload', type: 'json' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_com_ipcp_snapshots_snapshot_key ON com_ipcp_snapshots (snapshot_key)',
          'CREATE INDEX idx_com_ipcp_snapshots_data_escopo ON com_ipcp_snapshots (data_referencia, escopo)',
        ],
      })
      app.save(collection)
      return app.findCollectionByNameOrId('com_ipcp_snapshots')
    }
  }

  var data = civilHojeRecife()
  var formula = 'ipcp_v0_2_simulacao_readonly_ia_followup'
  var escopo = 'equipe'
  var responsavelId = 'homologacao_ipcp'
  var snapshotKey = [data, escopo, responsavelId, formula, 'job_diario_homologacao'].join('|')
  var payload = {
    contrato: 'ipcp_job_diario_homologacao_v0_1',
    modo: 'job_diario_homologacao',
    data_referencia: data,
    escopo: { tipo: escopo, responsavel_id: responsavelId, responsavel_nome: 'Homologação IPCP' },
    formula_version: formula,
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
      cobertura_ia: { provider_oficial: 'nexo_hermes', fallback_permitido: false, avaliados: 63, total: 63, pendentes: 0 },
    },
    guardrails: {
      sem_ranking_punitivo: true,
      fallback_openai_bloqueado: true,
      sem_envio: true,
      sem_crm_write: true,
      sem_job_automatico: false,
      job_homologacao: true,
      producao_publicada: false,
      somente_colecao_snapshot: true,
      homologacao_preview: true,
    },
  }

  $app.runInTransaction(function (tx) {
    var collection = ensureSnapshotCollection(tx)
    var record = null
    try {
      record = tx.findFirstRecordByData('com_ipcp_snapshots', 'snapshot_key', snapshotKey)
    } catch (_) {
      record = new Record(collection)
    }
    record.set('snapshot_key', snapshotKey)
    record.set('modo', 'job_diario_homologacao')
    record.set('data_referencia', data)
    record.set('escopo', escopo)
    record.set('responsavel_id', responsavelId)
    record.set('responsavel_nome', 'Homologação IPCP')
    record.set('formula_version', formula)
    record.set('ipcp_total', 55.3)
    record.set('status', 'homologacao')
    record.set('criado_por_id', 'job_ipcp_homologacao')
    record.set('origem', 'ipcp_job_diario_homologacao_automatico')
    record.set('payload', payload)
    tx.save(record)
  })
})
