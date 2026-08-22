migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('com_usuarios_equipes')
    const adminUser = app.findAuthRecordByEmail(
      '_pb_users_auth_',
      'luiz.moura@pmaisservicos.com.br',
    )
    const equipeAlpha = app.findFirstRecordByData('com_equipes', 'slug', 'equipe-alpha-teste')
    const adminPerfil = app.findFirstRecordByData('com_perfis', 'slug', 'admin')

    try {
      app.findFirstRecordByFilter(
        'com_usuarios_equipes',
        "usuario_id = '" + adminUser.id + "' && equipe_id = '" + equipeAlpha.id + "'",
      )
    } catch (_) {
      const rec = new Record(col)
      rec.set('usuario_id', adminUser.id)
      rec.set('equipe_id', equipeAlpha.id)
      rec.set('perfil_id', adminPerfil.id)
      rec.set('escopo', 'todos')
      app.save(rec)
    }
  },
  (app) => {
    try {
      app.findRecordsByFilter('com_usuarios_equipes', '').forEach((r) => app.delete(r))
    } catch (_) {}
  },
)
