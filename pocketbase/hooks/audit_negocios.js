onRecordUpdateRequest((e) => {
  e.next()

  const record = e.record
  const oldInativo = record.original().getBool('inativo')
  const newInativo = record.getBool('inativo')
  const oldTitle = record.original().getString('titulo')
  const newTitle = record.getString('titulo')

  let acao = 'update'
  let valorAnterior = oldTitle
  let valorNovo = newTitle

  if (oldInativo !== newInativo && newInativo) {
    acao = 'inactivate'
    valorAnterior = oldInativo ? 'inativo' : 'ativo'
    valorNovo = 'inativo'
  }

  try {
    const auditCol = $app.findCollectionByNameOrId('com_auditoria')
    const auditRec = new Record(auditCol)
    auditRec.set('collection_name', 'com_negocios')
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
        'audit_negocios failed',
        'collection',
        'com_negocios',
        'record_id',
        record.id,
        'error',
        String(err),
      )
  }
}, 'com_negocios')
