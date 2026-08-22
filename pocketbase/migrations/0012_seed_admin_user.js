migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')

    try {
      app.findAuthRecordByEmail('_pb_users_auth_', 'luiz.moura@pmaisservicos.com.br')
      return
    } catch (_) {}

    const adminPerfil = app.findFirstRecordByData('com_perfis', 'slug', 'admin')
    const equipeAlpha = app.findFirstRecordByData('com_equipes', 'slug', 'equipe-alpha-teste')

    const record = new Record(users)
    record.setEmail('luiz.moura@pmaisservicos.com.br')
    record.setPassword('Skip@Pass')
    record.setVerified(true)
    record.set('name', 'Admin PMais')
    record.set('perfil_id', adminPerfil.id)
    record.set('equipe_id', equipeAlpha.id)
    record.set('ativo_comercial', true)
    app.save(record)
  },
  (app) => {
    try {
      const record = app.findAuthRecordByEmail('_pb_users_auth_', 'luiz.moura@pmaisservicos.com.br')
      app.delete(record)
    } catch (_) {}
  },
)
