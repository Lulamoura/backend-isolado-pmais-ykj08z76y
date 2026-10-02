function comLedgerEventosTexto(record, field) {
  if (!record) return ''
  try {
    return record.getString(field) || ''
  } catch (_) {
    return ''
  }
}

function comLedgerEventosEscape(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
}

function comLedgerEventosNome(collectionName, id, fields) {
  if (!id) return ''
  try {
    var record = $app.findRecordById(collectionName, id)
    for (var i = 0; i < fields.length; i++) {
      var value = comLedgerEventosTexto(record, fields[i])
      if (value) return value
    }
  } catch (_) {}
  return ''
}

function comLedgerEventosNegocioDoRegistro(record, collectionName) {
  try {
    if (collectionName === 'com_proposta_versoes') {
      var proposta = $app.findRecordById(
        'com_propostas',
        comLedgerEventosTexto(record, 'proposta_id'),
      )
      return $app.findRecordById('com_negocios', comLedgerEventosTexto(proposta, 'negocio_id'))
    }
    return $app.findRecordById('com_negocios', comLedgerEventosTexto(record, 'negocio_id'))
  } catch (_) {
    return null
  }
}

function comLedgerEventosDescricao(record, collectionName) {
  if (collectionName === 'com_atividades') {
    var tipo = comLedgerEventosTexto(record, 'tipo') || 'atividade'
    var estado = comLedgerEventosTexto(record, 'estado') || 'registrada'
    var detalhe =
      comLedgerEventosTexto(record, 'resultado') || comLedgerEventosTexto(record, 'descricao')
    return ('Atividade ' + tipo + ' ' + estado + (detalhe ? ': ' + detalhe : '.')).slice(0, 2400)
  }
  if (collectionName === 'com_proposta_versoes') {
    var numero = comLedgerEventosTexto(record, 'numero')
    var estadoProposta = comLedgerEventosTexto(record, 'estado') || 'registrada'
    return (
      'Proposta comercial' +
      (numero ? ' versão ' + numero : '') +
      ' em estado ' +
      estadoProposta +
      '.'
    ).slice(0, 2400)
  }
  var anterior = comLedgerEventosTexto(record, 'etapa_anterior')
  var novo = comLedgerEventosTexto(record, 'etapa_novo')
  var justificativa = comLedgerEventosTexto(record, 'justificativa')
  return (
    'Movimentação do negócio' +
    (anterior || novo ? ': ' + (anterior || 'sem etapa') + ' → ' + (novo || 'sem etapa') : '') +
    (justificativa ? '. ' + justificativa : '.')
  ).slice(0, 2400)
}

function comLedgerEventosClassificacao(record, collectionName) {
  if (collectionName === 'com_atividades') {
    var tipo = comLedgerEventosTexto(record, 'tipo')
    var estado = comLedgerEventosTexto(record, 'estado')
    if (tipo === 'aceite_verbal_pendente') return { destino: 'escalar_direcao', risco: 'alto' }
    if (estado === 'planejada') return { destino: 'pendencia', risco: 'baixo' }
    if (tipo === 'reuniao' && estado === 'realizada' && comLedgerEventosTexto(record, 'resultado'))
      return { destino: 'curadoria', risco: 'medio' }
    return { destino: 'historico', risco: 'baixo' }
  }
  if (collectionName === 'com_proposta_versoes') {
    var estadoProposta = comLedgerEventosTexto(record, 'estado')
    if (
      estadoProposta === 'enviada' ||
      estadoProposta === 'aceita' ||
      estadoProposta === 'recusada'
    )
      return { destino: 'curadoria', risco: 'medio' }
    return { destino: 'historico', risco: 'baixo' }
  }
  return { destino: 'historico', risco: 'baixo' }
}

function comLedgerEventosRegistrar(record, collectionName) {
  if (!record || !record.id) return
  var negocio = comLedgerEventosNegocioDoRegistro(record, collectionName)
  if (!negocio) return
  var ocorridoEm =
    comLedgerEventosTexto(record, 'updated') ||
    comLedgerEventosTexto(record, 'created') ||
    new Date()
  var fato = comLedgerEventosDescricao(record, collectionName)
  var fonte =
    collectionName === 'com_atividades'
      ? 'atividade_comercial'
      : collectionName === 'com_proposta_versoes'
        ? 'proposta_comercial'
        : 'negocio_historico'
  var auditId = String(
    $security.sha256(
      ['ledger-evento-comercial-v1', collectionName, record.id, ocorridoEm, fato].join('|'),
    ),
  )
  var existente = $app.findRecordsByFilter(
    'com_ledger_comercial',
    "audit_id = '" + comLedgerEventosEscape(auditId) + "'",
    '+id',
    1,
    0,
  )
  if (existente.length) return

  var empresaId = comLedgerEventosTexto(negocio, 'empresa_id')
  var contatoId = comLedgerEventosTexto(negocio, 'contato_principal_id')
  var responsavelId =
    comLedgerEventosTexto(record, 'responsavel_id') ||
    comLedgerEventosTexto(record, 'usuario_id') ||
    comLedgerEventosTexto(negocio, 'responsavel_id')
  var numeroNegocio =
    comLedgerEventosTexto(negocio, 'oe_numero') ||
    comLedgerEventosTexto(negocio, 'external_id') ||
    comLedgerEventosTexto(negocio, 'codigo')
  var classificacao = comLedgerEventosClassificacao(record, collectionName)
  var ledger = new Record($app.findCollectionByNameOrId('com_ledger_comercial'))
  ledger.set('fonte', fonte)
  ledger.set(
    'canal',
    collectionName === 'com_atividades'
      ? comLedgerEventosTexto(record, 'canal') || 'Atividade comercial'
      : collectionName === 'com_proposta_versoes'
        ? 'Proposta comercial'
        : 'Histórico do negócio',
  )
  ledger.set('origem', collectionName)
  ledger.set('contato_nome', comLedgerEventosNome('com_contatos', contatoId, ['nome']))
  ledger.set(
    'empresa_nome',
    comLedgerEventosNome('com_empresas', empresaId, ['nome', 'razao_social']),
  )
  ledger.set('negocio_ref', numeroNegocio.slice(0, 240))
  ledger.set('negocio_id', negocio.id)
  ledger.set('responsavel_id', responsavelId)
  ledger.set('equipe_id', comLedgerEventosTexto(negocio, 'equipe_id'))
  ledger.set('responsavel', comLedgerEventosNome('users', responsavelId, ['name', 'nome']))
  ledger.set(
    'tipo_evento',
    collectionName === 'com_atividades'
      ? comLedgerEventosTexto(record, 'tipo') || 'atividade'
      : collectionName === 'com_proposta_versoes'
        ? 'proposta_' + (comLedgerEventosTexto(record, 'estado') || 'registrada')
        : 'movimentacao_negocio',
  )
  ledger.set('fato', fato)
  ledger.set('evidencia_ref', collectionName + ':' + record.id)
  ledger.set('destino_sugerido', classificacao.destino)
  ledger.set('risco', classificacao.risco)
  ledger.set('retencao', 'operacional')
  ledger.set('status', 'novo')
  ledger.set('confianca', 'alta')
  ledger.set('promocao_modo', '')
  ledger.set('revisao_status', '')
  ledger.set('audit_id', auditId)
  ledger.set(
    'payload_hash',
    String(
      $security.sha256(
        JSON.stringify({
          fonte: fonte,
          negocio_id: negocio.id,
          ocorrido_em: String(ocorridoEm),
          fato: fato,
        }),
      ),
    ),
  )
  ledger.set(
    'observacao',
    'Fato estruturado do App Comercial; sem payload bruto e sem promoção automática.',
  )
  ledger.set('occurred_at', ocorridoEm)
  $app.save(ledger)
}

function comLedgerEventosCallback(collectionName) {
  return function (e) {
    e.next()
    try {
      comLedgerEventosRegistrar(e.record, collectionName)
    } catch (_) {}
  }
}

var comLedgerEventosColecoes = ['com_atividades', 'com_proposta_versoes', 'com_negocio_historico']
for (
  var comLedgerEventosIndice = 0;
  comLedgerEventosIndice < comLedgerEventosColecoes.length;
  comLedgerEventosIndice++
) {
  var comLedgerEventosColecao = comLedgerEventosColecoes[comLedgerEventosIndice]
  onRecordAfterCreateSuccess(
    comLedgerEventosCallback(comLedgerEventosColecao),
    comLedgerEventosColecao,
  )
  onRecordAfterUpdateSuccess(
    comLedgerEventosCallback(comLedgerEventosColecao),
    comLedgerEventosColecao,
  )
}
