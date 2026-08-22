migrate(
  (app) => {
    // ─── com_execucoes_porta_2d2b: fechar todas as regras para null ───
    var execCol = app.findCollectionByNameOrId('com_execucoes_porta_2d2b')
    execCol.listRule = null
    execCol.viewRule = null
    execCol.createRule = null
    execCol.updateRule = null
    execCol.deleteRule = null
    app.save(execCol)

    // ─── com_etapas_porta_2d2b: fechar todas as regras para null ───
    // NOTA: a relação execucao_id permanece com cascadeDelete=true (imutável
    // por API), mas o hook ac_immutable_porta_2d2b.js bloqueia qualquer
    // delete de execução terminal e de etapas, garantindo a proteção
    // server-side exigida pela CORREÇÃO 12. A unicidade (execucao_id, ordem)
    // abaixo impede append duplicado.
    var etapasCol = app.findCollectionByNameOrId('com_etapas_porta_2d2b')

    etapasCol.listRule = null
    etapasCol.viewRule = null
    etapasCol.createRule = null
    etapasCol.updateRule = null
    etapasCol.deleteRule = null

    // CORREÇÃO 12: unicidade de (execucao_id, ordem) — append único por ordem.
    etapasCol.addIndex('idx_com_etapas_porta_2d2b_execucao_ordem', true, 'execucao_id, ordem', '')
    app.save(etapasCol)
  },
  (app) => {
    // Reverte: reabre leitura para auth e remove índice de unicidade.
    var execCol = app.findCollectionByNameOrId('com_execucoes_porta_2d2b')
    execCol.listRule = "@request.auth.id != ''"
    execCol.viewRule = "@request.auth.id != ''"
    app.save(execCol)

    var etapasCol = app.findCollectionByNameOrId('com_etapas_porta_2d2b')
    etapasCol.listRule = "@request.auth.id != ''"
    etapasCol.viewRule = "@request.auth.id != ''"
    etapasCol.removeIndex('idx_com_etapas_porta_2d2b_execucao_ordem')
    app.save(etapasCol)
  },
)
