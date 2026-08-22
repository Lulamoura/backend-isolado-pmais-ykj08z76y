migrate(
  (app) => {
    var col = app.findCollectionByNameOrId('com_negocios')
    col.listRule =
      "@request.auth.id != '' && inativo != true && (" +
      "@request.auth.perfil_id.slug = 'superadministrador' || " +
      "@request.auth.perfil_id.slug = 'aprovador' || " +
      "@request.auth.perfil_id.slug = 'leitura-executiva' || " +
      "(@request.auth.perfil_id.slug = 'gestor-comercial' && (responsavel_id = @request.auth.id || (@request.auth.equipe_id != '' && equipe_id = @request.auth.equipe_id))) || " +
      "((@request.auth.perfil_id.slug = 'operador-comercial' || @request.auth.perfil_id.slug = 'prospeccao') && responsavel_id = @request.auth.id)" +
      ')'
    app.save(col)
  },
  (app) => {
    var col = app.findCollectionByNameOrId('com_negocios')
    col.listRule =
      "@request.auth.id != '' && (@request.auth.perfil_id.slug = 'superadministrador' || responsavel_id = @request.auth.id || (@request.auth.equipe_id != '' && equipe_id = @request.auth.equipe_id))"
    app.save(col)
  },
)
