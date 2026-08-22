migrate(
  (app) => {
    var col = app.findCollectionByNameOrId('com_usuarios_equipes')

    if (!col.fields.getByName('ativo')) {
      col.fields.add(new BoolField({ name: 'ativo' }))
    }
    if (!col.fields.getByName('inicio_vigencia')) {
      col.fields.add(new DateField({ name: 'inicio_vigencia' }))
    }
    if (!col.fields.getByName('fim_vigencia')) {
      col.fields.add(new DateField({ name: 'fim_vigencia' }))
    }

    col.removeIndex('idx_com_usuarios_equipes_usuario_equipe')
    col.addIndex(
      'idx_com_usuarios_equipes_usuario_equipe_perfil',
      true,
      'usuario_id, equipe_id, perfil_id',
      '',
    )
    app.save(col)

    var now = new Date().toISOString().split('T')[0]
    var links = app.findRecordsByFilter('com_usuarios_equipes', '', '', 500, 0)
    for (var i = 0; i < links.length; i++) {
      if (!links[i].getBool('ativo')) {
        links[i].set('ativo', true)
      }
      if (!links[i].getString('inicio_vigencia')) {
        links[i].set('inicio_vigencia', now)
      }
      app.save(links[i])
    }

    var lulaUser = app.findAuthRecordByEmail('_pb_users_auth_', 'luiz.moura@pmaisservicos.com.br')
    var superadminPerfil = app.findFirstRecordByData('com_perfis', 'slug', 'superadministrador')
    var equipeAlpha = app.findFirstRecordByData('com_equipes', 'slug', 'equipe-alpha-teste')
    var auditoriaCol = app.findCollectionByNameOrId('com_auditoria')

    var lulaLinks = app.findRecordsByFilter(
      'com_usuarios_equipes',
      "usuario_id = '" + lulaUser.id + "'",
      '',
      500,
      0,
    )
    for (var j = 0; j < lulaLinks.length; j++) {
      var oldPerfilId = lulaLinks[j].getString('perfil_id')
      lulaLinks[j].set('perfil_id', superadminPerfil.id)
      lulaLinks[j].set('escopo', 'todos')
      lulaLinks[j].set('ativo', true)
      lulaLinks[j].set('inicio_vigencia', now)
      app.save(lulaLinks[j])

      var auditRec = new Record(auditoriaCol)
      auditRec.set('collection_name', 'com_usuarios_equipes')
      auditRec.set('record_id', lulaLinks[j].id)
      auditRec.set('usuario_id', lulaUser.id)
      auditRec.set('acao', 'update')
      auditRec.set('valor_anterior', oldPerfilId)
      auditRec.set('valor_novo', superadminPerfil.id)
      auditRec.set('justificativa', 'Migração para perfil superadministrador [TESTE]')
      auditRec.set('origem_alteracao', 'migration')
      app.save(auditRec)
    }

    lulaUser.set('perfil_id', superadminPerfil.id)
    app.save(lulaUser)

    var usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    var spokUser
    try {
      spokUser = app.findAuthRecordByEmail('_pb_users_auth_', 'spok@pmaisservicos.com.br')
    } catch (_) {
      spokUser = new Record(usersCol)
      spokUser.setEmail('spok@pmaisservicos.com.br')
      spokUser.setPassword('Skip@Pass')
      spokUser.setVerified(true)
      spokUser.set('name', 'Spok')
      spokUser.set('ativo_comercial', true)
      app.save(spokUser)
    }

    var integracaoPerfil = app.findFirstRecordByData('com_perfis', 'slug', 'integracao')

    try {
      app.findFirstRecordByFilter(
        'com_usuarios_equipes',
        "usuario_id = '" +
          spokUser.id +
          "' && equipe_id = '" +
          equipeAlpha.id +
          "' && perfil_id = '" +
          integracaoPerfil.id +
          "'",
      )
    } catch (_) {
      var spokLink = new Record(col)
      spokLink.set('usuario_id', spokUser.id)
      spokLink.set('equipe_id', equipeAlpha.id)
      spokLink.set('perfil_id', integracaoPerfil.id)
      spokLink.set('escopo', 'todos')
      spokLink.set('ativo', true)
      spokLink.set('inicio_vigencia', now)
      app.save(spokLink)

      var spokAudit = new Record(auditoriaCol)
      spokAudit.set('collection_name', 'com_usuarios_equipes')
      spokAudit.set('record_id', spokLink.id)
      spokAudit.set('usuario_id', lulaUser.id)
      spokAudit.set('acao', 'create')
      spokAudit.set('valor_anterior', '')
      spokAudit.set('valor_novo', 'Spok → integração / todos')
      spokAudit.set('justificativa', 'Criação de vínculo para homologação técnica [TESTE]')
      spokAudit.set('origem_alteracao', 'migration')
      app.save(spokAudit)
    }

    spokUser.set('perfil_id', integracaoPerfil.id)
    app.save(spokUser)
  },
  (app) => {
    try {
      var spokUser = app.findAuthRecordByEmail('_pb_users_auth_', 'spok@pmaisservicos.com.br')
      app.delete(spokUser)
    } catch (_) {}

    try {
      var col = app.findCollectionByNameOrId('com_usuarios_equipes')
      col.removeIndex('idx_com_usuarios_equipes_usuario_equipe_perfil')
      col.addIndex('idx_com_usuarios_equipes_usuario_equipe', true, 'usuario_id, equipe_id', '')
      var fieldsToRemove = ['ativo', 'inicio_vigencia', 'fim_vigencia']
      for (var i = 0; i < fieldsToRemove.length; i++) {
        if (col.fields.getByName(fieldsToRemove[i])) {
          col.fields.removeByName(fieldsToRemove[i])
        }
      }
      app.save(col)
    } catch (_) {}
  },
)
