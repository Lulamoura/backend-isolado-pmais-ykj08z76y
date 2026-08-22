migrate(
  (app) => {
    var equipesCol = app.findCollectionByNameOrId('com_equipes')
    var usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    var ueCol = app.findCollectionByNameOrId('com_usuarios_equipes')
    var negociosCol = app.findCollectionByNameOrId('com_negocios')

    var equipeAlpha = app.findFirstRecordByData('com_equipes', 'slug', 'equipe-alpha-teste')
    var operadorPerfil = app.findFirstRecordByData('com_perfis', 'slug', 'operador-comercial')
    var lulaUser = app.findAuthRecordByEmail('_pb_users_auth_', 'luiz.moura@pmaisservicos.com.br')
    var techSolutions = app.findFirstRecordByData('com_empresas', 'cnpj', '12345678000190')
    var consultoriaXYZ = app.findFirstRecordByData('com_empresas', 'cnpj', '98765432000110')

    var equipeBeta
    try {
      equipeBeta = app.findFirstRecordByData('com_equipes', 'slug', 'equipe-beta-teste')
    } catch (_) {
      equipeBeta = new Record(equipesCol)
      equipeBeta.set('nome', 'Equipe Beta Teste [TESTE]')
      equipeBeta.set('slug', 'equipe-beta-teste')
      equipeBeta.set('descricao', 'Equipe para testes positivos de escopo [TESTE]')
      equipeBeta.set('ativo', true)
      app.save(equipeBeta)
    }

    var comercialUser
    try {
      comercialUser = app.findAuthRecordByEmail(
        '_pb_users_auth_',
        'comercial.teste@pmaisservicos.com.br',
      )
    } catch (_) {
      comercialUser = new Record(usersCol)
      comercialUser.setEmail('comercial.teste@pmaisservicos.com.br')
      comercialUser.setPassword('Skip@Pass')
      comercialUser.setVerified(true)
      comercialUser.set('name', 'Comercial Teste [TESTE]')
      comercialUser.set('ativo_comercial', true)
      app.save(comercialUser)
    }
    comercialUser.set('perfil_id', operadorPerfil.id)
    comercialUser.set('equipe_id', equipeAlpha.id)
    app.save(comercialUser)

    var outroUser
    try {
      outroUser = app.findAuthRecordByEmail('_pb_users_auth_', 'outro.usuario@pmaisservicos.com.br')
    } catch (_) {
      outroUser = new Record(usersCol)
      outroUser.setEmail('outro.usuario@pmaisservicos.com.br')
      outroUser.setPassword('Skip@Pass')
      outroUser.setVerified(true)
      outroUser.set('name', 'Outro Usuario [TESTE]')
      outroUser.set('ativo_comercial', true)
      app.save(outroUser)
    }
    outroUser.set('perfil_id', operadorPerfil.id)
    outroUser.set('equipe_id', equipeBeta.id)
    app.save(outroUser)

    try {
      app.findFirstRecordByFilter(
        'com_usuarios_equipes',
        "usuario_id = '" +
          outroUser.id +
          "' && equipe_id = '" +
          equipeBeta.id +
          "' && perfil_id = '" +
          operadorPerfil.id +
          "'",
      )
    } catch (_) {
      var outroLink = new Record(ueCol)
      outroLink.set('usuario_id', outroUser.id)
      outroLink.set('equipe_id', equipeBeta.id)
      outroLink.set('perfil_id', operadorPerfil.id)
      outroLink.set('escopo', 'proprios')
      outroLink.set('ativo', true)
      outroLink.set('inicio_vigencia', new Date().toISOString().split('T')[0])
      app.save(outroLink)
    }

    try {
      app.findFirstRecordByFilter(
        'com_usuarios_equipes',
        "usuario_id = '" +
          comercialUser.id +
          "' && equipe_id = '" +
          equipeAlpha.id +
          "' && perfil_id = '" +
          operadorPerfil.id +
          "'",
      )
    } catch (_) {
      var comercialLink = new Record(ueCol)
      comercialLink.set('usuario_id', comercialUser.id)
      comercialLink.set('equipe_id', equipeAlpha.id)
      comercialLink.set('perfil_id', operadorPerfil.id)
      comercialLink.set('escopo', 'proprios')
      comercialLink.set('ativo', true)
      comercialLink.set('inicio_vigencia', new Date().toISOString().split('T')[0])
      app.save(comercialLink)
    }

    var testNegocios = [
      {
        titulo: 'Negocio A - Proprio [TESTE]',
        empresa: techSolutions,
        resp: comercialUser,
        equipe: equipeAlpha,
        valor: 10000,
        etapa: 'prospects',
        inativo: false,
      },
      {
        titulo: 'Negocio B - Equipe [TESTE]',
        empresa: consultoriaXYZ,
        resp: lulaUser,
        equipe: equipeAlpha,
        valor: 20000,
        etapa: 'negociacao',
        inativo: false,
      },
      {
        titulo: 'Negocio C - Outra Equipe [TESTE]',
        empresa: techSolutions,
        resp: outroUser,
        equipe: equipeBeta,
        valor: 30000,
        etapa: 'producao_proposta',
        inativo: false,
      },
      {
        titulo: 'Negocio D - Inativo [TESTE]',
        empresa: consultoriaXYZ,
        resp: comercialUser,
        equipe: equipeAlpha,
        valor: 5000,
        etapa: 'prospects',
        inativo: true,
      },
    ]

    for (var i = 0; i < testNegocios.length; i++) {
      var t = testNegocios[i]
      try {
        app.findFirstRecordByFilter('com_negocios', "titulo = '" + t.titulo + "'")
      } catch (_) {
        var rec = new Record(negociosCol)
        rec.set('titulo', t.titulo)
        rec.set('empresa_id', t.empresa.id)
        rec.set('equipe_id', t.equipe.id)
        rec.set('responsavel_id', t.resp.id)
        rec.set('valor', t.valor)
        rec.set('etapa', t.etapa)
        rec.set('inativo', t.inativo)
        rec.set('descricao', 'Negocio de teste positivo de autorizacao [TESTE]')
        app.save(rec)
      }
    }
  },
  (app) => {
    var testTitles = [
      'Negocio A - Proprio [TESTE]',
      'Negocio B - Equipe [TESTE]',
      'Negocio C - Outra Equipe [TESTE]',
      'Negocio D - Inativo [TESTE]',
    ]
    for (var i = 0; i < testTitles.length; i++) {
      try {
        app.delete(app.findFirstRecordByFilter('com_negocios', "titulo = '" + testTitles[i] + "'"))
      } catch (_) {}
    }
    try {
      app.delete(
        app.findAuthRecordByEmail('_pb_users_auth_', 'comercial.teste@pmaisservicos.com.br'),
      )
    } catch (_) {}
    try {
      app.delete(app.findAuthRecordByEmail('_pb_users_auth_', 'outro.usuario@pmaisservicos.com.br'))
    } catch (_) {}
    try {
      app.delete(app.findFirstRecordByData('com_equipes', 'slug', 'equipe-beta-teste'))
    } catch (_) {}
  },
)
