routerAdd(
  'GET',
  '/backend/v1/integracao/provelo/configuracao',
  function (e) {
    var profile = ''
    try {
      profile = $app.findRecordById('com_perfis', e.auth.getString('perfil_id')).getString('slug')
    } catch (_) {}
    if (!e.auth.getBool('ativo_comercial') || profile !== 'superadministrador')
      return e.forbiddenError('SuperAdmin necessario')
    var record = $app.findFirstRecordByData('com_integracao_provelo', 'provedor', 'make-provelo')
    return e.json(200, {
      provider: 'Make/Provelo',
      enabled: record.getBool('habilitada'),
      configured: !!record.getString('endpoint'),
      fingerprint: record.getString('endpoint_hash').slice(0, 12),
      updated_at: record.getString('ultima_alteracao_em') || null,
      last_success_at: record.getString('ultimo_sucesso_em') || null,
      last_failure_at: record.getString('ultima_falha_em') || null,
      last_uncertain_at: record.getString('ultimo_incerto_em') || null,
    })
  },
  $apis.requireAuth('users'),
)

routerAdd(
  'POST',
  '/backend/v1/integracao/provelo/configuracao',
  function (e) {
    var profile = ''
    try {
      profile = $app.findRecordById('com_perfis', e.auth.getString('perfil_id')).getString('slug')
    } catch (_) {}
    if (!e.auth.getBool('ativo_comercial') || profile !== 'superadministrador')
      return e.forbiddenError('SuperAdmin necessario')
    var body
    try {
      body = JSON.parse(toString(e.request.body))
    } catch (_) {
      return e.json(400, { error: 'JSON_INVALIDO' })
    }
    var action = String(body.action || ''),
      confirmation = String(body.confirmation || '')
    var endpoint = String(body.url || '').trim()
    if (action === 'replace_url') {
      if (confirmation !== 'SUBSTITUIR URL PROVELO')
        return e.json(400, { error: 'CONFIRMACAO_INVALIDA' })
      if (!/^https:\/\/hook\.us1\.make\.com\/[A-Za-z0-9_-]+$/.test(endpoint))
        return e.json(400, { error: 'URL_INVALIDA' })
    } else if (action === 'enable') {
      if (confirmation !== 'ATIVAR INTEGRACAO PROVELO')
        return e.json(400, { error: 'CONFIRMACAO_INVALIDA' })
    } else if (action === 'disable') {
      if (confirmation !== 'DESATIVAR INTEGRACAO PROVELO')
        return e.json(400, { error: 'CONFIRMACAO_INVALIDA' })
    } else return e.json(400, { error: 'ACAO_INVALIDA' })

    var responseStatus = null
    $app.runInTransaction(function (tx) {
      var record = tx.findFirstRecordByData('com_integracao_provelo', 'provedor', 'make-provelo')
      if (action === 'replace_url') {
        record.set('endpoint', endpoint)
        record.set('endpoint_hash', $security.sha256(endpoint))
      } else if (action === 'enable') {
        if (!record.getString('endpoint')) throw new Error('URL_NAO_CONFIGURADA')
        record.set('habilitada', true)
      } else record.set('habilitada', false)
      record.set('ultima_alteracao_em', new Date().toISOString())
      record.set('ultima_alteracao_por', e.auth.id)
      tx.save(record)

      var audit = new Record(tx.findCollectionByNameOrId('com_auditoria'))
      audit.set('collection_name', 'com_integracao_provelo')
      audit.set('record_id', record.id)
      audit.set('acao', 'update')
      audit.set('usuario_id', e.auth.id)
      audit.set('comando', 'provelo_' + action)
      audit.set('escopo', 'integracao')
      audit.set('origem', 'server-side')
      audit.set('evento_em', new Date())
      audit.set('snapshot_hash', $security.sha256(action + '|' + record.getString('endpoint_hash')))
      audit.set('snapshot_hash_versao', '1')
      tx.save(audit)

      responseStatus = {
        provider: 'Make/Provelo',
        enabled: record.getBool('habilitada'),
        configured: !!record.getString('endpoint'),
        fingerprint: record.getString('endpoint_hash').slice(0, 12),
        updated_at: record.getString('ultima_alteracao_em') || null,
        last_success_at: record.getString('ultimo_sucesso_em') || null,
        last_failure_at: record.getString('ultima_falha_em') || null,
        last_uncertain_at: record.getString('ultimo_incerto_em') || null,
      }
    })
    return e.json(200, responseStatus)
  },
  $apis.requireAuth('users'),
)
