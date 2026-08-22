onRecordUpdateRequest((e) => {
  e.next()

  const record = e.record
  const oldAtivo = record.original().getBool('ativo')
  const newAtivo = record.getBool('ativo')
  const oldValue = record.original().getString('valor')
  const newValue = record.getString('valor')

  const meaningfulFields = [
    'chave',
    'valor',
    'descricao',
    'tipo',
    'unidade',
    'regra_validacao',
    'inicio_vigencia',
    'fim_vigencia',
  ]
  let otherMeaningfulChanged = false
  for (let i = 0; i < meaningfulFields.length; i++) {
    if (
      record.original().getString(meaningfulFields[i]) !== record.getString(meaningfulFields[i])
    ) {
      otherMeaningfulChanged = true
      break
    }
  }

  const ativoDeactivated = oldAtivo && !newAtivo
  let acao = 'update'
  let valorAnterior = oldValue
  let valorNovo = newValue

  if (ativoDeactivated && !otherMeaningfulChanged) {
    acao = 'inactivate'
    valorAnterior = oldAtivo ? 'ativo' : 'inativo'
    valorNovo = 'inativo'
  }

  try {
    const auditCol = $app.findCollectionByNameOrId('com_auditoria')
    const auditRec = new Record(auditCol)
    auditRec.set('collection_name', 'com_parametros')
    auditRec.set('record_id', record.id)
    if (e.auth) {
      auditRec.set('usuario_id', e.auth.id)
    }
    auditRec.set('acao', acao)
    auditRec.set('valor_anterior', valorAnterior)
    auditRec.set('valor_novo', valorNovo)
    auditRec.set('justificativa', record.getString('justificativa') || '')
    auditRec.set('origem_alteracao', 'manual')
    $app.save(auditRec)
  } catch (err) {
    $app
      .logger()
      .error(
        'audit_parametros failed',
        'collection',
        'com_parametros',
        'record_id',
        record.id,
        'error',
        String(err),
      )
  }
}, 'com_parametros')
