routerAdd('POST', '/backend/v1/auth-with-password', (e) => {
  const body = e.requestInfo().body || {}
  const identity = body.identity || ''
  const password = body.password || ''

  if (!identity || !password) {
    return e.badRequestError('Identidade e senha sao obrigatorias')
  }

  let authRecord
  try {
    authRecord = $app.findAuthRecordByEmail('users', identity)
  } catch (err) {
    return e.unauthorizedError('Credenciais invalidas')
  }

  if (!authRecord.getBool('ativo_comercial')) {
    return e.unauthorizedError('Usuario inativo comercialmente nao pode autenticar')
  }

  const baseUrl = $secrets.get('PB_INSTANCE_URL') || ''
  if (!baseUrl) {
    return e.internalServerError('Configuracao do servidor ausente')
  }

  try {
    const res = $http.send({
      url: baseUrl + '/api/collections/users/auth-with-password',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity: identity, password: password }),
      timeout: 10,
    })

    if (res.statusCode !== 200) {
      return e.unauthorizedError('Credenciais invalidas')
    }

    return e.json(200, res.json)
  } catch (err) {
    $app.logger().error('auth internal call failed', 'error', String(err))
    return e.internalServerError('Servico de autenticacao indisponivel')
  }
})
