migrate(
  (app) => {
    var permCol = app.findCollectionByNameOrId('com_permissoes')
    var perfilPermCol = app.findCollectionByNameOrId('com_perfil_permissoes')

    var newPerms = [
      {
        nome: 'Visualizar Contatos',
        slug: 'contatos.view',
        recurso: 'contatos',
        acao: 'view',
        descricao: 'Visualizar contatos',
      },
      {
        nome: 'Criar Contatos',
        slug: 'contatos.create',
        recurso: 'contatos',
        acao: 'create',
        descricao: 'Criar contatos',
      },
      {
        nome: 'Editar Contatos',
        slug: 'contatos.update',
        recurso: 'contatos',
        acao: 'update',
        descricao: 'Editar contatos',
      },
      {
        nome: 'Visualizar Etapas',
        slug: 'etapas.view',
        recurso: 'etapas',
        acao: 'view',
        descricao: 'Visualizar etapas',
      },
      {
        nome: 'Criar Etapas',
        slug: 'etapas.create',
        recurso: 'etapas',
        acao: 'create',
        descricao: 'Criar etapas',
      },
      {
        nome: 'Editar Etapas',
        slug: 'etapas.update',
        recurso: 'etapas',
        acao: 'update',
        descricao: 'Editar etapas',
      },
      {
        nome: 'Visualizar Alias Dimensoes',
        slug: 'alias_dimensoes.view',
        recurso: 'alias_dimensoes',
        acao: 'view',
        descricao: 'Visualizar mapeamento de alias e dimensoes',
      },
      {
        nome: 'Criar Alias Dimensoes',
        slug: 'alias_dimensoes.create',
        recurso: 'alias_dimensoes',
        acao: 'create',
        descricao: 'Criar mapeamento de alias e dimensoes',
      },
      {
        nome: 'Editar Alias Dimensoes',
        slug: 'alias_dimensoes.update',
        recurso: 'alias_dimensoes',
        acao: 'update',
        descricao: 'Editar mapeamento de alias e dimensoes',
      },
      {
        nome: 'Visualizar Vinculos Externos',
        slug: 'vinculos_externos.view',
        recurso: 'vinculos_externos',
        acao: 'view',
        descricao: 'Visualizar vinculos externos',
      },
      {
        nome: 'Criar Vinculos Externos',
        slug: 'vinculos_externos.create',
        recurso: 'vinculos_externos',
        acao: 'create',
        descricao: 'Criar vinculos externos',
      },
      {
        nome: 'Editar Vinculos Externos',
        slug: 'vinculos_externos.update',
        recurso: 'vinculos_externos',
        acao: 'update',
        descricao: 'Editar vinculos externos',
      },
      {
        nome: 'Visualizar Execucoes Sincronizacao',
        slug: 'execucoes_sincronizacao.view',
        recurso: 'execucoes_sincronizacao',
        acao: 'view',
        descricao: 'Visualizar execucoes de sincronizacao',
      },
      {
        nome: 'Criar Execucoes Sincronizacao',
        slug: 'execucoes_sincronizacao.create',
        recurso: 'execucoes_sincronizacao',
        acao: 'create',
        descricao: 'Criar execucoes de sincronizacao',
      },
      {
        nome: 'Editar Execucoes Sincronizacao',
        slug: 'execucoes_sincronizacao.update',
        recurso: 'execucoes_sincronizacao',
        acao: 'update',
        descricao: 'Editar execucoes de sincronizacao',
      },
      {
        nome: 'Visualizar Eventos Integracao',
        slug: 'eventos_integracao.view',
        recurso: 'eventos_integracao',
        acao: 'view',
        descricao: 'Visualizar eventos de integracao',
      },
      {
        nome: 'Criar Eventos Integracao',
        slug: 'eventos_integracao.create',
        recurso: 'eventos_integracao',
        acao: 'create',
        descricao: 'Criar eventos de integracao',
      },
      {
        nome: 'Editar Eventos Integracao',
        slug: 'eventos_integracao.update',
        recurso: 'eventos_integracao',
        acao: 'update',
        descricao: 'Editar eventos de integracao',
      },
      {
        nome: 'Visualizar Snapshots Negocio',
        slug: 'snapshots_negocio.view',
        recurso: 'snapshots_negocio',
        acao: 'view',
        descricao: 'Visualizar snapshots de negocio',
      },
      {
        nome: 'Criar Snapshots Negocio',
        slug: 'snapshots_negocio.create',
        recurso: 'snapshots_negocio',
        acao: 'create',
        descricao: 'Criar snapshots de negocio',
      },
      {
        nome: 'Visualizar Ocorrencias Qualidade',
        slug: 'ocorrencias_qualidade.view',
        recurso: 'ocorrencias_qualidade',
        acao: 'view',
        descricao: 'Visualizar ocorrencias de qualidade',
      },
      {
        nome: 'Criar Ocorrencias Qualidade',
        slug: 'ocorrencias_qualidade.create',
        recurso: 'ocorrencias_qualidade',
        acao: 'create',
        descricao: 'Criar ocorrencias de qualidade',
      },
      {
        nome: 'Editar Ocorrencias Qualidade',
        slug: 'ocorrencias_qualidade.update',
        recurso: 'ocorrencias_qualidade',
        acao: 'update',
        descricao: 'Editar ocorrencias de qualidade',
      },
    ]

    for (var i = 0; i < newPerms.length; i++) {
      var np = newPerms[i]
      try {
        app.findFirstRecordByData('com_permissoes', 'slug', np.slug)
      } catch (_) {
        var prec = new Record(permCol)
        prec.set('nome', np.nome)
        prec.set('slug', np.slug)
        prec.set('recurso', np.recurso)
        prec.set('acao', np.acao)
        prec.set('descricao', np.descricao)
        app.save(prec)
      }
    }

    function linkPerm(perfilRec, permSlug, escopo) {
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
    var integracao = app.findFirstRecordByData('com_perfis', 'slug', 'integracao')

    for (var j = 0; j < newPerms.length; j++) {
      linkPerm(superadmin, newPerms[j].slug, 'todos')
    }

    var integracaoPerms = [
      'contatos.view',
      'contatos.create',
      'etapas.view',
      'etapas.create',
      'alias_dimensoes.view',
      'alias_dimensoes.create',
      'vinculos_externos.view',
      'vinculos_externos.create',
      'execucoes_sincronizacao.view',
      'execucoes_sincronizacao.create',
      'eventos_integracao.view',
      'eventos_integracao.create',
      'snapshots_negocio.view',
      'snapshots_negocio.create',
      'ocorrencias_qualidade.view',
      'ocorrencias_qualidade.create',
    ]
    for (var k = 0; k < integracaoPerms.length; k++) {
      linkPerm(integracao, integracaoPerms[k], 'todos')
    }
  },
  (app) => {
    var slugsToRemove = [
      'contatos.view',
      'contatos.create',
      'contatos.update',
      'etapas.view',
      'etapas.create',
      'etapas.update',
      'alias_dimensoes.view',
      'alias_dimensoes.create',
      'alias_dimensoes.update',
      'vinculos_externos.view',
      'vinculos_externos.create',
      'vinculos_externos.update',
      'execucoes_sincronizacao.view',
      'execucoes_sincronizacao.create',
      'execucoes_sincronizacao.update',
      'eventos_integracao.view',
      'eventos_integracao.create',
      'eventos_integracao.update',
      'snapshots_negocio.view',
      'snapshots_negocio.create',
      'ocorrencias_qualidade.view',
      'ocorrencias_qualidade.create',
      'ocorrencias_qualidade.update',
    ]
    for (var i = 0; i < slugsToRemove.length; i++) {
      try {
        var perm = app.findFirstRecordByData('com_permissoes', 'slug', slugsToRemove[i])
        var links = app.findRecordsByFilter(
          'com_perfil_permissoes',
          "permissao_id = '" + perm.id + "'",
          '',
          500,
          0,
        )
        for (var j = 0; j < links.length; j++) {
          app.delete(links[j])
        }
        app.delete(perm)
      } catch (_) {}
    }
  },
)
