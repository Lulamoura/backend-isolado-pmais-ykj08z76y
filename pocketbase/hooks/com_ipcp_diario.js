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
        'A leitura viva do IPCP ainda não está disponível para este escopo. Acione o processamento diário antes de usar o indicador como orientação operacional.',
      prioridades: [
        {
          titulo: 'Processar leitura viva do IPCP',
          motivo: 'Evita orientar a operação com referência fixa ou desatualizada.',
          bloco_afetado: 'qualidade_followup',
        },
        {
          titulo: 'Conferir responsável e escopo',
          motivo:
            'A carteira precisa ser lida pelo perfil correto antes da publicação operacional.',
          bloco_afetado: 'disciplina_carteira',
        },
        {
          titulo: 'Validar dados reais antes da publicação',
          motivo: 'Prioridades e negócios de atenção devem vir da carteira real consultada.',
          bloco_afetado: 'registros_aprendizado',
        },
      ],
    },
    ipcp: {
      total: 0,
      carater: 'educativo',
      blocos: {
        resultado_comercial: 0,
        valor_estrategico: 0,
        disciplina_carteira: 0,
        qualidade_followup: 0,
        registros_aprendizado: 0,
      },
      cobertura_ia: {
        provider_oficial: 'nexo_hermes',
        fallback_permitido: false,
        avaliados: 0,
        total: 0,
        pendentes: 0,
      },
    },
    negocios_atencao: [],
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
        'A leitura viva do IPCP ainda não está disponível para este escopo. Acione o processamento diário antes de usar o indicador como orientação operacional.',
      prioridades: [
        {
          titulo: 'Processar leitura viva do IPCP',
          motivo: 'Evita orientar a operação com referência fixa ou desatualizada.',
          bloco_afetado: 'qualidade_followup',
        },
        {
          titulo: 'Conferir responsável e escopo',
          motivo:
            'A carteira precisa ser lida pelo perfil correto antes da publicação operacional.',
          bloco_afetado: 'disciplina_carteira',
        },
        {
          titulo: 'Validar dados reais antes da publicação',
          motivo: 'Prioridades e negócios de atenção devem vir da carteira real consultada.',
          bloco_afetado: 'registros_aprendizado',
        },
      ],
    },
    ipcp: {
      total: 0,
      carater: 'educativo',
      blocos: {
        resultado_comercial: 0,
        valor_estrategico: 0,
        disciplina_carteira: 0,
        qualidade_followup: 0,
        registros_aprendizado: 0,
      },
      cobertura_ia: {
        provider_oficial: 'nexo_hermes',
        fallback_permitido: false,
        avaliados: 0,
        total: 0,
        pendentes: 0,
      },
    },
    negocios_atencao: [],
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
    return (
      slug === 'superadministrador' || slug === 'gestor-comercial' || slug === 'leitura-executiva'
    )
  }

  function canPersistSnapshot(slug) {
    return slug === 'superadministrador' || slug === 'gestor-comercial'
  }

  function ensureSnapshotCollection(app) {
    try {
      var existing = app.findCollectionByNameOrId('com_ipcp_snapshots')
      if (
        existing.listRule !== null ||
        existing.viewRule !== null ||
        existing.createRule !== null ||
        existing.updateRule !== null ||
        existing.deleteRule !== null
      ) {
        existing.listRule = null
        existing.viewRule = null
        existing.createRule = null
        existing.updateRule = null
        existing.deleteRule = null
        app.save(existing)
      }
      return existing
    } catch (_) {
      var collection = new Collection({
        name: 'com_ipcp_snapshots',
        type: 'base',
        listRule: null,
        viewRule: null,
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
  if (!canPersistSnapshot(slug))
    return e.forbiddenError('Perfil sem permissao para snapshot simulado')

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
  var effectiveScope =
    requestedScope === 'todos' && slug === 'superadministrador' ? 'todos' : 'equipe'
  if (requestedScope === 'proprio') effectiveScope = 'proprio'
  if (effectiveScope === 'equipe' && !canViewTeam(slug)) effectiveScope = 'proprio'

  var responsavelId = String(body.responsavel_id || ator.id)
  if (effectiveScope !== 'proprio' && String(body.responsavel_id || ''))
    responsavelId = String(body.responsavel_id)
  if (effectiveScope === 'proprio') responsavelId = ator.id

  var responsavelNome = ator.getString('name') || ator.getString('email') || ator.id
  var formula = 'ipcp_sem_leitura_viva_disponivel'
  var ipcpTotal = 0
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
        resultado_comercial: 0,
        valor_estrategico: 0,
        disciplina_carteira: 0,
        qualidade_followup: 0,
        registros_aprendizado: 0,
      },
      cobertura_ia: {
        provider_oficial: 'nexo_hermes',
        fallback_permitido: false,
        avaliados: 0,
        total: 0,
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
    return (
      slug === 'superadministrador' || slug === 'gestor-comercial' || slug === 'leitura-executiva'
    )
  }

  function canPersistSnapshot(slug) {
    return slug === 'superadministrador' || slug === 'gestor-comercial'
  }

  function ensureSnapshotCollection(app) {
    try {
      var existing = app.findCollectionByNameOrId('com_ipcp_snapshots')
      if (
        existing.listRule !== null ||
        existing.viewRule !== null ||
        existing.createRule !== null ||
        existing.updateRule !== null ||
        existing.deleteRule !== null
      ) {
        existing.listRule = null
        existing.viewRule = null
        existing.createRule = null
        existing.updateRule = null
        existing.deleteRule = null
        app.save(existing)
      }
      return existing
    } catch (_) {
      var collection = new Collection({
        name: 'com_ipcp_snapshots',
        type: 'base',
        listRule: null,
        viewRule: null,
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
  if (!canPersistSnapshot(slug))
    return e.forbiddenError('Perfil sem permissao para snapshot simulado')

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
  var effectiveScope =
    requestedScope === 'todos' && slug === 'superadministrador' ? 'todos' : 'equipe'
  if (requestedScope === 'proprio') effectiveScope = 'proprio'
  if (effectiveScope === 'equipe' && !canViewTeam(slug)) effectiveScope = 'proprio'

  var responsavelId = String(body.responsavel_id || ator.id)
  if (effectiveScope !== 'proprio' && String(body.responsavel_id || ''))
    responsavelId = String(body.responsavel_id)
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

  function esc(value) {
    return String(value || '')
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
  }

  function filtroEscopoColecao(collection, scope, responsavelId, actor) {
    var parts = []
    if (collection === 'com_negocios') parts.push('inativo = false')
    if (
      (scope === 'proprio' || scope === 'equipe') &&
      responsavelId &&
      responsavelId !== '__todos__'
    )
      parts.push("responsavel_id = '" + esc(responsavelId) + "'")
    if (scope === 'equipe' && (!responsavelId || responsavelId === '__todos__')) {
      var equipeId = actor.getString('equipe_id') || ''
      if (equipeId) parts.push("equipe_id = '" + esc(equipeId) + "'")
    }
    return parts.length ? parts.join(' && ') : "id != ''"
  }

  function listar(collection, filtro, sort, limit) {
    try {
      return $app.findRecordsByFilter(
        collection,
        filtro || "id != ''",
        sort || '-created',
        limit || 200,
        0,
      )
    } catch (_) {
      return []
    }
  }

  function valorNegocioIpcp(rec) {
    var valor = Number(rec.get('valor') || 0)
    if (!isFinite(valor) || valor < 0) return 0
    return valor
  }

  function negocioComputavelIpcp(rec) {
    if (!rec.getString('responsavel_id')) return false
    if (!rec.getString('modalidade')) return false
    if (valorNegocioIpcp(rec) <= 1) return false
    return true
  }

  function negociosComputaveisIpcp(negocios) {
    var rows = []
    for (var nci = 0; nci < negocios.length; nci++) {
      if (negocioComputavelIpcp(negocios[nci])) rows.push(negocios[nci])
    }
    return rows
  }

  function filtroPorIds(campo, ids) {
    if (!ids || !ids.length) return "id = '__sem_registros__'"
    var partes = []
    for (var fi = 0; fi < ids.length && fi < 80; fi++)
      partes.push(campo + " = '" + esc(ids[fi]) + "'")
    return partes.length ? '(' + partes.join(' || ') + ')' : "id = '__sem_registros__'"
  }

  function filtroPorNegocios(campo, negocios) {
    var ids = []
    for (var fni = 0; fni < negocios.length; fni++) ids.push(negocios[fni].id)
    return filtroPorIds(campo, ids)
  }

  function propostasDaCarteira(negocios) {
    return listar('com_propostas', filtroPorNegocios('negocio_id', negocios), '-created', 200)
  }

  function filtroPorPropostas(campo, propostasCarteira) {
    var ids = []
    for (var fpi = 0; fpi < propostasCarteira.length; fpi++) ids.push(propostasCarteira[fpi].id)
    return filtroPorIds(campo, ids)
  }

  function classificarResultado(rec) {
    var resultado = rec.getString('resultado') || rec.getString('status') || ''
    if (resultado === 'ganho') return 'ganho'
    if (resultado === 'perdido') return 'perdido'
    if (resultado === 'desqualificado') return 'desqualificado'
    return 'aberto'
  }

  function nomeNegocio(rec) {
    return (
      rec.getString('cliente') ||
      rec.getString('empresa_nome') ||
      rec.getString('contato_nome') ||
      rec.getString('titulo') ||
      rec.getString('nome') ||
      'Negócio comercial'
    )
  }

  function negocioHumanoId(rec) {
    return (
      rec.getString('oe_numero') ||
      rec.getString('external_id') ||
      rec.getString('codigo') ||
      rec.id
    )
  }
  function textoRegistroComercial(rec) {
    try {
      var notas = $app.findRecordsByFilter(
        'com_notas_negocio',
        "negocio_id='" + esc(rec.id) + "'",
        '-criada_em,-created,-id',
        3,
        0,
      )
      var textos = []
      for (var ni = 0; ni < notas.length; ni++) textos.push(notas[ni].getString('texto') || '')
      return textos.join(' ')
    } catch (_) {
      return ''
    }
  }

  function contemQualidadeRegistro(texto, padroes) {
    var t = String(texto || '').toLowerCase()
    for (var pi = 0; pi < padroes.length; pi++) if (padroes[pi].test(t)) return true
    return false
  }

  function calcularQualidadeRegistroComercial(negocios) {
    if (!negocios.length) return { media: 1, avaliados: 0, fracos: 0, bons: 0 }
    var total = 0,
      avaliados = 0,
      fracos = 0,
      bons = 0
    for (var qi = 0; qi < negocios.length; qi++) {
      var rec = negocios[qi]
      if (classificarResultado(rec) !== 'aberto') continue
      avaliados++
      var texto = textoRegistroComercial(rec)
      var proxima = rec.getString('proxima_acao_em') || ''
      var pontos = 0
      if (proxima) pontos += 0.15
      if (texto && texto.trim().length >= 40) pontos += 0.15
      if (
        contemQualidadeRegistro(texto, [
          /decisor/,
          /respons[aá]vel pela decis[aã]o/,
          /quem decide/,
          /influenciador/,
        ])
      )
        pontos += 0.18
      if (contemQualidadeRegistro(texto, [/necessidade/, /dor/, /demanda/, /objetivo/, /escopo/]))
        pontos += 0.18
      if (
        contemQualidadeRegistro(texto, [
          /obje[cç][aã]o/,
          /risco/,
          /pend[eê]ncia/,
          /bloqueio/,
          /restri[cç][aã]o/,
        ])
      )
        pontos += 0.18
      if (
        contemQualidadeRegistro(texto, [
          /pr[oó]ximo passo/,
          /combinado/,
          /retorno/,
          /validar/,
          /enviar/,
          /reuni[aã]o/,
        ])
      )
        pontos += 0.16
      if (
        contemQualidadeRegistro(texto, [
          /prazo/,
          /data/,
          /\d{1,2}\/\d{1,2}/,
          /\d{4}-\d{2}-\d{2}/,
        ])
      )
        pontos += 0.15
      if (pontos > 1) pontos = 1
      if (pontos < 0.35) fracos++
      if (pontos >= 0.7) bons++
      total += pontos
    }
    if (!avaliados) return { media: 1, avaliados: 0, fracos: 0, bons: 0 }
    return { media: total / avaliados, avaliados: avaliados, fracos: fracos, bons: bons }
  }

  var IPCP_ALTO_VALOR_REFERENCIA_REAIS = 10000
  var IPCP_ALTO_VALOR_REFERENCIA = IPCP_ALTO_VALOR_REFERENCIA_REAIS * 100
  var IPCP_MIN_DECIDIDOS_CONFIANCA_TOTAL = 5

  function negocioRecorrenteIpcp(rec) {
    return String(rec.getString('modalidade') || '').toLowerCase() === 'recorrente'
  }

  function negocioAltoValorIpcp(valor) {
    return Number(valor || 0) >= IPCP_ALTO_VALOR_REFERENCIA
  }

  function negocioMaduroQualificadoIpcp(rec, valor) {
    if (!rec.getString('modalidade')) return false
    if (!(Number(valor || 0) > 1)) return false
    if (rec.getString('proxima_acao_em')) return true
    var texto = textoRegistroComercial(rec)
    if (texto && texto.trim().length >= 80) return true
    return (
      contemQualidadeRegistro(texto, [
        /decisor/,
        /quem decide/,
        /respons[aá]vel pela decis[aã]o/,
      ]) &&
      contemQualidadeRegistro(texto, [/necessidade/, /dor\b/, /demanda/, /objetivo/, /escopo/]) &&
      contemQualidadeRegistro(texto, [
        /pr[oó]ximo passo/,
        /combinado/,
        /retorno/,
        /validar/,
        /reuni[aã]o/,
      ])
    )
  }

  function calcularResultadoComercialIpcp(ganhos, perdidos) {
    var totalDecididos = ganhos + perdidos
    var conversao = totalDecididos ? ganhos / totalDecididos : 0
    var confiancaDecididos = Math.min(1, totalDecididos / IPCP_MIN_DECIDIDOS_CONFIANCA_TOTAL)
    return round1(
      clamp(12 + conversao * 10 * confiancaDecididos + Math.min(8, ganhos * 0.8), 8, 30),
    )
  }

  function calcularValorEstrategicoIpcp(metricas) {
    var abertos = Math.max(0, Number(metricas.abertos || 0))
    var recorrenciaCarteiraAberta = Math.min(
      3,
      abertos ? (Number(metricas.abertosRecorrentes || 0) / abertos) * 3 : 0,
    )
    var valorFinanceiroCarteiraAberta = Math.min(1, Number(metricas.valorAberto || 0) / 200000)
    var recorrenteAltoValor = Math.min(
      5,
      abertos ? (Number(metricas.abertosRecorrentesAltoValor || 0) / abertos) * 5 : 0,
    )
    var valorGanhoEstrategico = Math.min(
      5,
      Number(metricas.ganhosEstrategicos || 0) * 2.5 +
        Number(metricas.valorGanhoEstrategico || 0) / 50000,
    )
    var maturidadeComercialQualificada = Math.min(
      1,
      abertos ? Number(metricas.madurosQualificados || 0) / abertos : 0,
    )
    return round1(
      clamp(
        recorrenciaCarteiraAberta +
          valorFinanceiroCarteiraAberta +
          recorrenteAltoValor +
          valorGanhoEstrategico +
          maturidadeComercialQualificada,
        0,
        15,
      ),
    )
  }

  function calcularPacoteIpcpDiario(dataRef, scope, responsavelId, actor) {
    var filtroNegocios = filtroEscopoColecao('com_negocios', scope, responsavelId, actor)
    var negocios = listar('com_negocios', filtroNegocios, '-updated,-created', 200)
    var negociosComputaveis = negociosComputaveisIpcp(negocios)
    var filtroNegociosRelacionados = filtroPorNegocios('negocio_id', negociosComputaveis)
    var propostasCarteira = propostasDaCarteira(negociosComputaveis)
    var atividades = listar('com_atividades', filtroNegociosRelacionados, '-created', 200)
    var slas = listar('com_slas', filtroNegociosRelacionados, '-created', 200)
    var propostas = listar(
      'com_proposta_envios',
      filtroPorPropostas('proposta_id', propostasCarteira),
      '-created',
      200,
    )
    var fechamentos = listar('com_fechamentos', filtroNegociosRelacionados, '-created', 200)

    var abertos = 0,
      ganhos = 0,
      perdidos = 0,
      valorAberto = 0,
      valorGanho = 0,
      abertosRecorrentes = 0,
      abertosRecorrentesAltoValor = 0,
      ganhosEstrategicos = 0,
      valorGanhoEstrategico = 0,
      madurosQualificados = 0
    var semResponsavel = 0,
      semModalidade = 0,
      prospectPendente = 0
    for (var i = 0; i < negociosComputaveis.length; i++) {
      var n = negociosComputaveis[i]
      var situacao = classificarResultado(n)
      var valor = valorNegocioIpcp(n)
      var recorrente = negocioRecorrenteIpcp(n)
      var altoValor = negocioAltoValorIpcp(valor)
      if (situacao === 'ganho') {
        ganhos++
        if (valor > 1) valorGanho += valor
        if (recorrente || altoValor) {
          ganhosEstrategicos++
          if (valor > 1) valorGanhoEstrategico += valor
        }
      } else if (situacao === 'perdido' || situacao === 'desqualificado') perdidos++
      else {
        abertos++
        if (valor > 1) valorAberto += valor
        if (recorrente) abertosRecorrentes++
        if (recorrente && altoValor) abertosRecorrentesAltoValor++
        if (negocioMaduroQualificadoIpcp(n, valor)) madurosQualificados++
      }
      if (!n.getString('responsavel_id')) semResponsavel++
      if (!n.getString('modalidade')) semModalidade++
      if (
        (n.getString('etapa') === 'prospects' || n.getString('qualificacao') === 'pendente') &&
        situacao === 'aberto'
      )
        prospectPendente++
    }

    var totalDecididos = ganhos + perdidos
    var conversao = totalDecididos ? ganhos / totalDecididos : 0
    var coberturaResponsavel = negociosComputaveis.length
      ? (negociosComputaveis.length - semResponsavel) / negociosComputaveis.length
      : 1
    var coberturaModalidade = negociosComputaveis.length
      ? (negociosComputaveis.length - semModalidade) / negociosComputaveis.length
      : 1
    var atividadePorAberto = abertos ? atividades.length / abertos : atividades.length
    var slaPressao = slas.length
      ? Math.min(1, slas.length / Math.max(1, abertos || negociosComputaveis.length))
      : 0

    var resultadoComercial = calcularResultadoComercialIpcp(ganhos, perdidos)
    var valorEstrategico = calcularValorEstrategicoIpcp({
      abertos: abertos,
      valorAberto: valorAberto,
      abertosRecorrentes: abertosRecorrentes,
      abertosRecorrentesAltoValor: abertosRecorrentesAltoValor,
      ganhosEstrategicos: ganhosEstrategicos,
      valorGanhoEstrategico: valorGanhoEstrategico,
      madurosQualificados: madurosQualificados,
    })
    var disciplinaCarteira = round1(
      clamp(
        7 + Math.min(8, atividadePorAberto * 1.6) + coberturaResponsavel * 4 - slaPressao * 3,
        4,
        20,
      ),
    )
    var qualidadeFollowup = round1(
      clamp(
        6 +
          Math.min(7, atividades.length / 8) +
          Math.min(4, propostas.length / 10) -
          prospectPendente * 0.4,
        4,
        20,
      ),
    )
    var qualidadeRegistro = calcularQualidadeRegistroComercial(negociosComputaveis)
    var registrosAprendizado = round1(
      clamp(
        3 +
          qualidadeRegistro.media * 9 +
          coberturaModalidade * 1.5 +
          Math.min(1.5, qualidadeRegistro.bons * 0.3),
        3,
        15,
      ),
    )
    var total = round1(
      resultadoComercial +
        valorEstrategico +
        disciplinaCarteira +
        qualidadeFollowup +
        registrosAprendizado,
    )

    var prioridades = []
    if (prospectPendente > 0)
      prioridades.push({
        titulo: 'Resolver qualificações pendentes',
        motivo:
          prospectPendente +
          ' negócio(s) precisam sair do limbo entre qualificar, descartar ou complementar dados.',
        bloco_afetado: 'resultado_comercial',
      })
    if (slas.length > 0)
      prioridades.push({
        titulo: 'Tratar SLAs e próximas ações em risco',
        motivo: 'Há sinais de prazo que podem esfriar oportunidades abertas neste escopo.',
        bloco_afetado: 'disciplina_carteira',
      })
    if (propostas.length > 0)
      prioridades.push({
        titulo: 'Acompanhar propostas enviadas',
        motivo: 'Propostas sem acompanhamento claro reduzem conversão e valor estratégico.',
        bloco_afetado: 'qualidade_followup',
      })
    if (qualidadeRegistro.fracos > 0)
      prioridades.push({
        titulo: 'Qualificar registros comerciais',
        motivo:
          qualidadeRegistro.fracos +
          ' registro(s) têm próximo compromisso ou histórico sem decisor, necessidade, objeção, prazo ou próximo passo claro.',
        bloco_afetado: 'registros_aprendizado',
      })
    if (prioridades.length < 3)
      prioridades.push({
        titulo: 'Registrar objeções e próximos compromissos',
        motivo:
          'Registros claros tornam a orientação do Nexo específica para a carteira consultada.',
        bloco_afetado: 'registros_aprendizado',
      })
    if (prioridades.length < 3)
      prioridades.push({
        titulo: 'Manter cadência da carteira aberta',
        motivo: 'Cada oportunidade aberta deve ter responsável e próxima ação objetiva.',
        bloco_afetado: 'disciplina_carteira',
      })

    var negociosAtencao = []
    for (var j = 0; j < negociosComputaveis.length && negociosAtencao.length < 3; j++) {
      var item = negociosComputaveis[j]
      if (classificarResultado(item) !== 'aberto') continue
      var motivos = []
      if (!item.getString('responsavel_id')) motivos.push('sem responsável comercial claro')
      if (!item.getString('modalidade')) motivos.push('sem modalidade registrada')
      if (item.getString('qualificacao') === 'pendente' || item.getString('etapa') === 'prospects')
        motivos.push('qualificação pendente')
      if (!motivos.length) motivos.push('exige próximo passo comercial verificável')
      negociosAtencao.push({
        id_negocio: negocioHumanoId(item),
        cliente: nomeNegocio(item),
        motivo: motivos.join('; '),
        acao_recomendada: 'Registrar decisor, pendência, prazo de retorno e próxima ação objetiva.',
        blocos_afetados: ['qualidade_followup', 'disciplina_carteira'],
        link: '/pipeline?negocio=' + encodeURIComponent(negocioHumanoId(item)),
      })
    }

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
          avaliados: atividades.length + propostas.length + negociosComputaveis.length,
          total: atividades.length + propostas.length + negociosComputaveis.length,
          pendentes: 0,
        },
      },
      resumo_nexo: {
        texto:
          'Leitura viva ' +
          (scope === 'proprio' ? 'da carteira do usuário' : 'da equipe') +
          ' processada com base nos sinais operacionais disponíveis no ambiente: negócios, atividades, propostas, SLAs e fechamentos.',
        prioridades: prioridades.slice(0, 3),
      },
      negocios_atencao: negociosAtencao,
      evolucao: {
        status: 'sem_historico',
        comentario:
          'Pacote diário calculado em produção assistida com dados vivos do escopo consultado.',
      },
      evidencias: {
        criterio: 'sinais_operacionais_resumidos_para_gestao',
        fonte: 'processamento_diario_ipcp_dados_vivos',
        exemplos: [
          {
            bloco: 'resultado_comercial',
            sinal: ganhos + ' ganho(s), ' + perdidos + ' perda(s) e ' + abertos + ' aberto(s)',
            acao: 'priorizar decisões e próximos passos',
          },
          {
            bloco: 'disciplina_carteira',
            sinal:
              atividades.length +
              ' atividade(s), ' +
              slas.length +
              ' SLA(s), ' +
              qualidadeRegistro.fracos +
              ' registro(s) fraco(s)',
            acao: 'qualificar decisor, necessidade, objeção, prazo e próximo passo verificável',
          },
        ],
      },
    }
  }

  var formula = 'ipcp_v0_5_formula_gerencial'
  var pacote = calcularPacoteIpcpDiario(data, effectiveScope, responsavelId, ator)
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
  if (resposta)
    resposta.processamento_diario = {
      controlado: true,
      homologacao: true,
      pacote_completo: true,
      agendamento_automatico_ativo: false,
      producao_publicada: false,
    }
  return e.json(resposta && resposta.replay ? 200 : 201, resposta)
})

var IPCP_JOB_DIARIO_HOMOLOGACAO_ATIVO = true
var IPCP_JOB_DIARIO_HOMOLOGACAO_HORARIO_RECIFE = '19:00'
var IPCP_JOB_DIARIO_HOMOLOGACAO_CRON_UTC = '0 22 * * *'

cronAdd(
  'ipcp_processamento_diario_homologacao_1900_recife',
  IPCP_JOB_DIARIO_HOMOLOGACAO_CRON_UTC,
  function () {
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

    function canPersistSnapshot(slug) {
      return slug === 'superadministrador' || slug === 'gestor-comercial'
    }

    function ensureSnapshotCollection(app) {
      try {
        var existing = app.findCollectionByNameOrId('com_ipcp_snapshots')
        if (
          existing.listRule !== null ||
          existing.viewRule !== null ||
          existing.createRule !== null ||
          existing.updateRule !== null ||
          existing.deleteRule !== null
        ) {
          existing.listRule = null
          existing.viewRule = null
          existing.createRule = null
          existing.updateRule = null
          existing.deleteRule = null
          app.save(existing)
        }
        return existing
      } catch (_) {
        var collection = new Collection({
          name: 'com_ipcp_snapshots',
          type: 'base',
          listRule: null,
          viewRule: null,
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

    function round1(value) {
      return Math.round(Number(value || 0) * 10) / 10
    }

    function clamp(value, min, max) {
      value = Number(value || 0)
      if (value < min) return min
      if (value > max) return max
      return value
    }

    function esc(value) {
      return String(value || '')
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
    }

    function filtroEscopoColecao(collection, scope, responsavelId, actor) {
      var parts = []
      if (collection === 'com_negocios') parts.push('inativo = false')
      if (
        (scope === 'proprio' || scope === 'equipe') &&
        responsavelId &&
        responsavelId !== '__todos__'
      )
        parts.push("responsavel_id = '" + esc(responsavelId) + "'")
      if (scope === 'equipe' && (!responsavelId || responsavelId === '__todos__')) {
        var equipeId = actor.getString('equipe_id') || ''
        if (equipeId) parts.push("equipe_id = '" + esc(equipeId) + "'")
      }
      return parts.length ? parts.join(' && ') : "id != ''"
    }

    function listar(collection, filtro, sort, limit) {
      try {
        return $app.findRecordsByFilter(
          collection,
          filtro || "id != ''",
          sort || '-created',
          limit || 200,
          0,
        )
      } catch (_) {
        return []
      }
    }

    function valorNegocioIpcp(rec) {
      var valor = Number(rec.get('valor') || 0)
      if (!isFinite(valor) || valor < 0) return 0
      return valor
    }

    function negocioComputavelIpcp(rec) {
      if (!rec.getString('responsavel_id')) return false
      if (!rec.getString('modalidade')) return false
      if (valorNegocioIpcp(rec) <= 1) return false
      return true
    }

    function negociosComputaveisIpcp(negocios) {
      var rows = []
      for (var nci = 0; nci < negocios.length; nci++) {
        if (negocioComputavelIpcp(negocios[nci])) rows.push(negocios[nci])
      }
      return rows
    }

    function filtroPorIds(campo, ids) {
      if (!ids || !ids.length) return "id = '__sem_registros__'"
      var partes = []
      for (var fi = 0; fi < ids.length && fi < 80; fi++)
        partes.push(campo + " = '" + esc(ids[fi]) + "'")
      return partes.length ? '(' + partes.join(' || ') + ')' : "id = '__sem_registros__'"
    }

    function filtroPorNegocios(campo, negocios) {
      var ids = []
      for (var fni = 0; fni < negocios.length; fni++) ids.push(negocios[fni].id)
      return filtroPorIds(campo, ids)
    }

    function propostasDaCarteira(negocios) {
      return listar('com_propostas', filtroPorNegocios('negocio_id', negocios), '-created', 200)
    }

    function filtroPorPropostas(campo, propostasCarteira) {
      var ids = []
      for (var fpi = 0; fpi < propostasCarteira.length; fpi++) ids.push(propostasCarteira[fpi].id)
      return filtroPorIds(campo, ids)
    }

    function classificarResultado(rec) {
      var resultado = rec.getString('resultado') || rec.getString('status') || ''
      if (resultado === 'ganho') return 'ganho'
      if (resultado === 'perdido') return 'perdido'
      if (resultado === 'desqualificado') return 'desqualificado'
      return 'aberto'
    }

    function nomeNegocio(rec) {
      return (
        rec.getString('cliente') ||
        rec.getString('empresa_nome') ||
        rec.getString('contato_nome') ||
        rec.getString('titulo') ||
        rec.getString('nome') ||
        'Negócio comercial'
      )
    }

    function negocioHumanoId(rec) {
      return (
        rec.getString('oe_numero') ||
        rec.getString('external_id') ||
        rec.getString('codigo') ||
        rec.id
      )
    }
    function textoRegistroComercial(rec) {
      try {
        var notas = $app.findRecordsByFilter(
          'com_notas_negocio',
          "negocio_id='" + esc(rec.id) + "'",
          '-criada_em,-created,-id',
          3,
          0,
        )
        var textos = []
        for (var ni = 0; ni < notas.length; ni++) textos.push(notas[ni].getString('texto') || '')
        return textos.join(' ')
      } catch (_) {
        return ''
      }
    }

    function contemQualidadeRegistro(texto, padroes) {
      var t = String(texto || '').toLowerCase()
      for (var pi = 0; pi < padroes.length; pi++) if (padroes[pi].test(t)) return true
      return false
    }

    function calcularQualidadeRegistroComercial(negocios) {
      if (!negocios.length) return { media: 1, avaliados: 0, fracos: 0, bons: 0 }
      var total = 0,
        avaliados = 0,
        fracos = 0,
        bons = 0
      for (var qi = 0; qi < negocios.length; qi++) {
        var rec = negocios[qi]
        if (classificarResultado(rec) !== 'aberto') continue
        avaliados++
        var texto = textoRegistroComercial(rec)
        var proxima = rec.getString('proxima_acao_em') || ''
        var pontos = 0
        if (proxima) pontos += 0.15
        if (texto && texto.trim().length >= 40) pontos += 0.15
        if (
          contemQualidadeRegistro(texto, [
            /decisor/,
            /respons[aá]vel pela decis[aã]o/,
            /quem decide/,
            /influenciador/,
          ])
        )
          pontos += 0.18
        if (
          contemQualidadeRegistro(texto, [/necessidade/, /dor/, /demanda/, /objetivo/, /escopo/])
        )
          pontos += 0.18
        if (
          contemQualidadeRegistro(texto, [
            /obje[cç][aã]o/,
            /risco/,
            /pend[eê]ncia/,
            /bloqueio/,
            /restri[cç][aã]o/,
          ])
        )
          pontos += 0.18
        if (
          contemQualidadeRegistro(texto, [
            /pr[oó]ximo passo/,
            /combinado/,
            /retorno/,
            /validar/,
            /enviar/,
            /reuni[aã]o/,
          ])
        )
          pontos += 0.16
        if (
          contemQualidadeRegistro(texto, [
            /prazo/,
            /data/,
            /\d{1,2}\/\d{1,2}/,
            /\d{4}-\d{2}-\d{2}/,
          ])
        )
          pontos += 0.15
        if (pontos > 1) pontos = 1
        if (pontos < 0.35) fracos++
        if (pontos >= 0.7) bons++
        total += pontos
      }
      if (!avaliados) return { media: 1, avaliados: 0, fracos: 0, bons: 0 }
      return { media: total / avaliados, avaliados: avaliados, fracos: fracos, bons: bons }
    }

    var IPCP_ALTO_VALOR_REFERENCIA_REAIS = 10000
    var IPCP_ALTO_VALOR_REFERENCIA = IPCP_ALTO_VALOR_REFERENCIA_REAIS * 100
    var IPCP_MIN_DECIDIDOS_CONFIANCA_TOTAL = 5

    function negocioRecorrenteIpcp(rec) {
      return String(rec.getString('modalidade') || '').toLowerCase() === 'recorrente'
    }

    function negocioAltoValorIpcp(valor) {
      return Number(valor || 0) >= IPCP_ALTO_VALOR_REFERENCIA
    }

    function negocioMaduroQualificadoIpcp(rec, valor) {
      if (!rec.getString('modalidade')) return false
      if (!(Number(valor || 0) > 1)) return false
      if (rec.getString('proxima_acao_em')) return true
      var texto = textoRegistroComercial(rec)
      if (texto && texto.trim().length >= 80) return true
      return (
        contemQualidadeRegistro(texto, [
          /decisor/,
          /quem decide/,
          /respons[aá]vel pela decis[aã]o/,
        ]) &&
        contemQualidadeRegistro(texto, [/necessidade/, /dor\b/, /demanda/, /objetivo/, /escopo/]) &&
        contemQualidadeRegistro(texto, [
          /pr[oó]ximo passo/,
          /combinado/,
          /retorno/,
          /validar/,
          /reuni[aã]o/,
        ])
      )
    }

    function calcularResultadoComercialIpcp(ganhos, perdidos) {
      var totalDecididos = ganhos + perdidos
      var conversao = totalDecididos ? ganhos / totalDecididos : 0
      var confiancaDecididos = Math.min(1, totalDecididos / IPCP_MIN_DECIDIDOS_CONFIANCA_TOTAL)
      return round1(
        clamp(12 + conversao * 10 * confiancaDecididos + Math.min(8, ganhos * 0.8), 8, 30),
      )
    }

    function calcularValorEstrategicoIpcp(metricas) {
      var abertos = Math.max(0, Number(metricas.abertos || 0))
      var recorrenciaCarteiraAberta = Math.min(
        3,
        abertos ? (Number(metricas.abertosRecorrentes || 0) / abertos) * 3 : 0,
      )
      var valorFinanceiroCarteiraAberta = Math.min(1, Number(metricas.valorAberto || 0) / 200000)
      var recorrenteAltoValor = Math.min(
        5,
        abertos ? (Number(metricas.abertosRecorrentesAltoValor || 0) / abertos) * 5 : 0,
      )
      var valorGanhoEstrategico = Math.min(
        5,
        Number(metricas.ganhosEstrategicos || 0) * 2.5 +
          Number(metricas.valorGanhoEstrategico || 0) / 50000,
      )
      var maturidadeComercialQualificada = Math.min(
        1,
        abertos ? Number(metricas.madurosQualificados || 0) / abertos : 0,
      )
      return round1(
        clamp(
          recorrenciaCarteiraAberta +
            valorFinanceiroCarteiraAberta +
            recorrenteAltoValor +
            valorGanhoEstrategico +
            maturidadeComercialQualificada,
          0,
          15,
        ),
      )
    }

    function calcularPacoteIpcpDiario(dataRef, scope, responsavelId, actor) {
      var filtroNegocios = filtroEscopoColecao('com_negocios', scope, responsavelId, actor)
      var negocios = listar('com_negocios', filtroNegocios, '-updated,-created', 200)
      var negociosComputaveis = negociosComputaveisIpcp(negocios)
      var filtroNegociosRelacionados = filtroPorNegocios('negocio_id', negociosComputaveis)
      var propostasCarteira = propostasDaCarteira(negociosComputaveis)
      var atividades = listar('com_atividades', filtroNegociosRelacionados, '-created', 200)
      var slas = listar('com_slas', filtroNegociosRelacionados, '-created', 200)
      var propostas = listar(
        'com_proposta_envios',
        filtroPorPropostas('proposta_id', propostasCarteira),
        '-created',
        200,
      )
      var fechamentos = listar('com_fechamentos', filtroNegociosRelacionados, '-created', 200)

      var abertos = 0,
        ganhos = 0,
        perdidos = 0,
        valorAberto = 0,
        valorGanho = 0,
        abertosRecorrentes = 0,
        abertosRecorrentesAltoValor = 0,
        ganhosEstrategicos = 0,
        valorGanhoEstrategico = 0,
        madurosQualificados = 0
      var semResponsavel = 0,
        semModalidade = 0,
        prospectPendente = 0
      for (var i = 0; i < negociosComputaveis.length; i++) {
        var n = negociosComputaveis[i]
        var situacao = classificarResultado(n)
        var valor = valorNegocioIpcp(n)
        var recorrente = negocioRecorrenteIpcp(n)
        var altoValor = negocioAltoValorIpcp(valor)
        if (situacao === 'ganho') {
          ganhos++
          if (valor > 1) valorGanho += valor
          if (recorrente || altoValor) {
            ganhosEstrategicos++
            if (valor > 1) valorGanhoEstrategico += valor
          }
        } else if (situacao === 'perdido' || situacao === 'desqualificado') perdidos++
        else {
          abertos++
          if (valor > 1) valorAberto += valor
          if (recorrente) abertosRecorrentes++
          if (recorrente && altoValor) abertosRecorrentesAltoValor++
          if (negocioMaduroQualificadoIpcp(n, valor)) madurosQualificados++
        }
        if (!n.getString('responsavel_id')) semResponsavel++
        if (!n.getString('modalidade')) semModalidade++
        if (
          (n.getString('etapa') === 'prospects' || n.getString('qualificacao') === 'pendente') &&
          situacao === 'aberto'
        )
          prospectPendente++
      }

      var coberturaResponsavel = negociosComputaveis.length
        ? (negociosComputaveis.length - semResponsavel) / negociosComputaveis.length
        : 1
      var coberturaModalidade = negociosComputaveis.length
        ? (negociosComputaveis.length - semModalidade) / negociosComputaveis.length
        : 1
      var atividadePorAberto = abertos ? atividades.length / abertos : atividades.length
      var slaPressao = slas.length
        ? Math.min(1, slas.length / Math.max(1, abertos || negociosComputaveis.length))
        : 0

      var resultadoComercial = calcularResultadoComercialIpcp(ganhos, perdidos)
      var valorEstrategico = calcularValorEstrategicoIpcp({
        abertos: abertos,
        valorAberto: valorAberto,
        abertosRecorrentes: abertosRecorrentes,
        abertosRecorrentesAltoValor: abertosRecorrentesAltoValor,
        ganhosEstrategicos: ganhosEstrategicos,
        valorGanhoEstrategico: valorGanhoEstrategico,
        madurosQualificados: madurosQualificados,
      })
      var disciplinaCarteira = round1(
        clamp(
          7 + Math.min(8, atividadePorAberto * 1.6) + coberturaResponsavel * 4 - slaPressao * 3,
          4,
          20,
        ),
      )
      var qualidadeFollowup = round1(
        clamp(
          6 +
            Math.min(7, atividades.length / 8) +
            Math.min(4, propostas.length / 10) -
            prospectPendente * 0.4,
          4,
          20,
        ),
      )
      var qualidadeRegistro = calcularQualidadeRegistroComercial(negociosComputaveis)
      var registrosAprendizado = round1(
        clamp(
          3 +
            qualidadeRegistro.media * 9 +
            coberturaModalidade * 1.5 +
            Math.min(1.5, qualidadeRegistro.bons * 0.3),
          3,
          15,
        ),
      )
      var total = round1(
        resultadoComercial +
          valorEstrategico +
          disciplinaCarteira +
          qualidadeFollowup +
          registrosAprendizado,
      )

      var prioridades = []
      if (prospectPendente > 0)
        prioridades.push({
          titulo: 'Resolver qualificações pendentes',
          motivo:
            prospectPendente +
            ' negócio(s) precisam sair do limbo entre qualificar, descartar ou complementar dados.',
          bloco_afetado: 'resultado_comercial',
        })
      if (slas.length > 0)
        prioridades.push({
          titulo: 'Tratar SLAs e próximas ações em risco',
          motivo: 'Há sinais de prazo que podem esfriar oportunidades abertas neste escopo.',
          bloco_afetado: 'disciplina_carteira',
        })
      if (propostas.length > 0)
        prioridades.push({
          titulo: 'Acompanhar propostas enviadas',
          motivo: 'Propostas sem acompanhamento claro reduzem conversão e valor estratégico.',
          bloco_afetado: 'qualidade_followup',
        })
      if (qualidadeRegistro.fracos > 0)
        prioridades.push({
          titulo: 'Qualificar registros comerciais',
          motivo:
            qualidadeRegistro.fracos +
            ' registro(s) têm próximo compromisso ou histórico sem decisor, necessidade, objeção, prazo ou próximo passo claro.',
          bloco_afetado: 'registros_aprendizado',
        })
      if (prioridades.length < 3)
        prioridades.push({
          titulo: 'Registrar objeções e próximos compromissos',
          motivo:
            'Registros claros tornam a orientação do Nexo específica para a carteira consultada.',
          bloco_afetado: 'registros_aprendizado',
        })
      if (prioridades.length < 3)
        prioridades.push({
          titulo: 'Manter cadência da carteira aberta',
          motivo: 'Cada oportunidade aberta deve ter responsável e próxima ação objetiva.',
          bloco_afetado: 'disciplina_carteira',
        })

      var negociosAtencao = []
      for (var j = 0; j < negociosComputaveis.length && negociosAtencao.length < 3; j++) {
        var item = negociosComputaveis[j]
        if (classificarResultado(item) !== 'aberto') continue
        var motivos = []
        if (!item.getString('responsavel_id')) motivos.push('sem responsável comercial claro')
        if (!item.getString('modalidade')) motivos.push('sem modalidade registrada')
        if (
          item.getString('qualificacao') === 'pendente' ||
          item.getString('etapa') === 'prospects'
        )
          motivos.push('qualificação pendente')
        if (!motivos.length) motivos.push('exige próximo passo comercial verificável')
        negociosAtencao.push({
          id_negocio: negocioHumanoId(item),
          cliente: nomeNegocio(item),
          motivo: motivos.join('; '),
          acao_recomendada:
            'Registrar decisor, pendência, prazo de retorno e próxima ação objetiva.',
          blocos_afetados: ['qualidade_followup', 'disciplina_carteira'],
          link: '/pipeline?negocio=' + encodeURIComponent(negocioHumanoId(item)),
        })
      }

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
            avaliados: atividades.length + propostas.length + negocios.length,
            total: atividades.length + propostas.length + negocios.length,
            pendentes: 0,
          },
        },
        resumo_nexo: {
          texto:
            'Leitura viva ' +
            (scope === 'proprio' ? 'da carteira do usuário' : 'da equipe') +
            ' processada com base nos sinais operacionais disponíveis no ambiente: negócios, atividades, propostas, SLAs e fechamentos.',
          prioridades: prioridades.slice(0, 3),
        },
        negocios_atencao: negociosAtencao,
        evolucao: {
          status: 'sem_historico',
          comentario:
            'Pacote diário calculado em produção assistida com dados vivos do escopo consultado.',
        },
        evidencias: {
          criterio: 'sinais_operacionais_resumidos_para_gestao',
          fonte: 'processamento_diario_ipcp_dados_vivos',
          exemplos: [
            {
              bloco: 'resultado_comercial',
              sinal: ganhos + ' ganho(s), ' + perdidos + ' perda(s) e ' + abertos + ' aberto(s)',
              acao: 'priorizar decisões e próximos passos',
            },
            {
              bloco: 'disciplina_carteira',
              sinal:
                atividades.length +
                ' atividade(s), ' +
                slas.length +
                ' SLA(s), ' +
                qualidadeRegistro.fracos +
                ' registro(s) fraco(s)',
              acao: 'qualificar decisor, necessidade, objeção, prazo e próximo passo verificável',
            },
          ],
        },
      }
    }

    function profileSlugLocal(user) {
      try {
        var perfilId = user ? user.getString('perfil_id') : ''
        if (!perfilId) return ''
        return $app.findRecordById('com_perfis', perfilId).getString('slug') || ''
      } catch (_) {
        return ''
      }
    }

    function usuarioNome(user) {
      return user.getString('name') || user.getString('email') || user.id
    }

    function salvarPacoteDiario(
      data,
      effectiveScope,
      responsavelId,
      responsavelNome,
      ator,
      origem,
    ) {
      var formula = 'ipcp_v0_5_formula_gerencial'
      var pacote = calcularPacoteIpcpDiario(data, effectiveScope, responsavelId, ator)
      var ipcpTotal = pacote.ipcp.total
      var snapshotKey = [
        data,
        effectiveScope,
        responsavelId || '',
        formula,
        'processamento_diario',
      ].join('|')
      var payload = {
        contrato: 'ipcp_processamento_diario_homologacao_v0_1',
        modo: 'processamento_diario_homologacao',
        data_referencia: data,
        escopo: {
          tipo: effectiveScope,
          responsavel_id: responsavelId || null,
          responsavel_nome: responsavelNome,
        },
        formula_version: formula,
        ipcp: pacote.ipcp,
        resumo_nexo: pacote.resumo_nexo,
        negocios_atencao: pacote.negocios_atencao,
        evolucao: pacote.evolucao,
        evidencias: pacote.evidencias,
        pacote_completo: true,
        processamento_diario: {
          controlado: true,
          homologacao: true,
          pacote_completo: true,
          agendamento_automatico_ativo: true,
          horario_recife: IPCP_JOB_DIARIO_HOMOLOGACAO_HORARIO_RECIFE,
          cron_utc: IPCP_JOB_DIARIO_HOMOLOGACAO_CRON_UTC,
          producao_publicada: false,
        },
        guardrails: {
          sem_ranking_punitivo: true,
          fallback_openai_bloqueado: true,
          sem_envio: true,
          sem_crm_write: true,
          sem_app_write: true,
          sem_job_automatico: false,
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
        record.set('modo', 'processamento_diario')
        record.set('data_referencia', data)
        record.set('escopo', effectiveScope)
        record.set('responsavel_id', responsavelId || '')
        record.set('responsavel_nome', responsavelNome)
        record.set('formula_version', formula)
        record.set('ipcp_total', ipcpTotal)
        record.set('status', 'producao_assistida')
        record.set('criado_por_id', ator.id || 'ipcp_job_diario')
        record.set('origem', origem)
        record.set('payload', payload)
        tx.save(record)
      })
    }

    var data = civilHojeRecife()
    var processados = 0
    var usuarios = []
    try {
      usuarios = $app.findRecordsByFilter('users', 'ativo_comercial = true', 'name,email', 200, 0)
    } catch (_) {
      usuarios = []
    }
    var gestor = null
    for (var i = 0; i < usuarios.length; i++) {
      var slug = profileSlugLocal(usuarios[i])
      if (
        slug === 'superadministrador' ||
        slug === 'gestor-comercial' ||
        slug === 'leitura-executiva'
      ) {
        gestor = usuarios[i]
        break
      }
    }
    if (!gestor && usuarios.length) gestor = usuarios[0]
    if (!gestor) return

    try {
      salvarPacoteDiario(
        data,
        'equipe',
        '__todos__',
        'Todos',
        gestor,
        'ipcp_processamento_diario_job_1900_recife',
      )
      processados++
    } catch (errConsolidado) {
      console.log('IPCP job diario: falha no consolidado: ' + String(errConsolidado).slice(0, 180))
    }

    for (var ui = 0; ui < usuarios.length; ui++) {
      var usuario = usuarios[ui]
      try {
        salvarPacoteDiario(
          data,
          'equipe',
          usuario.id,
          usuarioNome(usuario),
          usuario,
          'ipcp_processamento_diario_job_1900_recife_responsavel',
        )
        processados++
      } catch (errUsuario) {
        console.log(
          'IPCP job diario: falha no responsavel ' +
            usuario.id +
            ': ' +
            String(errUsuario).slice(0, 180),
        )
      }
    }
    console.log(
      'IPCP job diario 19:00 Recife: ' + processados + ' pacote(s) processado(s) para ' + data,
    )
  },
)

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
      return (
        slug === 'superadministrador' || slug === 'gestor-comercial' || slug === 'leitura-executiva'
      )
    }

    function canViewAll(slug) {
      return slug === 'superadministrador' || slug === 'leitura-executiva'
    }

    function esc(value) {
      return String(value || '')
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
    }

    function leituraPayload(record) {
      try {
        var raw = record.get('payload') || {}
        if (typeof raw === 'string') return JSON.parse(raw || '{}')
        if (raw && !raw.ipcp && raw.toString && String(raw).charAt(0) === '{')
          return JSON.parse(String(raw))
        return raw
      } catch (_) {
        return {}
      }
    }

    function textoCurto(value, max) {
      var text = String(value || '')
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
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

    function round1(value) {
      return Math.round(Number(value || 0) * 10) / 10
    }

    function clamp(value, min, max) {
      value = Number(value || 0)
      if (value < min) return min
      if (value > max) return max
      return value
    }

    function listar(collection, filtro, sort, limit) {
      try {
        return $app.findRecordsByFilter(
          collection,
          filtro || "id != ''",
          sort || '-created',
          limit || 200,
          0,
        )
      } catch (_) {
        return []
      }
    }

    function filtroEscopoColecao(collection, scope, responsavelId, actor) {
      var parts = []
      if (collection === 'com_negocios') parts.push('inativo = false')
      if ((scope === 'proprio' || scope === 'equipe') && responsavelId)
        parts.push("responsavel_id = '" + esc(responsavelId) + "'")
      else if (scope === 'equipe') {
        var equipeId = actor.getString('equipe_id') || ''
        if (equipeId) parts.push("equipe_id = '" + esc(equipeId) + "'")
      }
      return parts.length ? parts.join(' && ') : "id != ''"
    }

    function filtroResponsavelOperacional(scope, responsavelId) {
      if (scope === 'proprio' && responsavelId)
        return "responsavel_id = '" + esc(responsavelId) + "'"
      if (scope === 'equipe' && responsavelId)
        return "responsavel_id = '" + esc(responsavelId) + "'"
      return "id != ''"
    }

    function filtroPorIds(campo, ids) {
      if (!ids || !ids.length) return "id = '__sem_registros__'"
      var partes = []
      for (var fi = 0; fi < ids.length && fi < 80; fi++)
        partes.push(campo + " = '" + esc(ids[fi]) + "'")
      return partes.length ? '(' + partes.join(' || ') + ')' : "id = '__sem_registros__'"
    }

    function filtroPorNegocios(campo, negocios) {
      var ids = []
      for (var fni = 0; fni < negocios.length; fni++) ids.push(negocios[fni].id)
      return filtroPorIds(campo, ids)
    }

    function propostasDaCarteira(negocios) {
      return listar('com_propostas', filtroPorNegocios('negocio_id', negocios), '-created', 200)
    }

    function filtroPorPropostas(campo, propostasCarteira) {
      var ids = []
      for (var fpi = 0; fpi < propostasCarteira.length; fpi++) ids.push(propostasCarteira[fpi].id)
      return filtroPorIds(campo, ids)
    }

    function classificarResultado(rec) {
      var resultado = rec.getString('resultado') || rec.getString('status') || ''
      if (resultado === 'ganho') return 'ganho'
      if (resultado === 'perdido') return 'perdido'
      if (resultado === 'desqualificado') return 'desqualificado'
      return 'aberto'
    }

    function nomeNegocio(rec) {
      var empresaId = rec.getString('empresa_id') || ''
      var contatoId = rec.getString('contato_principal_id') || ''
      return (
        rec.getString('cliente') ||
        rec.getString('empresa_nome') ||
        rec.getString('contato_nome') ||
        nomeRelacionado('com_empresas', empresaId, ['nome', 'razao_social']) ||
        nomeRelacionado('com_contatos', contatoId, ['nome']) ||
        rec.getString('titulo') ||
        rec.getString('nome') ||
        'Negócio comercial'
      )
    }

    function nomeRelacionado(collection, id, fields) {
      if (!id) return null
      try {
        var rec = $app.findRecordById(collection, id)
        for (var nri = 0; nri < fields.length; nri++) {
          var value = rec.getString(fields[nri])
          if (value) return value
        }
      } catch (_) {}
      return null
    }

    function valorNegocioIpcp(rec) {
      var valor = Number(rec.get('valor') || 0)
      if (!isFinite(valor) || valor <= 0) valor = Number(rec.get('valor_centavos') || 0)
      if (!isFinite(valor) || valor < 0) return 0
      return valor
    }

    function negocioComputavelIpcp(rec) {
      if (!rec.getString('responsavel_id')) return false
      if (!rec.getString('modalidade')) return false
      if (valorNegocioIpcp(rec) <= 1) return false
      return true
    }

    function negociosComputaveisIpcp(negocios) {
      var rows = []
      for (var nci = 0; nci < negocios.length; nci++) {
        if (negocioComputavelIpcp(negocios[nci])) rows.push(negocios[nci])
      }
      return rows
    }

    function negocioHumanoId(rec) {
      var oe = rec.getString('oe_numero')
      if (oe) return oe
      try {
        var vinculo = $app.findFirstRecordByFilter(
          'com_vinculos_externos',
          "collection_name='com_negocios' && record_id='" + esc(rec.id) + "'",
        )
        if (vinculo && vinculo.getString('external_id')) return vinculo.getString('external_id')
      } catch (_) {}
      var external = rec.getString('external_id')
      if (external) return external
      var codigo = rec.getString('codigo')
      if (codigo) return codigo
      return 'Sem número legível'
    }
    function textoRegistroComercial(rec) {
      try {
        var notas = $app.findRecordsByFilter(
          'com_notas_negocio',
          "negocio_id='" + esc(rec.id) + "'",
          '-criada_em,-created,-id',
          3,
          0,
        )
        var textos = []
        for (var ni = 0; ni < notas.length; ni++) textos.push(notas[ni].getString('texto') || '')
        return textos.join(' ')
      } catch (_) {
        return ''
      }
    }

    function contemQualidadeRegistro(texto, padroes) {
      var t = String(texto || '').toLowerCase()
      for (var pi = 0; pi < padroes.length; pi++) if (padroes[pi].test(t)) return true
      return false
    }

    function calcularQualidadeRegistroComercial(negocios) {
      if (!negocios.length) return { media: 1, avaliados: 0, fracos: 0, bons: 0 }
      var total = 0,
        avaliados = 0,
        fracos = 0,
        bons = 0
      for (var qi = 0; qi < negocios.length; qi++) {
        var rec = negocios[qi]
        if (classificarResultado(rec) !== 'aberto') continue
        avaliados++
        var texto = textoRegistroComercial(rec)
        var proxima = rec.getString('proxima_acao_em') || ''
        var pontos = 0
        if (proxima) pontos += 0.15
        if (texto && texto.trim().length >= 40) pontos += 0.15
        if (
          contemQualidadeRegistro(texto, [
            /decisor/,
            /respons[aá]vel pela decis[aã]o/,
            /quem decide/,
            /influenciador/,
          ])
        )
          pontos += 0.18
        if (
          contemQualidadeRegistro(texto, [/necessidade/, /dor/, /demanda/, /objetivo/, /escopo/])
        )
          pontos += 0.18
        if (
          contemQualidadeRegistro(texto, [
            /obje[cç][aã]o/,
            /risco/,
            /pend[eê]ncia/,
            /bloqueio/,
            /restri[cç][aã]o/,
          ])
        )
          pontos += 0.18
        if (
          contemQualidadeRegistro(texto, [
            /pr[oó]ximo passo/,
            /combinado/,
            /retorno/,
            /validar/,
            /enviar/,
            /reuni[aã]o/,
          ])
        )
          pontos += 0.16
        if (
          contemQualidadeRegistro(texto, [
            /prazo/,
            /data/,
            /\d{1,2}\/\d{1,2}/,
            /\d{4}-\d{2}-\d{2}/,
          ])
        )
          pontos += 0.15
        if (pontos > 1) pontos = 1
        if (pontos < 0.35) fracos++
        if (pontos >= 0.7) bons++
        total += pontos
      }
      if (!avaliados) return { media: 1, avaliados: 0, fracos: 0, bons: 0 }
      return { media: total / avaliados, avaliados: avaliados, fracos: fracos, bons: bons }
    }

    var IPCP_ALTO_VALOR_REFERENCIA_REAIS = 10000
    var IPCP_ALTO_VALOR_REFERENCIA = IPCP_ALTO_VALOR_REFERENCIA_REAIS * 100
    var IPCP_MIN_DECIDIDOS_CONFIANCA_TOTAL = 5

    function negocioRecorrenteIpcp(rec) {
      return String(rec.getString('modalidade') || '').toLowerCase() === 'recorrente'
    }

    function negocioAltoValorIpcp(valor) {
      return Number(valor || 0) >= IPCP_ALTO_VALOR_REFERENCIA
    }

    function negocioMaduroQualificadoIpcp(rec, valor) {
      if (!rec.getString('modalidade')) return false
      if (!(Number(valor || 0) > 1)) return false
      if (rec.getString('proxima_acao_em')) return true
      var texto = textoRegistroComercial(rec)
      if (texto && texto.trim().length >= 80) return true
      return (
        contemQualidadeRegistro(texto, [
          /decisor/,
          /quem decide/,
          /respons[aá]vel pela decis[aã]o/,
        ]) &&
        contemQualidadeRegistro(texto, [/necessidade/, /dor\b/, /demanda/, /objetivo/, /escopo/]) &&
        contemQualidadeRegistro(texto, [
          /pr[oó]ximo passo/,
          /combinado/,
          /retorno/,
          /validar/,
          /reuni[aã]o/,
        ])
      )
    }

    function calcularResultadoComercialIpcp(ganhos, perdidos) {
      var totalDecididos = ganhos + perdidos
      var conversao = totalDecididos ? ganhos / totalDecididos : 0
      var confiancaDecididos = Math.min(1, totalDecididos / IPCP_MIN_DECIDIDOS_CONFIANCA_TOTAL)
      return round1(
        clamp(12 + conversao * 10 * confiancaDecididos + Math.min(8, ganhos * 0.8), 8, 30),
      )
    }

    function calcularValorEstrategicoIpcp(metricas) {
      var abertos = Math.max(0, Number(metricas.abertos || 0))
      var recorrenciaCarteiraAberta = Math.min(
        3,
        abertos ? (Number(metricas.abertosRecorrentes || 0) / abertos) * 3 : 0,
      )
      var valorFinanceiroCarteiraAberta = Math.min(1, Number(metricas.valorAberto || 0) / 200000)
      var recorrenteAltoValor = Math.min(
        5,
        abertos ? (Number(metricas.abertosRecorrentesAltoValor || 0) / abertos) * 5 : 0,
      )
      var valorGanhoEstrategico = Math.min(
        5,
        Number(metricas.ganhosEstrategicos || 0) * 2.5 +
          Number(metricas.valorGanhoEstrategico || 0) / 50000,
      )
      var maturidadeComercialQualificada = Math.min(
        1,
        abertos ? Number(metricas.madurosQualificados || 0) / abertos : 0,
      )
      return round1(
        clamp(
          recorrenciaCarteiraAberta +
            valorFinanceiroCarteiraAberta +
            recorrenteAltoValor +
            valorGanhoEstrategico +
            maturidadeComercialQualificada,
          0,
          15,
        ),
      )
    }

    function calcularPacoteIpcpDiarioVivo(dataRef, scope, responsavelId, actor) {
      var filtroNegocios = filtroEscopoColecao('com_negocios', scope, responsavelId, actor)
      var negocios = listar('com_negocios', filtroNegocios, '-updated,-created', 200)
      var negociosComputaveis = negociosComputaveisIpcp(negocios)
      var filtroOperacional = filtroResponsavelOperacional(scope, responsavelId)
      var filtroNegociosRelacionados = filtroPorNegocios('negocio_id', negociosComputaveis)
      var propostasCarteira = propostasDaCarteira(negociosComputaveis)
      var atividades = listar('com_atividades', filtroNegociosRelacionados, '-created', 200)
      var slas = listar('com_slas', filtroNegociosRelacionados, '-created', 200)
      var propostas = listar(
        'com_proposta_envios',
        filtroPorPropostas('proposta_id', propostasCarteira),
        '-created',
        200,
      )
      var fechamentos = listar('com_fechamentos', filtroNegociosRelacionados, '-created', 200)
      var abertos = 0,
        ganhos = 0,
        perdidos = 0,
        valorAberto = 0,
        valorGanho = 0,
        abertosRecorrentes = 0,
        abertosRecorrentesAltoValor = 0,
        ganhosEstrategicos = 0,
        valorGanhoEstrategico = 0,
        madurosQualificados = 0,
        semResponsavel = 0,
        semModalidade = 0,
        prospectPendente = 0
      for (var i = 0; i < negociosComputaveis.length; i++) {
        var n = negociosComputaveis[i]
        var situacao = classificarResultado(n)
        var valor = valorNegocioIpcp(n)
        var recorrente = negocioRecorrenteIpcp(n)
        var altoValor = negocioAltoValorIpcp(valor)
        if (situacao === 'ganho') {
          ganhos++
          if (valor > 1) valorGanho += valor
          if (recorrente || altoValor) {
            ganhosEstrategicos++
            if (valor > 1) valorGanhoEstrategico += valor
          }
        } else if (situacao === 'perdido' || situacao === 'desqualificado') perdidos++
        else {
          abertos++
          if (valor > 1) valorAberto += valor
          if (recorrente) abertosRecorrentes++
          if (recorrente && altoValor) abertosRecorrentesAltoValor++
          if (negocioMaduroQualificadoIpcp(n, valor)) madurosQualificados++
        }
        if (!n.getString('responsavel_id')) semResponsavel++
        if (!n.getString('modalidade')) semModalidade++
        if (
          (n.getString('etapa') === 'prospects' || n.getString('qualificacao') === 'pendente') &&
          situacao === 'aberto'
        )
          prospectPendente++
      }
      var totalDecididos = ganhos + perdidos
      var conversao = totalDecididos ? ganhos / totalDecididos : 0
      var coberturaResponsavel = negociosComputaveis.length
        ? (negociosComputaveis.length - semResponsavel) / negociosComputaveis.length
        : 1
      var coberturaModalidade = negociosComputaveis.length
        ? (negociosComputaveis.length - semModalidade) / negociosComputaveis.length
        : 1
      var atividadePorAberto = abertos ? atividades.length / abertos : atividades.length
      var slaPressao = slas.length
        ? Math.min(1, slas.length / Math.max(1, abertos || negociosComputaveis.length))
        : 0
      var resultadoComercial = calcularResultadoComercialIpcp(ganhos, perdidos)
      var valorEstrategico = calcularValorEstrategicoIpcp({
        abertos: abertos,
        valorAberto: valorAberto,
        abertosRecorrentes: abertosRecorrentes,
        abertosRecorrentesAltoValor: abertosRecorrentesAltoValor,
        ganhosEstrategicos: ganhosEstrategicos,
        valorGanhoEstrategico: valorGanhoEstrategico,
        madurosQualificados: madurosQualificados,
      })
      var disciplinaCarteira = round1(
        clamp(
          7 + Math.min(8, atividadePorAberto * 1.6) + coberturaResponsavel * 4 - slaPressao * 3,
          4,
          20,
        ),
      )
      var qualidadeFollowup = round1(
        clamp(
          6 +
            Math.min(7, atividades.length / 8) +
            Math.min(4, propostas.length / 10) -
            prospectPendente * 0.4,
          4,
          20,
        ),
      )
      var qualidadeRegistro = calcularQualidadeRegistroComercial(negociosComputaveis)
      var registrosAprendizado = round1(
        clamp(
          3 +
            qualidadeRegistro.media * 9 +
            coberturaModalidade * 1.5 +
            Math.min(1.5, qualidadeRegistro.bons * 0.3),
          3,
          15,
        ),
      )
      var prioridades = []
      if (prospectPendente > 0)
        prioridades.push({
          titulo: 'Resolver qualificações pendentes',
          motivo:
            prospectPendente +
            ' negócio(s) precisam sair do limbo entre qualificar, descartar ou complementar dados.',
          bloco_afetado: 'resultado_comercial',
        })
      if (slas.length > 0)
        prioridades.push({
          titulo: 'Tratar SLAs e próximas ações em risco',
          motivo: 'Há sinais de prazo que podem esfriar oportunidades abertas neste escopo.',
          bloco_afetado: 'disciplina_carteira',
        })
      if (propostas.length > 0)
        prioridades.push({
          titulo: 'Acompanhar propostas enviadas',
          motivo: 'Propostas sem acompanhamento claro reduzem conversão e valor estratégico.',
          bloco_afetado: 'qualidade_followup',
        })
      if (qualidadeRegistro.fracos > 0)
        prioridades.push({
          titulo: 'Qualificar registros comerciais',
          motivo:
            qualidadeRegistro.fracos +
            ' registro(s) têm próximo compromisso ou histórico sem decisor, necessidade, objeção, prazo ou próximo passo claro.',
          bloco_afetado: 'registros_aprendizado',
        })
      if (prioridades.length < 3)
        prioridades.push({
          titulo: 'Registrar objeções e próximos compromissos',
          motivo:
            'Registros claros tornam a orientação do Nexo específica para a carteira consultada.',
          bloco_afetado: 'registros_aprendizado',
        })
      if (prioridades.length < 3)
        prioridades.push({
          titulo: 'Manter cadência da carteira aberta',
          motivo: 'Cada oportunidade aberta deve ter responsável e próxima ação objetiva.',
          bloco_afetado: 'disciplina_carteira',
        })
      var negociosAtencao = []
      for (var j = 0; j < negociosComputaveis.length && negociosAtencao.length < 3; j++) {
        var item = negociosComputaveis[j]
        if (classificarResultado(item) !== 'aberto') continue
        var motivos = []
        if (!item.getString('responsavel_id')) motivos.push('sem responsável comercial claro')
        if (!item.getString('modalidade')) motivos.push('sem modalidade registrada')
        if (
          item.getString('qualificacao') === 'pendente' ||
          item.getString('etapa') === 'prospects'
        )
          motivos.push('qualificação pendente')
        if (!motivos.length) motivos.push('exige próximo passo comercial verificável')
        negociosAtencao.push({
          id_negocio: negocioHumanoId(item),
          cliente: nomeNegocio(item),
          empresa: nomeRelacionado('com_empresas', item.getString('empresa_id'), [
            'nome',
            'razao_social',
          ]),
          contato: nomeRelacionado('com_contatos', item.getString('contato_principal_id'), [
            'nome',
          ]),
          motivo: motivos.join('; '),
          acao_recomendada:
            'Registrar decisor, pendência, prazo de retorno e próxima ação objetiva.',
          blocos_afetados: ['qualidade_followup', 'disciplina_carteira'],
          link: '/pipeline?negocio=' + encodeURIComponent(item.id),
        })
      }
      return {
        ipcp: {
          total: round1(
            resultadoComercial +
              valorEstrategico +
              disciplinaCarteira +
              qualidadeFollowup +
              registrosAprendizado,
          ),
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
            avaliados: atividades.length + propostas.length + negociosComputaveis.length,
            total: atividades.length + propostas.length + negociosComputaveis.length,
            pendentes: 0,
          },
        },
        resumo_nexo: {
          texto:
            'Leitura viva ' +
            (scope === 'proprio' ? 'da carteira do usuário' : 'da equipe') +
            ' processada com base nos sinais operacionais disponíveis no ambiente: negócios, atividades, propostas, SLAs e fechamentos.',
          prioridades: prioridades.slice(0, 3),
        },
        negocios_atencao: negociosAtencao,
        evolucao: {
          status: 'sem_historico',
          comentario: 'Pacote calculado em leitura viva com dados do escopo consultado.',
        },
        evidencias: {
          criterio: 'sinais_operacionais_resumidos_para_gestao',
          fonte: 'leitura_viva_ipcp_dados_reais',
          exemplos: [
            {
              bloco: 'resultado_comercial',
              sinal:
                ganhos +
                ' ganho(s), ' +
                perdidos +
                ' perda(s), ' +
                abertos +
                ' aberto(s), ' +
                qualidadeRegistro.fracos +
                ' registro(s) fraco(s)',
              acao: 'priorizar decisões e qualificar registros comerciais',
            },
          ],
        },
      }
    }

    var slug = profileSlug(ator)
    var requestedScope = String(query.escopo || 'proprio')
    var effectiveScope = 'proprio'
    if (requestedScope === 'equipe' && canViewTeam(slug)) effectiveScope = 'equipe'
    if (requestedScope === 'todos' && canViewAll(slug)) effectiveScope = 'todos'

    var responsavelId = ator.id
    var responsavelSelecionado = String(query.responsavel_id || '')
    if (responsavelSelecionado && canViewTeam(slug)) {
      responsavelId = responsavelSelecionado
    }
    if (effectiveScope === 'todos') responsavelId = '__todos__'
    if (effectiveScope === 'equipe' && !responsavelSelecionado) responsavelId = '__todos__'
    if (effectiveScope === 'proprio') responsavelId = ator.id

    var filtro = "data_referencia <= '" + esc(data) + "' && escopo = '" + esc(effectiveScope) + "'"
    if (responsavelId) filtro += " && responsavel_id = '" + esc(responsavelId) + "'"

    var snapshots = []
    var fonteDisponivel = true
    try {
      snapshots = $app.findRecordsByFilter(
        'com_ipcp_snapshots',
        filtro,
        '-data_referencia,-created',
        5,
        0,
      )
      if (!snapshots.length && effectiveScope !== 'proprio' && responsavelId) {
        var filtroEquipe =
          "data_referencia <= '" + esc(data) + "' && escopo = '" + esc(effectiveScope) + "'"
        snapshots = $app.findRecordsByFilter(
          'com_ipcp_snapshots',
          filtroEquipe,
          '-data_referencia,-created',
          5,
          0,
        )
      }
    } catch (_) {
      fonteDisponivel = false
      snapshots = []
    }

    var snapshot = snapshots.length ? snapshots[0] : null
    var payload = snapshot ? leituraPayload(snapshot) : {}
    var pacoteVivoResponsavelId = responsavelId === '__todos__' ? '' : responsavelId
    var pacoteVivo = calcularPacoteIpcpDiarioVivo(
      data,
      effectiveScope,
      pacoteVivoResponsavelId,
      ator,
    )
    var ipcpPayload = pacoteVivo.ipcp || payload.ipcp || {}
    var resumoPayload = pacoteVivo.resumo_nexo || payload.resumo_nexo || {}
    var guardrailsPayload = payload.guardrails || {}

    var ipcpTotal = Number(ipcpPayload.total || 0)
    var formula = 'ipcp_v0_5_formula_gerencial'
    var dataReferencia = data

    function blocoLabel(bloco) {
      if (bloco === 'resultado_comercial') return 'Resultado comercial'
      if (bloco === 'valor_estrategico') return 'Valor estratégico'
      if (bloco === 'disciplina_carteira') return 'Disciplina da carteira'
      if (bloco === 'qualidade_followup') return 'Follow-up'
      if (bloco === 'registros_aprendizado') return 'Registros/aprendizado'
      return bloco
    }

    function roundEvolucao(value) {
      return Math.round(Number(value || 0) * 10) / 10
    }

    function statusEvolucao(delta) {
      if (delta >= 0.5) return 'melhorou'
      if (delta <= -0.5) return 'piorou'
      return 'manteve'
    }

    function payloadSnapshotAnterior(snapshotAtual, rows) {
      if (!rows || rows.length < 2) return null
      for (var ai = 0; ai < rows.length; ai++) {
        if (!snapshotAtual || rows[ai].id !== snapshotAtual.id) return leituraPayload(rows[ai])
      }
      return null
    }

    function montarEvolucaoIpcp(ipcpAtual, anteriorPayload) {
      if (!anteriorPayload || !anteriorPayload.ipcp) {
        return {
          status: 'sem_historico',
          comentario:
            'Esta é a primeira leitura comparável deste escopo. A evolução diária aparecerá após o próximo processamento.',
          total_atual: roundEvolucao(ipcpAtual.total || 0),
          total_anterior: null,
          variacao_total: null,
          blocos: [],
        }
      }
      var ipcpAnterior = anteriorPayload.ipcp || {}
      var totalAtual = roundEvolucao(ipcpAtual.total || 0)
      var totalAnterior = roundEvolucao(ipcpAnterior.total || 0)
      var deltaTotal = roundEvolucao(totalAtual - totalAnterior)
      var status = statusEvolucao(deltaTotal)
      var blocosAtual = ipcpAtual.blocos || {}
      var blocosAnterior = ipcpAnterior.blocos || {}
      var blocoIds = [
        'resultado_comercial',
        'valor_estrategico',
        'disciplina_carteira',
        'qualidade_followup',
        'registros_aprendizado',
      ]
      var blocos = []
      var melhorBloco = null
      var piorBloco = null
      for (var bi = 0; bi < blocoIds.length; bi++) {
        var id = blocoIds[bi]
        var atual = roundEvolucao(blocosAtual[id] || 0)
        var anterior = roundEvolucao(blocosAnterior[id] || 0)
        var variacao = roundEvolucao(atual - anterior)
        var row = {
          id: id,
          label: blocoLabel(id),
          atual: atual,
          anterior: anterior,
          variacao: variacao,
          status: statusEvolucao(variacao),
        }
        blocos.push(row)
        if (!melhorBloco || variacao > melhorBloco.variacao) melhorBloco = row
        if (!piorBloco || variacao < piorBloco.variacao) piorBloco = row
      }
      var verbo =
        status === 'melhorou' ? 'melhorou' : status === 'piorou' ? 'recuou' : 'se manteve estável'
      var comentario =
        'IPCP ' +
        verbo +
        ' em relação à leitura anterior (' +
        (deltaTotal > 0 ? '+' : '') +
        String(deltaTotal).replace('.', ',') +
        ' ponto(s)).'
      if (melhorBloco && melhorBloco.variacao > 0) {
        comentario +=
          ' Principal avanço: ' +
          melhorBloco.label +
          ' (' +
          (melhorBloco.variacao > 0 ? '+' : '') +
          String(melhorBloco.variacao).replace('.', ',') +
          ').'
      }
      if (piorBloco && piorBloco.variacao < 0) {
        comentario +=
          ' Ponto de atenção: ' +
          piorBloco.label +
          ' (' +
          String(piorBloco.variacao).replace('.', ',') +
          ').'
      }
      return {
        status: status,
        comentario: comentario,
        total_atual: totalAtual,
        total_anterior: totalAnterior,
        variacao_total: deltaTotal,
        data_anterior: anteriorPayload.data_referencia || null,
        blocos: blocos,
      }
    }

    var resumoTexto = textoCurto(resumoPayload.texto, 700)

    var prioridades = resumoPayload.prioridades || []
    var calculadoEm = snapshot
      ? snapshot.getString('updated') || snapshot.getString('created') || null
      : new Date().toISOString()
    pacoteVivo.evolucao = montarEvolucaoIpcp(
      ipcpPayload,
      payloadSnapshotAnterior(snapshot, snapshots),
    )

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
        pacote_completo: true,
        calculado_ao_vivo: true,
        calculado_em: calculadoEm,
      },
      data_referencia: dataReferencia,
      escopo_efetivo: {
        tipo: effectiveScope,
        responsavel_id: responsavelId === '__todos__' ? null : responsavelId || null,
        responsavel_nome:
          responsavelId === '__todos__'
            ? 'Todos'
            : ator.getString('name') || ator.getString('email') || ator.id,
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
      negocios_atencao: pacoteVivo.negocios_atencao || [],
      evolucao: pacoteVivo.evolucao,
      evidencias: {
        criterio: pacoteVivo.evidencias
          ? pacoteVivo.evidencias.criterio
          : 'leitura_viva_ipcp_dados_reais',
        fonte: pacoteVivo.evidencias
          ? pacoteVivo.evidencias.fonte
          : 'leitura_viva_ipcp_dados_reais',
        exemplos: pacoteVivo.evidencias ? pacoteVivo.evidencias.exemplos || [] : [],
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
