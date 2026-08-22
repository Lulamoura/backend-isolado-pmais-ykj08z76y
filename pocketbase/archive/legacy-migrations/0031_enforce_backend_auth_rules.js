migrate(
  (app) => {
    var negCol = app.findCollectionByNameOrId('com_negocios')
    negCol.listRule =
      "@request.auth.id != '' && (@request.auth.perfil_id.slug = 'superadministrador' || responsavel_id = @request.auth.id || (@request.auth.equipe_id != '' && equipe_id = @request.auth.equipe_id))"
    negCol.viewRule =
      "@request.auth.id != '' && (@request.auth.perfil_id.slug = 'superadministrador' || responsavel_id = @request.auth.id || (@request.auth.equipe_id != '' && equipe_id = @request.auth.equipe_id))"
    app.save(negCol)

    var perfisCol = app.findCollectionByNameOrId('com_perfis')
    perfisCol.listRule = "@request.auth.id != ''"
    perfisCol.viewRule = "@request.auth.id != ''"
    app.save(perfisCol)

    var ueCol = app.findCollectionByNameOrId('com_usuarios_equipes')
    ueCol.listRule = "@request.auth.id != ''"
    ueCol.viewRule = "@request.auth.id != ''"
    app.save(ueCol)

    var permCol = app.findCollectionByNameOrId('com_permissoes')
    permCol.listRule = "@request.auth.id != ''"
    permCol.viewRule = "@request.auth.id != ''"
    app.save(permCol)

    var paramCol = app.findCollectionByNameOrId('com_parametros')
    paramCol.listRule = "@request.auth.id != ''"
    paramCol.viewRule = "@request.auth.id != ''"
    app.save(paramCol)
  },
  (app) => {
    var negCol = app.findCollectionByNameOrId('com_negocios')
    negCol.listRule =
      "@request.auth.id != '' && (responsavel_id = @request.auth.id || (@request.auth.equipe_id != '' && equipe_id = @request.auth.equipe_id))"
    negCol.viewRule =
      "@request.auth.id != '' && (responsavel_id = @request.auth.id || (@request.auth.equipe_id != '' && equipe_id = @request.auth.equipe_id))"
    app.save(negCol)
  },
)
