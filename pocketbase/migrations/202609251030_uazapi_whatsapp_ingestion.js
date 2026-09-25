migrate(
  function (app) {
    function createIfMissing(name, configure) {
      try {
        app.findCollectionByNameOrId(name)
        return
      } catch (_) {}
      var collection = new Collection({
        type: 'base',
        name: name,
        createRule: null,
        updateRule: null,
        deleteRule: null,
        listRule:
          "@request.auth.id != '' && (@request.auth.perfil_id.slug = 'superadministrador' || @request.auth.perfil_id.slug = 'gestor-comercial' || @request.auth.perfil_id.slug = 'integracao')",
        viewRule:
          "@request.auth.id != '' && (@request.auth.perfil_id.slug = 'superadministrador' || @request.auth.perfil_id.slug = 'gestor-comercial' || @request.auth.perfil_id.slug = 'integracao')",
      })
      configure(collection)
      app.save(collection)
    }

    createIfMissing('com_whatsapp_eventos', function (collection) {
      collection.fields.add(new TextField({ name: 'provider', required: true, max: 40 }))
      collection.fields.add(new TextField({ name: 'instance_name', required: false, max: 120 }))
      collection.fields.add(new TextField({ name: 'owner', required: false, max: 80 }))
      collection.fields.add(new TextField({ name: 'event_type', required: true, max: 80 }))
      collection.fields.add(new TextField({ name: 'message_id', required: false, max: 220 }))
      collection.fields.add(new TextField({ name: 'idempotency_key', required: true, max: 200 }))
      collection.fields.add(new TextField({ name: 'payload_hash', required: true, max: 80 }))
      collection.fields.add(
        new TextField({ name: 'payload_sanitizado', required: true, max: 50000 }),
      )
      collection.fields.add(new TextField({ name: 'status', required: true, max: 40 }))
      collection.fields.add(new BoolField({ name: 'from_me', required: false }))
      collection.fields.add(new BoolField({ name: 'is_group', required: false }))
      collection.fields.add(new TextField({ name: 'media_type', required: false, max: 80 }))
      collection.fields.add(new TextField({ name: 'erro', required: false, max: 1200 }))
      collection.fields.add(new DateField({ name: 'received_at', required: true }))
      collection.indexes = [
        'CREATE UNIQUE INDEX idx_com_whatsapp_eventos_idem ON com_whatsapp_eventos (idempotency_key)',
        'CREATE INDEX idx_com_whatsapp_eventos_owner_created ON com_whatsapp_eventos (owner, received_at)',
        'CREATE INDEX idx_com_whatsapp_eventos_tipo_created ON com_whatsapp_eventos (event_type, received_at)',
        'CREATE INDEX idx_com_whatsapp_eventos_message ON com_whatsapp_eventos (message_id)',
      ]
    })

    createIfMissing('com_whatsapp_mensagens', function (collection) {
      collection.fields.add(new TextField({ name: 'provider', required: true, max: 40 }))
      collection.fields.add(new TextField({ name: 'instance_name', required: false, max: 120 }))
      collection.fields.add(new TextField({ name: 'owner', required: false, max: 80 }))
      collection.fields.add(new TextField({ name: 'chat_id', required: false, max: 160 }))
      collection.fields.add(new TextField({ name: 'sender_id', required: false, max: 160 }))
      collection.fields.add(new TextField({ name: 'sender_name', required: false, max: 180 }))
      collection.fields.add(new TextField({ name: 'message_id', required: true, max: 220 }))
      collection.fields.add(new TextField({ name: 'idempotency_key', required: true, max: 200 }))
      collection.fields.add(new TextField({ name: 'direcao', required: true, max: 30 }))
      collection.fields.add(new BoolField({ name: 'is_group', required: false }))
      collection.fields.add(new TextField({ name: 'message_type', required: false, max: 80 }))
      collection.fields.add(new TextField({ name: 'media_type', required: false, max: 80 }))
      collection.fields.add(new TextField({ name: 'texto', required: false, max: 8000 }))
      collection.fields.add(new TextField({ name: 'status', required: true, max: 40 }))
      collection.fields.add(new TextField({ name: 'evento_id', required: false, max: 80 }))
      collection.fields.add(new DateField({ name: 'message_at', required: false }))
      collection.fields.add(new DateField({ name: 'received_at', required: true }))
      collection.indexes = [
        'CREATE UNIQUE INDEX idx_com_whatsapp_mensagens_idem ON com_whatsapp_mensagens (idempotency_key)',
        'CREATE INDEX idx_com_whatsapp_mensagens_chat_created ON com_whatsapp_mensagens (chat_id, message_at)',
        'CREATE INDEX idx_com_whatsapp_mensagens_owner_created ON com_whatsapp_mensagens (owner, message_at)',
        'CREATE INDEX idx_com_whatsapp_mensagens_message ON com_whatsapp_mensagens (message_id)',
      ]
    })

    createIfMissing('com_whatsapp_midias', function (collection) {
      collection.fields.add(new TextField({ name: 'provider', required: true, max: 40 }))
      collection.fields.add(new TextField({ name: 'instance_name', required: false, max: 120 }))
      collection.fields.add(new TextField({ name: 'owner', required: false, max: 80 }))
      collection.fields.add(new TextField({ name: 'message_id', required: true, max: 220 }))
      collection.fields.add(new TextField({ name: 'media_type', required: false, max: 80 }))
      collection.fields.add(new TextField({ name: 'mimetype', required: false, max: 160 }))
      collection.fields.add(new TextField({ name: 'file_name', required: false, max: 240 }))
      collection.fields.add(new TextField({ name: 'source_url_hash', required: false, max: 80 }))
      collection.fields.add(new TextField({ name: 'download_status', required: true, max: 40 }))
      collection.fields.add(
        new NumberField({ name: 'bytes', min: 0, onlyInt: true, required: false }),
      )
      collection.fields.add(new TextField({ name: 'sha256', required: false, max: 80 }))
      collection.fields.add(new TextField({ name: 'storage_path', required: false, max: 500 }))
      collection.fields.add(new TextField({ name: 'erro', required: false, max: 1200 }))
      collection.fields.add(new DateField({ name: 'received_at', required: true }))
      collection.fields.add(new DateField({ name: 'downloaded_at', required: false }))
      collection.indexes = [
        'CREATE UNIQUE INDEX idx_com_whatsapp_midias_message ON com_whatsapp_midias (message_id)',
        'CREATE INDEX idx_com_whatsapp_midias_status ON com_whatsapp_midias (download_status)',
        'CREATE INDEX idx_com_whatsapp_midias_owner_created ON com_whatsapp_midias (owner, received_at)',
      ]
    })
  },
  function (app) {
    try {
      app.delete(app.findCollectionByNameOrId('com_whatsapp_midias'))
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('com_whatsapp_mensagens'))
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('com_whatsapp_eventos'))
    } catch (_) {}
  },
)
