routerAdd(
  'POST',
  '/backend/v1/admin/negocios/equipe-comercial/backfill',
  function (e) {
    if (!e.auth || !e.auth.getBool('ativo_comercial'))
      return e.unauthorizedError('Autenticacao necessaria')
    try {
      var perfil = $app.findRecordById('com_perfis', e.auth.getString('perfil_id'))
      if (perfil.getString('slug') !== 'superadministrador')
        return e.forbiddenError('SuperAdmin necessario')
    } catch (_) {
      return e.forbiddenError('SuperAdmin necessario')
    }
    var equipe
    try {
      equipe = $app.findFirstRecordByData('com_equipes', 'slug', 'comercial')
      if (!equipe.getBool('ativo')) return e.badRequestError('Equipe Comercial inativa')
    } catch (_) {
      return e.badRequestError('Equipe Comercial nao encontrada')
    }
    if (!/^[a-z0-9]{15}$/.test(equipe.id)) return e.badRequestError('Equipe Comercial invalida')
    var todosAntes = $app.findRecordsByFilter('com_negocios', "id != ''", 'id', 500, 0)
    var atualizados = 0
    for (var i = 0; i < todosAntes.length; i++)
      if (!todosAntes[i].getString('equipe_id')) atualizados++
    $app
      .db()
      .newQuery(
        "UPDATE com_negocios SET equipe_id = '" +
          equipe.id +
          "' WHERE equipe_id IS NULL OR equipe_id = ''",
      )
      .execute()
    var todos = $app.findRecordsByFilter('com_negocios', "id != ''", 'id', 500, 0)
    var restantes = 0
    for (var j = 0; j < todos.length; j++) if (!todos[j].getString('equipe_id')) restantes++
    return e.json(200, {
      equipe_id: equipe.id,
      atualizados: atualizados,
      restantes_sem_equipe: restantes,
    })
  },
  $apis.requireAuth('users'),
)
