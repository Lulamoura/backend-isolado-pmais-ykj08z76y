// T4.2 — atividades e próxima ação, com fila acionável e comandos auditáveis.
// GET  /backend/v1/atividades/fila
// POST /backend/v1/atividades/registrar

routerAdd(
  'GET',
  '/backend/v1/atividades/fila',
  (e) => {
    function perfilDoAtor(ator, app) {
      try {
        var id = ator.getString('perfil_id')
        return id ? app.findRecordById('com_perfis', id).getString('slug') : ''
      } catch (_) {
        return ''
      }
    }
    function maxScope(a, b) {
      var rank = { proprios: 1, equipe: 2, todos: 3 }
      return (rank[b] || 0) > (rank[a] || 0) ? b : a
    }
    function resolverEscopo(ator, app) {
      var scope = ''
      var perfilId = ator.getString('perfil_id')
      if (perfilId) {
        try {
          var perfil = app.findRecordById('com_perfis', perfilId)
          if (perfil.getBool('ativo') && perfil.getString('slug') === 'superadministrador')
            scope = 'todos'
          var links = app.findRecordsByFilter(
            'com_perfil_permissoes',
            "perfil_id = '" + perfilId + "'",
            '',
            500,
            0,
          )
          for (var i = 0; i < links.length; i++) {
            var permissao = app.findRecordById('com_permissoes', links[i].getString('permissao_id'))
            if (permissao.getString('slug') === 'negocios.view')
              scope = maxScope(scope, links[i].getString('escopo'))
          }
        } catch (_) {}
      }
      return scope
    }
    function dataCivil(valor) {
      var match = String(valor || '').match(/^(\d{4}-\d{2}-\d{2})/)
      return match ? match[1] : ''
    }
    function hojeRecife() {
      return new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10)
    }
    var ator = e.auth
    if (!ator) return e.unauthorizedError('Autenticacao necessaria')
    if (!ator.getBool('ativo_comercial')) return e.forbiddenError('Usuario comercial inativo')

    var pagina = Number(e.requestInfo().query.pagina || 1)
    var porPagina = Number(e.requestInfo().query.por_pagina || 20)
    var situacao = String(e.requestInfo().query.situacao || 'todas')
    var escopoTemporal = String(e.requestInfo().query.escopo_temporal || 'todas')
    if (
      !Number.isInteger(pagina) ||
      pagina < 1 ||
      !Number.isInteger(porPagina) ||
      porPagina < 1 ||
      porPagina > 100 ||
      ['todas', 'sem_proxima_acao', 'vencida', 'programada'].indexOf(situacao) === -1 ||
      ['todas', 'dia'].indexOf(escopoTemporal) === -1
    )
      return e.json(400, { error: 'VALIDATION' })

    var perfil = perfilDoAtor(ator, $app)
    var escopo = resolverEscopo(ator, $app)
    if (!escopo) return e.forbiddenError('Permissao negocios.view necessaria')
    var filtro = "inativo = false && resultado = ''"
    if (escopo !== 'todos') {
      var equipe = ator.getString('equipe_id')
      filtro +=
        escopo === 'equipe' && equipe
          ? " && equipe_id = '" + equipe + "'"
          : " && responsavel_id = '" + ator.id + "'"
    }
    var negocios = $app.findRecordsByFilter('com_negocios', filtro, 'titulo', 500, 0)
    var hoje = hojeRecife()
    var todos = []
    for (var i = 0; i < negocios.length; i++) {
      var negocio = negocios[i]
      var planejadas = $app.findRecordsByFilter(
        'com_atividades',
        "negocio_id = '" + negocio.id + "' && estado = 'planejada'",
        'planejada_para,created',
        1,
        0,
      )
      var proxima = null
      var estadoFila = 'sem_proxima_acao'
      var dono = null
      try {
        var dr = $app.findRecordById('users', negocio.getString('responsavel_id'))
        dono = { id: dr.id, nome: dr.getString('name') || dr.getString('email') }
      } catch (_) {}
      if (planejadas.length) {
        var a = planejadas[0]
        var data = a.getString('planejada_para')
        estadoFila = dataCivil(data) && dataCivil(data) < hoje ? 'vencida' : 'programada'
        var responsavel = null
        try {
          var ur = $app.findRecordById('users', a.getString('responsavel_id'))
          responsavel = { id: ur.id, nome: ur.getString('name') || ur.getString('email') }
        } catch (_) {}
        proxima = {
          id: a.id,
          tipo: a.getString('tipo'),
          descricao: a.getString('descricao') || null,
          canal: a.getString('canal') || null,
          estado: a.getString('estado'),
          planejada_para: data || null,
          responsavel: responsavel,
          updated: a.getString('updated'),
          origem: 'aplicativo',
          editavel: true,
        }
      } else if (negocio.getString('proxima_acao_em')) {
        var dataCrm = negocio.getString('proxima_acao_em')
        estadoFila = dataCivil(dataCrm) && dataCivil(dataCrm) < hoje ? 'vencida' : 'programada'
        proxima = {
          id: null,
          tipo: 'acompanhamento_proposta',
          descricao: 'Próxima ação registrada no ActiveCampaign',
          canal: null,
          estado: 'planejada',
          planejada_para: dataCrm,
          responsavel: dono,
          updated: negocio.getString('crm_updated_at') || negocio.getString('updated'),
          origem: 'activecampaign',
          editavel: false,
        }
      }
      if (situacao !== 'todas' && estadoFila !== situacao) continue
      var dataProxima = proxima ? dataCivil(proxima.planejada_para) : ''
      if (escopoTemporal === 'dia' && estadoFila === 'programada' && dataProxima !== hoje) continue
      var empresa = null
      try {
        var er = $app.findRecordById('com_empresas', negocio.getString('empresa_id'))
        empresa = { id: er.id, nome: er.getString('nome') }
      } catch (_) {}
      var externalId = null
      try {
        externalId = $app
          .findFirstRecordByFilter(
            'com_vinculos_externos',
            "sistema_origem='activecampaign' && external_type='business' && record_id='" +
              negocio.id +
              "'",
          )
          .getString('external_id')
      } catch (_) {}
      todos.push({
        negocio: {
          id: negocio.id,
          external_id: externalId,
          titulo: negocio.getString('titulo'),
          etapa: negocio.getString('etapa'),
          modalidade: negocio.getString('modalidade') || null,
          empresa: empresa,
          responsavel: dono,
          updated: negocio.getString('updated'),
        },
        situacao: estadoFila,
        proxima_acao: proxima,
      })
    }
    var prioridade = { sem_proxima_acao: 0, vencida: 1, programada: 2 }
    todos.sort(function (a, b) {
      var rank = prioridade[a.situacao] - prioridade[b.situacao]
      if (rank) return rank
      var dataA = dataCivil(a.proxima_acao && a.proxima_acao.planejada_para)
      var dataB = dataCivil(b.proxima_acao && b.proxima_acao.planejada_para)
      if (dataA !== dataB) return dataA < dataB ? -1 : 1
      var responsavelA = String((a.negocio.responsavel && a.negocio.responsavel.nome) || '')
      var responsavelB = String((b.negocio.responsavel && b.negocio.responsavel.nome) || '')
      if (responsavelA !== responsavelB) return responsavelA.localeCompare(responsavelB)
      var empresaA = String((a.negocio.empresa && a.negocio.empresa.nome) || '')
      var empresaB = String((b.negocio.empresa && b.negocio.empresa.nome) || '')
      if (empresaA !== empresaB) return empresaA.localeCompare(empresaB)
      return String(a.negocio.external_id || a.negocio.id).localeCompare(
        String(b.negocio.external_id || b.negocio.id),
      )
    })
    var inicio = (pagina - 1) * porPagina
    return e.json(200, {
      itens: todos.slice(inicio, inicio + porPagina),
      pagina: pagina,
      por_pagina: porPagina,
      tem_mais: todos.length > inicio + porPagina,
      total: todos.length,
    })
  },
  $apis.requireAuth(),
)

routerAdd(
  'POST',
  '/backend/v1/atividades/registrar',
  (e) => {
    function perfilDoAtor(ator, app) {
      try {
        var id = ator.getString('perfil_id')
        return id ? app.findRecordById('com_perfis', id).getString('slug') : ''
      } catch (_) {
        return ''
      }
    }
    function podeAcessar(ator, perfil, negocio) {
      if (perfil === 'superadministrador') return true
      if (negocio.getString('responsavel_id') === ator.id) return true
      if (perfil === 'negociacao-propria') return false
      var equipe = ator.getString('equipe_id')
      return !!equipe && negocio.getString('equipe_id') === equipe
    }
    function canonicalize(obj) {
      if (obj === null || obj === undefined) return 'null'
      if (typeof obj !== 'object') return JSON.stringify(obj)
      var keys = Object.keys(obj).sort()
      var parts = []
      for (var i = 0; i < keys.length; i++)
        parts.push(JSON.stringify(keys[i]) + ':' + canonicalize(obj[keys[i]]))
      return '{' + parts.join(',') + '}'
    }
    function recordId(value) {
      return /^[a-z0-9]{15}$/.test(value || '')
    }
    var ator = e.auth
    if (!ator) return e.unauthorizedError('Autenticacao necessaria')
    if (!ator.getBool('ativo_comercial')) return e.forbiddenError('Usuario comercial inativo')
    var body
    try {
      body = JSON.parse(toString(e.request.body))
    } catch (_) {
      return e.json(400, { error: 'VALIDATION' })
    }
    var permitidos = [
      'operacao',
      'negocio_id',
      'atividade_id',
      'tipo',
      'descricao',
      'responsavel_id',
      'canal',
      'planejada_para',
      'resultado',
      'justificativa_cancelamento',
      'updated_esperado',
      'command_idempotency_key',
    ]
    var keys = Object.keys(body || {})
    for (var k = 0; k < keys.length; k++)
      if (permitidos.indexOf(keys[k]) === -1)
        return e.json(400, { error: 'VALIDATION', message: 'Campo nao permitido' })

    var op = String(body.operacao || '')
    if (['planejar', 'realizar', 'cancelar'].indexOf(op) === -1)
      return e.json(400, { error: 'VALIDATION' })
    if (
      !body.updated_esperado ||
      !body.command_idempotency_key ||
      body.command_idempotency_key.length > 128
    )
      return e.json(400, {
        error: 'VALIDATION',
        message: 'Concorrencia e idempotencia obrigatorias',
      })

    var tipos = [
      'tentativa_contato',
      'reuniao',
      'visita',
      'envio_proposta',
      'acompanhamento_proposta',
      'aceite_verbal_pendente',
      'decisao_combinada',
      'tarefa_interna',
    ]
    var canais = ['', 'telefone', 'email', 'whatsapp', 'presencial', 'video']
    var descricao = String(body.descricao || '').trim()
    var resultado = String(body.resultado || '').trim()
    var justificativa = String(body.justificativa_cancelamento || '').trim()
    var canal = String(body.canal || '')
    if (
      descricao.length > 2000 ||
      resultado.length > 1000 ||
      justificativa.length > 500 ||
      canais.indexOf(canal) === -1
    )
      return e.json(400, { error: 'VALIDATION' })
    if (op === 'planejar') {
      if (
        !recordId(body.negocio_id) ||
        !recordId(body.responsavel_id) ||
        tipos.indexOf(body.tipo) === -1
      )
        return e.json(400, { error: 'VALIDATION' })
      var planejada = new Date(body.planejada_para)
      if (!body.planejada_para || isNaN(planejada.getTime()))
        return e.json(400, { error: 'DATA_INVALIDA' })
    } else {
      if (!recordId(body.atividade_id)) return e.json(400, { error: 'VALIDATION' })
      if (op === 'realizar' && !resultado) return e.json(400, { error: 'RESULTADO_OBRIGATORIO' })
      if (op === 'cancelar' && !justificativa)
        return e.json(400, { error: 'JUSTIFICATIVA_OBRIGATORIA' })
    }

    var payload = {}
    for (var p = 0; p < permitidos.length; p++) {
      var nome = permitidos[p]
      if (nome !== 'command_idempotency_key' && body[nome] !== undefined) payload[nome] = body[nome]
    }
    var hash = $security.sha256(canonicalize(payload))
    var comando = 'registrar_atividade'
    var anteriores = []
    try {
      anteriores = $app.findRecordsByFilter(
        'com_idempotencia',
        "ator_id='" +
          ator.id +
          "' && comando='" +
          comando +
          "' && command_idempotency_key='" +
          body.command_idempotency_key +
          "'",
        '',
        1,
        0,
      )
    } catch (_) {}
    if (anteriores.length) {
      var ar = anteriores[0]
      if (ar.getString('payload_hash') !== hash) return e.json(409, { error: 'CONFLICT' })
      if (ar.getString('estado') === 'executando') return e.json(409, { error: 'CONCORRENTE' })
      var antigo = ar.get('resultado') || {}
      return e.json(200, {
        atividade_id: antigo.atividade_id || '',
        negocio_id: antigo.negocio_id || '',
        estado: antigo.estado || '',
        replay: true,
      })
    }

    var resposta = null
    var txError = ''
    try {
      $app.runInTransaction(function (tx) {
        var usuario = tx.findRecordById('users', ator.id)
        if (!usuario.getBool('ativo_comercial')) throw new Error('FORBIDDEN')
        var perfil = perfilDoAtor(usuario, tx)
        var atividade = null
        var negocio = null
        if (op === 'planejar') {
          negocio = tx.findRecordById('com_negocios', body.negocio_id)
          try {
            var preop = tx.findFirstRecordByData(
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
          if (!podeAcessar(usuario, perfil, negocio)) throw new Error('FORBIDDEN')
          if (negocio.getBool('inativo') || negocio.getString('resultado'))
            throw new Error('NEGOCIO_FECHADO')
          if (negocio.getString('updated') !== body.updated_esperado) throw new Error('STALE_WRITE')
          tx.findRecordById('users', body.responsavel_id)
          var col = tx.findCollectionByNameOrId('com_atividades')
          atividade = new Record(col)
          atividade.set('negocio_id', negocio.id)
          atividade.set('tipo', body.tipo)
          if (descricao) atividade.set('descricao', descricao)
          atividade.set('autor_id', usuario.id)
          atividade.set('responsavel_id', body.responsavel_id)
          if (canal) atividade.set('canal', canal)
          atividade.set('estado', 'planejada')
          atividade.set('planejada_para', new Date(body.planejada_para))
          atividade.set('creation_idempotency_key', body.command_idempotency_key)
          tx.save(atividade)
        } else {
          atividade = tx.findRecordById('com_atividades', body.atividade_id)
          negocio = tx.findRecordById('com_negocios', atividade.getString('negocio_id'))
          try {
            var preopAtividade = tx.findFirstRecordByData(
              'com_parametros',
              'chave',
              'ac_preoperation_read_only',
            )
            if (
              preopAtividade.getBool('ativo') &&
              preopAtividade.getString('valor') === 'true' &&
              negocio.getString('origem_canal') === 'activecampaign'
            )
              throw new Error('PREOPERACAO_SOMENTE_LEITURA')
          } catch (preopAtividadeError) {
            if (String(preopAtividadeError).indexOf('PREOPERACAO_SOMENTE_LEITURA') !== -1)
              throw preopAtividadeError
          }
          if (!podeAcessar(usuario, perfil, negocio)) throw new Error('FORBIDDEN')
          if (atividade.getString('updated') !== body.updated_esperado)
            throw new Error('STALE_WRITE')
          if (atividade.getString('estado') !== 'planejada') throw new Error('JA_TERMINAL')
          if (op === 'realizar') {
            if (
              atividade.getString('tipo') !== 'tarefa_interna' &&
              !canal &&
              !atividade.getString('canal')
            )
              throw new Error('CANAL_OBRIGATORIO')
            if (canal) atividade.set('canal', canal)
            atividade.set('estado', 'realizada')
            atividade.set('realizada_em', new Date())
            atividade.set('resultado', resultado)
          } else {
            atividade.set('estado', 'cancelada')
            atividade.set('justificativa_cancelamento', justificativa)
          }
          tx.save(atividade)
        }

        var evidencia = {
          atividade_id: atividade.id,
          negocio_id: negocio.id,
          operacao: op,
          estado: atividade.getString('estado'),
          autor_id: usuario.id,
        }
        var aud = new Record(tx.findCollectionByNameOrId('com_auditoria'))
        aud.set('collection_name', 'com_atividades')
        aud.set('record_id', atividade.id)
        aud.set('acao', op === 'planejar' ? 'create' : 'update')
        aud.set('usuario_id', usuario.id)
        aud.set('comando', comando)
        aud.set('command_idempotency_key', body.command_idempotency_key)
        aud.set('transacao_id', $security.sha256(body.command_idempotency_key + '|' + atividade.id))
        aud.set('evento_em', new Date())
        aud.set('snapshot_hash', $security.sha256(canonicalize(evidencia)))
        aud.set('snapshot_hash_versao', '1')
        aud.set('evidencia_estruturada', evidencia)
        aud.set('perfil', perfil)
        aud.set('escopo', 'comando')
        aud.set('origem', 'server-side')
        aud.set('sequencia', 1)
        tx.save(aud)

        resposta = {
          atividade_id: atividade.id,
          negocio_id: negocio.id,
          estado: atividade.getString('estado'),
          replay: false,
        }
        var idem = new Record(tx.findCollectionByNameOrId('com_idempotencia'))
        idem.set('command_idempotency_key', body.command_idempotency_key)
        idem.set('comando', comando)
        idem.set('ator_id', usuario.id)
        idem.set('payload_hash', hash)
        idem.set('estado', 'concluido')
        idem.set('executor_id', 'pb-primary')
        idem.set('lease_ate', new Date(Date.now() + 300000))
        idem.set('tentativa', 1)
        idem.set('claim_version', 1)
        idem.set('inicio_em', new Date())
        idem.set('conclusao_em', new Date())
        idem.set('codigo_retorno', '200')
        idem.set('resultado', resposta)
        idem.set('registros_afetados', [atividade.id])
        tx.save(idem)
      })
    } catch (err) {
      txError = String(err).substring(0, 500)
    }
    var erros = ['STALE_WRITE', 'JA_TERMINAL', 'NEGOCIO_FECHADO', 'CANAL_OBRIGATORIO', 'FORBIDDEN']
    for (var x = 0; x < erros.length; x++)
      if (txError.indexOf(erros[x]) !== -1)
        return e.json(erros[x] === 'FORBIDDEN' ? 403 : 409, { error: erros[x] })
    if (txError) return e.json(500, { error: 'INTERNAL', message: 'Falha ao registrar atividade' })
    return e.json(200, resposta)
  },
  $apis.requireAuth(),
)
