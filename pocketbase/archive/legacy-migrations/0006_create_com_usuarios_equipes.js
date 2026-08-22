migrate(
  (app) => {
    const equipesCol = app.findCollectionByNameOrId('com_equipes')
    const perfisCol = app.findCollectionByNameOrId('com_perfis')
    const collection = new Collection({
      name: 'com_usuarios_equipes',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'usuario_id',
          type: 'relation',
          required: true,
          collectionId: '_pb_users_auth_',
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'equipe_id',
          type: 'relation',
          required: true,
          collectionId: equipesCol.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'perfil_id',
          type: 'relation',
          required: true,
          collectionId: perfisCol.id,
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
        'CREATE UNIQUE INDEX idx_com_usuarios_equipes_usuario_equipe ON com_usuarios_equipes (usuario_id, equipe_id)',
        'CREATE INDEX idx_com_usuarios_equipes_equipe ON com_usuarios_equipes (equipe_id)',
      ],
    })
    app.save(collection)
  },
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId('com_usuarios_equipes')
      app.delete(collection)
    } catch (_) {}
  },
)
