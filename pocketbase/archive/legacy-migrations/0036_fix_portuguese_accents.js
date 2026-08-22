migrate(
  (app) => {
    var permFixes = {
      'negocios.view': { nome: 'Visualizar Negócios', descricao: 'Visualizar Negócios' },
      'negocios.create': { nome: 'Criar Negócios', descricao: 'Criar Negócios' },
      'negocios.update': { nome: 'Editar Negócios', descricao: 'Editar Negócios' },
      'negocios.inactivate': { nome: 'Inativar Negócios', descricao: 'Inativar Negócios' },
      'usuarios.admin': { nome: 'Administrar Usuários', descricao: 'Administrar Usuários' },
      gerenciar_parametros_notificacoes: {
        nome: 'Gerenciar Parâmetros de Notificações',
        descricao: 'Gerenciar Parâmetros de Notificações',
      },
      'foundation.manage': { nome: 'Gerenciar Fundação', descricao: 'Gerenciar Fundação' },
      'empresas.view': { nome: 'Visualizar Empresas', descricao: 'Visualizar Empresas' },
      'empresas.create': { nome: 'Criar Empresas', descricao: 'Criar Empresas' },
      'empresas.update': { nome: 'Editar Empresas', descricao: 'Editar Empresas' },
      'empresas.inactivate': { nome: 'Inativar Empresas', descricao: 'Inativar Empresas' },
      'equipes.admin': { nome: 'Administrar Equipes', descricao: 'Administrar Equipes' },
      'perfis.admin': { nome: 'Administrar Perfis', descricao: 'Administrar Perfis' },
      'permissoes.admin': {
        nome: 'Administrar Permissões',
        descricao: 'Administrar Permissões',
      },
      'vinculos.admin': { nome: 'Administrar Vínculos', descricao: 'Administrar Vínculos' },
      'parametros.gerenciar': {
        nome: 'Gerenciar Parâmetros',
        descricao: 'Gerenciar Parâmetros',
      },
      'dashboard.view': { nome: 'Visualizar Dashboard', descricao: 'Visualizar Dashboard' },
      'excecoes.aprovar': { nome: 'Aprovar Exceções', descricao: 'Aprovar Exceções' },
      'auditoria.consultar': {
        nome: 'Consultar Logs e Auditoria',
        descricao: 'Consultar Logs e Auditoria',
      },
    }

    for (var slug in permFixes) {
      try {
        var rec = app.findFirstRecordByData('com_permissoes', 'slug', slug)
        var fix = permFixes[slug]
        rec.set('nome', fix.nome)
        rec.set('descricao', fix.descricao)
        app.save(rec)
      } catch (_) {}
    }

    var profileFixes = {
      superadministrador: 'Acesso total ao sistema',
      'gestor-comercial': 'Gestão da equipe comercial',
      'operador-comercial': 'Operação comercial',
      prospeccao: 'Equipe de prospecção',
      aprovador: 'Aprovação de exceções',
      'leitura-executiva': 'Acesso somente leitura para executivos',
      integracao: 'Perfil técnico para homologação de integrações',
    }

    for (var pSlug in profileFixes) {
      try {
        var pRec = app.findFirstRecordByData('com_perfis', 'slug', pSlug)
        pRec.set('descricao', profileFixes[pSlug])
        app.save(pRec)
      } catch (_) {}
    }

    var negocioFixes = {
      'Negocio A - Proprio [TESTE]': 'Negócio A - Próprio [TESTE]',
      'Negocio B - Equipe [TESTE]': 'Negócio B - Equipe [TESTE]',
      'Negocio C - Outra Equipe [TESTE]': 'Negócio C - Outra Equipe [TESTE]',
      'Negocio D - Inativo [TESTE]': 'Negócio D - Inativo [TESTE]',
    }

    try {
      var allNegocios = app.findRecordsByFilter('com_negocios', '', '-created', 500, 0)
      for (var n = 0; n < allNegocios.length; n++) {
        var title = allNegocios[n].getString('titulo')
        if (negocioFixes[title]) {
          allNegocios[n].set('titulo', negocioFixes[title])
          app.save(allNegocios[n])
        }
      }
    } catch (_) {}

    var paramFixes = {
      'comercial.etapa_padrao': {
        descricao: 'Etapa padrão para novos negócios [TESTE]',
        justificativa: 'Parâmetro inicial de etapa padrão [TESTE]',
      },
      'comercial.status_padrao': {
        justificativa: 'Substituído por comercial.etapa_padrao [TESTE]',
      },
    }

    for (var chave in paramFixes) {
      try {
        var param = app.findFirstRecordByData('com_parametros', 'chave', chave)
        var fix = paramFixes[chave]
        if (fix.descricao) param.set('descricao', fix.descricao)
        if (fix.justificativa) param.set('justificativa', fix.justificativa)
        app.save(param)
      } catch (_) {}
    }

    try {
      var versoes = app.findRecordsByFilter('com_parametros_versoes', '', '-created', 500, 0)
      for (var v = 0; v < versoes.length; v++) {
        var just = versoes[v].getString('justificativa')
        if (just === 'Substituido por comercial.etapa_padrao [TESTE]') {
          versoes[v].set('justificativa', 'Substituído por comercial.etapa_padrao [TESTE]')
          app.save(versoes[v])
        }
        var vDesc = versoes[v].getString('descricao')
        if (vDesc === 'Etapa padrao para novos negocios [TESTE]') {
          versoes[v].set('descricao', 'Etapa padrão para novos negócios [TESTE]')
          app.save(versoes[v])
        }
      }
    } catch (_) {}
  },
  (app) => {},
)
