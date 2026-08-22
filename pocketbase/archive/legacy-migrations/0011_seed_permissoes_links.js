migrate(
  (app) => {
    const permissoesCol = app.findCollectionByNameOrId('com_permissoes')
    const perfilPermCol = app.findCollectionByNameOrId('com_perfil_permissoes')

    const permissoes = [
      {
        nome: 'Visualizar Empresas',
        slug: 'empresas.view',
        recurso: 'empresas',
        acao: 'view',
        descricao: 'Ver empresas',
      },
      {
        nome: 'Criar Empresas',
        slug: 'empresas.create',
        recurso: 'empresas',
        acao: 'create',
        descricao: 'Criar empresas',
      },
      {
        nome: 'Editar Empresas',
        slug: 'empresas.update',
        recurso: 'empresas',
        acao: 'update',
        descricao: 'Editar empresas',
      },
      {
        nome: 'Excluir Empresas',
        slug: 'empresas.delete',
        recurso: 'empresas',
        acao: 'delete',
        descricao: 'Excluir empresas',
      },
      {
        nome: 'Visualizar Negocios',
        slug: 'negocios.view',
        recurso: 'negocios',
        acao: 'view',
        descricao: 'Ver negocios',
      },
      {
        nome: 'Criar Negocios',
        slug: 'negocios.create',
        recurso: 'negocios',
        acao: 'create',
        descricao: 'Criar negocios',
      },
      {
        nome: 'Editar Negocios',
        slug: 'negocios.update',
        recurso: 'negocios',
        acao: 'update',
        descricao: 'Editar negocios',
      },
      {
        nome: 'Excluir Negocios',
        slug: 'negocios.delete',
        recurso: 'negocios',
        acao: 'delete',
        descricao: 'Excluir negocios',
      },
      {
        nome: 'Gerenciar Fundacao',
        slug: 'foundation.manage',
        recurso: 'foundation',
        acao: 'manage',
        descricao: 'Gerenciar fundacao',
      },
    ]

    for (const p of permissoes) {
      try {
        app.findFirstRecordByData('com_permissoes', 'slug', p.slug)
      } catch (_) {
        const rec = new Record(permissoesCol)
        rec.set('nome', p.nome)
        rec.set('slug', p.slug)
        rec.set('recurso', p.recurso)
        rec.set('acao', p.acao)
        rec.set('descricao', p.descricao)
        app.save(rec)
      }
    }

    const adminPerfil = app.findFirstRecordByData('com_perfis', 'slug', 'admin')
    const gerentePerfil = app.findFirstRecordByData('com_perfis', 'slug', 'gerente')
    const consultorPerfil = app.findFirstRecordByData('com_perfis', 'slug', 'consultor')

    function linkPerfil(perfilRec, permissaoSlug, escopo) {
      const permRec = app.findFirstRecordByData('com_permissoes', 'slug', permissaoSlug)
      try {
        app.findFirstRecordByFilter(
          'com_perfil_permissoes',
          "perfil_id = '" + perfilRec.id + "' && permissao_id = '" + permRec.id + "'",
        )
      } catch (_) {
        const rec = new Record(perfilPermCol)
        rec.set('perfil_id', perfilRec.id)
        rec.set('permissao_id', permRec.id)
        rec.set('escopo', escopo)
        app.save(rec)
      }
    }

    for (const p of permissoes) {
      linkPerfil(adminPerfil, p.slug, 'todos')
    }
    linkPerfil(gerentePerfil, 'empresas.view', 'equipe')
    linkPerfil(gerentePerfil, 'empresas.create', 'equipe')
    linkPerfil(gerentePerfil, 'empresas.update', 'equipe')
    linkPerfil(gerentePerfil, 'negocios.view', 'equipe')
    linkPerfil(gerentePerfil, 'negocios.create', 'equipe')
    linkPerfil(gerentePerfil, 'negocios.update', 'equipe')
    linkPerfil(consultorPerfil, 'empresas.view', 'proprios')
    linkPerfil(consultorPerfil, 'empresas.create', 'proprios')
    linkPerfil(consultorPerfil, 'negocios.view', 'proprios')
    linkPerfil(consultorPerfil, 'negocios.create', 'proprios')
  },
  (app) => {
    try {
      app.findRecordsByFilter('com_perfil_permissoes', '').forEach((r) => app.delete(r))
    } catch (_) {}
    try {
      app.findRecordsByFilter('com_permissoes', '').forEach((r) => app.delete(r))
    } catch (_) {}
  },
)
