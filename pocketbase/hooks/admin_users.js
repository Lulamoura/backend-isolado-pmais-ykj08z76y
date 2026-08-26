routerAdd(
  'POST',
  '/backend/v1/admin/users',
  function (e) {
    function profileSlug(user) {
      try {
        return $app.findRecordById('com_perfis', user.getString('perfil_id')).getString('slug')
      } catch (_) {
        return ''
      }
    }
    function response(record) {
      return {
        id: record.id,
        name: record.getString('name'),
        email: record.getString('email'),
        perfil_id: record.getString('perfil_id'),
        equipe_id: record.getString('equipe_id'),
        ativo_comercial: record.getBool('ativo_comercial'),
        verified: record.getBool('verified'),
        updated: record.getString('updated'),
      }
    }

    if (!e.auth) return e.unauthorizedError('Autenticacao necessaria')
    if (!e.auth.getBool('ativo_comercial')) return e.forbiddenError('Usuario comercial inativo')
    if (profileSlug(e.auth) !== 'superadministrador')
      return e.forbiddenError('SuperAdmin necessario')

    var body
    try {
      body = JSON.parse(toString(e.request.body))
    } catch (_) {
      return e.json(400, { error: 'JSON_INVALIDO' })
    }
    var name = String((body && body.name) || '').trim()
    var email = String((body && body.email) || '')
      .trim()
      .toLowerCase()
    var password = String((body && body.password) || '')
    var perfilId = String((body && body.perfil_id) || '')
    var equipeId = String((body && body.equipe_id) || '')
    if (name.length < 2 || name.length > 150) return e.json(400, { error: 'NOME_INVALIDO' })
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return e.json(400, { error: 'EMAIL_INVALIDO' })
    if (password.length < 8) return e.json(400, { error: 'SENHA_INVALIDA' })
    if (!perfilId) return e.json(400, { error: 'PERFIL_OBRIGATORIO' })
    if (!equipeId) return e.json(400, { error: 'EQUIPE_OBRIGATORIA' })
    try {
      if (!$app.findRecordById('com_perfis', perfilId).getBool('ativo'))
        return e.json(400, { error: 'PERFIL_INATIVO' })
    } catch (_) {
      return e.json(400, { error: 'PERFIL_INVALIDO' })
    }
    try {
      if (!$app.findRecordById('com_equipes', equipeId).getBool('ativo'))
        return e.json(400, { error: 'EQUIPE_INATIVA' })
    } catch (_) {
      return e.json(400, { error: 'EQUIPE_INVALIDA' })
    }
    try {
      if ($app.findAuthRecordByEmail('users', email))
        return e.json(409, { error: 'EMAIL_JA_CADASTRADO' })
    } catch (_) {}

    try {
      var created
      $app.runInTransaction(function (tx) {
        var record = new Record(tx.findCollectionByNameOrId('users'))
        record.set('name', name)
        record.set('email', email)
        record.setPassword(password)
        record.set('verified', true)
        record.set('perfil_id', perfilId)
        record.set('equipe_id', equipeId)
        record.set('ativo_comercial', body.ativo_comercial !== false)
        tx.save(record)
        created = response(record)
      })
      return e.json(201, created)
    } catch (err) {
      $app.logger().error('admin user create failed', 'error', String(err))
      return e.json(400, { error: 'USUARIO_NAO_CRIADO' })
    }
  },
  $apis.requireAuth('users'),
)

routerAdd(
  'PATCH',
  '/backend/v1/admin/users/{id}',
  function (e) {
    function profileSlug(user) {
      try {
        return $app.findRecordById('com_perfis', user.getString('perfil_id')).getString('slug')
      } catch (_) {
        return ''
      }
    }
    function response(record) {
      return {
        id: record.id,
        name: record.getString('name'),
        email: record.getString('email'),
        perfil_id: record.getString('perfil_id'),
        equipe_id: record.getString('equipe_id'),
        ativo_comercial: record.getBool('ativo_comercial'),
        verified: record.getBool('verified'),
        updated: record.getString('updated'),
      }
    }

    if (!e.auth) return e.unauthorizedError('Autenticacao necessaria')
    if (!e.auth.getBool('ativo_comercial')) return e.forbiddenError('Usuario comercial inativo')
    if (profileSlug(e.auth) !== 'superadministrador')
      return e.forbiddenError('SuperAdmin necessario')

    var body
    try {
      body = JSON.parse(toString(e.request.body))
    } catch (_) {
      return e.json(400, { error: 'JSON_INVALIDO' })
    }
    var name = String((body && body.name) || '').trim()
    var email = String((body && body.email) || '')
      .trim()
      .toLowerCase()
    var perfilId = String((body && body.perfil_id) || '')
    var equipeId = String((body && body.equipe_id) || '')
    if (name.length < 2 || name.length > 150) return e.json(400, { error: 'NOME_INVALIDO' })
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return e.json(400, { error: 'EMAIL_INVALIDO' })
    if (!perfilId) return e.json(400, { error: 'PERFIL_OBRIGATORIO' })
    if (!equipeId) return e.json(400, { error: 'EQUIPE_OBRIGATORIA' })
    try {
      if (!$app.findRecordById('com_perfis', perfilId).getBool('ativo'))
        return e.json(400, { error: 'PERFIL_INATIVO' })
    } catch (_) {
      return e.json(400, { error: 'PERFIL_INVALIDO' })
    }
    try {
      if (!$app.findRecordById('com_equipes', equipeId).getBool('ativo'))
        return e.json(400, { error: 'EQUIPE_INATIVA' })
    } catch (_) {
      return e.json(400, { error: 'EQUIPE_INVALIDA' })
    }

    try {
      var updated
      $app.runInTransaction(function (tx) {
        var record = tx.findRecordById('users', String(e.request.pathValue('id') || ''))
        record.set('name', name)
        record.set('email', email)
        record.set('perfil_id', perfilId)
        record.set('equipe_id', equipeId)
        record.set('ativo_comercial', body.ativo_comercial !== false)
        tx.save(record)
        updated = response(record)
      })
      return e.json(200, updated)
    } catch (err) {
      $app.logger().error('admin user update failed', 'error', String(err))
      return e.json(400, { error: 'USUARIO_NAO_ATUALIZADO' })
    }
  },
  $apis.requireAuth('users'),
)
