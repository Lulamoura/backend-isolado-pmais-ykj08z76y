onRecordDelete((e) => {
  const record = e.record

  try {
    var versions = $app.findRecordsByFilter(
      'com_parametros_versoes',
      "parametro_id = '" + record.id + "'",
      '',
      1,
      0,
    )
    if (versions.length > 0) {
      throw new BadRequestError(
        'Parametro com historico de versoes nao pode ser excluido. Inative-o em vez de excluir.',
      )
    }
  } catch (err) {
    if (err instanceof BadRequestError) throw err
  }

  if (record.getBool('ativo')) {
    throw new BadRequestError('Parametro ativo nao pode ser excluido. Inative-o primeiro.')
  }

  e.next()
}, 'com_parametros')
