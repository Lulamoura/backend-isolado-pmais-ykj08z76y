function preencherEquipeNegocio(e) {
  if (!e.record.getString('equipe_id')) {
    var equipeId = ''
    var responsavelId = e.record.getString('responsavel_id')
    if (responsavelId) {
      try {
        equipeId = $app.findRecordById('users', responsavelId).getString('equipe_id')
      } catch (_) {}
    }
    if (!equipeId) {
      try {
        equipeId = $app.findFirstRecordByData('com_equipes', 'slug', 'comercial').id
      } catch (_) {}
    }
    if (equipeId) e.record.set('equipe_id', equipeId)
  }
  e.next()
}

onRecordCreate(preencherEquipeNegocio, 'com_negocios')
onRecordUpdate(preencherEquipeNegocio, 'com_negocios')

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
      var negocios = tx.findRecordsByFilter('com_negocios', "equipe_id = ''", 'id', 500, 0)
      for (var i = 0; i < negocios.length; i++) {
        negocios[i].set('equipe_id', equipe.id)
        tx.save(negocios[i])
        atualizados++
      }
    })
    var restantes = $app.findRecordsByFilter('com_negocios', "equipe_id = ''", 'id', 1, 0).length
    return e.json(200, {
      equipe_id: equipe.id,
      atualizados: atualizados,
      restantes_sem_equipe: restantes,
    })
  },
  $apis.requireAuth('users'),
)
