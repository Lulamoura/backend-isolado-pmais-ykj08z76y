migrate(
  (app) => {
    var perfisCol = app.findCollectionByNameOrId('com_perfis')
    perfisCol.listRule =
      "@request.auth.id != '' && @request.auth.perfil_id.slug = 'superadministrador'"
    app.save(perfisCol)

    var ueCol = app.findCollectionByNameOrId('com_usuarios_equipes')
    ueCol.listRule = "@request.auth.id != '' && @request.auth.perfil_id.slug = 'superadministrador'"
    app.save(ueCol)

    var permCol = app.findCollectionByNameOrId('com_permissoes')
    permCol.listRule =
      "@request.auth.id != '' && @request.auth.perfil_id.slug = 'superadministrador'"
    app.save(permCol)

    var paramCol = app.findCollectionByNameOrId('com_parametros')
    paramCol.listRule =
      "@request.auth.id != '' && @request.auth.perfil_id.slug = 'superadministrador'"
    app.save(paramCol)

    var negCol = app.findCollectionByNameOrId('com_negocios')
    negCol.listRule =
      "@request.auth.id != '' && (@request.auth.perfil_id.slug = 'superadministrador' || responsavel_id = @request.auth.id || (@request.auth.equipe_id != '' && equipe_id = @request.auth.equipe_id))"
    app.save(negCol)
  },
  (app) => {
    var perfisCol = app.findCollectionByNameOrId('com_perfis')
    perfisCol.listRule = "@request.auth.id != ''"
    app.save(perfisCol)

    var ueCol = app.findCollectionByNameOrId('com_usuarios_equipes')
    ueCol.listRule = "@request.auth.id != ''"
    app.save(ueCol)

    var permCol = app.findCollectionByNameOrId('com_permissoes')
    permCol.listRule = "@request.auth.id != ''"
    app.save(permCol)

    var paramCol = app.findCollectionByNameOrId('com_parametros')
    paramCol.listRule = "@request.auth.id != ''"
    app.save(paramCol)

    var negCol = app.findCollectionByNameOrId('com_negocios')
    negCol.listRule =
      "@request.auth.id != '' && (@request.auth.perfil_id.slug = 'superadministrador' || responsavel_id = @request.auth.id || (@request.auth.equipe_id != '' && equipe_id = @request.auth.equipe_id))"
    app.save(negCol)
  },
)
