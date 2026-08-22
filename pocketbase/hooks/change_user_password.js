routerAdd(
  'POST',
  '/backend/v1/change-user-password',
  (e) => {
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
