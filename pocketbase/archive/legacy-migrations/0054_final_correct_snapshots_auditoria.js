migrate(
  (app) => {
    var SI =
      "@request.auth.id != '' && (@request.auth.perfil_id.slug = 'superadministrador' || @request.auth.perfil_id.slug = 'integracao')"
    var SO = "@request.auth.id != '' && @request.auth.perfil_id.slug = 'superadministrador'"
    var G = "@request.auth.id != ''"

    var snapCol = app.findCollectionByNameOrId('com_snapshots_negocio')
    snapCol.listRule = SI
    snapCol.viewRule = SI
    snapCol.createRule = SO
    snapCol.updateRule = null
    snapCol.deleteRule = null
    app.save(snapCol)

    var audCol = app.findCollectionByNameOrId('com_auditoria')
    audCol.listRule = G
    audCol.viewRule = G
    audCol.createRule = G
    audCol.updateRule = null
    audCol.deleteRule = null
    app.save(audCol)
  },
  (app) => {
    var SI =
      "@request.auth.id != '' && (@request.auth.perfil_id.slug = 'superadministrador' || @request.auth.perfil_id.slug = 'integracao')"
    var SO = "@request.auth.id != '' && @request.auth.perfil_id.slug = 'superadministrador'"
    var G = "@request.auth.id != ''"

    var snapCol = app.findCollectionByNameOrId('com_snapshots_negocio')
    snapCol.listRule = SI
    snapCol.viewRule = SI
    snapCol.createRule = SO
    snapCol.updateRule = null
    snapCol.deleteRule = null
    app.save(snapCol)

    var audCol = app.findCollectionByNameOrId('com_auditoria')
    audCol.listRule = G
    audCol.viewRule = G
    audCol.createRule = G
    audCol.updateRule = null
    audCol.deleteRule = null
    app.save(audCol)
  },
)
