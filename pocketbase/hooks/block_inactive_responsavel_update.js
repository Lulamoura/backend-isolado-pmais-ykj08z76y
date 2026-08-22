onRecordUpdate((e) => {
  const novoResp = e.record.getString('responsavel_id')
  const antigoResp = e.record.original().getString('responsavel_id')
  if (novoResp !== antigoResp && novoResp) {
    try {
      const user = $app.findRecordById('users', novoResp)
      if (!user.getBool('ativo_comercial')) {
        throw new BadRequestError('Usuario inativo nao pode ser responsavel por negocios', {
          responsavel_id: new ValidationError(
            'validation_inactive_user',
            'Este usuario esta inativo comercialmente e nao pode receber novos negocios.',
          ),
        })
      }
    } catch (err) {
      if (err instanceof BadRequestError) throw err
    }
  }
  e.next()
}, 'com_negocios')
