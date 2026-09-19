migrate(
  function (app) {
    try {
      app.findCollectionByNameOrId('com_nexo_aprendizado_eventos')
      return
    } catch (_) {}

    var collection = new Collection({
      type: 'base',
      name: 'com_nexo_aprendizado_eventos',
      createRule: null,
      updateRule: null,
      deleteRule: null,
      listRule:
        "@request.auth.id != '' && (@request.auth.perfil_id.slug = 'superadministrador' || @request.auth.perfil_id.slug = 'gestor-comercial' || @request.auth.perfil_id.slug = 'leitura-executiva')",
      viewRule:
        "@request.auth.id != '' && (@request.auth.perfil_id.slug = 'superadministrador' || @request.auth.perfil_id.slug = 'gestor-comercial' || @request.auth.perfil_id.slug = 'leitura-executiva')",
    })

    collection.fields.add(new TextField({ name: 'tipo_evento', required: true, max: 80 }))
    collection.fields.add(new TextField({ name: 'external_id', required: true, max: 80 }))
    collection.fields.add(new TextField({ name: 'acao', required: true, max: 80 }))
    collection.fields.add(new TextField({ name: 'usuario_id', required: false, max: 80 }))
    collection.fields.add(new TextField({ name: 'usuario_nome', required: false, max: 160 }))
    collection.fields.add(new TextField({ name: 'fase_negocio', required: false, max: 160 }))
    collection.fields.add(new TextField({ name: 'tipo_servico', required: false, max: 240 }))
    collection.fields.add(new TextField({ name: 'contexto_resumo', required: true, max: 4000 }))
    collection.fields.add(new TextField({ name: 'resposta_resumo', required: true, max: 4000 }))
    collection.fields.add(new BoolField({ name: 'segundo_cerebro_usado', required: false }))
    collection.fields.add(
      new TextField({ name: 'segundo_cerebro_fontes', required: false, max: 4000 }),
    )
    collection.fields.add(
      new TextField({ name: 'segundo_cerebro_versao', required: false, max: 160 }),
    )
    collection.fields.add(new TextField({ name: 'provider', required: false, max: 120 }))
    collection.fields.add(new TextField({ name: 'modelo', required: false, max: 160 }))
    collection.fields.add(new BoolField({ name: 'fallback', required: false }))
    collection.fields.add(new BoolField({ name: 'human_review_required', required: true }))
    collection.fields.add(new BoolField({ name: 'automatic_send_allowed', required: true }))
    collection.fields.add(new BoolField({ name: 'crm_write_allowed', required: true }))
    collection.fields.add(new TextField({ name: 'audit_id', required: true, max: 160 }))
    collection.fields.add(new DateField({ name: 'created_at', required: true }))

    collection.indexes = [
      'CREATE INDEX idx_com_nexo_aprendizado_eventos_created ON com_nexo_aprendizado_eventos (created_at)',
      'CREATE INDEX idx_com_nexo_aprendizado_eventos_external ON com_nexo_aprendizado_eventos (external_id, created_at)',
      'CREATE INDEX idx_com_nexo_aprendizado_eventos_audit ON com_nexo_aprendizado_eventos (audit_id)',
    ]

    app.save(collection)
  },
  function (app) {
    try {
      app.delete(app.findCollectionByNameOrId('com_nexo_aprendizado_eventos'))
    } catch (_) {}
  },
)
