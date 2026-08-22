onRecordAfterUpdateSuccess((e) => {
  const record = e.record

  const meaningfulFields = [
    'chave',
    'valor',
    'descricao',
    'tipo',
    'unidade',
    'regra_validacao',
    'inicio_vigencia',
    'fim_vigencia',
    'ativo',
  ]
  let meaningfulChanged = false
  for (let i = 0; i < meaningfulFields.length; i++) {
    var f = meaningfulFields[i]
    if (record.original().getString(f) !== record.getString(f)) {
      meaningfulChanged = true
      break
    }
  }
  if (!meaningfulChanged) {
    e.next()
    return
  }

  try {
    var versoesCol = $app.findCollectionByNameOrId('com_parametros_versoes')
    var versaoRec = new Record(versoesCol)
    versaoRec.set('parametro_id', record.id)
    versaoRec.set('chave', record.original().getString('chave'))
    versaoRec.set('valor', record.original().getString('valor'))
    versaoRec.set('descricao', record.original().getString('descricao'))
    versaoRec.set('tipo', record.original().getString('tipo'))
    versaoRec.set('unidade', record.original().getString('unidade'))
    versaoRec.set('regra_validacao', record.original().getString('regra_validacao'))
    versaoRec.set('versao', record.original().getInt('versao'))

    var inicioVig = record.original().getString('inicio_vigencia')
    if (inicioVig) versaoRec.set('inicio_vigencia', inicioVig)
    var fimVig = record.original().getString('fim_vigencia')
    if (fimVig) versaoRec.set('fim_vigencia', fimVig)

    var autorId = record.original().getString('autor_id')
    if (autorId) versaoRec.set('autor_id', autorId)
    versaoRec.set('justificativa', record.original().getString('justificativa'))
    $app.save(versaoRec)

    var currentRecord = $app.findRecordById('com_parametros', record.id)
    currentRecord.set('versao', record.getInt('versao') + 1)
    $app.saveNoValidate(currentRecord)
  } catch (err) {
    $app.logger().error('parametro version history failed', 'error', String(err))
  }

  e.next()
}, 'com_parametros')
