migrate(
  function (app) {
    var eventos = app.findCollectionByNameOrId('com_proposta_eventos_publicos')
    var changed = false
    if (!eventos.fields.getByName('visitante_nome')) {
      eventos.fields.add(new TextField({ name: 'visitante_nome', max: 120, required: false }))
      changed = true
    }
    var tipo = eventos.fields.getByName('tipo')
    if (tipo.values.indexOf('pdf_visualizado') < 0) {
      tipo.values = tipo.values.concat(['pdf_visualizado'])
      changed = true
    }
    if (changed) app.save(eventos)

    var parametros = app.findCollectionByNameOrId('com_parametros')
    try {
      app.findFirstRecordByData(
        'com_parametros',
        'chave',
        'proposta.identificacao_visitante_obrigatoria',
      )
    } catch (_) {
      var parametro = new Record(parametros)
      parametro.set('chave', 'proposta.identificacao_visitante_obrigatoria')
      parametro.set('valor', 'true')
      parametro.set('descricao', 'Exigir nome informado antes de visualizar a proposta pública')
      parametro.set('tipo', 'booleano')
      parametro.set('versao', 1)
      parametro.set('ativo', true)
      parametro.set('justificativa', 'Melhoria aprovada após o piloto 4821')
      app.save(parametro)
    }
  },
  function (app) {
    try {
      app.delete(
        app.findFirstRecordByData(
          'com_parametros',
          'chave',
          'proposta.identificacao_visitante_obrigatoria',
        ),
      )
    } catch (_) {}
    var eventos = app.findCollectionByNameOrId('com_proposta_eventos_publicos')
    var tipo = eventos.fields.getByName('tipo')
    tipo.values = tipo.values.filter(function (value) {
      return value !== 'pdf_visualizado'
    })
    if (eventos.fields.getByName('visitante_nome')) eventos.fields.removeByName('visitante_nome')
    app.save(eventos)
  },
)
