// T4.7 — Referência da Ordem de Execução após o ganho.
;(function () {
  routerAdd(
    'GET',
    '/backend/v1/ordens-execucao/fila',
    (e) => {
      function oePerfil(app, user) {
        try {
          return app.findRecordById('com_perfis', user.getString('perfil_id')).getString('slug')
        } catch (_) {
          return ''
        }
      }
      function oePodeAcessar(user, perfil, negocio) {
        if (perfil === 'superadministrador') return true
        if (negocio.getString('responsavel_id') === user.id) return true
        return (
          !!user.getString('equipe_id') &&
          negocio.getString('equipe_id') === user.getString('equipe_id')
        )
      }
      function oeEstado(negocio) {
        return negocio.getString('oe_numero') &&
          negocio.getString('oe_data_envio') &&
          negocio.getString('oe_responsavel_envio_id')
          ? 'em_processo_de_entrega'
          : 'aguardando_oe'
      }
      var ator = e.auth
      if (!ator || !ator.getBool('ativo_comercial'))
        return e.forbiddenError('Usuario comercial necessario')
      var perfil = oePerfil($app, ator),
        bloqueado = perfil === 'negociacao-propria',
        negocios = $app.findRecordsByFilter(
          'com_negocios',
          "resultado='ganho' && inativo=false",
          '-fechamento_data,-updated',
          200,
          0,
        ),
        itens = []
      if (bloqueado) return e.json(403, { error: 'ACAO_NAO_AUTORIZADA' })
      for (var i = 0; i < negocios.length; i++) {
        var negocio = negocios[i]
        if (!oePodeAcessar(ator, perfil, negocio)) continue
        var responsavelEnvio = null
        try {
          var usuario = $app.findRecordById('users', negocio.getString('oe_responsavel_envio_id'))
          responsavelEnvio = { id: usuario.id, name: usuario.getString('name') }
        } catch (_) {}
        itens.push({
          negocio: {
            id: negocio.id,
            titulo: negocio.getString('titulo'),
            responsavel_id: negocio.getString('responsavel_id') || null,
            equipe_id: negocio.getString('equipe_id') || null,
            updated: negocio.getString('updated'),
          },
          estado_operacional: oeEstado(negocio),
          oe: negocio.getString('oe_numero')
            ? {
                numero: negocio.getString('oe_numero'),
                data_envio: negocio.getString('oe_data_envio'),
                responsavel_envio: responsavelEnvio,
              }
            : null,
        })
      }
      var filtroUsuarios = 'ativo_comercial=true'
      if (perfil !== 'superadministrador') {
        if (!ator.getString('equipe_id')) filtroUsuarios += " && id='" + ator.id + "'"
        else filtroUsuarios += " && equipe_id='" + ator.getString('equipe_id') + "'"
      }
      var usuarios = $app.findRecordsByFilter('users', filtroUsuarios, 'name', 200, 0)
      return e.json(200, {
        itens: itens,
        responsaveis_envio: usuarios.map(function (usuario) {
          return { id: usuario.id, name: usuario.getString('name') }
        }),
      })
    },
    $apis.requireAuth(),
  )

  routerAdd(
    'POST',
    '/backend/v1/ordens-execucao/registrar',
    (e) => {
      try {
        var perfilRestrito = $app.findRecordById('com_perfis', e.auth.getString('perfil_id'))
        if (perfilRestrito.getString('slug') === 'negociacao-propria')
          return e.json(403, { error: 'ACAO_NAO_AUTORIZADA' })
      } catch (_) {}
      function oePerfil(app, user) {
        try {
          return app.findRecordById('com_perfis', user.getString('perfil_id')).getString('slug')
        } catch (_) {
          return ''
        }
      }
      function oePodeAcessar(user, perfil, negocio) {
        if (perfil === 'superadministrador') return true
        if (negocio.getString('responsavel_id') === user.id) return true
        return (
          !!user.getString('equipe_id') &&
          negocio.getString('equipe_id') === user.getString('equipe_id')
        )
      }
      var ator = e.auth,
        body = new DynamicModel({
          negocio_id: '',
          oe_numero: '',
          oe_data_envio: '',
          oe_responsavel_envio_id: '',
          updated_esperado: '',
          command_idempotency_key: '',
          justificativa: '',
        })
      e.bindBody(body)
      if (!ator || !ator.getBool('ativo_comercial'))
        return e.forbiddenError('Usuario comercial necessario')
      var numero = String(body.oe_numero || '').trim(),
        justificativa = String(body.justificativa || '').trim()
      if (
        !body.negocio_id ||
        !numero ||
        !body.oe_data_envio ||
        !body.oe_responsavel_envio_id ||
        !body.updated_esperado ||
        !body.command_idempotency_key
      )
        return e.json(400, { error: 'DADOS_OE_OBRIGATORIOS' })
      if (numero.length > 80) return e.json(400, { error: 'NUMERO_OE_INVALIDO' })
      var comando = 'registrar_referencia_oe',
        payload = {
          negocio_id: body.negocio_id,
          oe_numero: numero,
          oe_data_envio: body.oe_data_envio,
          oe_responsavel_envio_id: body.oe_responsavel_envio_id,
          updated_esperado: body.updated_esperado,
        },
        hash = $security.sha256(JSON.stringify(payload)),
        known = []
      try {
        known = $app.findRecordsByFilter(
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
      if (known.length) {
        if (known[0].getString('payload_hash') !== hash) return e.json(409, { error: 'CONFLICT' })
        if (known[0].getString('estado') !== 'concluido')
          return e.json(409, { error: 'CONCORRENTE' })
        var replay = {}
        try {
          replay = JSON.parse(known[0].getString('resultado') || '{}')
        } catch (_) {}
        return e.json(200, {
          negocio_id: replay.negocio_id,
          estado_operacional: replay.estado_operacional,
          oe_numero: replay.oe_numero,
          oe_data_envio: replay.oe_data_envio,
          oe_responsavel_envio_id: replay.oe_responsavel_envio_id,
          replay: true,
        })
      }
      var negocio
      try {
        negocio = $app.findRecordById('com_negocios', body.negocio_id)
      } catch (_) {
        return e.notFoundError('NEGOCIO_NAO_ENCONTRADO')
      }
      var perfil = oePerfil($app, ator)
      if (!oePodeAcessar(ator, perfil, negocio)) return e.forbiddenError('FORA_DO_ESCOPO')
      if (negocio.getString('resultado') !== 'ganho')
        return e.json(409, { error: 'NEGOCIO_NAO_GANHO' })
      if (negocio.getString('updated') !== body.updated_esperado)
        return e.json(409, { error: 'STALE_WRITE' })
      try {
        var responsavel = $app.findRecordById('users', body.oe_responsavel_envio_id)
        if (!responsavel.getBool('ativo_comercial')) throw new Error('inativo')
      } catch (_) {
        return e.json(400, { error: 'RESPONSAVEL_ENVIO_INVALIDO' })
      }
      var resposta = null,
        erro = ''
      try {
        $app.runInTransaction(function (tx) {
          var atorTx = tx.findRecordById('users', ator.id)
          if (!atorTx.getBool('ativo_comercial')) throw new Error('FORBIDDEN')
          var perfilTx = oePerfil(tx, atorTx),
            atual = tx.findRecordById('com_negocios', body.negocio_id)
          if (!oePodeAcessar(atorTx, perfilTx, atual)) throw new Error('FORBIDDEN')
          if (atual.getString('resultado') !== 'ganho') throw new Error('NEGOCIO_NAO_GANHO')
          if (atual.getString('updated') !== body.updated_esperado) throw new Error('STALE_WRITE')
          var responsavelTx = tx.findRecordById('users', body.oe_responsavel_envio_id)
          if (!responsavelTx.getBool('ativo_comercial'))
            throw new Error('RESPONSAVEL_ENVIO_INVALIDO')
          atual.set('oe_numero', numero)
          atual.set('oe_data_envio', body.oe_data_envio)
          atual.set('oe_responsavel_envio_id', body.oe_responsavel_envio_id)
          tx.save(atual)
          resposta = {
            negocio_id: atual.id,
            estado_operacional: 'em_processo_de_entrega',
            oe_numero: numero,
            oe_data_envio: body.oe_data_envio,
            oe_responsavel_envio_id: body.oe_responsavel_envio_id,
          }
          var auditoria = new Record(tx.findCollectionByNameOrId('com_auditoria'))
          auditoria.set('collection_name', 'com_negocios')
          auditoria.set('record_id', atual.id)
          auditoria.set('acao', 'update')
          auditoria.set('usuario_id', ator.id)
          auditoria.set('comando', comando)
          auditoria.set('command_idempotency_key', body.command_idempotency_key)
          auditoria.set('evento_em', new Date())
          auditoria.set('justificativa', justificativa || 'Registro da referência da OE')
          auditoria.set('perfil', perfil)
          auditoria.set('escopo', 'ordem_execucao')
          auditoria.set('origem', 'server-side')
          auditoria.set('evidencia_estruturada', resposta)
          auditoria.set('snapshot_hash', $security.sha256(JSON.stringify(resposta)))
          auditoria.set('snapshot_hash_versao', '1')
          tx.save(auditoria)
          var idem = new Record(tx.findCollectionByNameOrId('com_idempotencia'))
          idem.set('command_idempotency_key', body.command_idempotency_key)
          idem.set('comando', comando)
          idem.set('ator_id', ator.id)
          idem.set('payload_hash', hash)
          idem.set('estado', 'concluido')
          idem.set('codigo_retorno', '200')
          idem.set('resultado', resposta)
          idem.set('registros_afetados', [atual.id])
          idem.set('executor_id', 'pb-primary')
          idem.set('lease_ate', new Date(Date.now() + 300000))
          idem.set('tentativa', 1)
          idem.set('claim_version', 1)
          idem.set('inicio_em', new Date())
          idem.set('conclusao_em', new Date())
          tx.save(idem)
        })
      } catch (err) {
        erro = String(err)
      }
      if (erro.indexOf('STALE_WRITE') >= 0) return e.json(409, { error: 'STALE_WRITE' })
      if (erro.indexOf('NEGOCIO_NAO_GANHO') >= 0) return e.json(409, { error: 'NEGOCIO_NAO_GANHO' })
      if (erro.indexOf('RESPONSAVEL_ENVIO_INVALIDO') >= 0)
        return e.json(400, { error: 'RESPONSAVEL_ENVIO_INVALIDO' })
      if (erro.indexOf('FORBIDDEN') >= 0) return e.json(403, { error: 'FORBIDDEN' })
      if (erro) return e.json(500, { error: 'INTERNAL' })
      return e.json(200, Object.assign({ replay: false }, resposta))
    },
    $apis.requireAuth(),
  )
})()
