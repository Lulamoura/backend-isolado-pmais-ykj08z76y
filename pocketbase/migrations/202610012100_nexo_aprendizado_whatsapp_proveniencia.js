migrate(
  function (app) {
    var collection = app.findCollectionByNameOrId('com_nexo_aprendizado_eventos')
    var changed = false

    function addIfMissing(name, field) {
      try {
        collection.fields.getByName(name)
      } catch (_) {
        collection.fields.add(field)
        changed = true
      }
    }

    addIfMissing('fonte_origem', new TextField({ name: 'fonte_origem', required: false, max: 160 }))
    addIfMissing(
      'evidencia_status',
      new TextField({ name: 'evidencia_status', required: false, max: 80 }),
    )
    addIfMissing(
      'whatsapp_evidencia',
      new BoolField({ name: 'whatsapp_evidencia', required: false }),
    )
    addIfMissing(
      'whatsapp_evidencia_hash',
      new TextField({ name: 'whatsapp_evidencia_hash', required: false, max: 160 }),
    )
    addIfMissing(
      'whatsapp_janela_inicio',
      new DateField({ name: 'whatsapp_janela_inicio', required: false }),
    )
    addIfMissing(
      'whatsapp_janela_fim',
      new DateField({ name: 'whatsapp_janela_fim', required: false }),
    )
    addIfMissing(
      'whatsapp_conversas',
      new NumberField({ name: 'whatsapp_conversas', min: 0, onlyInt: true, required: false }),
    )
    addIfMissing(
      'whatsapp_mensagens',
      new NumberField({ name: 'whatsapp_mensagens', min: 0, onlyInt: true, required: false }),
    )
    addIfMissing(
      'whatsapp_resumo_factual',
      new TextField({ name: 'whatsapp_resumo_factual', required: false, max: 4000 }),
    )
    addIfMissing(
      'conhecimento_oficial',
      new BoolField({ name: 'conhecimento_oficial', required: false }),
    )

    if (changed) app.save(collection)
  },
  function (app) {
    var collection = app.findCollectionByNameOrId('com_nexo_aprendizado_eventos')
    var fields = [
      'fonte_origem',
      'evidencia_status',
      'whatsapp_evidencia',
      'whatsapp_evidencia_hash',
      'whatsapp_janela_inicio',
      'whatsapp_janela_fim',
      'whatsapp_conversas',
      'whatsapp_mensagens',
      'whatsapp_resumo_factual',
      'conhecimento_oficial',
    ]
    var changed = false
    for (var i = 0; i < fields.length; i++) {
      try {
        collection.fields.getByName(fields[i])
        collection.fields.removeByName(fields[i])
        changed = true
      } catch (_) {}
    }
    if (changed) app.save(collection)
  },
)
