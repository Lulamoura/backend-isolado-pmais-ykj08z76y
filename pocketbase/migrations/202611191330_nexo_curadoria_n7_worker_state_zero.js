migrate(
  function (app) {
    var collection = app.findCollectionByNameOrId('com_nexo_curadoria_worker_estado')
    var field = collection.fields.getByName('processed_records')
    if (!field || field.type() !== 'number')
      throw new Error('incompatible field com_nexo_curadoria_worker_estado.processed_records: type')
    if (Number(field.min) !== 0 || !field.onlyInt)
      throw new Error(
        'incompatible field com_nexo_curadoria_worker_estado.processed_records: bounds',
      )

    field.required = false
    app.save(collection)
  },
  function (_) {
    // Intentionally non-destructive: zero is the valid initial processed count.
  },
)
