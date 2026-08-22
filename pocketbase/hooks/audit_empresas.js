onRecordUpdateRequest((e) => {
  e.next()

  const record = e.record
  const oldStatus = record.original().getString('status')
  const newStatus = record.getString('status')
  const oldName = record.original().getString('nome')
  const newName = record.getString('nome')

  let acao = 'update'
  let valorAnterior = oldName
  let valorNovo = newName

  if (oldStatus !== newStatus && newStatus === 'inativo') {
    acao = 'inactivate'
    valorAnterior = oldStatus
    valorNovo = newStatus
  }

  try {
    const auditCol = $app.findCollectionByNameOrId('com_auditoria')
    const auditRec = new Record(auditCol)
    auditRec.set('collection_name', 'com_empresas')
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
        'audit_empresas failed',
        'collection',
        'com_empresas',
        'record_id',
        record.id,
        'error',
        String(err),
      )
  }
}, 'com_empresas')
