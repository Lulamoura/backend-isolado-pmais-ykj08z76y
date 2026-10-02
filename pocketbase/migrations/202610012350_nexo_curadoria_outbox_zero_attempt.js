migrate(
  function (app) {
    var collectionName = 'com_nexo_curadoria_outbox'
    var collection
    try {
      collection = app.findCollectionByNameOrId(collectionName)
    } catch (_) {
      throw new Error('incompatible collection ' + collectionName + ': missing')
    }

    if (collection.name !== collectionName)
      throw new Error('incompatible collection ' + collectionName + ': name')
    if (collection.type !== 'base')
      throw new Error('incompatible collection ' + collectionName + ': type')

    var field = collection.fields.getByName('tentativas')
    if (!field) throw new Error('incompatible field ' + collectionName + '.tentativas: missing')
    if (field.type() !== 'number')
      throw new Error('incompatible field ' + collectionName + '.tentativas: type')
    var expected = new NumberField({ name: 'tentativas', required: true, min: 0 })
    if (String(field.min) !== String(expected.min))
      throw new Error('incompatible field ' + collectionName + '.tentativas: min')
    if (field.required !== true && field.required !== false)
      throw new Error('incompatible field ' + collectionName + '.tentativas: required')

    if (field.required === false) return
    field.required = false
    app.save(collection)
  },
  function (_) {
    // Intentionally non-destructive: required=false is needed to persist the valid zero-attempt state.
  },
)
