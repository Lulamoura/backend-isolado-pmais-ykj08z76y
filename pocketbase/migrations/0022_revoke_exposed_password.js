migrate(
  (app) => {
    try {
      const user = app.findAuthRecordByEmail('_pb_users_auth_', 'luiz.moura@pmaisservicos.com.br')
      var newPassword = $security.randomString(24)
      user.setPassword(newPassword)
      app.save(user)
    } catch (_) {}
  },
  (app) => {
    // Irreversible — original password was publicly disclosed
  },
)
