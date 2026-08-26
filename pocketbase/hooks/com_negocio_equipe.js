onRecordCreate(function (e) {
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
}, 'com_negocios')

onRecordUpdate(function (e) {
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
}, 'com_negocios')
