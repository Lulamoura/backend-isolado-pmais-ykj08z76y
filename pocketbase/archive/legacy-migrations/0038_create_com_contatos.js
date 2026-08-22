migrate(
  (app) => {
    const empresasCol = app.findCollectionByNameOrId('com_empresas')
    const collection = new Collection({
      name: 'com_contatos',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: null,
      fields: [
        { name: 'nome', type: 'text', required: true, min: 2, max: 200 },
        { name: 'email', type: 'text', max: 200 },
        { name: 'telefone', type: 'text', max: 30 },
        { name: 'empresa_id', type: 'relation', collectionId: empresasCol.id, maxSelect: 1 },
        { name: 'ativo', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_com_contatos_empresa ON com_contatos (empresa_id)',
        'CREATE INDEX idx_com_contatos_ativo ON com_contatos (ativo)',
      ],
    })
    app.save(collection)
  },
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId('com_contatos')
      app.delete(collection)
    } catch (_) {}
  },
)
