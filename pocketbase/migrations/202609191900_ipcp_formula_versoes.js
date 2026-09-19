migrate(
  function (app) {
    var perfisDecisaoSuperior =
      "@request.auth.id != '' && (@request.auth.perfil_id.slug = 'superadministrador' || @request.auth.perfil_id.slug = 'leitura-executiva')"

    var collection
    try {
      collection = app.findCollectionByNameOrId('com_ipcp_formula_versoes')
    } catch (_) {
      collection = new Collection({
        type: 'base',
        name: 'com_ipcp_formula_versoes',
        listRule: perfisDecisaoSuperior,
        viewRule: perfisDecisaoSuperior,
        createRule: null,
        updateRule: null,
        deleteRule: null,
      })
    }

    function addText(name, required, max) {
      if (!collection.fields.getByName(name)) {
        collection.fields.add(new TextField({ name: name, required: Boolean(required), max: max || 2000 }))
      }
    }
    function addDate(name, required) {
      if (!collection.fields.getByName(name)) {
        collection.fields.add(new DateField({ name: name, required: Boolean(required) }))
      }
    }

    addText('formula_version', true, 120)
    addText('formula_base_version', true, 120)
    addText('status', true, 80)
    addText('origem_decisao_id', true, 80)
    addText('regra_aprovada', true, 4000)
    addText('blocos_afetados', false, 1000)
    addText('snapshot_antes_json', false, 4000)
    addText('snapshot_depois_json', false, 4000)
    addText('aprovada_por_id', true, 80)
    addText('aprovada_por_nome', false, 160)
    addText('auditoria_json', false, 4000)
    addDate('aplicada_em', true)
    addDate('created_at', true)
    addDate('updated_at', false)

    collection.indexes = [
      'CREATE UNIQUE INDEX idx_com_ipcp_formula_versoes_decisao ON com_ipcp_formula_versoes (origem_decisao_id)',
      'CREATE INDEX idx_com_ipcp_formula_versoes_status ON com_ipcp_formula_versoes (status, aplicada_em)',
      'CREATE INDEX idx_com_ipcp_formula_versoes_formula ON com_ipcp_formula_versoes (formula_version)',
    ]

    app.save(collection)

    try {
      var decisoes = app.findCollectionByNameOrId('com_nexo_curadoria_decisoes')
      var changed = false
      if (!decisoes.fields.getByName('ipcp_formula_versao_id')) {
        decisoes.fields.add(new TextField({ name: 'ipcp_formula_versao_id', required: false, max: 80 }))
        changed = true
      }
      if (!decisoes.fields.getByName('ipcp_formula_versao')) {
        decisoes.fields.add(new TextField({ name: 'ipcp_formula_versao', required: false, max: 120 }))
        changed = true
      }
      if (!decisoes.fields.getByName('ipcp_formula_aplicada_em')) {
        decisoes.fields.add(new DateField({ name: 'ipcp_formula_aplicada_em', required: false }))
        changed = true
      }
      if (!decisoes.fields.getByName('ipcp_formula_audit_json')) {
        decisoes.fields.add(new TextField({ name: 'ipcp_formula_audit_json', required: false, max: 4000 }))
        changed = true
      }
      if (changed) app.save(decisoes)
    } catch (_) {}
  },
  function (app) {
    try {
      var decisoes = app.findCollectionByNameOrId('com_nexo_curadoria_decisoes')
      var changed = false
      ;['ipcp_formula_versao_id', 'ipcp_formula_versao', 'ipcp_formula_aplicada_em', 'ipcp_formula_audit_json'].forEach(function (name) {
        if (decisoes.fields.getByName(name)) {
          decisoes.fields.removeByName(name)
          changed = true
        }
      })
      if (changed) app.save(decisoes)
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('com_ipcp_formula_versoes'))
    } catch (_) {}
  },
)
