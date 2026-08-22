onRecordUpdateRequest((e) => {
  e.next()

  const record = e.record
  const oldAtivo = record.original().getBool('ativo')
  const newAtivo = record.getBool('ativo')
  const oldName = record.original().getString('nome')
  const newName = record.getString('nome')

  let acao = 'update'
  let valorAnterior = oldName
  let valorNovo = newName

  if (oldAtivo !== newAtivo && !newAtivo) {
    acao = 'inactivate'
    valorAnterior = oldAtivo ? 'ativo' : 'inativo'
    valorNovo = 'inativo'
  }

  try {
    const auditCol = $app.findCollectionByNameOrId('com_auditoria')
    const auditRec = new Record(auditCol)
    auditRec.set('collection_name', 'com_equipes')
    auditRec.set('record_id', record.id)
    if (e.auth) {
      auditRec.set('usuario_id', e.auth.id)
    }
    auditRec.set('acao', acao)
    auditRec.set('valor_anterior', valorAnterior)
    auditRec.set('valor_novo', valorNovo)
    auditRec.set('justificativa', '')
    auditRec.set('origem_alteracao', 'manual')
    $app.save(auditRec)
  } catch (err) {
    $app
      .logger()
      .error(
        'audit_equipes failed',
        'collection',
        'com_equipes',
        'record_id',
        record.id,
        'error',
        String(err),
      )
  }
}, 'com_equipes')
