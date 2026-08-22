routerAdd(
  'POST',
  '/backend/v1/change-own-password',
  (e) => {
    const body = e.requestInfo().body || {}
    const userId = e.auth ? e.auth.id : ''
    if (!userId) return e.unauthorizedError('Autenticacao necessaria')

    const oldPassword = body.oldPassword || ''
    const newPassword = body.newPassword || ''

    if (!oldPassword) {
      throw new BadRequestError('Senha atual e obrigatoria', {
        oldPassword: new ValidationError('validation_required', 'Senha atual e obrigatoria.'),
      })
    }
    if (newPassword.length < 8) {
      throw new BadRequestError('Nova senha muito curta', {
        newPassword: new ValidationError(
          'validation_min_text_constraint',
          'A nova senha deve ter no minimo 8 caracteres.',
        ),
      })
    }

    const user = $app.findRecordById('users', userId)

    const baseUrl = $secrets.get('PB_INSTANCE_URL') || ''
    if (!baseUrl) {
      return e.internalServerError('Configuracao do servidor ausente')
    }

    try {
      const res = $http.send({
        url: baseUrl + '/api/collections/users/auth-with-password',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identity: user.getString('email'), password: oldPassword }),
        timeout: 10,
      })

      if (res.statusCode !== 200) {
        throw new BadRequestError('Senha atual incorreta', {
          oldPassword: new ValidationError('validation_invalid_password', 'Senha atual incorreta.'),
        })
      }
    } catch (err) {
      if (err instanceof BadRequestError) throw err
      $app.logger().error('password verification failed', 'error', String(err))
      return e.internalServerError('Servico de verificacao indisponivel')
    }

    user.setPassword(newPassword)
    $app.save(user)

    return e.json(200, { success: true })
  },
  $apis.requireAuth(),
)
