migrate(
  (app) => {
    var now = new Date().toISOString().split('T')[0]

    // === 1. Fix com_usuarios_equipes: add vigencia fields, update unique index ===
    var ueCol = app.findCollectionByNameOrId('com_usuarios_equipes')
    if (!ueCol.fields.getByName('inicio_vigencia')) {
      ueCol.fields.add(new DateField({ name: 'inicio_vigencia' }))
    }
    if (!ueCol.fields.getByName('fim_vigencia')) {
      ueCol.fields.add(new DateField({ name: 'fim_vigencia' }))
    }
    try {
      ueCol.removeIndex('idx_com_usuarios_equipes_usuario_equipe')
    } catch (_) {}
    try {
      ueCol.removeIndex('idx_com_usuarios_equipes_usuario_equipe_perfil')
    } catch (_) {}
    ueCol.addIndex(
      'idx_com_usuarios_equipes_usuario_equipe_perfil',
      true,
      'usuario_id, equipe_id, perfil_id',
      '',
    )
    ueCol.deleteRule = null
    app.save(ueCol)
    app
      .db()
      .newQuery('UPDATE com_usuarios_equipes SET ativo = 1 WHERE ativo = 0 OR ativo IS NULL')
      .execute()
    app
      .db()
      .newQuery(
        "UPDATE com_usuarios_equipes SET inicio_vigencia = {:d} WHERE inicio_vigencia IS NULL OR inicio_vigencia = ''",
      )
      .bind({ d: now })
      .execute()

    // === 2. Ensure 7 canonical profiles exist and are active ===
    var perfisCol = app.findCollectionByNameOrId('com_perfis')
    var canonical = [
      {
        nome: 'Superadministrador',
        slug: 'superadministrador',
        descricao: 'Acesso total ao sistema',
      },
      {
        nome: 'Gestor Comercial',
        slug: 'gestor-comercial',
        descricao: 'Gestao da equipe comercial',
      },
      { nome: 'Operador Comercial', slug: 'operador-comercial', descricao: 'Operacao comercial' },
      { nome: 'Prospeccao', slug: 'prospeccao', descricao: 'Equipe de prospeccao' },
      { nome: 'Aprovador', slug: 'aprovador', descricao: 'Aprovacao de excecoes' },
      {
        nome: 'Leitura Executiva',
        slug: 'leitura-executiva',
        descricao: 'Acesso somente leitura para executivos',
      },
      {
        nome: 'Integracao',
        slug: 'integracao',
        descricao: 'Perfil tecnico para homologacao de integracoes',
      },
    ]
    for (var i = 0; i < canonical.length; i++) {
      var p = canonical[i]
      try {
        var ex = app.findFirstRecordByData('com_perfis', 'slug', p.slug)
        if (!ex.getBool('ativo')) {
          ex.set('ativo', true)
          app.save(ex)
        }
      } catch (_) {
        var rec = new Record(perfisCol)
        rec.set('nome', p.nome)
        rec.set('slug', p.slug)
        rec.set('descricao', p.descricao)
        rec.set('ativo', true)
        app.save(rec)
      }
    }
    var oldSlugs = ['admin', 'gerente', 'consultor']
    for (var j = 0; j < oldSlugs.length; j++) {
      try {
        var old = app.findFirstRecordByData('com_perfis', 'slug', oldSlugs[j])
        if (old.getBool('ativo')) {
          old.set('ativo', false)
          app.save(old)
        }
      } catch (_) {}
    }
    perfisCol.deleteRule = null
    app.save(perfisCol)

    // === 3. Ensure granular permissions exist ===
    var permCol = app.findCollectionByNameOrId('com_permissoes')
    var perms = [
      { nome: 'Visualizar Empresas', slug: 'empresas.view', recurso: 'empresas', acao: 'view' },
      { nome: 'Criar Empresas', slug: 'empresas.create', recurso: 'empresas', acao: 'create' },
      { nome: 'Editar Empresas', slug: 'empresas.update', recurso: 'empresas', acao: 'update' },
      {
        nome: 'Inativar Empresas',
        slug: 'empresas.inactivate',
        recurso: 'empresas',
        acao: 'inactivate',
      },
      { nome: 'Visualizar Negocios', slug: 'negocios.view', recurso: 'negocios', acao: 'view' },
      { nome: 'Criar Negocios', slug: 'negocios.create', recurso: 'negocios', acao: 'create' },
      { nome: 'Editar Negocios', slug: 'negocios.update', recurso: 'negocios', acao: 'update' },
      {
        nome: 'Inativar Negocios',
        slug: 'negocios.inactivate',
        recurso: 'negocios',
        acao: 'inactivate',
      },
      { nome: 'Administrar Usuarios', slug: 'usuarios.admin', recurso: 'usuarios', acao: 'admin' },
      { nome: 'Administrar Equipes', slug: 'equipes.admin', recurso: 'equipes', acao: 'admin' },
      { nome: 'Administrar Perfis', slug: 'perfis.admin', recurso: 'perfis', acao: 'admin' },
      {
        nome: 'Administrar Permissoes',
        slug: 'permissoes.admin',
        recurso: 'permissoes',
        acao: 'admin',
      },
      { nome: 'Administrar Vinculos', slug: 'vinculos.admin', recurso: 'vinculos', acao: 'admin' },
      {
        nome: 'Gerenciar Parametros',
        slug: 'parametros.gerenciar',
        recurso: 'parametros',
        acao: 'gerenciar',
      },
      {
        nome: 'Gerenciar Parametros de Notificacoes',
        slug: 'gerenciar_parametros_notificacoes',
        recurso: 'parametros',
        acao: 'manage_notifications',
      },
      { nome: 'Visualizar Dashboard', slug: 'dashboard.view', recurso: 'dashboard', acao: 'view' },
      { nome: 'Aprovar Excecoes', slug: 'excecoes.aprovar', recurso: 'excecoes', acao: 'aprovar' },
      {
        nome: 'Consultar Logs e Auditoria',
        slug: 'auditoria.consultar',
        recurso: 'auditoria',
        acao: 'consultar',
      },
      {
        nome: 'Gerenciar Fundacao',
        slug: 'foundation.manage',
        recurso: 'foundation',
        acao: 'manage',
      },
    ]
    for (var k = 0; k < perms.length; k++) {
      var np = perms[k]
      try {
        app.findFirstRecordByData('com_permissoes', 'slug', np.slug)
      } catch (_) {
        var pr = new Record(permCol)
        pr.set('nome', np.nome)
        pr.set('slug', np.slug)
        pr.set('recurso', np.recurso)
        pr.set('acao', np.acao)
        pr.set('descricao', np.nome)
        app.save(pr)
      }
    }
    permCol.deleteRule = null
    app.save(permCol)

    // === 4. Remove delete permissions ===
    var delSlugs = ['empresas.delete', 'negocios.delete']
    for (var l = 0; l < delSlugs.length; l++) {
      try {
        var dp = app.findFirstRecordByData('com_permissoes', 'slug', delSlugs[l])
        var dlinks = app.findRecordsByFilter(
          'com_perfil_permissoes',
          "permissao_id = '" + dp.id + "'",
          '',
          500,
          0,
        )
        for (var m = 0; m < dlinks.length; m++) {
          app.delete(dlinks[m])
        }
        app.delete(dp)
      } catch (_) {}
    }

    // === 5. Set deleteRule=null for protected collections ===
    var ppCol = app.findCollectionByNameOrId('com_perfil_permissoes')
    ppCol.deleteRule = null
    app.save(ppCol)
    var eqCol = app.findCollectionByNameOrId('com_equipes')
    eqCol.deleteRule = null
    app.save(eqCol)
    var paCol = app.findCollectionByNameOrId('com_parametros')
    paCol.deleteRule = null
    app.save(paCol)

    // === 6. Migrate business records (status -> etapa/resultado) ===
    app
      .db()
      .newQuery(
        "UPDATE com_negocios SET etapa = 'prospects' WHERE status = 'aberto' AND (etapa IS NULL OR etapa = '')",
      )
      .execute()
    app
      .db()
      .newQuery(
        "UPDATE com_negocios SET etapa = 'negociacao' WHERE status = 'em_andamento' AND (etapa IS NULL OR etapa = '')",
      )
      .execute()
    app
      .db()
      .newQuery(
        "UPDATE com_negocios SET resultado = 'ganho' WHERE status = 'ganho' AND (resultado IS NULL OR resultado = '')",
      )
      .execute()
    app
      .db()
      .newQuery(
        "UPDATE com_negocios SET resultado = 'perdido' WHERE status = 'perdido' AND (resultado IS NULL OR resultado = '')",
      )
      .execute()
    app
      .db()
      .newQuery("UPDATE com_negocios SET status = '' WHERE status IS NOT NULL AND status != ''")
      .execute()

    // === 7. Update status select field (remove aberto, em_andamento) ===
    var negCol = app.findCollectionByNameOrId('com_negocios')
    if (negCol.fields.getByName('status')) {
      negCol.fields.removeByName('status')
      negCol.fields.add(
        new SelectField({
          name: 'status',
          required: false,
          values: ['ganho', 'perdido'],
          maxSelect: 1,
        }),
      )
    }
    app.save(negCol)

    // === 8. Ensure etapa_padrao param exists & active; inactivate status_padrao ===
    var versoesCol = app.findCollectionByNameOrId('com_parametros_versoes')
    var adminUser = app.findAuthRecordByEmail('_pb_users_auth_', 'luiz.moura@pmaisservicos.com.br')
    try {
      var oldParam = app.findFirstRecordByData('com_parametros', 'chave', 'comercial.status_padrao')
      if (oldParam.getBool('ativo')) {
        var vr = new Record(versoesCol)
        vr.set('parametro_id', oldParam.id)
        vr.set('chave', oldParam.getString('chave'))
        vr.set('valor', oldParam.getString('valor'))
        vr.set('descricao', oldParam.getString('descricao'))
        vr.set('tipo', oldParam.getString('tipo') || 'texto')
        vr.set('versao', oldParam.getInt('versao'))
        vr.set('justificativa', 'Substituido por comercial.etapa_padrao [TESTE]')
        app.save(vr)
        app
          .db()
          .newQuery(
            "UPDATE com_parametros SET ativo = 0, versao = versao + 1, justificativa = 'Substituido por comercial.etapa_padrao [TESTE]' WHERE chave = 'comercial.status_padrao'",
          )
          .execute()
      }
    } catch (_) {}
    try {
      app.findFirstRecordByData('com_parametros', 'chave', 'comercial.etapa_padrao')
      var ep = app.findFirstRecordByData('com_parametros', 'chave', 'comercial.etapa_padrao')
      if (!ep.getBool('ativo')) {
        ep.set('ativo', true)
        app.save(ep)
      }
    } catch (_) {
      var np2 = new Record(paCol)
      np2.set('chave', 'comercial.etapa_padrao')
      np2.set('valor', 'prospects')
      np2.set('descricao', 'Etapa padrao para novos negocios [TESTE]')
      np2.set('tipo', 'texto')
      np2.set('versao', 1)
      np2.set('ativo', true)
      np2.set('justificativa', 'Parametro inicial de etapa padrao [TESTE]')
      np2.set('autor_id', adminUser.id)
      app.save(np2)
    }
    app
      .db()
      .newQuery("UPDATE com_parametros SET tipo = 'texto' WHERE tipo IS NULL OR tipo = ''")
      .execute()

    // === 9. Remove negocios.view from integracao profile ===
    try {
      var intPerfil = app.findFirstRecordByData('com_perfis', 'slug', 'integracao')
      var nvPerm = app.findFirstRecordByData('com_permissoes', 'slug', 'negocios.view')
      var nvLinks = app.findRecordsByFilter(
        'com_perfil_permissoes',
        "perfil_id = '" + intPerfil.id + "' && permissao_id = '" + nvPerm.id + "'",
        '',
        500,
        0,
      )
      for (var n = 0; n < nvLinks.length; n++) {
        app.delete(nvLinks[n])
      }
    } catch (_) {}

    // === 10. Ensure perfil_permissoes links are correct ===
    function linkPerm(perfilRec, permSlug, escopo) {
      try {
        var permRec = app.findFirstRecordByData('com_permissoes', 'slug', permSlug)
        try {
          app.findFirstRecordByFilter(
            'com_perfil_permissoes',
            "perfil_id = '" + perfilRec.id + "' && permissao_id = '" + permRec.id + "'",
          )
        } catch (_) {
          var lr = new Record(ppCol)
          lr.set('perfil_id', perfilRec.id)
          lr.set('permissao_id', permRec.id)
          lr.set('escopo', escopo)
          app.save(lr)
        }
      } catch (_) {}
    }
    var sa = app.findFirstRecordByData('com_perfis', 'slug', 'superadministrador')
    var gc = app.findFirstRecordByData('com_perfis', 'slug', 'gestor-comercial')
    var oc = app.findFirstRecordByData('com_perfis', 'slug', 'operador-comercial')
    var pp = app.findFirstRecordByData('com_perfis', 'slug', 'prospeccao')
    var ap = app.findFirstRecordByData('com_perfis', 'slug', 'aprovador')
    var le = app.findFirstRecordByData('com_perfis', 'slug', 'leitura-executiva')
    var ig = app.findFirstRecordByData('com_perfis', 'slug', 'integracao')
    var all = [
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
    for (var o = 0; o < all.length; o++) {
      linkPerm(sa, all[o], 'todos')
    }
    linkPerm(gc, 'empresas.view', 'equipe')
    linkPerm(gc, 'empresas.create', 'equipe')
    linkPerm(gc, 'empresas.update', 'equipe')
    linkPerm(gc, 'empresas.inactivate', 'equipe')
    linkPerm(gc, 'negocios.view', 'equipe')
    linkPerm(gc, 'negocios.create', 'equipe')
    linkPerm(gc, 'negocios.update', 'equipe')
    linkPerm(gc, 'negocios.inactivate', 'equipe')
    linkPerm(gc, 'dashboard.view', 'equipe')
    linkPerm(gc, 'auditoria.consultar', 'equipe')
    linkPerm(oc, 'empresas.view', 'proprios')
    linkPerm(oc, 'empresas.create', 'proprios')
    linkPerm(oc, 'empresas.update', 'proprios')
    linkPerm(oc, 'negocios.view', 'proprios')
    linkPerm(oc, 'negocios.create', 'proprios')
    linkPerm(oc, 'negocios.update', 'proprios')
    linkPerm(oc, 'dashboard.view', 'proprios')
    linkPerm(pp, 'empresas.view', 'proprios')
    linkPerm(pp, 'empresas.create', 'proprios')
    linkPerm(pp, 'negocios.view', 'proprios')
    linkPerm(pp, 'negocios.create', 'proprios')
    linkPerm(pp, 'dashboard.view', 'proprios')
    linkPerm(ap, 'empresas.view', 'todos')
    linkPerm(ap, 'negocios.view', 'todos')
    linkPerm(ap, 'excecoes.aprovar', 'todos')
    linkPerm(ap, 'dashboard.view', 'todos')
    linkPerm(ap, 'auditoria.consultar', 'todos')
    linkPerm(le, 'empresas.view', 'todos')
    linkPerm(le, 'negocios.view', 'todos')
    linkPerm(le, 'dashboard.view', 'todos')
    linkPerm(le, 'auditoria.consultar', 'todos')
    linkPerm(ig, 'empresas.view', 'todos')
  },
  (app) => {},
)
