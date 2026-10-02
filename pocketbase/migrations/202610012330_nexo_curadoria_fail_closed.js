migrate(
  function (app) {
    var decisoes = app.findCollectionByNameOrId('com_nexo_curadoria_decisoes')
    decisoes.createRule = null
    decisoes.updateRule = null
    decisoes.deleteRule = null
    app.save(decisoes)

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

    function addOrValidate(collection, name, field) {
      var existing = collection.fields.getByName(name)
      if (!existing) {
        collection.fields.add(field)
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

    function indexName(definition) {
      var match = String(definition).match(
        /^\s*CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:"([^"]+)"|\[([^\]]+)\]|([^\s]+))/i,
      )
      return match ? match[1] || match[2] || match[3] : null
    }

    function withoutIndex(indexes, name) {
      var out = []
      for (var i = 0; i < (indexes || []).length; i++) {
        if (indexName(indexes[i]) !== name) out.push(indexes[i])
      }
      return out
    }

    var transicoes = app.findCollectionByNameOrId('com_nexo_curadoria_transicoes')
    addOrValidate(
      transicoes,
      'command_hash',
      new TextField({ name: 'command_hash', required: false, max: 160 }),
    )
    app.save(transicoes)

    var outbox = app.findCollectionByNameOrId('com_nexo_curadoria_outbox')
    addOrValidate(
      outbox,
      'claim_token',
      new TextField({ name: 'claim_token', required: false, max: 160 }),
    )
    addOrValidate(outbox, 'claimed_at', new DateField({ name: 'claimed_at', required: false }))
    addOrValidate(
      outbox,
      'claim_expires_at',
      new DateField({ name: 'claim_expires_at', required: false }),
    )
    outbox.indexes = withoutIndex(outbox.indexes, 'idx_com_nexo_curadoria_outbox_claim')
    outbox.indexes.push(
      'CREATE INDEX idx_com_nexo_curadoria_outbox_claim ON com_nexo_curadoria_outbox (status, claim_expires_at, requested_at)',
    )
    app.save(outbox)
  },
  function (_) {
    // Intentionally non-destructive: fields, indexes, ACLs, and records are retained on rollback.
  },
)
