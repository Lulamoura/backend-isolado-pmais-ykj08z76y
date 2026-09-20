migrate(
  (app) => {
    const chave = 'activecampaign.deal_base_url'
    const valor = 'https://pmaisservicos89463.activehosted.com/app/deals/'
    const collection = app.findCollectionByNameOrId('com_parametros')
    let record
    try {
      record = app.findFirstRecordByData('com_parametros', 'chave', chave)
    } catch (_) {
      record = new Record(collection)
      record.set('chave', chave)
    }
    record.set('valor', valor)
    record.set(
      'descricao',
      'URL base para abrir negócios diretamente no ActiveCampaign a partir do App Comercial PMais.',
    )
    record.set('tipo', 'url')
    record.set('unidade', 'url')
    record.set('regra_validacao', 'url_absoluta_https')
    record.set('ativo', true)
    record.set('versao', 1)
    record.set('data_hora', new Date())
    record.set(
      'justificativa',
      'Parâmetro criado para botões Abrir no ActiveCampaign nos cards de negócio.',
    )
    app.save(record)
  },
  (app) => {
    try {
      const record = app.findFirstRecordByData(
        'com_parametros',
        'chave',
        'activecampaign.deal_base_url',
      )
      app.delete(record)
    } catch (_) {}
  },
)
