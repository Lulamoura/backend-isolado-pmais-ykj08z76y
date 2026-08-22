migrate(
  (app) => {
    const collection = new Collection({
      name: 'com_equipes',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'nome', type: 'text', required: true, min: 2, max: 100 },
        { name: 'slug', type: 'text', required: true, max: 50, pattern: '^[a-z0-9-]+$' },
        { name: 'descricao', type: 'text', max: 500 },
        { name: 'ativo', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_com_equipes_slug ON com_equipes (slug)',
        'CREATE INDEX idx_com_equipes_ativo ON com_equipes (ativo)',
      ],
    })
    app.save(collection)
  },
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId('com_equipes')
      app.delete(collection)
    } catch (_) {}
  },
)
