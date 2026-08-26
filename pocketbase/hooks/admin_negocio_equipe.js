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
    var atualizados = 0
    $app.runInTransaction(function (tx) {
      var negocios = tx.findRecordsByFilter('com_negocios', "id != ''", 'id', 500, 0)
      for (var i = 0; i < negocios.length; i++) {
        if (negocios[i].getString('equipe_id')) continue
        negocios[i].set('equipe_id', equipe.id)
        tx.save(negocios[i])
        atualizados++
      }
    })
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
