migrate(
  (app) => {
    const usersCol = app.findCollectionByNameOrId('users')
    usersCol.listRule = "@request.auth.id != ''"
    usersCol.viewRule = "@request.auth.id != ''"
    usersCol.createRule = "@request.auth.id != ''"
    app.save(usersCol)

    const permissoesCol = app.findCollectionByNameOrId('com_permissoes')
    try {
      app.findFirstRecordByData('com_permissoes', 'slug', 'gerenciar_parametros_notificacoes')
    } catch (_) {
      const rec = new Record(permissoesCol)
      rec.set('nome', 'Gerenciar Parametros de Notificacoes')
      rec.set('slug', 'gerenciar_parametros_notificacoes')
      rec.set('recurso', 'parametros')
      rec.set('acao', 'manage_notifications')
      rec.set('descricao', 'Gerenciar parametros de notificacoes e escalonamentos')
      app.save(rec)
    }

    const adminPerfil = app.findFirstRecordByData('com_perfis', 'slug', 'admin')
    const permRec = app.findFirstRecordByData(
      'com_permissoes',
      'slug',
      'gerenciar_parametros_notificacoes',
    )
    const perfilPermCol = app.findCollectionByNameOrId('com_perfil_permissoes')

    try {
      app.findFirstRecordByFilter(
        'com_perfil_permissoes',
        "perfil_id = '" + adminPerfil.id + "' && permissao_id = '" + permRec.id + "'",
      )
    } catch (_) {
      const link = new Record(perfilPermCol)
      link.set('perfil_id', adminPerfil.id)
      link.set('permissao_id', permRec.id)
      link.set('escopo', 'todos')
      app.save(link)
    }
  },
  (app) => {
    try {
      const usersCol = app.findCollectionByNameOrId('users')
      usersCol.listRule = 'id = @request.auth.id'
      usersCol.viewRule = 'id = @request.auth.id'
      usersCol.createRule = ''
      app.save(usersCol)
    } catch (_) {}
    try {
      const permRec = app.findFirstRecordByData(
        'com_permissoes',
        'slug',
        'gerenciar_parametros_notificacoes',
      )
      try {
        const links = app.findRecordsByFilter(
          'com_perfil_permissoes',
          "permissao_id = '" + permRec.id + "'",
        )
        links.forEach((r) => app.delete(r))
      } catch (_) {}
      app.delete(permRec)
    } catch (_) {}
  },
)
