migrate(
  (app) => {
    const collection = new Collection({
      name: 'com_etapas',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: null,
      fields: [
        { name: 'external_id', type: 'text', required: true, max: 100 },
        { name: 'codigo', type: 'text', max: 50 },
        { name: 'nome', type: 'text', max: 200 },
        { name: 'ordem', type: 'number', onlyInt: true },
        { name: 'tipo', type: 'text', max: 30 },
        { name: 'ativa', type: 'bool' },
        { name: 'inicio_vigencia', type: 'date' },
        { name: 'fim_vigencia', type: 'date' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_com_etapas_external_id ON com_etapas (external_id)',
        'CREATE INDEX idx_com_etapas_codigo ON com_etapas (codigo)',
      ],
    })
    app.save(collection)

    var etapasCol = app.findCollectionByNameOrId('com_etapas')
    var seeds = [
      {
        external_id: 'ac_stage_1',
        codigo: 'prospects',
        nome: 'Prospects',
        ordem: 1,
        tipo: 'etapa',
        ativa: true,
      },
      {
        external_id: 'ac_stage_2',
        codigo: 'producao_proposta',
        nome: 'Produção de Proposta',
        ordem: 2,
        tipo: 'etapa',
        ativa: true,
      },
      {
        external_id: 'ac_stage_3',
        codigo: 'negociacao',
        nome: 'Negociação',
        ordem: 3,
        tipo: 'etapa',
        ativa: true,
      },
      {
        external_id: 'ac_result_1',
        codigo: 'ganho',
        nome: 'Ganho',
        ordem: 4,
        tipo: 'resultado',
        ativa: true,
      },
      {
        external_id: 'ac_result_2',
        codigo: 'perdido',
        nome: 'Perdido',
        ordem: 5,
        tipo: 'resultado',
        ativa: true,
      },
      {
        external_id: 'ac_result_3',
        codigo: 'desqualificado',
        nome: 'Desqualificado',
        ordem: 6,
        tipo: 'resultado',
        ativa: true,
      },
    ]

    for (var i = 0; i < seeds.length; i++) {
      var s = seeds[i]
      try {
        app.findFirstRecordByData('com_etapas', 'external_id', s.external_id)
      } catch (_) {
        var rec = new Record(etapasCol)
        rec.set('external_id', s.external_id)
        rec.set('codigo', s.codigo)
        rec.set('nome', s.nome)
        rec.set('ordem', s.ordem)
        rec.set('tipo', s.tipo)
        rec.set('ativa', s.ativa)
        app.save(rec)
      }
    }
  },
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId('com_etapas')
      app.delete(collection)
    } catch (_) {}
  },
)
