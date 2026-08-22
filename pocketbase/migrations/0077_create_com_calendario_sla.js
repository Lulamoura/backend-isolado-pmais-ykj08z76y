migrate(
  (app) => {
    var col
    try {
      col = app.findCollectionByNameOrId('com_calendario_feriados')
    } catch (_) {
      col = new Collection({
        name: 'com_calendario_feriados',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
          { name: 'data', type: 'date', required: true },
          { name: 'descricao', type: 'text', required: true, max: 200 },
          { name: 'ativo', type: 'bool' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_com_calendario_feriados_data ON com_calendario_feriados (data)',
        ],
      })
      app.save(col)
    }

    var parametros = [
      ['sla.lead_dias_uteis', '1', 'Lead vence no fim do próximo dia útil'],
      ['sla.proposta_dias_uteis', '5', 'Proposta vence em cinco dias úteis'],
      [
        'sla.negociacao_dias_uteis',
        '2',
        'Primeiro acompanhamento da negociação vence em dois dias úteis',
      ],
      ['sla.alerta_antecedencia_dias_uteis', '1', 'Antecedência padrão dos alertas de SLA'],
    ]
    var pcol = app.findCollectionByNameOrId('com_parametros')
    for (var i = 0; i < parametros.length; i++) {
      try {
        app.findFirstRecordByData('com_parametros', 'chave', parametros[i][0])
      } catch (_) {
        var p = new Record(pcol)
        p.set('chave', parametros[i][0])
        p.set('valor', parametros[i][1])
        p.set('descricao', parametros[i][2])
        p.set('versao', 1)
        p.set('ativo', true)
        app.save(p)
      }
    }

    pcol.createRule = null
    pcol.updateRule = null
    pcol.deleteRule = null
    app.save(pcol)
  },
  (app) => {
    try {
      var ps = app.findRecordsByFilter('com_parametros', "chave ~ 'sla.'", '', 100, 0)
      for (var i = 0; i < ps.length; i++) app.delete(ps[i])
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('com_calendario_feriados'))
    } catch (_) {}
  },
)
