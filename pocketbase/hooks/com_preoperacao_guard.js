// T6.AC.8-R — propostas e atividades reais pré-carregadas são somente leitura.
// Cada callback é autocontido porque o runtime do SKIP serializa callbacks.
onRecordCreate(
  function (e) {
    function guard(record) {
      var enabled = false
      try {
        var parameter = $app.findFirstRecordByData(
          'com_parametros',
          'chave',
          'ac_preoperation_read_only',
        )
        enabled = parameter.getBool('ativo') && parameter.getString('valor') === 'true'
      } catch (_) {}
      if (!enabled) return
      var collection = record.collection().name,
        businessId = ''
      if (collection === 'com_propostas' || collection === 'com_atividades')
        businessId = record.getString('negocio_id')
      if (collection === 'com_proposta_versoes') {
        var proposal = $app.findRecordById('com_propostas', record.getString('proposta_id'))
        businessId = proposal.getString('negocio_id')
      }
      if (!businessId) return
      var business = $app.findRecordById('com_negocios', businessId)
      if (business.getString('origem_canal') === 'activecampaign')
        throw new BadRequestError('PREOPERACAO_SOMENTE_LEITURA')
    }
    guard(e.record)
    e.next()
  },
  'com_propostas',
  'com_proposta_versoes',
  'com_atividades',
)

onRecordUpdate(
  function (e) {
    function guard(record) {
      var enabled = false
      try {
        var parameter = $app.findFirstRecordByData(
          'com_parametros',
          'chave',
          'ac_preoperation_read_only',
        )
        enabled = parameter.getBool('ativo') && parameter.getString('valor') === 'true'
      } catch (_) {}
      if (!enabled) return
      var collection = record.collection().name,
        businessId = ''
      if (collection === 'com_propostas' || collection === 'com_atividades')
        businessId = record.getString('negocio_id')
      if (collection === 'com_proposta_versoes') {
        var proposal = $app.findRecordById('com_propostas', record.getString('proposta_id'))
        businessId = proposal.getString('negocio_id')
      }
      if (!businessId) return
      var business = $app.findRecordById('com_negocios', businessId)
      if (business.getString('origem_canal') === 'activecampaign')
        throw new BadRequestError('PREOPERACAO_SOMENTE_LEITURA')
    }
    guard(e.record)
    e.next()
  },
  'com_propostas',
  'com_proposta_versoes',
  'com_atividades',
)
