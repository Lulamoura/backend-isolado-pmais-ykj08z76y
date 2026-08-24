// T4.1 — decisão explícita e auditável de qualificação.
// GET  /backend/v1/qualificacoes/pendentes
// POST /backend/v1/qualificacoes/decidir

routerAdd(
  'GET',
  '/backend/v1/qualificacoes/pendentes',
  (e) => {
    var ator = e.auth
    if (!ator) return e.unauthorizedError('Autenticacao necessaria')
    if (!ator.getBool('ativo_comercial')) return e.forbiddenError('Usuario comercial inativo')

    var pagina = Number(e.requestInfo().query.pagina || 1)
    var porPagina = Number(e.requestInfo().query.por_pagina || 20)
    if (
      !Number.isInteger(pagina) ||
      pagina < 1 ||
      !Number.isInteger(porPagina) ||
      porPagina < 1 ||
      porPagina > 100
    )
      return e.badRequestError('Paginacao invalida')

    var perfil = ''
    try {
      var perfilId = ator.getString('perfil_id')
      if (perfilId) perfil = $app.findRecordById('com_perfis', perfilId).getString('slug')
    } catch (_) {}
    if (perfil === 'negociacao-propria') return e.json(403, { error: 'ACAO_NAO_AUTORIZADA' })
    var filtro =
      "qualificacao = 'pendente' && etapa = 'prospects' && inativo = false && crm_created_at >= '2026-08-24 03:00:00.000Z'"
    if (perfil !== 'superadministrador') {
      var equipeId = ator.getString('equipe_id')
      filtro += equipeId
        ? " && (responsavel_id = '' || responsavel_id = '" +
          ator.id +
          "' || equipe_id = '" +
          equipeId +
          "')"
        : " && (responsavel_id = '' || responsavel_id = '" + ator.id + "')"
    }

    var registros = $app.findRecordsByFilter(
      'com_negocios',
      filtro,
      '-created',
      porPagina + 1,
      (pagina - 1) * porPagina,
    )
    var temMais = registros.length > porPagina
    if (temMais) registros.pop()
    var itens = []
    for (var i = 0; i < registros.length; i++) {
      var r = registros[i]
      var empresa = null
      var responsavel = null
      try {
        var er = $app.findRecordById('com_empresas', r.getString('empresa_id'))
        empresa = { id: er.id, nome: er.getString('nome') }
      } catch (_) {}
      try {
        var ur = $app.findRecordById('users', r.getString('responsavel_id'))
        responsavel = { id: ur.id, nome: ur.getString('name') || ur.getString('email') }
      } catch (_) {}
      var externalId = null
      try {
        externalId = $app
          .findFirstRecordByFilter(
            'com_vinculos_externos',
            "sistema_origem='activecampaign' && external_type='business' && record_id='" +
              r.id +
              "'",
          )
          .getString('external_id')
      } catch (_) {}
      itens.push({
        id: r.id,
        external_id: externalId,
        titulo: r.getString('titulo'),
        descricao: r.getString('descricao') || null,
        origem_canal: r.getString('origem_canal') || null,
        tipo_entrada: r.getString('tipo_entrada') || 'pendente',
        qualificacao: r.getString('qualificacao') || 'pendente',
        empresa: empresa,
        responsavel: responsavel,
        created: r.getString('created'),
        updated: r.getString('updated'),
      })
    }
    return e.json(200, { itens: itens, pagina: pagina, por_pagina: porPagina, tem_mais: temMais })
  },
  $apis.requireAuth(),
)

routerAdd(
  'POST',
  '/backend/v1/qualificacoes/decidir',
  (e) => {
    try {
      var perfilRestrito = $app.findRecordById('com_perfis', e.auth.getString('perfil_id'))
      if (perfilRestrito.getString('slug') === 'negociacao-propria')
        return e.json(403, { error: 'ACAO_NAO_AUTORIZADA' })
    } catch (_) {}
    function canonicalize(obj) {
      if (obj === null || obj === undefined) return 'null'
      if (typeof obj !== 'object') return JSON.stringify(obj)
      var keys = Object.keys(obj).sort()
      var parts = []
      for (var i = 0; i < keys.length; i++)
        parts.push(JSON.stringify(keys[i]) + ':' + canonicalize(obj[keys[i]]))
      return '{' + parts.join(',') + '}'
    }
    function recordId(v) {
      return /^[a-z0-9]{15}$/.test(v || '')
    }
    function podeAcessar(ator, perfil, negocio) {
      if (perfil === 'superadministrador') return true
      if (
        negocio.getString('etapa') === 'prospects' &&
        !negocio.getString('responsavel_id') &&
        negocio.getString('crm_created_at') >= '2026-08-24 03:00:00.000Z'
      )
        return perfil !== 'negociacao-propria'
      if (negocio.getString('responsavel_id') === ator.id) return true
      var equipe = ator.getString('equipe_id')
      return !!equipe && negocio.getString('equipe_id') === equipe
    }

    var ator = e.auth
    if (!ator) return e.unauthorizedError('Autenticacao necessaria')
    if (!ator.getBool('ativo_comercial')) return e.forbiddenError('Usuario comercial inativo')
    var body
    try {
      body = JSON.parse(toString(e.request.body))
    } catch (_) {
      return e.badRequestError('JSON invalido')
    }
    var permitidos = [
      'negocio_id',
      'decisao',
      'motivo',
      'justificativa',
      'updated_esperado',
      'command_idempotency_key',
    ]
    var keys = Object.keys(body || {})
    for (var k = 0; k < keys.length; k++)
      if (permitidos.indexOf(keys[k]) === -1)
        return e.json(400, { error: 'VALIDATION', message: 'Campo nao permitido: ' + keys[k] })
    if (
      !recordId(body.negocio_id) ||
      (body.decisao !== 'qualificada' && body.decisao !== 'desqualificada')
    )
      return e.json(400, { error: 'VALIDATION', message: 'Negocio ou decisao invalida' })
    if (
      !body.updated_esperado ||
      !body.command_idempotency_key ||
      body.command_idempotency_key.length > 128
    )
      return e.json(400, {
        error: 'VALIDATION',
        message: 'Concorrencia e idempotencia sao obrigatorias',
      })
    var motivo = String(body.motivo || '').trim()
    var justificativa = String(body.justificativa || '').trim()
    if (body.decisao === 'desqualificada' && !motivo)
      return e.json(400, {
        error: 'MOTIVO_OBRIGATORIO',
        message: 'Motivo obrigatorio para desqualificar',
      })
    if (motivo.length > 500 || justificativa.length > 1000)
      return e.json(400, { error: 'VALIDATION', message: 'Texto excede o limite permitido' })

    var perfil = ''
    try {
      var perfilId = ator.getString('perfil_id')
      if (perfilId) perfil = $app.findRecordById('com_perfis', perfilId).getString('slug')
    } catch (_) {}
    var payload = {
      negocio_id: body.negocio_id,
      decisao: body.decisao,
      motivo: motivo,
      justificativa: justificativa,
      updated_esperado: body.updated_esperado,
    }
    var payloadHash = $security.sha256(canonicalize(payload))
    var resposta = null
    var txError = ''

    // Replay conhecido é resolvido antes de abrir uma nova transação. Em
    // SQLite, tentar o INSERT duplicado dentro da transação pode invalidar o
    // contexto antes da releitura do registro vencedor.
    var replayExistente = []
    try {
      replayExistente = $app.findRecordsByFilter(
        'com_idempotencia',
        "ator_id='" +
          ator.id +
          "' && comando='decidir_qualificacao' && command_idempotency_key='" +
          body.command_idempotency_key +
          "'",
        '',
        1,
        0,
      )
    } catch (_) {}
    if (replayExistente.length) {
      var replayRec = replayExistente[0]
      if (replayRec.getString('payload_hash') !== payloadHash)
        return e.json(409, { error: 'CONFLICT' })
      if (replayRec.getString('estado') === 'executando')
        return e.json(409, { error: 'CONCORRENTE' })
      if (replayRec.getString('estado') !== 'concluido') return e.json(409, { error: 'CONFLICT' })
      var replayResultado = replayRec.get('resultado') || {}
      return e.json(200, {
        negocio_id: replayResultado.negocio_id || body.negocio_id,
        qualificacao: replayResultado.qualificacao || body.decisao,
        historico_id: replayResultado.historico_id || '',
        replay: true,
      })
    }

    try {
      $app.runInTransaction(function (txApp) {
        var idemCol = txApp.findCollectionByNameOrId('com_idempotencia')
        var idem = new Record(idemCol)
        idem.set('command_idempotency_key', body.command_idempotency_key)
        idem.set('comando', 'decidir_qualificacao')
        idem.set('ator_id', ator.id)
        idem.set('payload_hash', payloadHash)
        idem.set('estado', 'executando')
        idem.set('executor_id', 'pb-primary')
        idem.set('tentativa', 1)
        idem.set('claim_version', 1)
        idem.set('inicio_em', new Date())
        idem.set('lease_ate', new Date(Date.now() + 300000))
        idem.set('resultado', {})
        idem.set('registros_afetados', [])
        try {
          txApp.save(idem)
        } catch (err) {
          if (String(err).indexOf('UNIQUE') === -1) throw err
          var anteriores = txApp.findRecordsByFilter(
            'com_idempotencia',
            "ator_id='" +
              ator.id +
              "' && comando='decidir_qualificacao' && command_idempotency_key='" +
              body.command_idempotency_key +
              "'",
            '',
            1,
            0,
          )
          if (!anteriores.length) throw err
          var anterior = anteriores[0]
          if (anterior.getString('payload_hash') !== payloadHash) throw new Error('CONFLICT')
          if (anterior.getString('estado') === 'executando') throw new Error('CONCORRENTE')
          resposta = anterior.get('resultado') || { replay: true }
          resposta.replay = true
          return
        }

        var usuarioTx = txApp.findRecordById('users', ator.id)
        if (!usuarioTx.getBool('ativo_comercial')) throw new Error('FORBIDDEN')
        var perfilTx = ''
        try {
          var perfilTxId = usuarioTx.getString('perfil_id')
          if (perfilTxId)
            perfilTx = txApp.findRecordById('com_perfis', perfilTxId).getString('slug')
        } catch (_) {}
        var negocio = txApp.findRecordById('com_negocios', body.negocio_id)
        try {
          var preop = txApp.findFirstRecordByData(
            'com_parametros',
            'chave',
            'ac_preoperation_read_only',
          )
          if (
            preop.getBool('ativo') &&
            preop.getString('valor') === 'true' &&
            negocio.getString('origem_canal') === 'activecampaign'
          )
            throw new Error('PREOPERACAO_SOMENTE_LEITURA')
        } catch (preopError) {
          if (String(preopError).indexOf('PREOPERACAO_SOMENTE_LEITURA') !== -1) throw preopError
        }
        if (!podeAcessar(usuarioTx, perfilTx, negocio)) throw new Error('FORBIDDEN')
        if (negocio.getString('updated') !== body.updated_esperado) throw new Error('STALE_WRITE')
        var anteriorEstado = negocio.getString('qualificacao') || 'pendente'
        if (anteriorEstado !== 'pendente') throw new Error('JA_DECIDIDO')

        negocio.set('qualificacao', body.decisao)
        if (body.decisao === 'qualificada') {
          negocio.set('etapa', 'producao_proposta')
          negocio.set('resultado', '')
          negocio.set('inativo', false)
        } else {
          negocio.set('etapa', 'prospects')
          negocio.set('resultado', 'desqualificado')
          negocio.set('inativo', true)
        }
        txApp.save(negocio)

        var histCol = txApp.findCollectionByNameOrId('com_qualificacao_historico')
        var hist = new Record(histCol)
        hist.set('negocio_id', negocio.id)
        hist.set('idempotency_key', body.command_idempotency_key)
        hist.set('estado_anterior', anteriorEstado)
        hist.set('estado_novo', body.decisao)
        if (motivo) hist.set('motivo', motivo)
        hist.set('autor_id', ator.id)
        hist.set('origem', 'manual')
        if (justificativa) hist.set('justificativa', justificativa)
        hist.set('data_hora_efetiva', new Date())
        txApp.save(hist)

        var evidencia = {
          negocio_id: negocio.id,
          estado_anterior: anteriorEstado,
          estado_novo: body.decisao,
          motivo: motivo || null,
          autor_id: ator.id,
          historico_id: hist.id,
        }
        var audCol = txApp.findCollectionByNameOrId('com_auditoria')
        var aud = new Record(audCol)
        aud.set('collection_name', 'com_negocios')
        aud.set('record_id', negocio.id)
        aud.set('acao', 'update')
        aud.set('usuario_id', ator.id)
        aud.set('comando', 'decidir_qualificacao')
        aud.set('command_idempotency_key', body.command_idempotency_key)
        aud.set('transacao_id', $security.sha256(body.command_idempotency_key + '|' + negocio.id))
        aud.set('evento_em', new Date())
        aud.set('snapshot_hash', $security.sha256(canonicalize(evidencia)))
        aud.set('snapshot_hash_versao', '1')
        aud.set('evidencia_estruturada', evidencia)
        aud.set('perfil', perfilTx)
        aud.set('escopo', 'comando')
        aud.set('origem', 'server-side')
        aud.set('sequencia', 1)
        txApp.save(aud)

        resposta = {
          negocio_id: negocio.id,
          qualificacao: body.decisao,
          historico_id: hist.id,
          replay: false,
        }
        idem.set('estado', 'concluido')
        idem.set('conclusao_em', new Date())
        idem.set('codigo_retorno', '200')
        idem.set('registros_afetados', [negocio.id, hist.id])
        idem.set('resultado', resposta)
        txApp.save(idem)
      })
    } catch (err) {
      txError = String(err).substring(0, 500)
    }

    if (txError.indexOf('STALE_WRITE') !== -1) return e.json(409, { error: 'STALE_WRITE' })
    if (txError.indexOf('JA_DECIDIDO') !== -1) return e.json(409, { error: 'JA_DECIDIDO' })
    if (txError.indexOf('CONCORRENTE') !== -1) return e.json(409, { error: 'CONCORRENTE' })
    if (txError.indexOf('CONFLICT') !== -1) return e.json(409, { error: 'CONFLICT' })
    if (txError.indexOf('FORBIDDEN') !== -1) return e.json(403, { error: 'FORBIDDEN' })
    if (txError) return e.json(500, { error: 'INTERNAL', message: 'Falha ao registrar decisao' })
    return e.json(200, resposta)
  },
  $apis.requireAuth(),
)
