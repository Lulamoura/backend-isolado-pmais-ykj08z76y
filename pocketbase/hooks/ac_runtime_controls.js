// T6.AC.8 — materializacao idempotente dos controles da integracao em
// candidatos existentes. O SKIP sincroniza o codigo, mas nao reaplica
// migrations antigas sobre bancos ja provisionados.
routerAdd(
  'POST',
  '/backend/v1/integracao/ac/configuracao/materializar',
  function (e) {
    var actor = e.auth
    if (!actor || !actor.getBool('ativo_comercial'))
      return e.unauthorizedError('Autenticacao necessaria')
    var slug = ''
    try {
      slug = $app.findRecordById('com_perfis', actor.getString('perfil_id')).getString('slug')
    } catch (_) {}
    if (slug !== 'superadministrador') return e.forbiddenError('SuperAdmin necessario')

    var body = {}
    try {
      body = e.requestInfo().body || {}
    } catch (_) {}
    if (body.confirmation !== 'MATERIALIZAR CONTROLES AC')
      return e.json(400, { error: 'CONFIRMACAO_INVALIDA' })

    var controls = [
      ['ac_webhook_enabled', 'false', 'Webhook ActiveCampaign V1 (desligado por padrao)'],
      ['ac_reconciliation_enabled', 'false', 'Reconciliacao ActiveCampaign (desligada por padrao)'],
      ['ac_reconciliation_cursor', '', 'Cursor confirmado da reconciliacao ActiveCampaign'],
      ['ac_synthetic_preview_enabled', 'false', 'Canal sintetico T6.AC.8 (desligado por padrao)'],
      [
        'ac_preoperation_read_only',
        'true',
        'Negocios reais importados ficam somente leitura antes do go-live',
      ],
      ['ac_initial_load_scope', 'open_negotiation', 'Pre-carga restrita a aberto + Negociacao'],
    ]
    var created = [],
      preserved = []
    try {
      $app.runInTransaction(function (tx) {
        var collection = tx.findCollectionByNameOrId('com_parametros')
        for (var i = 0; i < controls.length; i++) {
          var current = null
          try {
            current = tx.findFirstRecordByData('com_parametros', 'chave', controls[i][0])
          } catch (_) {}
          if (current) {
            preserved.push(controls[i][0])
            continue
          }
          var record = new Record(collection)
          record.set('chave', controls[i][0])
          record.set('valor', controls[i][1])
          record.set('descricao', controls[i][2])
          record.set('ativo', true)
          record.set('versao', 1)
          tx.save(record)
          created.push(controls[i][0])
        }
      })
    } catch (error) {
      return e.json(409, { error: 'MATERIALIZACAO_REVERTIDA', detail: String(error).slice(0, 160) })
    }
    return e.json(200, {
      status: 'completed',
      created: created,
      preserved: preserved,
      enabled: false,
    })
  },
  $apis.requireAuth('users'),
  $apis.bodyLimit(1024),
)
