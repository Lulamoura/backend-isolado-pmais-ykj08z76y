routerAdd('GET', '/backend/v1/negocios/{id}/notas', function (e) {
  if (!e.auth) return e.unauthorizedError('Autenticacao necessaria')
  var negocio
  try {
    negocio = $app.findRecordById('com_negocios', e.request.pathValue('id'))
  } catch (_) {
    return e.notFoundError('Negocio nao encontrado')
  }
  if (!e.auth.getBool('ativo_comercial')) return e.forbiddenError('Acesso negado')
  var slug = ''
  try {
    slug = $app.findRecordById('com_perfis', e.auth.getString('perfil_id')).getString('slug')
  } catch (_) {}
  var podeLer =
    slug === 'superadministrador' ||
    negocio.getString('responsavel_id') === e.auth.id ||
    (e.auth.getString('equipe_id') &&
      e.auth.getString('equipe_id') === negocio.getString('equipe_id'))
  if (!podeLer) return e.forbiddenError('Acesso negado')
  var records = $app.findRecordsByFilter(
    'com_notas_negocio',
    "negocio_id='" + negocio.id + "'",
    '-criada_em,-id',
    500,
    0,
  )
  return e.json(200, {
    total: records.length,
    itens: records.map(function (r) {
      return {
        id: r.id,
        external_id: r.getString('external_id'),
        texto: r.getString('texto'),
        autor_external_id: r.getString('autor_external_id') || null,
        autor_nome: r.getString('autor_nome') || null,
        criada_em: r.getString('criada_em'),
        alterada_em: r.getString('alterada_em') || null,
      }
    }),
  })
})

routerAdd('POST', '/backend/v1/integracao/ac/notas/sincronizar', function (e) {
  if (!e.auth) return e.unauthorizedError('Autenticacao necessaria')
  var slug = ''
  try {
    slug = $app.findRecordById('com_perfis', e.auth.getString('perfil_id')).getString('slug')
  } catch (_) {}
  if (!e.auth.getBool('ativo_comercial') || slug !== 'superadministrador')
    return e.forbiddenError('SuperAdmin necessario')
  var body = e.requestInfo().body || {},
    dryRun = body.executar !== true
  var apiUrl = String($secrets.get('AC_API_URL') || '').replace(/\/$/, ''),
    apiKey = $secrets.get('AC_API_KEY') || ''
  if (!apiUrl || !apiKey) return e.json(503, { error: 'CONFIGURACAO_AC_AUSENTE' })
  var links = $app.findRecordsByFilter(
    'com_vinculos_externos',
    "sistema_origem='activecampaign' && external_type='business' && collection_name='com_negocios'",
    'external_id',
    1000,
    0,
  )
  var planned = [],
    unchanged = 0
  for (var li = 0; li < links.length; li++) {
    var externalDealId = links[li].getString('external_id'),
      negocioId = links[li].getString('record_id')
    if (!externalDealId || !negocioId) continue
    var notes = []
    for (var page = 0; page < 100; page++) {
      var response = $http.send({
        url:
          apiUrl +
          '/api/3/notes?limit=100&offset=' +
          page * 100 +
          '&filters[relid]=' +
          encodeURIComponent(externalDealId),
        method: 'GET',
        headers: { 'Api-Token': apiKey, Accept: 'application/json' },
        timeout: 20,
      })
      if (response.statusCode !== 200)
        return e.json(502, { error: 'AC_HTTP_' + response.statusCode })
      var batch = (response.json && response.json.notes) || []
      for (var bi = 0; bi < batch.length; bi++) notes.push(batch[bi])
      if (batch.length < 100) break
      if (page === 99) return e.json(422, { error: 'AC_PAGINACAO_EXCEDE_LIMITE' })
    }
    for (var ni = 0; ni < notes.length; ni++) {
      if (String(notes[ni].reltype || '').toLowerCase() !== 'deal') continue
      var existing = null
      try {
        existing = $app.findFirstRecordByData(
          'com_notas_negocio',
          'external_id',
          String(notes[ni].id),
        )
      } catch (_) {}
      if (existing) unchanged++
      else planned.push({ negocio_id: negocioId, note: notes[ni] })
    }
  }
  if (!dryRun) {
    $app.runInTransaction(function (txApp) {
      var collection = txApp.findCollectionByNameOrId('com_notas_negocio')
      for (var pi = 0; pi < planned.length; pi++) {
        var rec = new Record(collection),
          note = planned[pi].note
        rec.set('negocio_id', planned[pi].negocio_id)
        rec.set('external_id', String(note.id))
        rec.set('texto', String(note.note || ''))
        rec.set('autor_external_id', String(note.userid || ''))
        rec.set('criada_em', note.cdate)
        rec.set('alterada_em', note.mdate || null)
        rec.set('origem', 'activecampaign')
        txApp.save(rec)
      }
    })
  }
  return e.json(200, {
    dry_run: dryRun,
    negocios_consultados: links.length,
    criar: planned.length,
    inalteradas: unchanged,
  })
})
