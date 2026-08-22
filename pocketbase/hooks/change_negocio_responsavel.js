routerAdd(
  'POST',
  '/backend/v1/negocios/{id}/change-responsavel',
  (e) => {
    const id = e.request.pathValue('id')
    const body = e.requestInfo().body || {}
    const userId = e.auth ? e.auth.id : ''
    if (!userId) return e.unauthorizedError('Autenticacao necessaria')

    const novoResponsavelId = body.responsavel_id || ''
    const justificativa = body.justificativa || ''

    if (!novoResponsavelId) return e.badRequestError('responsavel_id e obrigatorio')
    if (!justificativa.trim()) return e.badRequestError('justificativa e obrigatoria')

    let novoUser
    try {
      novoUser = $app.findRecordById('users', novoResponsavelId)
    } catch (_) {
      return e.badRequestError('Usuario responsavel nao encontrado')
    }
    if (!novoUser.getBool('ativo_comercial')) {
      throw new BadRequestError('Usuario inativo nao pode ser responsavel por negocios', {
        responsavel_id: new ValidationError(
          'validation_inactive_user',
          'Este usuario esta inativo comercialmente e nao pode receber novos negocios.',
        ),
      })
    }

    let negocio
    try {
      negocio = $app.findRecordById('com_negocios', id)
    } catch (_) {
      return e.notFoundError('Negocio nao encontrado')
    }

    const responsavelAnteriorId = negocio.getString('responsavel_id')

    negocio.set('responsavel_id', novoResponsavelId)
    $app.save(negocio)

    const histCol = $app.findCollectionByNameOrId('com_negocio_historico')
    const histRec = new Record(histCol)
    histRec.set('negocio_id', id)
    histRec.set('usuario_id', userId)
    if (responsavelAnteriorId) histRec.set('responsavel_anterior_id', responsavelAnteriorId)
    histRec.set('responsavel_novo_id', novoResponsavelId)
    histRec.set('justificativa', justificativa)
    histRec.set('origem_alteracao', 'manual')
    $app.save(histRec)

    return e.json(200, { success: true, negocio_id: id, history_id: histRec.id })
  },
  $apis.requireAuth(),
)
