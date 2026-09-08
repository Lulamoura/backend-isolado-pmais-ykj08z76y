/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId('com_substituicoes')
    const field = collection.fields.getByName('motivo')

    if (field.values.indexOf('suporte_interno') === -1) {
      field.values.push('suporte_interno')
    }

    app.save(collection)
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('com_substituicoes')
    const field = collection.fields.getByName('motivo')
    field.values = field.values.filter((value) => value !== 'suporte_interno')
    app.save(collection)
  },
)
