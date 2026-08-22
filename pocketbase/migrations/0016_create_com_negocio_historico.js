migrate(
  (app) => {
    const negociosCol = app.findCollectionByNameOrId('com_negocios')
    const collection = new Collection({
      name: 'com_negocio_historico',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: null,
      deleteRule: null,
      fields: [
        {
          name: 'negocio_id',
          type: 'relation',
          required: true,
          collectionId: negociosCol.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'usuario_id', type: 'relation', collectionId: '_pb_users_auth_', maxSelect: 1 },
        {
          name: 'responsavel_anterior_id',
          type: 'relation',
          collectionId: '_pb_users_auth_',
          maxSelect: 1,
        },
        {
          name: 'responsavel_novo_id',
          type: 'relation',
          collectionId: '_pb_users_auth_',
          maxSelect: 1,
        },
        { name: 'justificativa', type: 'text', max: 1000 },
        { name: 'origem_alteracao', type: 'text', max: 50 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_com_negocio_historico_negocio ON com_negocio_historico (negocio_id)',
        'CREATE INDEX idx_com_negocio_historico_created ON com_negocio_historico (created)',
      ],
    })
    app.save(collection)
  },
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId('com_negocio_historico')
      app.delete(collection)
    } catch (_) {}
  },
)
