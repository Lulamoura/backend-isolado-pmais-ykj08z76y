// Relatorio agregado somente leitura para o acompanhamento comercial diario.
// A rota nao altera dados e e restrita ao perfil tecnico de integracao e ao SuperAdmin.
routerAdd(
  'GET',
  '/backend/v1/monitoramento-comercial/diario',
  function (e) {
    if (!e.auth) return e.unauthorizedError('Autenticacao necessaria')
    if (!e.auth.getBool('ativo_comercial')) return e.forbiddenError('Usuario comercial inativo')

    var slug = ''
    try {
      slug = $app.findRecordById('com_perfis', e.auth.getString('perfil_id')).getString('slug')
    } catch (_) {}
    if (slug !== 'integracao' && slug !== 'superadministrador')
      return e.forbiddenError('Acesso restrito ao monitoramento comercial')

    function safeRecords(collection, filter, sort, limit) {
      try {
        return $app.findRecordsByFilter(collection, filter || '', sort || 'id', limit || 5000, 0)
      } catch (_) {
        return []
      }
    }
    function indexById(records) {
      var out = {}
      for (var i = 0; i < records.length; i++) out[records[i].id] = records[i]
      return out
    }
    function iso(record, field) {
      var value = record.getString(field)
      return value || null
    }

    var users = safeRecords('users', '', 'name,id', 500)
    var companies = safeRecords('com_empresas', '', 'nome,id', 5000)
    var userById = indexById(users)
    var companyById = indexById(companies)
    var notes = safeRecords('com_notas_negocio', '', 'criada_em,id', 10000)
    var activities = safeRecords('com_atividades', '', 'planejada_para,id', 10000)
    var recoveries = safeRecords('com_recuperacao_agendas', '', 'data_alvo,id', 5000)
    var links = safeRecords(
      'com_vinculos_externos',
      "sistema_origem='activecampaign' && external_type='business' && collection_name='com_negocios'",
      'record_id,id',
      10000,
    )

    var notesByDeal = {}, activitiesByDeal = {}, recoveriesByDeal = {}, externalByDeal = {}
    var i
    for (i = 0; i < notes.length; i++) {
      var noteDeal = notes[i].getString('negocio_id')
      if (!notesByDeal[noteDeal]) notesByDeal[noteDeal] = []
      notesByDeal[noteDeal].push({
        id: notes[i].id,
        texto: notes[i].getString('texto'),
        autor_nome: notes[i].getString('autor_nome') || null,
        criada_em: iso(notes[i], 'criada_em'),
        alterada_em: iso(notes[i], 'alterada_em'),
      })
    }
    for (i = 0; i < activities.length; i++) {
      var activityDeal = activities[i].getString('negocio_id')
      if (!activitiesByDeal[activityDeal]) activitiesByDeal[activityDeal] = []
      activitiesByDeal[activityDeal].push({
        id: activities[i].id,
        tipo: activities[i].getString('tipo'),
        descricao: activities[i].getString('descricao') || null,
        canal: activities[i].getString('canal') || null,
        estado: activities[i].getString('estado'),
        planejada_para: iso(activities[i], 'planejada_para'),
        realizada_em: iso(activities[i], 'realizada_em'),
        resultado: activities[i].getString('resultado') || null,
      })
    }
    for (i = 0; i < recoveries.length; i++) {
      var recoveryDeal = recoveries[i].getString('negocio_perdido_id')
      if (!recoveriesByDeal[recoveryDeal]) recoveriesByDeal[recoveryDeal] = []
      recoveriesByDeal[recoveryDeal].push({
        id: recoveries[i].id,
        data_alvo: iso(recoveries[i], 'data_alvo'),
        antecedencia_dias: recoveries[i].getInt('antecedencia_dias'),
        contexto: recoveries[i].getString('contexto') || null,
        estado: recoveries[i].getString('estado'),
      })
    }
    for (i = 0; i < links.length; i++)
      externalByDeal[links[i].getString('record_id')] = links[i].getString('external_id') || null

    var deals = safeRecords('com_negocios', "inativo=false", '-valor,titulo,id', 10000)
    var output = []
    for (i = 0; i < deals.length; i++) {
      var d = deals[i]
      var owner = userById[d.getString('responsavel_id')]
      var company = companyById[d.getString('empresa_id')]
      output.push({
        id: d.id,
        activecampaign_id: externalByDeal[d.id] || null,
        titulo: d.getString('titulo'),
        empresa: company ? { id: company.id, nome: company.getString('nome') } : null,
        responsavel: owner
          ? { id: owner.id, nome: owner.getString('name'), email: owner.getString('email') }
          : null,
        valor: Number(d.get('valor') || 0),
        modalidade: d.getString('modalidade') || null,
        etapa: d.getString('etapa') || null,
        fase_crm: d.getString('fase_crm') || null,
        resultado: d.getString('resultado') || null,
        status: d.getString('status') || null,
        proxima_acao_em: iso(d, 'proxima_acao_em'),
        etapa_entrou_em: iso(d, 'etapa_entrou_em'),
        crm_created_at: iso(d, 'crm_created_at'),
        crm_updated_at: iso(d, 'crm_updated_at'),
        notas: notesByDeal[d.id] || [],
        atividades: activitiesByDeal[d.id] || [],
        recuperacoes: recoveriesByDeal[d.id] || [],
      })
    }

    return e.json(200, {
      schema_version: 1,
      generated_at: new Date().toISOString(),
      read_only: true,
      total: output.length,
      negocios: output,
    })
  },
  $apis.requireAuth('users'),
)
