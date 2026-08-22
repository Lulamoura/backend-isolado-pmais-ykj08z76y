migrate(
  (app) => {
    var SI =
      "@request.auth.id != '' && (@request.auth.perfil_id.slug = 'superadministrador' || @request.auth.perfil_id.slug = 'integracao')"
    var SO = "@request.auth.id != '' && @request.auth.perfil_id.slug = 'superadministrador'"
    var SG =
      "@request.auth.id != '' && (@request.auth.perfil_id.slug = 'superadministrador' || @request.auth.perfil_id.slug = 'gestor-comercial')"
    var HR =
      "@request.auth.id != '' && (@request.auth.perfil_id.slug = 'superadministrador' || @request.auth.perfil_id.slug = 'gestor-comercial' || @request.auth.perfil_id.slug = 'operador-comercial' || @request.auth.perfil_id.slug = 'prospeccao' || @request.auth.perfil_id.slug = 'aprovador' || @request.auth.perfil_id.slug = 'leitura-executiva')"
    var HC =
      "@request.auth.id != '' && (@request.auth.perfil_id.slug = 'superadministrador' || @request.auth.perfil_id.slug = 'gestor-comercial' || @request.auth.perfil_id.slug = 'operador-comercial' || @request.auth.perfil_id.slug = 'prospeccao')"
    var G = "@request.auth.id != ''"

    var etapasCol = app.findCollectionByNameOrId('com_etapas')
    etapasCol.listRule = SI
    etapasCol.viewRule = SI
    etapasCol.createRule = SI
    etapasCol.updateRule = SG
    etapasCol.deleteRule = null
    app.save(etapasCol)

    var aliasCol = app.findCollectionByNameOrId('com_alias_dimensoes')
    aliasCol.listRule = SI
    aliasCol.viewRule = SI
    aliasCol.createRule = SI
    aliasCol.updateRule = SG
    aliasCol.deleteRule = null
    app.save(aliasCol)

    var vincCol = app.findCollectionByNameOrId('com_vinculos_externos')
    vincCol.listRule = SI
    vincCol.viewRule = SI
    vincCol.createRule = SI
    vincCol.updateRule = SG
    vincCol.deleteRule = null
    app.save(vincCol)

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
    audCol.createRule = G
    app.save(audCol)
  },
  (app) => {
    var SI =
      "@request.auth.id != '' && (@request.auth.perfil_id.slug = 'superadministrador' || @request.auth.perfil_id.slug = 'integracao')"
    var SO = "@request.auth.id != '' && @request.auth.perfil_id.slug = 'superadministrador'"
    var SG =
      "@request.auth.id != '' && (@request.auth.perfil_id.slug = 'superadministrador' || @request.auth.perfil_id.slug = 'gestor-comercial')"
    var HR =
      "@request.auth.id != '' && (@request.auth.perfil_id.slug = 'superadministrador' || @request.auth.perfil_id.slug = 'gestor-comercial' || @request.auth.perfil_id.slug = 'operador-comercial' || @request.auth.perfil_id.slug = 'prospeccao' || @request.auth.perfil_id.slug = 'aprovador' || @request.auth.perfil_id.slug = 'leitura-executiva')"
    var HC =
      "@request.auth.id != '' && (@request.auth.perfil_id.slug = 'superadministrador' || @request.auth.perfil_id.slug = 'gestor-comercial' || @request.auth.perfil_id.slug = 'operador-comercial' || @request.auth.perfil_id.slug = 'prospeccao')"
    var G = "@request.auth.id != ''"

    var etapasCol = app.findCollectionByNameOrId('com_etapas')
    etapasCol.listRule = SI
    etapasCol.viewRule = SI
    etapasCol.createRule = SI
    etapasCol.updateRule = SG
    etapasCol.deleteRule = null
    app.save(etapasCol)

    var aliasCol = app.findCollectionByNameOrId('com_alias_dimensoes')
    aliasCol.listRule = SI
    aliasCol.viewRule = SI
    aliasCol.createRule = SI
    aliasCol.updateRule = SG
    aliasCol.deleteRule = null
    app.save(aliasCol)

    var vincCol = app.findCollectionByNameOrId('com_vinculos_externos')
    vincCol.listRule = SI
    vincCol.viewRule = SI
    vincCol.createRule = SI
    vincCol.updateRule = SG
    vincCol.deleteRule = null
    app.save(vincCol)

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
    audCol.createRule = G
    app.save(audCol)
  },
)
