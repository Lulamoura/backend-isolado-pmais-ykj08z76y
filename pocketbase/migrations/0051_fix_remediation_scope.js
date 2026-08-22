migrate(
  (app) => {
    var SI =
      "@request.auth.id != '' && (@request.auth.perfil_id.slug = 'superadministrador' || @request.auth.perfil_id.slug = 'integracao')"
    var SO = "@request.auth.id != '' && @request.auth.perfil_id.slug = 'superadministrador'"
    var SG =
      "@request.auth.id != '' && (@request.auth.perfil_id.slug = 'superadministrador' || @request.auth.perfil_id.slug = 'gestor-comercial')"
    var G = "@request.auth.id != ''"

    var contatosCol = app.findCollectionByNameOrId('com_contatos')
    contatosCol.listRule = SI
    contatosCol.viewRule = SI
    contatosCol.createRule = SI
    contatosCol.updateRule = SO
    contatosCol.deleteRule = null
    app.save(contatosCol)

    var etapasCol = app.findCollectionByNameOrId('com_etapas')
    etapasCol.updateRule = SG
    app.save(etapasCol)

    var aliasCol = app.findCollectionByNameOrId('com_alias_dimensoes')
    aliasCol.updateRule = SG
    app.save(aliasCol)

    var vincCol = app.findCollectionByNameOrId('com_vinculos_externos')
    vincCol.updateRule = SG
    app.save(vincCol)

    var audCol = app.findCollectionByNameOrId('com_auditoria')
    audCol.createRule = G
    app.save(audCol)
  },
  (app) => {
    var SI =
      "@request.auth.id != '' && (@request.auth.perfil_id.slug = 'superadministrador' || @request.auth.perfil_id.slug = 'integracao')"
    var HC =
      "@request.auth.id != '' && (@request.auth.perfil_id.slug = 'superadministrador' || @request.auth.perfil_id.slug = 'gestor-comercial' || @request.auth.perfil_id.slug = 'operador-comercial' || @request.auth.perfil_id.slug = 'prospeccao')"
    var G = "@request.auth.id != ''"

    var contatosCol = app.findCollectionByNameOrId('com_contatos')
    contatosCol.listRule = G
    contatosCol.viewRule = G
    contatosCol.createRule = G
    contatosCol.updateRule = G
    contatosCol.deleteRule = null
    app.save(contatosCol)

    var etapasCol = app.findCollectionByNameOrId('com_etapas')
    etapasCol.updateRule = SI
    app.save(etapasCol)

    var aliasCol = app.findCollectionByNameOrId('com_alias_dimensoes')
    aliasCol.updateRule = SI
    app.save(aliasCol)

    var vincCol = app.findCollectionByNameOrId('com_vinculos_externos')
    vincCol.updateRule = SI
    app.save(vincCol)

    var audCol = app.findCollectionByNameOrId('com_auditoria')
    audCol.createRule = HC
    app.save(audCol)
  },
)
