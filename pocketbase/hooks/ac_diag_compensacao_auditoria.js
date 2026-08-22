routerAdd(
  'GET',
  '/backend/v1/integracao/ac/diag-compensacao-auditoria',
  (e) => {
    var ROUTE_VERSION = 'R13-DIAG-COMPENSACAO-AUDITORIA-20260812-v3'
    var ROUTE_PATH = '/backend/v1/integracao/ac/diag-compensacao-auditoria'

    var FIXED_IDS = {
      com_vinculos_externos: 'phzmobi8mfb34ha',
      com_eventos_integracao: 'pq4npvruaak9gpb',
      com_execucoes_sincronizacao: '62otoics23ul0vy',
    }

    var EXPECTED_IDENTITY = {
      com_vinculos_externos: {
        id: 'phzmobi8mfb34ha',
        created: '2026-08-11T20:38:39.951Z',
        collection_name: 'com_contatos',
        external_id: 'DIAG-TRANSPORT-FN-C1',
        external_type: 'contact',
        record_id: 'hfjq2q1olefske7',
        sistema_origem: 'activecampaign',
      },
      com_eventos_integracao: {
        id: 'pq4npvruaak9gpb',
        created: '2026-08-11T20:38:39.950Z',
        evento_tipo: 'contact_create',
        external_id: 'DIAG-TRANSPORT-FN-C1',
        idempotency_key: 'e860fa5a9d8615c44a7db52b909b70b816f80b74123b96780e7bb309e53d34ec',
        sistema_origem: 'activecampaign',
        status: 'processed',
      },
      com_execucoes_sincronizacao: {
        id: '62otoics23ul0vy',
        created: '2026-08-11T20:38:39.948Z',
        inicio: '2026-08-11T20:38:39.948Z',
        fim: '2026-08-11T20:38:39.952Z',
        sistema_origem: 'activecampaign',
        status: 'completed',
      },
    }

    var V7_LOCK_KEY = 'ac_diag_compensacao_dependencias_lock'

    var INVOLVED_COLLECTIONS = [
      'com_vinculos_externos',
      'com_eventos_integracao',
      'com_execucoes_sincronizacao',
      'com_ocorrencias_qualidade',
    ]

    var authId = e.auth ? e.auth.id : ''
    if (!authId) return e.unauthorizedError('Autenticacao necessaria')

    var isSA = false
    try {
      var p = $app.findRecordById('com_perfis', e.auth.getString('perfil_id'))
      if (p && p.getString('slug') === 'superadministrador') isSA = true
    } catch (_) {}
    if (!isSA) {
      try {
        var sp = $app.findFirstRecordByData('com_perfis', 'slug', 'superadministrador')
        var b = $app.findRecordsByFilter(
          'com_usuarios_equipes',
          "usuario_id = '" + authId + "' && perfil_id = '" + sp.id + "' && ativo = true",
          '',
          1,
          0,
        )
        if (b && b.length > 0) isSA = true
      } catch (_) {}
    }
    if (!isSA) return e.forbiddenError('Apenas superadministrador')

    function verifyIdentity(record, expected, fields) {
      var verified = true
      var actual = {}
      for (var i = 0; i < fields.length; i++) {
        var f = fields[i]
        if (f === 'id') {
          actual[f] = record.id
        } else {
          actual[f] = record.getString(f)
        }
        if (actual[f] !== expected[f]) verified = false
      }
      return { verified: verified, actual: actual }
    }

    var vinculoFields = [
      'id',
      'created',
      'collection_name',
      'external_id',
      'external_type',
      'record_id',
      'sistema_origem',
    ]
    var eventoFields = [
      'id',
      'created',
      'evento_tipo',
      'external_id',
      'idempotency_key',
      'sistema_origem',
      'status',
    ]
    var execucaoFields = ['id', 'created', 'inicio', 'fim', 'sistema_origem', 'status']

    var queryError = null

    var vinculo = null
    var evento = null
    var execucao = null
    var ocorrencias = null
    var counts = null
    var lockRec = null
    var v7LockState = null

    try {
      vinculo = $app.findRecordById('com_vinculos_externos', FIXED_IDS.com_vinculos_externos)
      evento = $app.findRecordById('com_eventos_integracao', FIXED_IDS.com_eventos_integracao)
      execucao = $app.findRecordById(
        'com_execucoes_sincronizacao',
        FIXED_IDS.com_execucoes_sincronizacao,
      )
      ocorrencias = $app.findRecordsByFilter(
        'com_ocorrencias_qualidade',
        'execucao_id = "62otoics23ul0vy"',
        'created',
        100,
        0,
      )
      counts = {
        com_vinculos_externos: $app.countRecords('com_vinculos_externos'),
        com_eventos_integracao: $app.countRecords('com_eventos_integracao'),
        com_execucoes_sincronizacao: $app.countRecords('com_execucoes_sincronizacao'),
        com_ocorrencias_qualidade: $app.countRecords('com_ocorrencias_qualidade'),
      }
      lockRec = $app.findFirstRecordByData('com_parametros', 'chave', V7_LOCK_KEY)
      v7LockState = lockRec.getString('valor')
    } catch (err) {
      queryError = String(err).substring(0, 500)
    }

    if (queryError) {
      return e.json(500, {
        route_version: ROUTE_VERSION,
        route: ROUTE_PATH,
        method: 'GET',
        read_only: true,
        client_parameters_accepted: 0,
        query_succeeded: false,
        target_identity_verified: false,
        dependency_query_succeeded: false,
        dependency_count: null,
        counts: null,
        lock_state_read_succeeded: false,
        v7_lock: {
          key: V7_LOCK_KEY,
          state: null,
          modified: false,
        },
        error: queryError,
        records_created: 0,
        records_updated: 0,
        records_deleted: 0,
        locks_modified: 0,
        activecampaign_calls: 0,
        external_calls: 0,
        message:
          'Audit FAILED — a query, count, or lock read threw an error. No conclusion of zero dependencies or safety is emitted. No writes, deletions, or lock changes occurred.',
      })
    }

    var vinculoIdentity = verifyIdentity(
      vinculo,
      EXPECTED_IDENTITY.com_vinculos_externos,
      vinculoFields,
    )
    var eventoIdentity = verifyIdentity(
      evento,
      EXPECTED_IDENTITY.com_eventos_integracao,
      eventoFields,
    )
    var execucaoIdentity = verifyIdentity(
      execucao,
      EXPECTED_IDENTITY.com_execucoes_sincronizacao,
      execucaoFields,
    )

    var ocorrenciasInventory = []
    for (var k = 0; k < ocorrencias.length; k++) {
      var oc = ocorrencias[k]
      ocorrenciasInventory.push({
        id: oc.id,
        execucao_id: oc.getString('execucao_id'),
        tipo: oc.getString('tipo'),
        severidade: oc.getString('severidade'),
        descricao: oc.getString('descricao'),
        resolvida: oc.getBool('resolvida'),
        created: oc.getString('created'),
      })
    }

    return e.json(200, {
      route_version: ROUTE_VERSION,
      route: ROUTE_PATH,
      method: 'GET',
      read_only: true,
      client_parameters_accepted: 0,
      query_succeeded: true,
      target_identity_verified: {
        com_vinculos_externos: vinculoIdentity.verified,
        com_eventos_integracao: eventoIdentity.verified,
        com_execucoes_sincronizacao: execucaoIdentity.verified,
      },
      target_identity_details: {
        com_vinculos_externos: vinculoIdentity.actual,
        com_eventos_integracao: eventoIdentity.actual,
        com_execucoes_sincronizacao: execucaoIdentity.actual,
      },
      expected_identity: EXPECTED_IDENTITY,
      fixed_ids: FIXED_IDS,
      involved_collections: INVOLVED_COLLECTIONS,
      dependency_query_succeeded: true,
      dependency_filter: 'execucao_id = "62otoics23ul0vy"',
      dependency_limit: 100,
      dependency_count: ocorrencias.length,
      dependency_items: ocorrenciasInventory,
      counts: counts,
      lock_state_read_succeeded: true,
      v7_lock: {
        key: V7_LOCK_KEY,
        state: v7LockState,
        modified: false,
      },
      records_created: 0,
      records_updated: 0,
      records_deleted: 0,
      locks_modified: 0,
      activecampaign_calls: 0,
      external_calls: 0,
      message:
        'Read-only audit completed (v3). All queries succeeded. No records were created, updated, or deleted. No locks were modified or consumed. No external calls were made.',
    })
  },
  $apis.requireAuth(),
)
