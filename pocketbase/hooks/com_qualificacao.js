// T4.1 — decisão explícita e auditável de qualificação.
// GET  /backend/v1/qualificacoes/pendentes
// POST /backend/v1/qualificacoes/assumir
// POST /backend/v1/qualificacoes/decidir
// POST /backend/v1/qualificacoes/devolver

function comQualificacaoGarantirCampos() {
  var negocios = $app.findCollectionByNameOrId('com_negocios')
  var alterado = false
  if (!negocios.fields.getByName('qualificacao_responsavel_id')) {
    negocios.fields.add(
      new RelationField({
        name: 'qualificacao_responsavel_id',
        collectionId: '_pb_users_auth_',
        maxSelect: 1,
        cascadeDelete: false,
        required: false,
      }),
    )
    alterado = true
  }
  if (!negocios.fields.getByName('qualificacao_assumida_em')) {
    negocios.fields.add(new DateField({ name: 'qualificacao_assumida_em', required: false }))
    alterado = true
  }
  if (!negocios.fields.getByName('qualificacao_decidida_em')) {
    negocios.fields.add(new DateField({ name: 'qualificacao_decidida_em', required: false }))
    alterado = true
  }
  if (alterado) {
    negocios.indexes = Array.from(
      new Set([
        ...(negocios.indexes || []),
        'CREATE INDEX idx_com_negocios_qualificacao_responsavel ON com_negocios (qualificacao_responsavel_id, qualificacao)',
      ]),
    )
    $app.save(negocios)
  }
}

routerAdd(
  'GET',
  '/backend/v1/qualificacoes/pendentes',
  (e) => {
    var ator = e.auth
    if (!ator) return e.unauthorizedError('Autenticacao necessaria')
    if (!ator.getBool('ativo_comercial')) return e.forbiddenError('Usuario comercial inativo')
    try {
      comQualificacaoGarantirCampos()
    } catch (_) {
      return e.json(503, { error: 'QUALIFICACAO_SCHEMA_INDISPONIVEL' })
    }

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
    var escopo = 'proprios'
    try {
      var perfilId = ator.getString('perfil_id')
      if (perfilId) {
        perfil = $app.findRecordById('com_perfis', perfilId).getString('slug')
        var links = $app.findRecordsByFilter(
          'com_perfil_permissoes',
          "perfil_id='" + perfilId + "'",
          '',
          500,
          0,
        )
        for (var li = 0; li < links.length; li++) {
          var permissao = $app.findRecordById('com_permissoes', links[li].getString('permissao_id'))
          if (permissao.getString('slug') === 'negocios.view')
            escopo = links[li].getString('escopo')
        }
      }
    } catch (_) {}
    if (perfil === 'negociacao-propria') return e.json(403, { error: 'ACAO_NAO_AUTORIZADA' })
    var filtro =
      "qualificacao = 'pendente' && etapa = 'prospects' && inativo = false && crm_created_at >= '2026-08-24 03:00:00.000Z'"
    var filtrarQualificacaoPropria = false
    if (perfil !== 'superadministrador' && perfil !== 'leitura-executiva' && escopo !== 'todos') {
      var equipeId = ator.getString('equipe_id')
      if (escopo === 'equipe' && equipeId)
        filtro +=
          " && (responsavel_id = '' || responsavel_id = '" +
          ator.id +
          "' || equipe_id = '" +
          equipeId +
          "')"
      else filtrarQualificacaoPropria = true
    }

    var registros = $app.findRecordsByFilter('com_negocios', filtro, '-created', 1000, 0)
    if (filtrarQualificacaoPropria) {
      var registrosProprios = []
      for (var fi = 0; fi < registros.length; fi++) {
        var qualificador = registros[fi].getString('qualificacao_responsavel_id')
        if (!qualificador || qualificador === ator.id) registrosProprios.push(registros[fi])
      }
      registros = registrosProprios
    }
    var inicioPagina = (pagina - 1) * porPagina
    var temMais = registros.length > inicioPagina + porPagina
    registros = registros.slice(inicioPagina, inicioPagina + porPagina)
    var itens = []
    for (var i = 0; i < registros.length; i++) {
      var r = registros[i]
      var empresa = null
      var contato = null
      var responsavel = null
      var responsavelQualificacao = null
      try {
        var er = $app.findRecordById('com_empresas', r.getString('empresa_id'))
        empresa = { id: er.id, nome: er.getString('nome') }
      } catch (_) {}
      try {
        var cr = $app.findRecordById('com_contatos', r.getString('contato_principal_id'))
        contato = {
          id: cr.id,
          nome: cr.getString('nome') || null,
          email: cr.getString('email') || null,
          telefone: cr.getString('telefone') || null,
        }
      } catch (_) {}
      try {
        var ur = $app.findRecordById('users', r.getString('responsavel_id'))
        responsavel = { id: ur.id, nome: ur.getString('name') || ur.getString('email') }
      } catch (_) {}
      try {
        var qr = $app.findRecordById('users', r.getString('qualificacao_responsavel_id'))
        responsavelQualificacao = {
          id: qr.id,
          nome: qr.getString('name') || qr.getString('email'),
        }
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
        contato: contato,
        responsavel: responsavel,
        responsavel_qualificacao: responsavelQualificacao,
        qualificacao_assumida_em: r.getString('qualificacao_assumida_em') || null,
        proxima_acao_em: r.getString('proxima_acao_em') || null,
        created: r.getString('created'),
        updated: r.getString('updated'),
      })
    }
    var responsaveisQualificacao = []
    if (perfil === 'superadministrador' || perfil === 'gestor-comercial') {
      var usuarios = $app.findRecordsByFilter('users', 'ativo_comercial = true', 'name', 200, 0)
      for (var ui = 0; ui < usuarios.length; ui++) {
        var usuario = usuarios[ui],
          slugUsuario = ''
        try {
          slugUsuario = $app
            .findRecordById('com_perfis', usuario.getString('perfil_id'))
            .getString('slug')
        } catch (_) {}
        if (slugUsuario === 'operador-comercial' || slugUsuario === 'gestor-comercial')
          responsaveisQualificacao.push({
            id: usuario.id,
            nome: usuario.getString('name') || usuario.getString('email'),
          })
      }
    }
    var indicadores = []
    if (
      perfil === 'superadministrador' ||
      perfil === 'gestor-comercial' ||
      perfil === 'leitura-executiva'
    ) {
      var mapa = {}
      var negociosIndicadores = $app.findRecordsByFilter(
        'com_negocios',
        "crm_created_at >= '2026-08-24 03:00:00.000Z'",
        '',
        1000,
        0,
      )
      for (var ni = 0; ni < negociosIndicadores.length; ni++) {
        var negocioIndicador = negociosIndicadores[ni]
        var qualificadorId = negocioIndicador.getString('qualificacao_responsavel_id')
        if (!qualificadorId) continue
        if (!mapa[qualificadorId])
          mapa[qualificadorId] = {
            usuario_id: qualificadorId,
            nome: '',
            assumidos: 0,
            qualificados: 0,
            desqualificados: 0,
            devolvidos: 0,
            soma_tempo_assumir_horas: 0,
            contagem_tempo_assumir: 0,
            soma_tempo_decidir_horas: 0,
            contagem_tempo_decidir: 0,
          }
        var metrica = mapa[qualificadorId]
        metrica.assumidos++
        var estadoQualificacao = negocioIndicador.getString('qualificacao')
        if (estadoQualificacao === 'qualificada') metrica.qualificados++
        if (estadoQualificacao === 'desqualificada') metrica.desqualificados++
        var criada = new Date(negocioIndicador.getString('crm_created_at'))
        var assumida = new Date(negocioIndicador.getString('qualificacao_assumida_em'))
        var decidida = new Date(negocioIndicador.getString('qualificacao_decidida_em'))
        if (!isNaN(criada.getTime()) && !isNaN(assumida.getTime())) {
          metrica.soma_tempo_assumir_horas += (assumida.getTime() - criada.getTime()) / 3600000
          metrica.contagem_tempo_assumir++
        }
        if (!isNaN(assumida.getTime()) && !isNaN(decidida.getTime())) {
          metrica.soma_tempo_decidir_horas += (decidida.getTime() - assumida.getTime()) / 3600000
          metrica.contagem_tempo_decidir++
        }
      }
      var devolucoes = $app.findRecordsByFilter(
        'com_qualificacao_historico',
        "origem = 'reavaliacao' && estado_novo = 'pendente'",
        '',
        1000,
        0,
      )
      for (var di = 0; di < devolucoes.length; di++) {
        try {
          var negocioDevolvido = $app.findRecordById(
            'com_negocios',
            devolucoes[di].getString('negocio_id'),
          )
          var responsavelDevolvido = negocioDevolvido.getString('qualificacao_responsavel_id')
          if (mapa[responsavelDevolvido]) mapa[responsavelDevolvido].devolvidos++
        } catch (_) {}
      }
      var idsIndicadores = Object.keys(mapa)
      for (var mi = 0; mi < idsIndicadores.length; mi++) {
        var idIndicador = idsIndicadores[mi],
          itemIndicador = mapa[idIndicador]
        try {
          var usuarioIndicador = $app.findRecordById('users', idIndicador)
          itemIndicador.nome =
            usuarioIndicador.getString('name') || usuarioIndicador.getString('email')
        } catch (_) {
          itemIndicador.nome = 'Usuário não identificado'
        }
        var decisoes = itemIndicador.qualificados + itemIndicador.desqualificados
        indicadores.push({
          usuario_id: itemIndicador.usuario_id,
          nome: itemIndicador.nome,
          assumidos: itemIndicador.assumidos,
          qualificados: itemIndicador.qualificados,
          desqualificados: itemIndicador.desqualificados,
          taxa_qualificacao: decisoes
            ? Math.round((itemIndicador.qualificados / decisoes) * 10000) / 100
            : 0,
          devolvidos: itemIndicador.devolvidos,
          tempo_medio_assumir_horas: itemIndicador.contagem_tempo_assumir
            ? Math.round(
                (itemIndicador.soma_tempo_assumir_horas / itemIndicador.contagem_tempo_assumir) *
                  100,
              ) / 100
            : null,
          tempo_medio_decidir_horas: itemIndicador.contagem_tempo_decidir
            ? Math.round(
                (itemIndicador.soma_tempo_decidir_horas / itemIndicador.contagem_tempo_decidir) *
                  100,
              ) / 100
            : null,
        })
      }
      indicadores.sort(function (a, b) {
        return a.nome < b.nome ? -1 : 1
      })
    }
    return e.json(200, {
      itens: itens,
      pagina: pagina,
      por_pagina: porPagina,
      tem_mais: temMais,
      responsaveis_qualificacao: responsaveisQualificacao,
      indicadores: indicadores,
    })
  },
  $apis.requireAuth(),
)

routerAdd(
  'POST',
  '/backend/v1/qualificacoes/assumir',
  (e) => {
    var ator = e.auth
    if (!ator) return e.unauthorizedError('Autenticacao necessaria')
    if (!ator.getBool('ativo_comercial')) return e.forbiddenError('Usuario comercial inativo')
    var perfil = ''
    try {
      perfil = $app.findRecordById('com_perfis', ator.getString('perfil_id')).getString('slug')
    } catch (_) {}
    if (perfil === 'negociacao-propria' || perfil === 'leitura-executiva')
      return e.json(403, { error: 'ACAO_NAO_AUTORIZADA' })
    var body
    try {
      body = JSON.parse(toString(e.request.body))
    } catch (_) {
      return e.json(400, { error: 'VALIDATION' })
    }
    if (!/^[a-z0-9]{15}$/.test(body.negocio_id || '') || !body.updated_esperado)
      return e.json(400, { error: 'VALIDATION' })
    var resposta = null,
      erro = ''
    try {
      $app.runInTransaction(function (tx) {
        var negocio = tx.findRecordById('com_negocios', body.negocio_id)
        if (
          negocio.getString('etapa') !== 'prospects' ||
          negocio.getString('qualificacao') !== 'pendente' ||
          negocio.getBool('inativo')
        )
          throw new Error('NAO_PENDENTE')
        if (negocio.getString('updated') !== body.updated_esperado) throw new Error('STALE_WRITE')
        var atual = negocio.getString('qualificacao_responsavel_id')
        if (atual && atual !== ator.id) throw new Error('JA_ATRIBUIDA')
        if (!atual) {
          negocio.set('qualificacao_responsavel_id', ator.id)
          negocio.set('qualificacao_assumida_em', new Date())
          tx.save(negocio)
          var evidencia = {
            negocio_id: negocio.id,
            qualificacao_responsavel_id: ator.id,
            assumida_em: negocio.getString('qualificacao_assumida_em'),
          }
          var aud = new Record(tx.findCollectionByNameOrId('com_auditoria'))
          aud.set('collection_name', 'com_negocios')
          aud.set('record_id', negocio.id)
          aud.set('acao', 'update')
          aud.set('usuario_id', ator.id)
          aud.set('comando', 'assumir_qualificacao')
          aud.set('evento_em', new Date())
          aud.set('snapshot_hash', $security.sha256(JSON.stringify(evidencia)))
          aud.set('snapshot_hash_versao', '1')
          aud.set('evidencia_estruturada', evidencia)
          aud.set('perfil', perfil)
          aud.set('escopo', 'comando')
          aud.set('origem', 'server-side')
          aud.set('sequencia', 1)
          tx.save(aud)
        }
        resposta = {
          negocio_id: negocio.id,
          qualificacao_responsavel_id: ator.id,
          updated: negocio.getString('updated'),
        }
      })
    } catch (err) {
      erro = String(err)
    }
    if (erro.indexOf('STALE_WRITE') !== -1) return e.json(409, { error: 'STALE_WRITE' })
    if (erro.indexOf('JA_ATRIBUIDA') !== -1) return e.json(409, { error: 'JA_ATRIBUIDA' })
    if (erro.indexOf('NAO_PENDENTE') !== -1) return e.json(409, { error: 'NAO_PENDENTE' })
    if (erro) return e.json(500, { error: 'INTERNAL' })
    return e.json(200, resposta)
  },
  $apis.requireAuth(),
)

routerAdd(
  'POST',
  '/backend/v1/qualificacoes/atribuir',
  (e) => {
    var ator = e.auth
    if (!ator) return e.unauthorizedError('Autenticacao necessaria')
    var perfil = ''
    try {
      perfil = $app.findRecordById('com_perfis', ator.getString('perfil_id')).getString('slug')
    } catch (_) {}
    if (perfil !== 'superadministrador' && perfil !== 'gestor-comercial')
      return e.json(403, { error: 'ACAO_NAO_AUTORIZADA' })
    var body
    try {
      body = JSON.parse(toString(e.request.body))
    } catch (_) {
      return e.json(400, { error: 'VALIDATION' })
    }
    if (
      !/^[a-z0-9]{15}$/.test(body.negocio_id || '') ||
      !/^[a-z0-9]{15}$/.test(body.responsavel_id || '') ||
      !body.updated_esperado
    )
      return e.json(400, { error: 'VALIDATION' })
    var resposta = null,
      erro = ''
    try {
      $app.runInTransaction(function (tx) {
        var negocio = tx.findRecordById('com_negocios', body.negocio_id)
        if (negocio.getString('qualificacao') !== 'pendente') throw new Error('NAO_PENDENTE')
        if (negocio.getString('updated') !== body.updated_esperado) throw new Error('STALE_WRITE')
        var destino = tx.findRecordById('users', body.responsavel_id)
        if (!destino.getBool('ativo_comercial')) throw new Error('RESPONSAVEL_INVALIDO')
        var perfilDestino = ''
        try {
          perfilDestino = tx
            .findRecordById('com_perfis', destino.getString('perfil_id'))
            .getString('slug')
        } catch (_) {}
        if (perfilDestino !== 'operador-comercial' && perfilDestino !== 'gestor-comercial')
          throw new Error('RESPONSAVEL_INVALIDO')
        var anterior = negocio.getString('qualificacao_responsavel_id') || null
        negocio.set('qualificacao_responsavel_id', destino.id)
        negocio.set('qualificacao_assumida_em', new Date())
        tx.save(negocio)
        var evidencia = {
          negocio_id: negocio.id,
          responsavel_anterior_id: anterior,
          responsavel_novo_id: destino.id,
          autor_id: ator.id,
        }
        var aud = new Record(tx.findCollectionByNameOrId('com_auditoria'))
        aud.set('collection_name', 'com_negocios')
        aud.set('record_id', negocio.id)
        aud.set('acao', 'update')
        aud.set('usuario_id', ator.id)
        aud.set('comando', 'atribuir_qualificacao')
        aud.set('evento_em', new Date())
        aud.set('snapshot_hash', $security.sha256(JSON.stringify(evidencia)))
        aud.set('snapshot_hash_versao', '1')
        aud.set('evidencia_estruturada', evidencia)
        aud.set('perfil', perfil)
        aud.set('escopo', 'comando')
        aud.set('origem', 'server-side')
        aud.set('sequencia', 1)
        tx.save(aud)
        resposta = { negocio_id: negocio.id, qualificacao_responsavel_id: destino.id }
      })
    } catch (err) {
      erro = String(err)
    }
    if (erro.indexOf('STALE_WRITE') !== -1) return e.json(409, { error: 'STALE_WRITE' })
    if (erro.indexOf('NAO_PENDENTE') !== -1) return e.json(409, { error: 'NAO_PENDENTE' })
    if (erro.indexOf('RESPONSAVEL_INVALIDO') !== -1)
      return e.json(400, { error: 'RESPONSAVEL_INVALIDO' })
    if (erro) return e.json(500, { error: 'INTERNAL' })
    return e.json(200, resposta)
  },
  $apis.requireAuth(),
)

routerAdd(
  'POST',
  '/backend/v1/qualificacoes/decidir',
  (e) => {
    try {
      var perfilRestrito = $app.findRecordById('com_perfis', e.auth.getString('perfil_id'))
      if (
        perfilRestrito.getString('slug') === 'negociacao-propria' ||
        perfilRestrito.getString('slug') === 'leitura-executiva'
      )
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
      if (perfil === 'superadministrador' || perfil === 'leitura-executiva') return true
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
      'teste_controlado',
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
    var motivosDesqualificacao = [
      'contato_invalido_dados_insuficientes',
      'contato_nao_estabelecido',
      'solicitacao_emprego_candidato',
      'fornecedor_assunto_nao_comercial',
      'servico_residencial',
      'oportunidade_pequena_sem_atratividade',
      'prazo_mobilizacao_inviavel',
      'fora_escopo_operacional',
      'evento_sem_supervisao',
      'pos_obra_em_andamento',
      'localidade_esforco_inviavel',
      'duplicidade_teste_registro_indevido',
      'desistencia_antes_proposta',
      'outro',
    ]
    var motivo = String(body.motivo || '').trim()
    var justificativa = String(body.justificativa || '').trim()
    if (body.decisao === 'desqualificada' && motivosDesqualificacao.indexOf(motivo) === -1)
      return e.json(400, {
        error: 'MOTIVO_OBRIGATORIO',
        message: 'Selecione um motivo canonico para desqualificar',
      })
    if (body.decisao === 'desqualificada' && motivo === 'outro' && !justificativa)
      return e.json(400, { error: 'JUSTIFICATIVA_OBRIGATORIA' })
    if (motivo.length > 500 || justificativa.length > 1000)
      return e.json(400, { error: 'VALIDATION', message: 'Texto excede o limite permitido' })
    if (body.teste_controlado !== undefined && body.teste_controlado !== true)
      return e.json(400, {
        error: 'VALIDATION',
        message: 'Marcador de teste controlado invalido',
      })

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
      teste_controlado: body.teste_controlado === true,
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
        var responsavelQualificacao = negocio.getString('qualificacao_responsavel_id')
        if (
          perfilTx !== 'superadministrador' &&
          perfilTx !== 'gestor-comercial' &&
          responsavelQualificacao !== ator.id
        )
          throw new Error('QUALIFICACAO_NAO_ASSUMIDA')
        if (negocio.getString('updated') !== body.updated_esperado) throw new Error('STALE_WRITE')
        var anteriorEstado = negocio.getString('qualificacao') || 'pendente'
        if (anteriorEstado !== 'pendente') throw new Error('JA_DECIDIDO')

        negocio.set('qualificacao', body.decisao)
        negocio.set('qualificacao_decidida_em', new Date())
        if (!negocio.getString('qualificacao_responsavel_id'))
          negocio.set('qualificacao_responsavel_id', ator.id)
        if (body.decisao === 'qualificada') {
          if (!negocio.getString('responsavel_id')) negocio.set('responsavel_id', ator.id)
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
          teste_controlado: body.teste_controlado === true,
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
    if (txError.indexOf('PREOPERACAO_SOMENTE_LEITURA') !== -1)
      return e.json(423, { error: 'PREOPERACAO_SOMENTE_LEITURA' })
    if (txError.indexOf('QUALIFICACAO_NAO_ASSUMIDA') !== -1)
      return e.json(409, { error: 'QUALIFICACAO_NAO_ASSUMIDA' })
    if (txError) return e.json(500, { error: 'INTERNAL', message: 'Falha ao registrar decisao' })
    return e.json(200, resposta)
  },
  $apis.requireAuth(),
)

routerAdd(
  'POST',
  '/backend/v1/qualificacoes/devolver',
  (e) => {
    var ator = e.auth
    if (!ator) return e.unauthorizedError('Autenticacao necessaria')
    var perfil = ''
    try {
      perfil = $app.findRecordById('com_perfis', ator.getString('perfil_id')).getString('slug')
    } catch (_) {}
    if (perfil !== 'superadministrador' && perfil !== 'gestor-comercial')
      return e.json(403, { error: 'ACAO_NAO_AUTORIZADA' })
    var body
    try {
      body = JSON.parse(toString(e.request.body))
    } catch (_) {
      return e.json(400, { error: 'VALIDATION' })
    }
    var justificativa = String(body.justificativa || '').trim()
    if (
      !/^[a-z0-9]{15}$/.test(body.negocio_id || '') ||
      !body.updated_esperado ||
      !body.command_idempotency_key ||
      !justificativa ||
      justificativa.length > 1000
    )
      return e.json(400, { error: 'VALIDATION' })
    var resposta = null,
      erro = ''
    try {
      $app.runInTransaction(function (tx) {
        var negocio = tx.findRecordById('com_negocios', body.negocio_id)
        if (negocio.getString('updated') !== body.updated_esperado) throw new Error('STALE_WRITE')
        if (
          negocio.getString('qualificacao') !== 'qualificada' ||
          negocio.getString('etapa') !== 'producao_proposta'
        )
          throw new Error('NAO_DEVOLVIVEL')
        negocio.set('qualificacao', 'pendente')
        negocio.set('etapa', 'prospects')
        negocio.set('resultado', '')
        negocio.set('inativo', false)
        negocio.set('qualificacao_decidida_em', null)
        negocio.set('etapa_entrou_em', new Date())
        tx.save(negocio)
        var hist = new Record(tx.findCollectionByNameOrId('com_qualificacao_historico'))
        hist.set('negocio_id', negocio.id)
        hist.set('idempotency_key', body.command_idempotency_key)
        hist.set('estado_anterior', 'qualificada')
        hist.set('estado_novo', 'pendente')
        hist.set('motivo', 'qualificacao_insuficiente')
        hist.set('autor_id', ator.id)
        hist.set('origem', 'reavaliacao')
        hist.set('justificativa', justificativa)
        hist.set('data_hora_efetiva', new Date())
        tx.save(hist)
        var evidencia = {
          negocio_id: negocio.id,
          estado_anterior: 'qualificada',
          estado_novo: 'pendente',
          justificativa: justificativa,
          autor_id: ator.id,
          responsavel_qualificacao_id: negocio.getString('qualificacao_responsavel_id') || null,
        }
        var aud = new Record(tx.findCollectionByNameOrId('com_auditoria'))
        aud.set('collection_name', 'com_negocios')
        aud.set('record_id', negocio.id)
        aud.set('acao', 'update')
        aud.set('usuario_id', ator.id)
        aud.set('comando', 'devolver_qualificacao')
        aud.set('command_idempotency_key', body.command_idempotency_key)
        aud.set('evento_em', new Date())
        aud.set('snapshot_hash', $security.sha256(JSON.stringify(evidencia)))
        aud.set('snapshot_hash_versao', '1')
        aud.set('evidencia_estruturada', evidencia)
        aud.set('perfil', perfil)
        aud.set('escopo', 'comando')
        aud.set('origem', 'server-side')
        aud.set('sequencia', 1)
        tx.save(aud)
        resposta = { negocio_id: negocio.id, qualificacao: 'pendente', historico_id: hist.id }
      })
    } catch (err) {
      erro = String(err)
    }
    if (erro.indexOf('STALE_WRITE') !== -1) return e.json(409, { error: 'STALE_WRITE' })
    if (erro.indexOf('NAO_DEVOLVIVEL') !== -1) return e.json(409, { error: 'NAO_DEVOLVIVEL' })
    if (erro) return e.json(500, { error: 'INTERNAL' })
    return e.json(200, resposta)
  },
  $apis.requireAuth(),
)
