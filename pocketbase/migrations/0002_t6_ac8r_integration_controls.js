migrate(
  (app) => {
    const negocios = app.findCollectionByNameOrId('com_negocios')
    negocios.updateRule = null
    app.save(negocios)
    const collection = app.findCollectionByNameOrId('com_parametros')
    const controls = [
      ['ac_webhook_enabled', 'false', 'Webhook ActiveCampaign V1 (desligado por padrão)'],
      ['ac_reconciliation_enabled', 'false', 'Reconciliação ActiveCampaign (desligada por padrão)'],
      [
        'ac_reconciliation_cursor',
        'UNINITIALIZED',
        'Cursor confirmado da reconciliação ActiveCampaign',
      ],
      ['ac_synthetic_preview_enabled', 'false', 'Canal sintético T6.AC.8 (desligado por padrão)'],
      [
        'ac_preoperation_read_only',
        'true',
        'Negócios reais importados ficam somente leitura antes do go-live',
      ],
      ['ac_initial_load_scope', 'open_negotiation', 'Pré-carga restrita a aberto + Negociação'],
    ]
    for (const [key, value, description] of controls) {
      try {
        app.findFirstRecordByData('com_parametros', 'chave', key)
      } catch (_) {
        const record = new Record(collection)
        record.set('chave', key)
        record.set('valor', value)
        record.set('descricao', description)
        record.set('ativo', true)
        record.set('versao', 1)
        app.save(record)
      }
    }
  },
  (app) => {
    const negocios = app.findCollectionByNameOrId('com_negocios')
    negocios.updateRule =
      "@request.auth.id != '' && (responsavel_id = @request.auth.id || (@request.auth.equipe_id != '' && equipe_id = @request.auth.equipe_id))"
    app.save(negocios)
    const keys = [
      'ac_reconciliation_enabled',
      'ac_reconciliation_cursor',
      'ac_synthetic_preview_enabled',
      'ac_preoperation_read_only',
      'ac_initial_load_scope',
    ]
    for (const key of keys) {
      try {
        app.delete(app.findFirstRecordByData('com_parametros', 'chave', key))
      } catch (_) {}
    }
  },
)
