migrate(
  (app) => {
    const equipesCol = app.findCollectionByNameOrId('com_equipes')
    const collection = new Collection({
      name: 'com_empresas',
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
        { name: 'nome', type: 'text', required: true, min: 2, max: 200 },
        { name: 'cnpj', type: 'text', max: 20 },
        { name: 'email', type: 'email', max: 100 },
        { name: 'telefone', type: 'text', max: 30 },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['ativo', 'inativo', 'prospecto'],
          maxSelect: 1,
        },
        { name: 'equipe_id', type: 'relation', collectionId: equipesCol.id, maxSelect: 1 },
        { name: 'responsavel_id', type: 'relation', collectionId: '_pb_users_auth_', maxSelect: 1 },
        { name: 'endereco', type: 'text', max: 200 },
        { name: 'cidade', type: 'text', max: 100 },
        { name: 'estado', type: 'text', max: 2 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_com_empresas_status ON com_empresas (status)',
        'CREATE INDEX idx_com_empresas_equipe ON com_empresas (equipe_id)',
        'CREATE INDEX idx_com_empresas_responsavel ON com_empresas (responsavel_id)',
        'CREATE INDEX idx_com_empresas_created ON com_empresas (created)',
      ],
    })
    app.save(collection)
  },
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId('com_empresas')
      app.delete(collection)
    } catch (_) {}
  },
)
