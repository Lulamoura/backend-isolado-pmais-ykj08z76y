function proveloProfile(app, user) {
  try {
    return app.findRecordById('com_perfis', user.getString('perfil_id')).getString('slug')
  } catch (_) {
    return ''
  }
}
function proveloConfig(app) {
  return app.findFirstRecordByData('com_integracao_provelo', 'provedor', 'make-provelo')
}
function proveloStatus(record) {
  return {
    provider: 'Make/Provelo',
    enabled: record.getBool('habilitada'),
    configured: !!record.getString('endpoint'),
    fingerprint: record.getString('endpoint_hash').slice(0, 12),
    updated_at: record.getString('ultima_alteracao_em') || null,
    last_success_at: record.getString('ultimo_sucesso_em') || null,
    last_failure_at: record.getString('ultima_falha_em') || null,
    last_uncertain_at: record.getString('ultimo_incerto_em') || null,
  }
}
function requireProveloAdmin(e) {
  return (
    e.auth &&
    e.auth.getBool('ativo_comercial') &&
    proveloProfile($app, e.auth) === 'superadministrador'
  )
}
routerAdd(
  'GET',
  '/backend/v1/integracao/provelo/configuracao',
  function (e) {
    if (!requireProveloAdmin(e)) return e.forbiddenError('SuperAdmin necessario')
    return e.json(200, proveloStatus(proveloConfig($app)))
  },
  $apis.requireAuth('users'),
)

routerAdd(
  'POST',
  '/backend/v1/integracao/provelo/configuracao',
  function (e) {
    if (!requireProveloAdmin(e)) return e.forbiddenError('SuperAdmin necessario')
    var body
    try {
      body = JSON.parse(toString(e.request.body))
    } catch (_) {
      return e.json(400, { error: 'JSON_INVALIDO' })
    }
    var action = String(body.action || ''),
      confirmation = String(body.confirmation || '')
    var record = proveloConfig($app)
    if (action === 'replace_url') {
      var endpoint = String(body.url || '').trim()
      if (confirmation !== 'SUBSTITUIR URL PROVELO')
        return e.json(400, { error: 'CONFIRMACAO_INVALIDA' })
      if (!/^https:\/\/hook\.us1\.make\.com\/[A-Za-z0-9_-]+$/.test(endpoint))
        return e.json(400, { error: 'URL_INVALIDA' })
      record.set('endpoint', endpoint)
      record.set('endpoint_hash', $security.sha256(endpoint))
    } else if (action === 'enable') {
      if (confirmation !== 'ATIVAR INTEGRACAO PROVELO')
        return e.json(400, { error: 'CONFIRMACAO_INVALIDA' })
      if (!record.getString('endpoint')) return e.json(409, { error: 'URL_NAO_CONFIGURADA' })
      record.set('habilitada', true)
    } else if (action === 'disable') {
      if (confirmation !== 'DESATIVAR INTEGRACAO PROVELO')
        return e.json(400, { error: 'CONFIRMACAO_INVALIDA' })
      record.set('habilitada', false)
    } else return e.json(400, { error: 'ACAO_INVALIDA' })
    record.set('ultima_alteracao_em', new Date().toISOString())
    record.set('ultima_alteracao_por', e.auth.id)
    $app.save(record)
    var audit = new Record($app.findCollectionByNameOrId('com_auditoria'))
    audit.set('collection_name', 'com_integracao_provelo')
    audit.set('record_id', record.id)
    audit.set('comando', 'provelo_' + action)
    audit.set('ator_id', e.auth.id)
    audit.set('escopo', 'integracao')
    audit.set('snapshot_hash', $security.sha256(action + '|' + record.getString('endpoint_hash')))
    $app.save(audit)
    return e.json(200, proveloStatus(record))
  },
  $apis.requireAuth('users'),
)
