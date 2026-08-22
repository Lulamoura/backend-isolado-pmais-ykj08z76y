onRecordDelete((e) => {
  var record = e.record

  try {
    var negocios = $app.findRecordsByFilter(
      'com_negocios',
      "empresa_id = '" + record.id + "'",
      '',
      1,
      0,
    )
    if (negocios.length > 0) {
      throw new BadRequestError(
        'Empresa com negócios associados não pode ser excluída. Inative-a em vez de excluir.',
      )
    }
  } catch (err) {
    if (err instanceof BadRequestError) throw err
  }

  try {
    var auditoria = $app.findRecordsByFilter(
      'com_auditoria',
      "collection_name = 'com_empresas' && record_id = '" + record.id + "'",
      '',
      1,
      0,
    )
    if (auditoria.length > 0) {
      throw new BadRequestError(
        'Empresa com histórico de auditoria não pode ser excluída. Inative-a em vez de excluir.',
      )
    }
  } catch (err) {
    if (err instanceof BadRequestError) throw err
  }

  e.next()
}, 'com_empresas')
