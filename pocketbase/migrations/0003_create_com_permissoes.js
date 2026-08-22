migrate(
  (app) => {
    const collection = new Collection({
      name: 'com_permissoes',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'nome', type: 'text', required: true, min: 2, max: 100 },
        { name: 'slug', type: 'text', required: true, max: 50, pattern: '^[a-z0-9._-]+$' },
        { name: 'recurso', type: 'text', required: true, max: 50 },
        { name: 'acao', type: 'text', required: true, max: 30 },
        { name: 'descricao', type: 'text', max: 500 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_com_permissoes_slug ON com_permissoes (slug)',
        'CREATE INDEX idx_com_permissoes_recurso_acao ON com_permissoes (recurso, acao)',
      ],
    })
    app.save(collection)
  },
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId('com_permissoes')
      app.delete(collection)
    } catch (_) {}
  },
)
