routerAdd('GET', '/backend/v1/integracao/ac/webhook', (e) => {
  var webhookEnabled = false
  try {
    var flagParam = $app.findFirstRecordByData('com_parametros', 'chave', 'ac_webhook_enabled')
    if (flagParam && flagParam.getString('valor') === 'true' && flagParam.getBool('ativo'))
      webhookEnabled = true
  } catch (_) {}
  if (!webhookEnabled) {
    return e.json(503, { ac_webhook_enabled: false })
  }
  return e.json(405, { error: 'Method not allowed' })
})
