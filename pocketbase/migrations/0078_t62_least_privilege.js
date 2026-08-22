migrate(
  (app) => {
    var perfis = app.findCollectionByNameOrId('com_perfis')
    var perfilPermissoes = app.findCollectionByNameOrId('com_perfil_permissoes')
    var perfil
    try {
      perfil = app.findFirstRecordByData('com_perfis', 'slug', 'negociacao-propria')
    } catch (_) {
      perfil = new Record(perfis)
      perfil.set('nome', 'Negociação Própria')
      perfil.set('slug', 'negociacao-propria')
      perfil.set(
        'descricao',
        'Acompanhamento somente leitura da negociação e alertas dos próprios negócios',
      )
      perfil.set('ativo', true)
      app.save(perfil)
    }

    var slugs = ['empresas.view', 'negocios.view', 'dashboard.view']
    for (var i = 0; i < slugs.length; i++) {
      var permissao = app.findFirstRecordByData('com_permissoes', 'slug', slugs[i])
      try {
        app.findFirstRecordByFilter(
          'com_perfil_permissoes',
          "perfil_id = '" + perfil.id + "' && permissao_id = '" + permissao.id + "'",
        )
      } catch (_) {
        var vinculo = new Record(perfilPermissoes)
        vinculo.set('perfil_id', perfil.id)
        vinculo.set('permissao_id', permissao.id)
        vinculo.set('escopo', 'proprios')
        app.save(vinculo)
      }
    }

    var shirleide = app.findAuthRecordByEmail('users', 'comercial06@pmaisservicos.com.br')
    shirleide.set('perfil_id', perfil.id)
    app.save(shirleide)

    var bindings = app.findRecordsByFilter(
      'com_usuarios_equipes',
      "usuario_id = '" + shirleide.id + "'",
      '',
      50,
      0,
    )
    for (var b = 0; b < bindings.length; b++) {
      bindings[b].set('perfil_id', perfil.id)
      bindings[b].set('escopo', 'proprios')
      app.save(bindings[b])
    }

    var users = app.findCollectionByNameOrId('users')
    users.listRule = "@request.auth.id != '' && @request.auth.perfil_id.slug = 'superadministrador'"
    users.viewRule =
      "@request.auth.id != '' && (@request.auth.id = id || @request.auth.perfil_id.slug = 'superadministrador')"
    app.save(users)

    var auditoria = app.findCollectionByNameOrId('com_auditoria')
    var auditProfiles =
      "(@request.auth.perfil_id.slug = 'superadministrador' || @request.auth.perfil_id.slug = 'gestor-comercial' || @request.auth.perfil_id.slug = 'aprovador' || @request.auth.perfil_id.slug = 'leitura-executiva')"
    auditoria.listRule = "@request.auth.id != '' && " + auditProfiles
    auditoria.viewRule = "@request.auth.id != '' && " + auditProfiles
    app.save(auditoria)
  },
  (app) => {
    try {
      var operador = app.findFirstRecordByData('com_perfis', 'slug', 'operador-comercial')
      var shirleide = app.findAuthRecordByEmail('users', 'comercial06@pmaisservicos.com.br')
      shirleide.set('perfil_id', operador.id)
      app.save(shirleide)
      var bindings = app.findRecordsByFilter(
        'com_usuarios_equipes',
        "usuario_id = '" + shirleide.id + "'",
        '',
        50,
        0,
      )
      for (var b = 0; b < bindings.length; b++) {
        bindings[b].set('perfil_id', operador.id)
        bindings[b].set('escopo', 'proprios')
        app.save(bindings[b])
      }
    } catch (_) {}

    var users = app.findCollectionByNameOrId('users')
    users.listRule = "@request.auth.id != ''"
    users.viewRule = "@request.auth.id != ''"
    app.save(users)

    var auditoria = app.findCollectionByNameOrId('com_auditoria')
    auditoria.listRule = "@request.auth.id != ''"
    auditoria.viewRule = "@request.auth.id != ''"
    app.save(auditoria)
  },
)
