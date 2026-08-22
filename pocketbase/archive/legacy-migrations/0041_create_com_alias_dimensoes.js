migrate(
  (app) => {
    var etapasCol = app.findCollectionByNameOrId('com_etapas')
    const collection = new Collection({
      name: 'com_alias_dimensoes',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: null,
      fields: [
        { name: 'dimensao', type: 'text', required: true, max: 50 },
        { name: 'valor_original', type: 'text', max: 200 },
        { name: 'valor_comparacao', type: 'text', max: 200 },
        { name: 'canonico_ref', type: 'relation', collectionId: etapasCol.id, maxSelect: 1 },
        { name: 'validacao', type: 'text', max: 30 },
        { name: 'inicio_vigencia', type: 'date' },
        { name: 'fim_vigencia', type: 'date' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_com_alias_dimensoes_dimensao ON com_alias_dimensoes (dimensao)',
        'CREATE INDEX idx_com_alias_dimensoes_valor_original ON com_alias_dimensoes (valor_original)',
      ],
    })
    app.save(collection)

    var aliasCol = app.findCollectionByNameOrId('com_alias_dimensoes')

    function findEtapa(codigo) {
      try {
        return app.findFirstRecordByData('com_etapas', 'codigo', codigo)
      } catch (_) {
        return null
      }
    }

    var etapaProspects = findEtapa('prospects')
    var etapaProducao = findEtapa('producao_proposta')
    var etapaNegociacao = findEtapa('negociacao')
    var etapaGanho = findEtapa('ganho')
    var etapaPerdido = findEtapa('perdido')
    var etapaDesqualificado = findEtapa('desqualificado')

    var aliases = [
      {
        dimensao: 'etapa',
        valor_original: 'prospects',
        valor_comparacao: 'prospects',
        canonico_ref: etapaProspects ? etapaProspects.id : '',
        validacao: 'auto',
      },
      {
        dimensao: 'etapa',
        valor_original: 'producao_proposta',
        valor_comparacao: 'producao_proposta',
        canonico_ref: etapaProducao ? etapaProducao.id : '',
        validacao: 'auto',
      },
      {
        dimensao: 'etapa',
        valor_original: 'negociacao',
        valor_comparacao: 'negociacao',
        canonico_ref: etapaNegociacao ? etapaNegociacao.id : '',
        validacao: 'auto',
      },
      {
        dimensao: 'resultado',
        valor_original: 'ganho',
        valor_comparacao: 'ganho',
        canonico_ref: etapaGanho ? etapaGanho.id : '',
        validacao: 'auto',
      },
      {
        dimensao: 'resultado',
        valor_original: 'perdido',
        valor_comparacao: 'perdido',
        canonico_ref: etapaPerdido ? etapaPerdido.id : '',
        validacao: 'auto',
      },
      {
        dimensao: 'resultado',
        valor_original: 'desqualificado',
        valor_comparacao: 'desqualificado',
        canonico_ref: etapaDesqualificado ? etapaDesqualificado.id : '',
        validacao: 'auto',
      },
    ]

    for (var i = 0; i < aliases.length; i++) {
      var a = aliases[i]
      try {
        app.findFirstRecordByFilter(
          'com_alias_dimensoes',
          "dimensao = '" + a.dimensao + "' && valor_original = '" + a.valor_original + "'",
        )
      } catch (_) {
        var rec = new Record(aliasCol)
        rec.set('dimensao', a.dimensao)
        rec.set('valor_original', a.valor_original)
        rec.set('valor_comparacao', a.valor_comparacao)
        if (a.canonico_ref) {
          rec.set('canonico_ref', a.canonico_ref)
        }
        rec.set('validacao', a.validacao)
        app.save(rec)
      }
    }
  },
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId('com_alias_dimensoes')
      app.delete(collection)
    } catch (_) {}
  },
)
