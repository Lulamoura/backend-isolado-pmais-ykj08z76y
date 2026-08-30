migrate(
  function (app) {
    var collection
    try {
      collection = app.findCollectionByNameOrId('com_integracao_provelo')
    } catch (_) {
      collection = new Collection({
        type: 'base',
        name: 'com_integracao_provelo',
        createRule: null,
        updateRule: null,
        deleteRule: null,
        listRule: null,
        viewRule: null,
      })
      collection.fields.add(new TextField({ name: 'provedor', required: true, max: 80 }))
      collection.fields.add(new TextField({ name: 'endpoint', required: false, max: 1000 }))
      collection.fields.add(new TextField({ name: 'endpoint_hash', required: false, max: 64 }))
      collection.fields.add(new BoolField({ name: 'habilitada' }))
      collection.fields.add(new DateField({ name: 'ultima_alteracao_em', required: false }))
      collection.fields.add(
        new TextField({ name: 'ultima_alteracao_por', required: false, max: 15 }),
      )
      collection.fields.add(new DateField({ name: 'ultimo_sucesso_em', required: false }))
      collection.fields.add(new DateField({ name: 'ultima_falha_em', required: false }))
      collection.fields.add(new DateField({ name: 'ultimo_incerto_em', required: false }))
      app.save(collection)
    }
    try {
      app.findFirstRecordByData('com_integracao_provelo', 'provedor', 'make-provelo')
    } catch (_) {
      var record = new Record(collection)
      record.set('provedor', 'make-provelo')
      record.set('habilitada', false)
      app.save(record)
    }
  },
  function (app) {
    try {
      app.delete(app.findCollectionByNameOrId('com_integracao_provelo'))
    } catch (_) {}
  },
)
