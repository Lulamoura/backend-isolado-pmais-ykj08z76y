onRecordCreate((e) => {
  var etapa = e.record.getString('etapa')
  var resultado = e.record.getString('resultado')
  var status = e.record.getString('status')

  if (status) {
    throw new BadRequestError(
      'O campo "status" foi descontinuado e nao aceita novos valores. Use "etapa" ou "resultado".',
    )
  }

  if (etapa && resultado) {
    throw new BadRequestError('Um negocio nao pode ter etapa ativa e resultado simultaneamente.')
  }

  e.next()
}, 'com_negocios')
