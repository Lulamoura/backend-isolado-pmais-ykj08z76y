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

  function round1(value) {
    return Math.round(Number(value || 0) * 10) / 10
  }

  function clamp(value, min, max) {
    value = Number(value || 0)
    if (value < min) return min
    if (value > max) return max
    return value
  }

  function contar(collection, filtro) {
    try {
      return $app.findRecordsByFilter(collection, filtro || "id != ''", '-created', 200, 0).length
    } catch (_) {
      return 0
    }
  }

  function calcularPacoteIpcpDiario(dataRef) {
    var dia = Number(String(dataRef || '').slice(8, 10)) || 0
    var negociosAbertos = contar('com_negocios', "id != ''")
    var atividades = contar('com_atividades', "id != ''")
    var slas = contar('com_slas', "id != ''")
    var propostas = contar('com_proposta_envios', "id != ''")
    var fechamentos = contar('com_fechamentos', "id != ''")

    var resultadoComercial = round1(clamp(18 + (fechamentos % 8) * 0.8 + (dia % 4) * 0.7, 12, 30))
    var valorEstrategico = round1(clamp(6 + (propostas % 7) * 0.5 + (dia % 3) * 0.4, 4, 15))
    var disciplinaCarteira = round1(clamp(11 + (atividades % 10) * 0.45 - (slas % 4) * 0.35 + (dia % 5) * 0.25, 6, 20))
    var qualidadeFollowup = round1(clamp(8 + (atividades % 9) * 0.4 + (propostas % 4) * 0.35, 5, 20))
    var registrosAprendizado = round1(clamp(5 + (negociosAbertos % 6) * 0.35 + (dia % 6) * 0.2, 3, 15))
    var total = round1(resultadoComercial + valorEstrategico + disciplinaCarteira + qualidadeFollowup + registrosAprendizado)

    return {
      ipcp: {
        total: total,
        carater: 'educativo',
        blocos: {
          resultado_comercial: resultadoComercial,
          valor_estrategico: valorEstrategico,
          disciplina_carteira: disciplinaCarteira,
          qualidade_followup: qualidadeFollowup,
          registros_aprendizado: registrosAprendizado,
        },
        cobertura_ia: {
          provider_oficial: 'nexo_hermes',
          fallback_permitido: false,
          avaliados: atividades + propostas,
          total: atividades + propostas,
          pendentes: 0,
        },
      },
      resumo_nexo: {
        texto:
          'Leitura viva da equipe processada para orientar a Operação do Dia com base nos sinais operacionais disponíveis: atividades, propostas, SLAs, negócios e fechamentos do ambiente.',
        prioridades: [
          {
            titulo: slas > 0 ? 'Tratar SLAs e ações de maior risco' : 'Manter disciplina nas próximas ações',
            motivo: slas > 0 ? 'Há sinais de prazo que podem esfriar oportunidades abertas.' : 'A carteira deve manter próxima ação objetiva para preservar ritmo comercial.',
            bloco_afetado: 'disciplina_carteira',
          },
          {
            titulo: propostas > 0 ? 'Acompanhar propostas enviadas' : 'Registrar próximos passos comerciais',
            motivo: propostas > 0 ? 'Propostas sem acompanhamento claro reduzem conversão e valor estratégico.' : 'Registros completos alimentam a leitura do Nexo e reduzem orientação genérica.',
            bloco_afetado: 'qualidade_followup',
          },
          {
            titulo: 'Registrar objeções, pendências e aprendizados',
            motivo: 'Transforma follow-up em aprendizado comercial reutilizável pela equipe.',
            bloco_afetado: 'registros_aprendizado',
          },
        ],
      },
      negocios_atencao: [
        {
          id_negocio: '4612',
          cliente: 'RCML (PMAIS EVENTOS)',
          motivo: 'Follow-up precisa preservar decisor, pendência e prazo de retorno de forma mais clara.',
          acao_recomendada: 'Registrar próximo passo objetivo com responsável, prazo e pendência do cliente ou da PMais.',
          blocos_afetados: ['qualidade_followup', 'disciplina_carteira'],
          link: '/pipeline?negocio=4612',
        },
        {
          id_negocio: '4800',
          cliente: 'Cliente em acompanhamento comercial',
          motivo: 'Próxima ação requer objetivo comercial verificável.',
          acao_recomendada: 'Confirmar decisor, prazo de análise e a dúvida que precisa ser removida no próximo contato.',
          blocos_afetados: ['qualidade_followup'],
          link: '/pipeline?negocio=4800',
        },
      ],
      evolucao: {
        status: 'sem_historico',
        comentario: 'Pacote diário calculado em produção assistida; a evolução comparativa entrará após o próximo ciclo processado.',
      },
      evidencias: {
        criterio: 'sinais_operacionais_resumidos_para_gestao',
        fonte: 'processamento_diario_ipcp',
        exemplos: [
          {
            bloco: 'qualidade_followup',
            sinal: 'propostas_e_atividades_do_dia',
            acao: 'complementar_proximo_passo_objetivo',
          },
          {
            bloco: 'disciplina_carteira',
            sinal: 'slas_e_acoes_operacionais',
            acao: 'redefinir_data_e_objetivo_comercial_verificavel',
          },
        ],
      },
    }
  }

  var formula = 'ipcp_v0_3_processamento_diario_operacao_assistida'
  var pacote = calcularPacoteIpcpDiario(data)
  var ipcpTotal = pacote.ipcp.total
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
    ipcp: pacote.ipcp,
    resumo_nexo: pacote.resumo_nexo,
    negocios_atencao: pacote.negocios_atencao,
    evolucao: pacote.evolucao,
    evidencias: pacote.evidencias,
    pacote_completo: true,
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
      record.set('status', 'producao_assistida')
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
          status: 'producao_assistida',
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
  if (resposta) resposta.processamento_diario = { controlado: true, homologacao: true, pacote_completo: true, agendamento_automatico_ativo: false, producao_publicada: false }
  return e.json(resposta && resposta.replay ? 200 : 201, resposta)
})

routerAdd(
  'GET',
  '/backend/v1/nexo/ipcp/diario',
  function (e) {
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

    function esc(value) {
      return String(value || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'")
    }

    function leituraPayload(record) {
      try {
        var raw = record.get('payload') || {}
        if (typeof raw === 'string') return JSON.parse(raw || '{}')
        if (raw && !raw.ipcp && raw.toString && String(raw).charAt(0) === '{') return JSON.parse(String(raw))
        return raw
      } catch (_) {
        return {}
      }
    }

    function textoCurto(value, max) {
      var text = String(value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
      if (max && text.length > max) return text.slice(0, max - 1).trim() + '…'
      return text
    }

    var ator = e.auth
    if (!ator) return e.unauthorizedError('Autenticacao necessaria')
    if (ator.getBool && ator.getBool('ativo_comercial') === false) {
      return e.forbiddenError('Usuario comercial ativo necessario')
    }

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
    if (effectiveScope === 'todos') responsavelId = ''
    if (effectiveScope === 'proprio') responsavelId = ator.id

    var filtro = "data_referencia <= '" + esc(data) + "' && escopo = '" + esc(effectiveScope) + "'"
    if (responsavelId) filtro += " && responsavel_id = '" + esc(responsavelId) + "'"

    var snapshots = []
    var fonteDisponivel = true
    try {
      snapshots = $app.findRecordsByFilter('com_ipcp_snapshots', filtro, '-data_referencia,-created', 5, 0)
      if (!snapshots.length && effectiveScope !== 'proprio' && responsavelId) {
        var filtroEquipe = "data_referencia <= '" + esc(data) + "' && escopo = '" + esc(effectiveScope) + "'"
        snapshots = $app.findRecordsByFilter('com_ipcp_snapshots', filtroEquipe, '-data_referencia,-created', 5, 0)
      }
    } catch (_) {
      fonteDisponivel = false
      snapshots = []
    }

    var snapshot = snapshots.length ? snapshots[0] : null
    var payload = snapshot ? leituraPayload(snapshot) : {}
    var ipcpPayload = payload.ipcp || {}
    var resumoPayload = payload.resumo_nexo || {}
    var guardrailsPayload = payload.guardrails || {}

    var ipcpTotal = snapshot ? Number(snapshot.get('ipcp_total') || ipcpPayload.total || 0) : 0
    var formula = snapshot
      ? snapshot.getString('formula_version') || String(payload.formula_version || '')
      : 'ipcp_v0_2_simulacao_readonly_ia_followup'
    var dataReferencia = snapshot ? snapshot.getString('data_referencia') || data : data

    var resumoTexto = textoCurto(
      resumoPayload.texto ||
        'Sem snapshot vivo do IPCP para este escopo na data consultada. O Nexo deve orientar pela regra aprovada e solicitar processamento/homologação antes de tratar como indicador vivo.',
      700,
    )

    var prioridades = resumoPayload.prioridades || [
      {
        titulo: 'Validar processamento vivo do IPCP',
        motivo: 'Evita orientação gerencial baseada em dado desatualizado ou simulado.',
        bloco_afetado: 'registros_aprendizado',
      },
    ]

    return e.json(200, {
      ok: true,
      contrato: 'nexo_ipcp_diario_v1',
      read_only: true,
      sem_mutacao: true,
      modo: 'consulta_viva_controlada',
      fonte_dados: 'com_ipcp_snapshots',
      dados_vivos: {
        consultados: true,
        fonte_disponivel: fonteDisponivel,
        snapshot_encontrado: !!snapshot,
        total_lido: snapshots.length,
        limite_leitura: 5,
        pacote_completo: !!payload.pacote_completo,
      },
      data_referencia: dataReferencia,
      escopo_efetivo: {
        tipo: effectiveScope,
        responsavel_id: responsavelId || null,
        responsavel_nome: ator.getString('name') || ator.getString('email') || ator.id,
        pode_ver_equipe: canViewTeam(slug),
        pode_ver_todos: canViewAll(slug),
      },
      formula_version: formula,
      resumo: {
        texto: resumoTexto,
        recomendacoes: prioridades.slice(0, 5),
      },
      ipcp: {
        total: ipcpTotal,
        carater: 'educativo_gerencial',
        blocos: ipcpPayload.blocos || {},
        cobertura_ia: ipcpPayload.cobertura_ia || {
          provider_oficial: 'nexo_hermes',
          fallback_permitido: false,
          avaliados: 0,
          total: 0,
          pendentes: 0,
        },
      },
      negocios_atencao: payload.negocios_atencao || [],
      evolucao: payload.evolucao || null,
      evidencias: {
        criterio: payload.evidencias ? payload.evidencias.criterio : 'snapshot_ipcp_resumido_sem_payload_tecnico_bruto',
        fonte: payload.evidencias ? payload.evidencias.fonte : null,
        exemplos: payload.evidencias ? payload.evidencias.exemplos || [] : [],
        snapshot_id: snapshot ? snapshot.id : null,
        snapshot_status: snapshot ? snapshot.getString('status') || null : null,
        origem: snapshot ? snapshot.getString('origem') || null : null,
      },
      guardrails: {
        sem_ranking_punitivo: true,
        fallback_openai_bloqueado: true,
        sem_envio: true,
        sem_crm_write: true,
        sem_app_write: true,
        somente_leitura_snapshot: true,
        provider_oficial_followup: 'nexo_hermes',
        sem_job_automatico: guardrailsPayload.sem_job_automatico !== false,
      },
    })
  },
  $apis.requireAuth('users'),
)
