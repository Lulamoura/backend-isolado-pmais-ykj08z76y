migrate(
  (app) => {
    var perfisCol = app.findCollectionByNameOrId('com_perfis')
    var permCol = app.findCollectionByNameOrId('com_permissoes')
    var perfilPermCol = app.findCollectionByNameOrId('com_perfil_permissoes')

    var integracaoProfile
    try {
      integracaoProfile = app.findFirstRecordByData('com_perfis', 'slug', 'integracao')
      if (!integracaoProfile.getBool('ativo')) {
        integracaoProfile.set('ativo', true)
        app.save(integracaoProfile)
      }
    } catch (_) {
      integracaoProfile = new Record(perfisCol)
      integracaoProfile.set('nome', 'Integração')
      integracaoProfile.set('slug', 'integracao')
      integracaoProfile.set('descricao', 'Perfil técnico para homologação de integrações')
      integracaoProfile.set('ativo', true)
      app.save(integracaoProfile)
    }

    var expectedSlugs = [
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
      'ocorrencias_qualidade.view',
      'ocorrencias_qualidade.create',
    ]

    var permDefs = {
      'contatos.view': {
        nome: 'Visualizar Contatos',
        recurso: 'contatos',
        acao: 'view',
        descricao: 'Visualizar contatos',
      },
      'contatos.create': {
        nome: 'Criar Contatos',
        recurso: 'contatos',
        acao: 'create',
        descricao: 'Criar contatos',
      },
      'etapas.view': {
        nome: 'Visualizar Etapas',
        recurso: 'etapas',
        acao: 'view',
        descricao: 'Visualizar etapas',
      },
      'etapas.create': {
        nome: 'Criar Etapas',
        recurso: 'etapas',
        acao: 'create',
        descricao: 'Criar etapas',
      },
      'alias_dimensoes.view': {
        nome: 'Visualizar Alias Dimensoes',
        recurso: 'alias_dimensoes',
        acao: 'view',
        descricao: 'Visualizar mapeamento de alias e dimensoes',
      },
      'alias_dimensoes.create': {
        nome: 'Criar Alias Dimensoes',
        recurso: 'alias_dimensoes',
        acao: 'create',
        descricao: 'Criar mapeamento de alias e dimensoes',
      },
      'vinculos_externos.view': {
        nome: 'Visualizar Vinculos Externos',
        recurso: 'vinculos_externos',
        acao: 'view',
        descricao: 'Visualizar vinculos externos',
      },
      'vinculos_externos.create': {
        nome: 'Criar Vinculos Externos',
        recurso: 'vinculos_externos',
        acao: 'create',
        descricao: 'Criar vinculos externos',
      },
      'execucoes_sincronizacao.view': {
        nome: 'Visualizar Execucoes Sincronizacao',
        recurso: 'execucoes_sincronizacao',
        acao: 'view',
        descricao: 'Visualizar execucoes de sincronizacao',
      },
      'execucoes_sincronizacao.create': {
        nome: 'Criar Execucoes Sincronizacao',
        recurso: 'execucoes_sincronizacao',
        acao: 'create',
        descricao: 'Criar execucoes de sincronizacao',
      },
      'eventos_integracao.view': {
        nome: 'Visualizar Eventos Integracao',
        recurso: 'eventos_integracao',
        acao: 'view',
        descricao: 'Visualizar eventos de integracao',
      },
      'eventos_integracao.create': {
        nome: 'Criar Eventos Integracao',
        recurso: 'eventos_integracao',
        acao: 'create',
        descricao: 'Criar eventos de integracao',
      },
      'snapshots_negocio.view': {
        nome: 'Visualizar Snapshots Negocio',
        recurso: 'snapshots_negocio',
        acao: 'view',
        descricao: 'Visualizar snapshots de negocio',
      },
      'ocorrencias_qualidade.view': {
        nome: 'Visualizar Ocorrencias Qualidade',
        recurso: 'ocorrencias_qualidade',
        acao: 'view',
        descricao: 'Visualizar ocorrencias de qualidade',
      },
      'ocorrencias_qualidade.create': {
        nome: 'Criar Ocorrencias Qualidade',
        recurso: 'ocorrencias_qualidade',
        acao: 'create',
        descricao: 'Criar ocorrencias de qualidade',
      },
    }

    for (var i = 0; i < expectedSlugs.length; i++) {
      var slug = expectedSlugs[i]
      try {
        app.findFirstRecordByData('com_permissoes', 'slug', slug)
      } catch (_) {
        var def = permDefs[slug]
        var prec = new Record(permCol)
        prec.set('nome', def.nome)
        prec.set('slug', slug)
        prec.set('recurso', def.recurso)
        prec.set('acao', def.acao)
        prec.set('descricao', def.descricao)
        app.save(prec)
      }
    }

    var expectedPermIds = {}
    for (var j = 0; j < expectedSlugs.length; j++) {
      try {
        var perm = app.findFirstRecordByData('com_permissoes', 'slug', expectedSlugs[j])
        expectedPermIds[perm.id] = true
        try {
          app.findFirstRecordByFilter(
            'com_perfil_permissoes',
            "perfil_id = '" + integracaoProfile.id + "' && permissao_id = '" + perm.id + "'",
          )
        } catch (_) {
          var link = new Record(perfilPermCol)
          link.set('perfil_id', integracaoProfile.id)
          link.set('permissao_id', perm.id)
          link.set('escopo', 'todos')
          app.save(link)
        }
      } catch (_) {}
    }

    var existingLinks = app.findRecordsByFilter(
      'com_perfil_permissoes',
      "perfil_id = '" + integracaoProfile.id + "'",
      '',
      500,
      0,
    )
    var removedSlugs = []
    for (var k = 0; k < existingLinks.length; k++) {
      var linkPermId = existingLinks[k].getString('permissao_id')
      if (!expectedPermIds[linkPermId]) {
        try {
          var rp = app.findRecordById('com_permissoes', linkPermId)
          removedSlugs.push(rp.getString('slug'))
        } catch (_) {}
        app.delete(existingLinks[k])
      }
    }

    console.log('=== 0058: integracao profile permission matrix aligned ===')
    console.log('Expected: ' + expectedSlugs.join(', '))
    console.log(
      'Removed exceeding: ' + (removedSlugs.length > 0 ? removedSlugs.join(', ') : 'none'),
    )
  },
  (app) => {
    console.log('=== 0058 DOWN: no-op (permission matrix adjustment not reverted) ===')
  },
)
