routerAdd(
  'POST',
  '/backend/v1/change-user-password',
  (e) => {
    function profileSlug(user) {
      try {
        return $app.findRecordById('com_perfis', user.getString('perfil_id')).getString('slug')
      } catch (_) {
        return ''
      }
    }
    function hasPermission(user, slug) {
      try {
        var links = $app.findRecordsByFilter(
          'com_perfil_permissoes',
          "perfil_id='" + user.getString('perfil_id') + "'",
          '',
          500,
          0,
        )
        for (var i = 0; i < links.length; i++) {
          var permissao = $app.findRecordById('com_permissoes', links[i].getString('permissao_id'))
          if (permissao.getString('slug') === slug) return true
        }
      } catch (_) {}
      return false
    }
    var ator = e.auth
    if (!ator || !ator.getBool('ativo_comercial')) {
      return e.forbiddenError('Usuario comercial necessario')
    }
    if (profileSlug(ator) !== 'superadministrador' && !hasPermission(ator, 'usuarios.admin')) {
      return e.forbiddenError('Permissao de administracao de usuarios necessaria')
    }

    const body = e.requestInfo().body || {}
    const userId = body.userId || ''
    const newPassword = body.newPassword || ''

    if (!userId) {
      return e.badRequestError('userId e obrigatorio')
    }
    if (newPassword.length < 8) {
      throw new BadRequestError('Nova senha muito curta', {
        newPassword: new ValidationError(
          'validation_min_text_constraint',
          'A nova senha deve ter no minimo 8 caracteres.',
        ),
      })
    }

    try {
      const user = $app.findRecordById('users', userId)
      user.setPassword(newPassword)
      $app.save(user)
      return e.json(200, { success: true })
    } catch (err) {
      $app.logger().error('change user password failed', 'error', String(err))
      return e.internalServerError('Erro ao alterar senha do usuario')
    }
  },
  $apis.requireAuth(),
)
