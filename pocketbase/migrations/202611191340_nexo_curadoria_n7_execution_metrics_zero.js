migrate(
  function (app) {
    var collection = app.findCollectionByNameOrId('com_nexo_curadoria_execucoes')
    var counters = [
      'selected_ledger_records',
      'cases_created',
      'cases_updated',
      'evidence_created',
      'transitions_created',
      'outbox_created',
      'outbox_processed',
      'outbox_failed',
      'outbox_invalidated',
      'automatic_cases',
      'human_exceptions',
      'human_exceptions_new',
      'open_human_exceptions_before',
    ]

    for (var i = 0; i < counters.length; i++) {
      var field = collection.fields.getByName(counters[i])
      if (!field || field.type() !== 'number')
        throw new Error('incompatible field com_nexo_curadoria_execucoes.' + counters[i] + ': type')
      if (String(field.min) !== '0' || !field.onlyInt)
        throw new Error(
          'incompatible field com_nexo_curadoria_execucoes.' + counters[i] + ': bounds',
        )
      field.required = false
    }

    app.save(collection)
  },
  function (_) {
    // Intentionally non-destructive: zero is a valid value for every execution counter.
  },
)
