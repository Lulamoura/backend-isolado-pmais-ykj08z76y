migrate(
  function (app) {
    var collection = app.findCollectionByNameOrId('com_nexo_aprendizado_eventos')
    var changed = false

    function sameFieldValue(left, right) {
      if (left === right) return true
      return (
        left !== null &&
        right !== null &&
        typeof left === 'object' &&
        typeof right === 'object' &&
        String(left) === String(right)
      )
    }

    function addOrValidate(name, field) {
      var existing = collection.fields.getByName(name)
      if (!existing) {
        collection.fields.add(field)
        changed = true
        return
      }

      if (existing.type() !== field.type()) {
        throw new Error('incompatible field ' + collection.name + '.' + name + ': type')
      }

      var keys = ['required', 'max', 'min', 'maxSize', 'onlyInt']
      for (var i = 0; i < keys.length; i++) {
        var key = keys[i]
        if (field[key] !== undefined && !sameFieldValue(existing[key], field[key])) {
          throw new Error('incompatible field ' + collection.name + '.' + name + ': ' + key)
        }
      }
    }

    addOrValidate(
      'fonte_origem',
      new TextField({ name: 'fonte_origem', required: false, max: 160 }),
    )
    addOrValidate(
      'evidencia_status',
      new TextField({ name: 'evidencia_status', required: false, max: 80 }),
    )
    addOrValidate(
      'whatsapp_evidencia',
      new BoolField({ name: 'whatsapp_evidencia', required: false }),
    )
    addOrValidate(
      'whatsapp_evidencia_hash',
      new TextField({ name: 'whatsapp_evidencia_hash', required: false, max: 160 }),
    )
    addOrValidate(
      'whatsapp_janela_inicio',
      new DateField({ name: 'whatsapp_janela_inicio', required: false }),
    )
    addOrValidate(
      'whatsapp_janela_fim',
      new DateField({ name: 'whatsapp_janela_fim', required: false }),
    )
    addOrValidate(
      'whatsapp_conversas',
      new NumberField({ name: 'whatsapp_conversas', min: 0, onlyInt: true, required: false }),
    )
    addOrValidate(
      'whatsapp_mensagens',
      new NumberField({ name: 'whatsapp_mensagens', min: 0, onlyInt: true, required: false }),
    )
    addOrValidate(
      'whatsapp_resumo_factual',
      new TextField({ name: 'whatsapp_resumo_factual', required: false, max: 4000 }),
    )
    addOrValidate(
      'conhecimento_oficial',
      new BoolField({ name: 'conhecimento_oficial', required: false }),
    )

    if (changed) app.save(collection)
  },
  function (_) {
    // Intentionally non-destructive: this migration augments a pre-existing collection.
  },
)
