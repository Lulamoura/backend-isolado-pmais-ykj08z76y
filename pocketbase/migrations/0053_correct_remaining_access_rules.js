migrate(
  (app) => {
    var SI =
      "@request.auth.id != '' && (@request.auth.perfil_id.slug = 'superadministrador' || @request.auth.perfil_id.slug = 'integracao')"
    var SO = "@request.auth.id != '' && @request.auth.perfil_id.slug = 'superadministrador'"
    var HR =
      "@request.auth.id != '' && (@request.auth.perfil_id.slug = 'superadministrador' || @request.auth.perfil_id.slug = 'gestor-comercial' || @request.auth.perfil_id.slug = 'operador-comercial' || @request.auth.perfil_id.slug = 'prospeccao' || @request.auth.perfil_id.slug = 'aprovador' || @request.auth.perfil_id.slug = 'leitura-executiva')"
    var HC =
      "@request.auth.id != '' && (@request.auth.perfil_id.slug = 'superadministrador' || @request.auth.perfil_id.slug = 'gestor-comercial' || @request.auth.perfil_id.slug = 'operador-comercial' || @request.auth.perfil_id.slug = 'prospeccao')"
    var G = "@request.auth.id != ''"

    var snapCol = app.findCollectionByNameOrId('com_snapshots_negocio')
    snapCol.listRule = SI
    snapCol.viewRule = SI
    snapCol.createRule = SO
    snapCol.updateRule = null
    snapCol.deleteRule = null
    app.save(snapCol)

    var histCol = app.findCollectionByNameOrId('com_negocio_historico')
    histCol.listRule = HR
    histCol.viewRule = HR
    histCol.createRule = HC
    histCol.updateRule = null
    histCol.deleteRule = null
    app.save(histCol)

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
    var HR =
      "@request.auth.id != '' && (@request.auth.perfil_id.slug = 'superadministrador' || @request.auth.perfil_id.slug = 'gestor-comercial' || @request.auth.perfil_id.slug = 'operador-comercial' || @request.auth.perfil_id.slug = 'prospeccao' || @request.auth.perfil_id.slug = 'aprovador' || @request.auth.perfil_id.slug = 'leitura-executiva')"
    var HC =
      "@request.auth.id != '' && (@request.auth.perfil_id.slug = 'superadministrador' || @request.auth.perfil_id.slug = 'gestor-comercial' || @request.auth.perfil_id.slug = 'operador-comercial' || @request.auth.perfil_id.slug = 'prospeccao')"
    var G = "@request.auth.id != ''"

    var snapCol = app.findCollectionByNameOrId('com_snapshots_negocio')
    snapCol.listRule = SI
    snapCol.viewRule = SI
    snapCol.createRule = SO
    snapCol.updateRule = null
    snapCol.deleteRule = null
    app.save(snapCol)

    var histCol = app.findCollectionByNameOrId('com_negocio_historico')
    histCol.listRule = HR
    histCol.viewRule = HR
    histCol.createRule = HC
    histCol.updateRule = null
    histCol.deleteRule = null
    app.save(histCol)

    var audCol = app.findCollectionByNameOrId('com_auditoria')
    audCol.listRule = G
    audCol.viewRule = G
    audCol.createRule = G
    audCol.updateRule = null
    audCol.deleteRule = null
    app.save(audCol)
  },
)
