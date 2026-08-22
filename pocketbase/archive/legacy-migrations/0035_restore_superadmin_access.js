migrate(
  (app) => {
    var usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    var perfisCol = app.findCollectionByNameOrId('com_perfis')
    var equipesCol = app.findCollectionByNameOrId('com_equipes')
    var ueCol = app.findCollectionByNameOrId('com_usuarios_equipes')
    var permCol = app.findCollectionByNameOrId('com_permissoes')
    var ppCol = app.findCollectionByNameOrId('com_perfil_permissoes')

    // 1. Get or create Superadministrador profile
    var saPerfil
    try {
      saPerfil = app.findFirstRecordByData('com_perfis', 'slug', 'superadministrador')
    } catch (_) {
      saPerfil = new Record(perfisCol)
      saPerfil.set('nome', 'Superadministrador')
      saPerfil.set('slug', 'superadministrador')
      saPerfil.set('descricao', 'Acesso total ao sistema')
      saPerfil.set('ativo', true)
      app.save(saPerfil)
    }

    if (!saPerfil.getBool('ativo')) {
      saPerfil.set('ativo', true)
      app.save(saPerfil)
    }

    // 2. Get or create default equipe
    var mainEquipe
    try {
      mainEquipe = app.findFirstRecordByData('com_equipes', 'slug', 'equipe-alpha-teste')
    } catch (_) {
      try {
        var equipes = app.findRecordsByFilter('com_equipes', 'ativo = true', '', 1, 0)
        if (equipes.length > 0) mainEquipe = equipes[0]
      } catch (_) {}
    }
    if (!mainEquipe) {
      mainEquipe = new Record(equipesCol)
      mainEquipe.set('nome', 'Equipe Principal')
      mainEquipe.set('slug', 'equipe-principal')
      mainEquipe.set('descricao', 'Equipe principal do sistema')
      mainEquipe.set('ativo', true)
      app.save(mainEquipe)
    }

    // 3. Get or create superadmin user
    var adminUser
    try {
      adminUser = app.findAuthRecordByEmail('_pb_users_auth_', 'luiz.moura@pmaisservicos.com.br')
    } catch (_) {
      adminUser = new Record(usersCol)
      adminUser.setEmail('luiz.moura@pmaisservicos.com.br')
      adminUser.setPassword('Skip@Pass')
      adminUser.setVerified(true)
      adminUser.set('name', 'Luiz Moura')
    }
    adminUser.set('perfil_id', saPerfil.id)
    adminUser.set('equipe_id', mainEquipe.id)
    adminUser.set('ativo_comercial', true)
    app.save(adminUser)

    // 4. Ensure active binding in com_usuarios_equipes for luiz.moura
    try {
      var existingBinding = app.findFirstRecordByFilter(
        'com_usuarios_equipes',
        "usuario_id = '" + adminUser.id + "'",
      )
      existingBinding.set('equipe_id', mainEquipe.id)
      existingBinding.set('perfil_id', saPerfil.id)
      existingBinding.set('escopo', 'todos')
      existingBinding.set('ativo', true)
      existingBinding.set('inicio_vigencia', '2020-01-01')
      existingBinding.set('fim_vigencia', '')
      app.save(existingBinding)
    } catch (_) {
      var newBinding = new Record(ueCol)
      newBinding.set('usuario_id', adminUser.id)
      newBinding.set('equipe_id', mainEquipe.id)
      newBinding.set('perfil_id', saPerfil.id)
      newBinding.set('escopo', 'todos')
      newBinding.set('ativo', true)
      newBinding.set('inicio_vigencia', '2020-01-01')
      newBinding.set('fim_vigencia', '')
      app.save(newBinding)
    }

    // 5. Ensure required permissions exist and are linked to superadministrador
    var requiredPerms = [
      { slug: 'equipes.admin', nome: 'Administrar Equipes', recurso: 'equipes', acao: 'admin' },
      { slug: 'usuarios.admin', nome: 'Administrar Usuários', recurso: 'usuarios', acao: 'admin' },
      { slug: 'perfis.admin', nome: 'Administrar Perfis', recurso: 'perfis', acao: 'admin' },
      {
        slug: 'permissoes.admin',
        nome: 'Administrar Permissões',
        recurso: 'permissoes',
        acao: 'admin',
      },
      { slug: 'vinculos.admin', nome: 'Administrar Vínculos', recurso: 'vinculos', acao: 'admin' },
      {
        slug: 'parametros.gerenciar',
        nome: 'Gerenciar Parâmetros',
        recurso: 'parametros',
        acao: 'gerenciar',
      },
      { slug: 'empresas.view', nome: 'Visualizar Empresas', recurso: 'empresas', acao: 'view' },
      { slug: 'empresas.create', nome: 'Criar Empresas', recurso: 'empresas', acao: 'create' },
      { slug: 'empresas.update', nome: 'Editar Empresas', recurso: 'empresas', acao: 'update' },
      {
        slug: 'empresas.inactivate',
        nome: 'Inativar Empresas',
        recurso: 'empresas',
        acao: 'inactivate',
      },
      { slug: 'negocios.view', nome: 'Visualizar Negócios', recurso: 'negocios', acao: 'view' },
      { slug: 'negocios.create', nome: 'Criar Negócios', recurso: 'negocios', acao: 'create' },
      { slug: 'negocios.update', nome: 'Editar Negócios', recurso: 'negocios', acao: 'update' },
      {
        slug: 'negocios.inactivate',
        nome: 'Inativar Negócios',
        recurso: 'negocios',
        acao: 'inactivate',
      },
      {
        slug: 'gerenciar_parametros_notificacoes',
        nome: 'Notificações',
        recurso: 'parametros',
        acao: 'notificacoes',
      },
      { slug: 'dashboard.view', nome: 'Visualizar Dashboard', recurso: 'dashboard', acao: 'view' },
      { slug: 'excecoes.aprovar', nome: 'Aprovar Exceções', recurso: 'excecoes', acao: 'aprovar' },
      {
        slug: 'auditoria.consultar',
        nome: 'Consultar Auditoria',
        recurso: 'auditoria',
        acao: 'consultar',
      },
      {
        slug: 'foundation.manage',
        nome: 'Gerenciar Fundação',
        recurso: 'foundation',
        acao: 'manage',
      },
    ]

    for (var i = 0; i < requiredPerms.length; i++) {
      var item = requiredPerms[i]
      var permRec
      try {
        permRec = app.findFirstRecordByData('com_permissoes', 'slug', item.slug)
      } catch (_) {
        permRec = new Record(permCol)
        permRec.set('nome', item.nome)
        permRec.set('slug', item.slug)
        permRec.set('recurso', item.recurso)
        permRec.set('acao', item.acao)
        permRec.set('descricao', item.nome)
        app.save(permRec)
      }

      try {
        app.findFirstRecordByFilter(
          'com_perfil_permissoes',
          "perfil_id = '" + saPerfil.id + "' && permissao_id = '" + permRec.id + "'",
        )
      } catch (_) {
        var link = new Record(ppCol)
        link.set('perfil_id', saPerfil.id)
        link.set('permissao_id', permRec.id)
        link.set('escopo', 'todos')
        app.save(link)
      }
    }
  },
  (app) => {},
)
