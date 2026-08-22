migrate(
  (app) => {
    const execucoesCol = app.findCollectionByNameOrId('com_execucoes_sincronizacao')
    const collection = new Collection({
      name: 'com_ocorrencias_qualidade',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: null,
      fields: [
        {
          name: 'execucao_id',
          type: 'relation',
          collectionId: execucoesCol.id,
          maxSelect: 1,
        },
        { name: 'tipo', type: 'text', max: 50 },
        { name: 'severidade', type: 'text', max: 30 },
        { name: 'descricao', type: 'text', max: 1000 },
        { name: 'resolvida', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_com_ocorrencias_qualidade_execucao ON com_ocorrencias_qualidade (execucao_id)',
        'CREATE INDEX idx_com_ocorrencias_qualidade_severidade ON com_ocorrencias_qualidade (severidade)',
      ],
    })
    app.save(collection)
  },
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId('com_ocorrencias_qualidade')
      app.delete(collection)
    } catch (_) {}
  },
)
