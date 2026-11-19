migrate(
  function (app) {
    var cases = app.findCollectionByNameOrId('com_nexo_curadoria_casos')
    var originField = null
    try {
      originField = cases.fields.getByName('origin_worker_identity')
    } catch (_) {}
    if (originField) {
      if (originField.type() !== 'text' || originField.max !== 80)
        throw new Error('incompatible com_nexo_curadoria_casos.origin_worker_identity')
    } else {
      cases.fields.add(new TextField({ name: 'origin_worker_identity', required: false, max: 80 }))
      app.save(cases)
    }

    function ensureDisabledSwitch(key, description) {
      var rows = app.findRecordsByFilter('com_parametros', "chave = '" + key + "'", '', 2, 0)
      if (rows.length > 1) throw new Error('duplicate N7 runtime switch: ' + key)
      if (rows.length === 1) {
        var existing = rows[0]
        if (
          !existing.getBool('ativo') ||
          existing.getString('tipo') !== 'booleano' ||
          existing.getString('valor') !== 'false' ||
          Number(existing.getInt('versao') || 0) !== 1
        )
          throw new Error('incompatible N7 runtime switch: ' + key)
        return
      }
      var record = new Record(app.findCollectionByNameOrId('com_parametros'))
      record.set('chave', key)
      record.set('valor', 'false')
      record.set('descricao', description)
      record.set('tipo', 'booleano')
      record.set('ativo', true)
      record.set('versao', 1)
      app.save(record)
    }

    ensureDisabledSwitch(
      'nexo.curadoria.operacao_n7_switch_v1',
      'Kill switch do worker interno de consolidação contínua N7; inicia desligado.',
    )
    ensureDisabledSwitch(
      'nexo.curadoria.outbox_n7_switch_v1',
      'Kill switch do worker interno de publicação/readback N7; inicia desligado.',
    )
  },
  function (_) {
    // Intentionally non-destructive: switches remain fail-closed and case provenance is audit data.
  },
)
