onRecordUpdateRequest((e) => {
  var chave = e.record.getString('chave')
  if (!chave.startsWith('notificacao.')) {
    e.next()
    return
  }

  var authId = e.auth ? e.auth.id : ''
  if (!authId) {
    throw new ForbiddenError('Autenticação necessária')
  }

  var isSuperadmin = false
  try {
    var superadminPerfil = $app.findFirstRecordByData('com_perfis', 'slug', 'superadministrador')
    var links = $app.findRecordsByFilter(
      'com_usuarios_equipes',
      "usuario_id = '" + authId + "' && perfil_id = '" + superadminPerfil.id + "' && ativo = true",
      '',
      1,
      0,
    )
    isSuperadmin = links.length > 0
  } catch (_) {}

  if (!isSuperadmin) {
    throw new ForbiddenError('Apenas superadministrador pode gerenciar parâmetros de notificações')
  }

  e.next()
}, 'com_parametros')
