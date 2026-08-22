migrate(
  (app) => {
    const perfisCol = app.findCollectionByNameOrId('com_perfis')
    const permissoesCol = app.findCollectionByNameOrId('com_permissoes')
    const collection = new Collection({
      name: 'com_perfil_permissoes',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'perfil_id',
          type: 'relation',
          required: true,
          collectionId: perfisCol.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'permissao_id',
          type: 'relation',
          required: true,
          collectionId: permissoesCol.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'escopo',
          type: 'select',
          required: true,
          values: ['proprios', 'equipe', 'todos'],
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_com_perfil_permissoes_perfil_permissao ON com_perfil_permissoes (perfil_id, permissao_id)',
        'CREATE INDEX idx_com_perfil_permissoes_escopo ON com_perfil_permissoes (escopo)',
      ],
    })
    app.save(collection)
  },
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId('com_perfil_permissoes')
      app.delete(collection)
    } catch (_) {}
  },
)
