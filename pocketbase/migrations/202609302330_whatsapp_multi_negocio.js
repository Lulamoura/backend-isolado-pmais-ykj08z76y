migrate(
  function (app) {
    var OBSERVACAO_ANTERIOR =
      'PILOTO_NEXO_TELEGRAM: múltiplos negócios abertos para o mesmo contato/empresa. Operador=Cristiane PMais; negócios_abertos=q3g119zt7r9g0tv|Proposta Qualificada|resultado=aberto; mgic724qec8mz20|Proposta Qualificada|resultado=aberto'
    var ORIGEM_ANTERIOR = 'sistema_multiplos_negocios_abertos_piloto_nexo_telegram'
    var ORIGEM_NOVA = 'decisao_humana_dialogo_multiplos_negocios'
    var OBSERVACAO_NOVA =
      'Decisão de Lula Moura: o diálogo trata conjuntamente das propostas de limpeza e vigilante desarmado; vinculado aos dois negócios.'
    var VINCULADO_EM_NOVO = '2026-09-30T23:30:00.000Z'
    var collection = app.findCollectionByNameOrId('com_whatsapp_vinculos')
    var campoNegocioIds = collection.fields.getByName('negocio_ids')
    var vinculo = app.findRecordById('com_whatsapp_vinculos', '9ktk4n5hvxiwx4p')
    var negocioIds = ['q3g119zt7r9g0tv', 'mgic724qec8mz20']
    var idsAtuais = campoNegocioIds ? vinculo.get('negocio_ids') || [] : []
    if (
      vinculo.getString('provider') !== 'uazapi' ||
      vinculo.getString('instance_name') !== 'Cristiane PMais' ||
      vinculo.getString('owner') !== '558183966723' ||
      vinculo.getString('chat_id') !== '558173434439@s.whatsapp.net' ||
      vinculo.getString('contato_id') !== 'oct8omr1j1pdaj1' ||
      vinculo.getString('empresa_id') !== 'heiwkslfa65akw8'
    ) {
      throw new Error(
        'Vínculo WhatsApp autorizado mudou desde a análise; nenhuma decisão foi aplicada',
      )
    }

    if (
      vinculo.getString('status') === 'vinculado_multiplo' &&
      vinculo.getString('origem_decisao') === ORIGEM_NOVA &&
      vinculo.getString('negocio_id') === '' &&
      vinculo.getString('observacao') === OBSERVACAO_NOVA &&
      vinculo.getString('vinculado_em') === VINCULADO_EM_NOVO &&
      Array.isArray(idsAtuais) &&
      idsAtuais.length === 2 &&
      idsAtuais.indexOf(negocioIds[0]) !== -1 &&
      idsAtuais.indexOf(negocioIds[1]) !== -1
    ) {
      return
    }

    if (
      vinculo.getString('status') !== 'ambiguidade_negocio_aberto' ||
      vinculo.getString('origem_decisao') !== ORIGEM_ANTERIOR ||
      vinculo.getString('negocio_id') !== '' ||
      vinculo.getString('observacao') !== OBSERVACAO_ANTERIOR ||
      !Array.isArray(idsAtuais) ||
      idsAtuais.length !== 0 ||
      vinculo.getString('vinculado_em') !== ''
    ) {
      throw new Error(
        'Vínculo WhatsApp autorizado mudou desde a análise; nenhuma decisão foi aplicada',
      )
    }

    for (var i = 0; i < negocioIds.length; i++) {
      app.findRecordById('com_negocios', negocioIds[i])
    }

    if (!campoNegocioIds) {
      collection.fields.add(new JSONField({ name: 'negocio_ids', required: false, maxSize: 2000 }))
      app.save(collection)
    }

    vinculo.set('negocio_id', '')
    vinculo.set('negocio_ids', negocioIds)
    vinculo.set('status', 'vinculado_multiplo')
    vinculo.set('origem_decisao', ORIGEM_NOVA)
    vinculo.set('observacao', OBSERVACAO_NOVA)
    vinculo.set('vinculado_em', VINCULADO_EM_NOVO)
    app.save(vinculo)
  },
  function (app) {
    var OBSERVACAO_ANTERIOR =
      'PILOTO_NEXO_TELEGRAM: múltiplos negócios abertos para o mesmo contato/empresa. Operador=Cristiane PMais; negócios_abertos=q3g119zt7r9g0tv|Proposta Qualificada|resultado=aberto; mgic724qec8mz20|Proposta Qualificada|resultado=aberto'
    var ORIGEM_ANTERIOR = 'sistema_multiplos_negocios_abertos_piloto_nexo_telegram'
    var ORIGEM_NOVA = 'decisao_humana_dialogo_multiplos_negocios'
    var OBSERVACAO_NOVA =
      'Decisão de Lula Moura: o diálogo trata conjuntamente das propostas de limpeza e vigilante desarmado; vinculado aos dois negócios.'
    var VINCULADO_EM_NOVO = '2026-09-30T23:30:00.000Z'
    var vinculo = app.findRecordById('com_whatsapp_vinculos', '9ktk4n5hvxiwx4p')
    var idsAtuais = vinculo.get('negocio_ids') || []
    if (
      vinculo.getString('provider') !== 'uazapi' ||
      vinculo.getString('instance_name') !== 'Cristiane PMais' ||
      vinculo.getString('owner') !== '558183966723' ||
      vinculo.getString('chat_id') !== '558173434439@s.whatsapp.net' ||
      vinculo.getString('contato_id') !== 'oct8omr1j1pdaj1' ||
      vinculo.getString('empresa_id') !== 'heiwkslfa65akw8' ||
      vinculo.getString('status') !== 'vinculado_multiplo' ||
      vinculo.getString('origem_decisao') !== ORIGEM_NOVA ||
      vinculo.getString('negocio_id') !== '' ||
      vinculo.getString('observacao') !== OBSERVACAO_NOVA ||
      vinculo.getString('vinculado_em') !== VINCULADO_EM_NOVO ||
      !Array.isArray(idsAtuais) ||
      idsAtuais.length !== 2 ||
      idsAtuais.indexOf('q3g119zt7r9g0tv') === -1 ||
      idsAtuais.indexOf('mgic724qec8mz20') === -1
    ) {
      return
    }

    vinculo.set('negocio_id', '')
    vinculo.set('negocio_ids', [])
    vinculo.set('status', 'ambiguidade_negocio_aberto')
    vinculo.set('origem_decisao', ORIGEM_ANTERIOR)
    vinculo.set('observacao', OBSERVACAO_ANTERIOR)
    vinculo.set('vinculado_em', '')
    app.save(vinculo)
  },
)
