onRecordDelete((e) => {
  var record = e.record

  try {
    var historico = $app.findRecordsByFilter(
      'com_negocio_historico',
      "negocio_id = '" + record.id + "'",
      '',
      1,
      0,
    )
    if (historico.length > 0) {
      throw new BadRequestError(
        'Negócio com histórico não pode ser excluído. Inative-o em vez de excluir.',
      )
    }
  } catch (err) {
    if (err instanceof BadRequestError) throw err
  }

  try {
    var auditoria = $app.findRecordsByFilter(
      'com_auditoria',
      "collection_name = 'com_negocios' && record_id = '" + record.id + "'",
      '',
      1,
      0,
    )
    if (auditoria.length > 0) {
      throw new BadRequestError(
        'Negócio com histórico de auditoria não pode ser excluído. Inative-o em vez de excluir.',
      )
    }
  } catch (err) {
    if (err instanceof BadRequestError) throw err
  }

  e.next()
}, 'com_negocios')
