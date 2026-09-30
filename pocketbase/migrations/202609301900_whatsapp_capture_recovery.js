migrate(
  function (app) {
    try {
      app.findCollectionByNameOrId('com_whatsapp_vinculos')
      return
    } catch (_) {}

    var collection = new Collection({
      type: 'base',
      name: 'com_whatsapp_vinculos',
      createRule: null,
      updateRule: null,
      deleteRule: null,
      listRule:
        "@request.auth.id != '' && (@request.auth.perfil_id.slug = 'superadministrador' || @request.auth.perfil_id.slug = 'gestor-comercial' || @request.auth.perfil_id.slug = 'integracao')",
      viewRule:
        "@request.auth.id != '' && (@request.auth.perfil_id.slug = 'superadministrador' || @request.auth.perfil_id.slug = 'gestor-comercial' || @request.auth.perfil_id.slug = 'integracao')",
    })
    collection.fields.add(new TextField({ name: 'provider', required: true, max: 40 }))
    collection.fields.add(new TextField({ name: 'instance_name', required: false, max: 120 }))
    collection.fields.add(new TextField({ name: 'owner', required: false, max: 80 }))
    collection.fields.add(new TextField({ name: 'chat_id', required: true, max: 160 }))
    collection.fields.add(new TextField({ name: 'telefone', required: false, max: 40 }))
    collection.fields.add(new TextField({ name: 'contato_id', required: false, max: 80 }))
    collection.fields.add(new TextField({ name: 'empresa_id', required: false, max: 80 }))
    collection.fields.add(new TextField({ name: 'negocio_id', required: false, max: 80 }))
    collection.fields.add(new TextField({ name: 'status', required: true, max: 60 }))
    collection.fields.add(new TextField({ name: 'origem_decisao', required: false, max: 80 }))
    collection.fields.add(new TextField({ name: 'observacao', required: false, max: 1200 }))
    collection.fields.add(new DateField({ name: 'vinculado_em', required: false }))
    collection.fields.add(new DateField({ name: 'last_message_at', required: false }))
    collection.indexes = [
      'CREATE UNIQUE INDEX idx_com_whatsapp_vinculos_chat ON com_whatsapp_vinculos (provider, instance_name, owner, chat_id)',
      'CREATE INDEX idx_com_whatsapp_vinculos_status ON com_whatsapp_vinculos (status)',
      'CREATE INDEX idx_com_whatsapp_vinculos_negocio ON com_whatsapp_vinculos (negocio_id)',
    ]
    app.save(collection)
  },
  function () {
    // Migração corretiva não remove a coleção no rollback para preservar vínculos já capturados.
  },
)
