migrate(
  (app) => {
    // Coleção 1: com_execucoes_porta_2d2b
    var execCol = new Collection({
      name: 'com_execucoes_porta_2d2b',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: 'id', type: 'text', required: true },
        { name: 'runner_version', type: 'text' },
        { name: 'correlation_key', type: 'text' },
        { name: 'estado', type: 'text' },
        { name: 'started_at', type: 'text' },
        { name: 'finished_at', type: 'text' },
        { name: 'counts_before', type: 'text' },
        { name: 'counts_after', type: 'text' },
        { name: 'flag_before', type: 'text' },
        { name: 'flag_final', type: 'text' },
        { name: 'prova_zero_chamadas_externas', type: 'bool' },
        { name: 'versao_commit', type: 'text' },
        { name: 'decisao', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_com_execucoes_porta_2d2b_id ON com_execucoes_porta_2d2b (id)',
        'CREATE INDEX idx_com_execucoes_porta_2d2b_correlation_key ON com_execucoes_porta_2d2b (correlation_key)',
      ],
    })
    app.save(execCol)

    // Coleção 2: com_etapas_porta_2d2b
    var execColId = app.findCollectionByNameOrId('com_execucoes_porta_2d2b').id
    var etapasCol = new Collection({
      name: 'com_etapas_porta_2d2b',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: 'id', type: 'text', required: true },
        {
          name: 'execucao_id',
          type: 'relation',
          required: true,
          collectionId: execColId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'ordem', type: 'text' },
        { name: 'codigo', type: 'text' },
        { name: 'metodo', type: 'text' },
        { name: 'rota_sanitizada', type: 'text' },
        { name: 'started_at', type: 'text' },
        { name: 'finished_at', type: 'text' },
        { name: 'http_status_real', type: 'number' },
        { name: 'http_status_esperado', type: 'number' },
        { name: 'resultado', type: 'text' },
        { name: 'counts_antes', type: 'text' },
        { name: 'counts_depois', type: 'text' },
        { name: 'deltas', type: 'text' },
        { name: 'ids_correlacao_sanitizados', type: 'text' },
        { name: 'sha256_corpo_bruto', type: 'text' },
        { name: 'resposta_sanitizada', type: 'text' },
        { name: 'erro_real', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_com_etapas_porta_2d2b_id ON com_etapas_porta_2d2b (id)',
        'CREATE INDEX idx_com_etapas_porta_2d2b_execucao_id ON com_etapas_porta_2d2b (execucao_id)',
        'CREATE INDEX idx_com_etapas_porta_2d2b_ordem ON com_etapas_porta_2d2b (ordem)',
      ],
    })
    app.save(etapasCol)
  },
  (app) => {
    try {
      var etapas = app.findCollectionByNameOrId('com_etapas_porta_2d2b')
      app.delete(etapas)
    } catch (_) {}
    try {
      var exec = app.findCollectionByNameOrId('com_execucoes_porta_2d2b')
      app.delete(exec)
    } catch (_) {}
  },
)
