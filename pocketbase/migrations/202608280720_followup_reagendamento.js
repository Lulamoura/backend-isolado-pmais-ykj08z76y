migrate(
  function (app) {
    var collection = app.findCollectionByNameOrId('com_negocio_historico')
    collection.fields.add(
      new TextField({ name: 'reagendamento_external_id', required: false, max: 220 }),
    )
    collection.fields.add(new DateField({ name: 'data_acao_anterior', required: false }))
    collection.fields.add(new DateField({ name: 'data_acao_nova', required: false }))
    collection.fields.add(new DateField({ name: 'reagendada_em', required: false }))
    collection.indexes = (collection.indexes || []).concat([
      'CREATE UNIQUE INDEX idx_com_negocio_historico_reagendamento_external ON com_negocio_historico (reagendamento_external_id)',
      'CREATE INDEX idx_com_negocio_historico_reagendamento_data ON com_negocio_historico (negocio_id, reagendada_em)',
    ])
    app.save(collection)
  },
  function (app) {
    var collection = app.findCollectionByNameOrId('com_negocio_historico')
    collection.indexes = (collection.indexes || []).filter(function (index) {
      return (
        index.indexOf('idx_com_negocio_historico_reagendamento_external') === -1 &&
        index.indexOf('idx_com_negocio_historico_reagendamento_data') === -1
      )
    })
    ;['reagendamento_external_id', 'data_acao_anterior', 'data_acao_nova', 'reagendada_em'].forEach(
      function (name) {
        var field = collection.fields.getByName(name)
        if (field) collection.fields.removeById(field.id)
      },
    )
    app.save(collection)
  },
)
