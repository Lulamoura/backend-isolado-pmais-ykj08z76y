migrate(
  (app) => {
    var perfisCol = app.findCollectionByNameOrId('com_perfis')
    var permissoesCol = app.findCollectionByNameOrId('com_permissoes')
    var perfilPermCol = app.findCollectionByNameOrId('com_perfil_permissoes')

    var newProfiles = [
      {
        nome: 'Superadministrador',
        slug: 'superadministrador',
        descricao: 'Acesso total ao sistema',
        ativo: true,
      },
      {
        nome: 'Gestor Comercial',
        slug: 'gestor-comercial',
        descricao: 'Gestão da equipe comercial',
        ativo: true,
      },
      {
        nome: 'Operador Comercial',
        slug: 'operador-comercial',
        descricao: 'Operação comercial',
        ativo: true,
      },
      { nome: 'Prospecção', slug: 'prospeccao', descricao: 'Equipe de prospecção', ativo: true },
      { nome: 'Aprovador', slug: 'aprovador', descricao: 'Aprovação de exceções', ativo: true },
      {
        nome: 'Leitura Executiva',
        slug: 'leitura-executiva',
        descricao: 'Acesso somente leitura para executivos',
        ativo: true,
      },
      {
        nome: 'Integração',
        slug: 'integracao',
        descricao: 'Perfil técnico para homologação de integrações',
        ativo: true,
      },
    ]

    for (var i = 0; i < newProfiles.length; i++) {
      var p = newProfiles[i]
      try {
        app.findFirstRecordByData('com_perfis', 'slug', p.slug)
      } catch (_) {
        var rec = new Record(perfisCol)
        rec.set('nome', p.nome)
        rec.set('slug', p.slug)
        rec.set('descricao', p.descricao)
        rec.set('ativo', p.ativo)
        app.save(rec)
      }
    }

    var oldSlugs = ['admin', 'gerente', 'consultor']
    for (var j = 0; j < oldSlugs.length; j++) {
      try {
        var oldRec = app.findFirstRecordByData('com_perfis', 'slug', oldSlugs[j])
        if (oldRec.getBool('ativo')) {
          oldRec.set('ativo', false)
          app.save(oldRec)
        }
      } catch (_) {}
    }

    var profileMap = [
      { old: 'admin', new: 'superadministrador' },
      { old: 'gerente', new: 'gestor-comercial' },
      { old: 'consultor', new: 'operador-comercial' },
    ]

    for (var k = 0; k < profileMap.length; k++) {
      var oldSlug = profileMap[k].old
      var newSlug = profileMap[k].new
      try {
        var oldPerfil = app.findFirstRecordByData('com_perfis', 'slug', oldSlug)
        var newPerfil = app.findFirstRecordByData('com_perfis', 'slug', newSlug)

        var permLinks = app.findRecordsByFilter(
          'com_perfil_permissoes',
          "perfil_id = '" + oldPerfil.id + "'",
          '',
          500,
          0,
        )
        for (var m = 0; m < permLinks.length; m++) {
          var link = permLinks[m]
          var permId = link.getString('permissao_id')
          var escopo = link.getString('escopo')
          try {
            app.findFirstRecordByFilter(
              'com_perfil_permissoes',
              "perfil_id = '" + newPerfil.id + "' && permissao_id = '" + permId + "'",
            )
          } catch (_) {
            var newLink = new Record(perfilPermCol)
            newLink.set('perfil_id', newPerfil.id)
            newLink.set('permissao_id', permId)
            newLink.set('escopo', escopo)
            app.save(newLink)
          }
        }

        var userLinks = app.findRecordsByFilter(
          'com_usuarios_equipes',
          "perfil_id = '" + oldPerfil.id + "'",
          '',
          500,
          0,
        )
        for (var n = 0; n < userLinks.length; n++) {
          userLinks[n].set('perfil_id', newPerfil.id)
          app.save(userLinks[n])
        }

        var users = app.findRecordsByFilter(
          'users',
          "perfil_id = '" + oldPerfil.id + "'",
          '',
          500,
          0,
        )
        for (var o = 0; o < users.length; o++) {
          users[o].set('perfil_id', newPerfil.id)
          app.save(users[o])
        }
      } catch (_) {}
    }

    app
      .db()
      .newQuery(
        "UPDATE com_permissoes SET nome = 'Visualizar Negócios', descricao = 'Visualizar negócios' WHERE slug = 'negocios.view'",
      )
      .execute()
    app
      .db()
      .newQuery(
        "UPDATE com_permissoes SET nome = 'Criar Negócios', descricao = 'Criar negócios' WHERE slug = 'negocios.create'",
      )
      .execute()
    app
      .db()
      .newQuery(
        "UPDATE com_permissoes SET nome = 'Editar Negócios', descricao = 'Editar negócios' WHERE slug = 'negocios.update'",
      )
      .execute()
    app
      .db()
      .newQuery(
        "UPDATE com_permissoes SET nome = 'Gerenciar Fundação', descricao = 'Gerenciar fundação' WHERE slug = 'foundation.manage'",
      )
      .execute()
    app
      .db()
      .newQuery(
        "UPDATE com_permissoes SET nome = 'Gerenciar Parâmetros de Notificações', descricao = 'Gerenciar parâmetros de notificações e escalonamentos' WHERE slug = 'gerenciar_parametros_notificacoes'",
      )
      .execute()

    var newPermissions = [
      {
        nome: 'Inativar Empresas',
        slug: 'empresas.inactivate',
        recurso: 'empresas',
        acao: 'inactivate',
        descricao: 'Inativar empresas',
      },
      {
        nome: 'Inativar Negócios',
        slug: 'negocios.inactivate',
        recurso: 'negocios',
        acao: 'inactivate',
        descricao: 'Inativar negócios',
      },
      {
        nome: 'Administrar Usuários',
        slug: 'usuarios.admin',
        recurso: 'usuarios',
        acao: 'admin',
        descricao: 'Administrar usuários',
      },
      {
        nome: 'Administrar Equipes',
        slug: 'equipes.admin',
        recurso: 'equipes',
        acao: 'admin',
        descricao: 'Administrar equipes',
      },
      {
        nome: 'Administrar Perfis',
        slug: 'perfis.admin',
        recurso: 'perfis',
        acao: 'admin',
        descricao: 'Administrar perfis',
      },
      {
        nome: 'Administrar Permissões',
        slug: 'permissoes.admin',
        recurso: 'permissoes',
        acao: 'admin',
        descricao: 'Administrar permissões',
      },
      {
        nome: 'Administrar Vínculos',
        slug: 'vinculos.admin',
        recurso: 'vinculos',
        acao: 'admin',
        descricao: 'Administrar vínculos',
      },
      {
        nome: 'Gerenciar Parâmetros',
        slug: 'parametros.gerenciar',
        recurso: 'parametros',
        acao: 'gerenciar',
        descricao: 'Gerenciar parâmetros',
      },
      {
        nome: 'Visualizar Dashboard',
        slug: 'dashboard.view',
        recurso: 'dashboard',
        acao: 'view',
        descricao: 'Visualizar dashboard',
      },
      {
        nome: 'Aprovar Exceções',
        slug: 'excecoes.aprovar',
        recurso: 'excecoes',
        acao: 'aprovar',
        descricao: 'Aprovar exceções',
      },
      {
        nome: 'Consultar Logs e Auditoria',
        slug: 'auditoria.consultar',
        recurso: 'auditoria',
        acao: 'consultar',
        descricao: 'Consultar logs e auditoria',
      },
    ]

    for (var q = 0; q < newPermissions.length; q++) {
      var np = newPermissions[q]
      try {
        app.findFirstRecordByData('com_permissoes', 'slug', np.slug)
      } catch (_) {
        var prec = new Record(permissoesCol)
        prec.set('nome', np.nome)
        prec.set('slug', np.slug)
        prec.set('recurso', np.recurso)
        prec.set('acao', np.acao)
        prec.set('descricao', np.descricao)
        app.save(prec)
      }
    }

    var deletePermSlugs = ['empresas.delete', 'negocios.delete']
    for (var r = 0; r < deletePermSlugs.length; r++) {
      try {
        var delPerm = app.findFirstRecordByData('com_permissoes', 'slug', deletePermSlugs[r])
        var delLinks = app.findRecordsByFilter(
          'com_perfil_permissoes',
          "permissao_id = '" + delPerm.id + "'",
          '',
          500,
          0,
        )
        for (var s = 0; s < delLinks.length; s++) {
          app.delete(delLinks[s])
        }
      } catch (_) {}
    }

    var linkPerm = function (perfilRec, permSlug, escopo) {
      try {
        var permRec = app.findFirstRecordByData('com_permissoes', 'slug', permSlug)
        try {
          app.findFirstRecordByFilter(
            'com_perfil_permissoes',
            "perfil_id = '" + perfilRec.id + "' && permissao_id = '" + permRec.id + "'",
          )
        } catch (_) {
          var lr = new Record(perfilPermCol)
          lr.set('perfil_id', perfilRec.id)
          lr.set('permissao_id', permRec.id)
          lr.set('escopo', escopo)
          app.save(lr)
        }
      } catch (_) {}
    }

    var superadmin = app.findFirstRecordByData('com_perfis', 'slug', 'superadministrador')
    var gestor = app.findFirstRecordByData('com_perfis', 'slug', 'gestor-comercial')
    var operador = app.findFirstRecordByData('com_perfis', 'slug', 'operador-comercial')
    var prospeccao = app.findFirstRecordByData('com_perfis', 'slug', 'prospeccao')
    var aprovador = app.findFirstRecordByData('com_perfis', 'slug', 'aprovador')
    var leitura = app.findFirstRecordByData('com_perfis', 'slug', 'leitura-executiva')
    var integracao = app.findFirstRecordByData('com_perfis', 'slug', 'integracao')

    var allPermSlugs = [
      'empresas.view',
      'empresas.create',
      'empresas.update',
      'empresas.inactivate',
      'negocios.view',
      'negocios.create',
      'negocios.update',
      'negocios.inactivate',
      'usuarios.admin',
      'equipes.admin',
      'perfis.admin',
      'permissoes.admin',
      'vinculos.admin',
      'parametros.gerenciar',
      'gerenciar_parametros_notificacoes',
      'dashboard.view',
      'excecoes.aprovar',
      'auditoria.consultar',
      'foundation.manage',
    ]
    for (var t = 0; t < allPermSlugs.length; t++) {
      linkPerm(superadmin, allPermSlugs[t], 'todos')
    }

    linkPerm(gestor, 'empresas.view', 'equipe')
    linkPerm(gestor, 'empresas.create', 'equipe')
    linkPerm(gestor, 'empresas.update', 'equipe')
    linkPerm(gestor, 'empresas.inactivate', 'equipe')
    linkPerm(gestor, 'negocios.view', 'equipe')
    linkPerm(gestor, 'negocios.create', 'equipe')
    linkPerm(gestor, 'negocios.update', 'equipe')
    linkPerm(gestor, 'negocios.inactivate', 'equipe')
    linkPerm(gestor, 'dashboard.view', 'equipe')
    linkPerm(gestor, 'auditoria.consultar', 'equipe')

    linkPerm(operador, 'empresas.view', 'proprios')
    linkPerm(operador, 'empresas.create', 'proprios')
    linkPerm(operador, 'empresas.update', 'proprios')
    linkPerm(operador, 'negocios.view', 'proprios')
    linkPerm(operador, 'negocios.create', 'proprios')
    linkPerm(operador, 'negocios.update', 'proprios')
    linkPerm(operador, 'dashboard.view', 'proprios')

    linkPerm(prospeccao, 'empresas.view', 'proprios')
    linkPerm(prospeccao, 'empresas.create', 'proprios')
    linkPerm(prospeccao, 'negocios.view', 'proprios')
    linkPerm(prospeccao, 'negocios.create', 'proprios')
    linkPerm(prospeccao, 'dashboard.view', 'proprios')

    linkPerm(aprovador, 'empresas.view', 'todos')
    linkPerm(aprovador, 'negocios.view', 'todos')
    linkPerm(aprovador, 'excecoes.aprovar', 'todos')
    linkPerm(aprovador, 'dashboard.view', 'todos')
    linkPerm(aprovador, 'auditoria.consultar', 'todos')

    linkPerm(leitura, 'empresas.view', 'todos')
    linkPerm(leitura, 'negocios.view', 'todos')
    linkPerm(leitura, 'dashboard.view', 'todos')
    linkPerm(leitura, 'auditoria.consultar', 'todos')

    linkPerm(integracao, 'empresas.view', 'todos')
    linkPerm(integracao, 'negocios.view', 'todos')

    try {
      var notifPerm = app.findFirstRecordByData(
        'com_permissoes',
        'slug',
        'gerenciar_parametros_notificacoes',
      )
      var notifLinks = app.findRecordsByFilter(
        'com_perfil_permissoes',
        "permissao_id = '" + notifPerm.id + "'",
        '',
        500,
        0,
      )
      for (var u = 0; u < notifLinks.length; u++) {
        if (notifLinks[u].getString('perfil_id') !== superadmin.id) {
          app.delete(notifLinks[u])
        }
      }
    } catch (_) {}
  },
  (app) => {
    var oldSlugs = ['admin', 'gerente', 'consultor']
    for (var i = 0; i < oldSlugs.length; i++) {
      try {
        var rec = app.findFirstRecordByData('com_perfis', 'slug', oldSlugs[i])
        rec.set('ativo', true)
        app.save(rec)
      } catch (_) {}
    }
    var newSlugs = [
      'superadministrador',
      'gestor-comercial',
      'operador-comercial',
      'prospeccao',
      'aprovador',
      'leitura-executiva',
      'integracao',
    ]
    for (var j = 0; j < newSlugs.length; j++) {
      try {
        var rec2 = app.findFirstRecordByData('com_perfis', 'slug', newSlugs[j])
        app.delete(rec2)
      } catch (_) {}
    }
  },
)
