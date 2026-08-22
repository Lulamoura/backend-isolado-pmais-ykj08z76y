migrate(
  (app) => {
    const parametrosCol = app.findCollectionByNameOrId('com_parametros')
    const collection = new Collection({
      name: 'com_parametros_versoes',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: null,
      deleteRule: null,
      fields: [
        {
          name: 'parametro_id',
          type: 'relation',
          required: true,
          collectionId: parametrosCol.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'chave', type: 'text', required: true, max: 100 },
        { name: 'valor', type: 'text', required: true, max: 1000 },
        { name: 'descricao', type: 'text', max: 500 },
        { name: 'tipo', type: 'text', max: 50 },
        { name: 'unidade', type: 'text', max: 50 },
        { name: 'regra_validacao', type: 'text', max: 500 },
        { name: 'versao', type: 'number', required: true, min: 1, onlyInt: true },
        { name: 'inicio_vigencia', type: 'date' },
        { name: 'fim_vigencia', type: 'date' },
        { name: 'autor_id', type: 'relation', collectionId: '_pb_users_auth_', maxSelect: 1 },
        { name: 'justificativa', type: 'text', max: 1000 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_com_parametros_versoes_parametro ON com_parametros_versoes (parametro_id)',
        'CREATE INDEX idx_com_parametros_versoes_versao ON com_parametros_versoes (parametro_id, versao)',
      ],
    })
    app.save(collection)
  },
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId('com_parametros_versoes')
      app.delete(collection)
    } catch (_) {}
  },
)
