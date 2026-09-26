migrate(
  function (app) {
    try {
      app.findCollectionByNameOrId('com_ledger_comercial')
      return
    } catch (_) {}

    var collection = new Collection({
      type: 'base',
      name: 'com_ledger_comercial',
      createRule: null,
      updateRule: null,
      deleteRule: null,
      listRule:
        "@request.auth.id != '' && (@request.auth.perfil_id.slug = 'superadministrador' || @request.auth.perfil_id.slug = 'gestor-comercial' || @request.auth.perfil_id.slug = 'leitura-executiva' || @request.auth.perfil_id.slug = 'integracao')",
      viewRule:
        "@request.auth.id != '' && (@request.auth.perfil_id.slug = 'superadministrador' || @request.auth.perfil_id.slug = 'gestor-comercial' || @request.auth.perfil_id.slug = 'leitura-executiva' || @request.auth.perfil_id.slug = 'integracao')",
    })

    collection.fields.add(new TextField({ name: 'fonte', required: true, max: 80 }))
    collection.fields.add(new TextField({ name: 'canal', required: true, max: 120 }))
    collection.fields.add(new TextField({ name: 'origem', required: false, max: 160 }))
    collection.fields.add(new TextField({ name: 'contato_nome', required: false, max: 240 }))
    collection.fields.add(new TextField({ name: 'empresa_nome', required: false, max: 240 }))
    collection.fields.add(new TextField({ name: 'negocio_ref', required: false, max: 240 }))
    collection.fields.add(new TextField({ name: 'responsavel', required: false, max: 160 }))
    collection.fields.add(new TextField({ name: 'tipo_evento', required: true, max: 80 }))
    collection.fields.add(new TextField({ name: 'fato', required: true, max: 2400 }))
    collection.fields.add(new TextField({ name: 'evidencia_ref', required: true, max: 500 }))
    collection.fields.add(new TextField({ name: 'destino_sugerido', required: true, max: 80 }))
    collection.fields.add(new TextField({ name: 'risco', required: true, max: 40 }))
    collection.fields.add(new TextField({ name: 'retencao', required: true, max: 80 }))
    collection.fields.add(new TextField({ name: 'status', required: true, max: 80 }))
    collection.fields.add(new TextField({ name: 'confianca', required: false, max: 40 }))
    collection.fields.add(new TextField({ name: 'promocao_modo', required: false, max: 80 }))
    collection.fields.add(new TextField({ name: 'revisao_status', required: false, max: 80 }))
    collection.fields.add(new TextField({ name: 'audit_id', required: true, max: 160 }))
    collection.fields.add(new TextField({ name: 'observacao', required: false, max: 1200 }))
    collection.fields.add(new DateField({ name: 'occurred_at', required: true }))

    // Estados aceitos pela governança: promover_baixo_risco, ativo_provisorio, escalar_direcao.
    collection.indexes = [
      'CREATE INDEX idx_com_ledger_comercial_occurred ON com_ledger_comercial (occurred_at)',
      'CREATE INDEX idx_com_ledger_comercial_destino ON com_ledger_comercial (destino_sugerido, status)',
      'CREATE INDEX idx_com_ledger_comercial_audit ON com_ledger_comercial (audit_id)',
      'CREATE INDEX idx_com_ledger_comercial_fonte ON com_ledger_comercial (fonte, occurred_at)',
    ]

    app.save(collection)
  },
  function (app) {
    try {
      app.delete(app.findCollectionByNameOrId('com_ledger_comercial'))
    } catch (_) {}
  },
)
