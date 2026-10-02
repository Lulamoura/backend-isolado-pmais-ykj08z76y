migrate(
  function (app) {
    function addIfMissing(collection, name, field) {
      try {
        if (!collection.fields.getByName(name)) collection.fields.add(field)
      } catch (_) {
        collection.fields.add(field)
      }
    }

    function withoutIndex(indexes, name) {
      var out = []
      for (var i = 0; i < (indexes || []).length; i++) {
        if (String(indexes[i]).indexOf(name) === -1) out.push(indexes[i])
      }
      return out
    }

    var transicoes = app.findCollectionByNameOrId('com_nexo_curadoria_transicoes')
    addIfMissing(
      transicoes,
      'command_hash',
      new TextField({ name: 'command_hash', required: false, max: 160 }),
    )
    app.save(transicoes)

    var outbox = app.findCollectionByNameOrId('com_nexo_curadoria_outbox')
    addIfMissing(
      outbox,
      'claim_token',
      new TextField({ name: 'claim_token', required: false, max: 160 }),
    )
    addIfMissing(outbox, 'claimed_at', new DateField({ name: 'claimed_at', required: false }))
    addIfMissing(
      outbox,
      'claim_expires_at',
      new DateField({ name: 'claim_expires_at', required: false }),
    )
    outbox.indexes = withoutIndex(outbox.indexes, 'idx_com_nexo_curadoria_outbox_claim')
    outbox.indexes.push(
      'CREATE INDEX idx_com_nexo_curadoria_outbox_claim ON com_nexo_curadoria_outbox (status, claim_expires_at, requested_at)',
    )
    app.save(outbox)

    var decisoes = app.findCollectionByNameOrId('com_nexo_curadoria_decisoes')
    decisoes.createRule = null
    decisoes.updateRule = null
    decisoes.deleteRule = null
    app.save(decisoes)
  },
  function (app) {
    function removeIfPresent(collection, name) {
      try {
        collection.fields.removeByName(name)
      } catch (_) {}
    }

    function withoutIndex(indexes, name) {
      var out = []
      for (var i = 0; i < (indexes || []).length; i++) {
        if (String(indexes[i]).indexOf(name) === -1) out.push(indexes[i])
      }
      return out
    }

    var decisoes = app.findCollectionByNameOrId('com_nexo_curadoria_decisoes')
    decisoes.createRule =
      "@request.auth.id != '' && (@request.auth.perfil_id.slug = 'superadministrador' || @request.auth.perfil_id.slug = 'gestor-comercial' || @request.auth.perfil_id.slug = 'leitura-executiva')"
    decisoes.updateRule =
      "@request.auth.id != '' && (@request.auth.perfil_id.slug = 'superadministrador' || @request.auth.perfil_id.slug = 'leitura-executiva')"
    decisoes.deleteRule = null
    app.save(decisoes)

    var outbox = app.findCollectionByNameOrId('com_nexo_curadoria_outbox')
    removeIfPresent(outbox, 'claim_token')
    removeIfPresent(outbox, 'claimed_at')
    removeIfPresent(outbox, 'claim_expires_at')
    outbox.indexes = withoutIndex(outbox.indexes, 'idx_com_nexo_curadoria_outbox_claim')
    app.save(outbox)

    var transicoes = app.findCollectionByNameOrId('com_nexo_curadoria_transicoes')
    removeIfPresent(transicoes, 'command_hash')
    app.save(transicoes)
  },
)
