migrate(
  (app) => {
    const empresasCol = app.findCollectionByNameOrId('com_empresas')
    const equipesCol = app.findCollectionByNameOrId('com_equipes')
    const collection = new Collection({
      name: 'com_negocios',
      type: 'base',
      listRule:
        "@request.auth.id != '' && (responsavel_id = @request.auth.id || (@request.auth.equipe_id != '' && equipe_id = @request.auth.equipe_id))",
      viewRule:
        "@request.auth.id != '' && (responsavel_id = @request.auth.id || (@request.auth.equipe_id != '' && equipe_id = @request.auth.equipe_id))",
      createRule: "@request.auth.id != ''",
      updateRule:
        "@request.auth.id != '' && (responsavel_id = @request.auth.id || (@request.auth.equipe_id != '' && equipe_id = @request.auth.equipe_id))",
      deleteRule:
        "@request.auth.id != '' && (responsavel_id = @request.auth.id || (@request.auth.equipe_id != '' && equipe_id = @request.auth.equipe_id))",
      fields: [
        { name: 'titulo', type: 'text', required: true, min: 2, max: 200 },
        {
          name: 'empresa_id',
          type: 'relation',
          collectionId: empresasCol.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'equipe_id', type: 'relation', collectionId: equipesCol.id, maxSelect: 1 },
        { name: 'responsavel_id', type: 'relation', collectionId: '_pb_users_auth_', maxSelect: 1 },
        { name: 'valor', type: 'number', min: 0, onlyInt: true },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['aberto', 'em_andamento', 'ganho', 'perdido'],
          maxSelect: 1,
        },
        { name: 'descricao', type: 'text', max: 1000 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_com_negocios_status ON com_negocios (status)',
        'CREATE INDEX idx_com_negocios_equipe ON com_negocios (equipe_id)',
        'CREATE INDEX idx_com_negocios_responsavel ON com_negocios (responsavel_id)',
        'CREATE INDEX idx_com_negocios_empresa ON com_negocios (empresa_id)',
        'CREATE INDEX idx_com_negocios_created ON com_negocios (created)',
      ],
    })
    app.save(collection)
  },
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId('com_negocios')
      app.delete(collection)
    } catch (_) {}
  },
)
