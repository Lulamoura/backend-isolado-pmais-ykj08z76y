// T6.AC.8-R — relay sintético autenticado. Só existe para homologação do
// candidato e sempre atravessa o webhook V1 assinado publicado.
routerAdd(
  'POST',
  '/backend/v1/integracao/ac/sintetico-v1',
  function (e) {
    var actor = e.auth
    if (!actor || !actor.getBool('ativo_comercial')) return e.unauthorizedError('Autenticacao')
    var slug = ''
    try {
      slug = $app.findRecordById('com_perfis', actor.getString('perfil_id')).getString('slug')
    } catch (_) {}
    if (slug !== 'superadministrador') return e.forbiddenError('SuperAdmin necessario')
    var enabled = false
    try {
      var flag = $app.findFirstRecordByData(
        'com_parametros',
        'chave',
        'ac_synthetic_preview_enabled',
      )
      enabled = flag.getBool('ativo') && flag.getString('valor') === 'true'
    } catch (_) {}
    if (!enabled) return e.json(503, { error: 'CANAL_SINTETICO_DESABILITADO' })
    var event = {}
    try {
      event = e.requestInfo().body || {}
    } catch (_) {}
    if (
      event.schema_version !== '1' ||
      event.source !== 'activecampaign' ||
      String(event.correlation_id || '').indexOf('t6-ac8-') !== 0 ||
      String(event.event_id || '').indexOf('test:') !== 0
    )
      return e.json(400, { error: 'EVENTO_SINTETICO_FORA_DO_ESCOPO' })
    var serialized = JSON.stringify(event)
    if (serialized.indexOf('[TESTE]') === -1)
      return e.json(400, { error: 'MARCADOR_TESTE_OBRIGATORIO' })
    var secret = $secrets.get('AC_WEBHOOK_SECRET') || ''
    var pbUrl = String($secrets.get('PB_INSTANCE_URL') || '').replace(/\/$/, '')
    if (!secret || !pbUrl) return e.json(500, { error: 'CONFIGURACAO_SERVIDOR_AUSENTE' })
    var response = $http.send({
      url: pbUrl + '/backend/v1/integracao/ac/webhook',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-AC-Signature': $security.hs256(serialized, secret),
        'X-Correlation-Id': event.correlation_id,
      },
      body: serialized,
      timeout: 30,
    })
    return e.json(response.statusCode, response.json || { error: 'RESPOSTA_WEBHOOK_INVALIDA' })
  },
  $apis.requireAuth(),
  $apis.bodyLimit(262144),
)
