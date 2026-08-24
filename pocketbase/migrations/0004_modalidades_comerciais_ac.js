migrate(
  (app) => {
    for (const collectionName of ['com_negocios', 'com_proposta_versoes']) {
      const collection = app.findCollectionByNameOrId(collectionName)
      collection.fields.getByName('modalidade').values = ['recorrente', 'evento', 'serv_eventual']
      app.save(collection)
    }
  },
  (app) => {
    for (const collectionName of ['com_negocios', 'com_proposta_versoes']) {
      const collection = app.findCollectionByNameOrId(collectionName)
      collection.fields.getByName('modalidade').values = ['pontual', 'recorrente']
      app.save(collection)
    }
  },
)
