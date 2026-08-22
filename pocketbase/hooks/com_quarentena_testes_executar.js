// T6.1 — execução transacional da quarentena pré-operacional.
// Publicar este hook não executa a quarentena. A escrita só ocorre com chamada
// autenticada que satisfaça lista, confirmação, fingerprint e idempotência.

routerAdd(
  'POST',
  '/backend/v1/admin/quarentena-testes/executar',
  (e) => {
    function canonicalize(obj) {
      if (obj === null || obj === undefined) return 'null'
      if (typeof obj !== 'object') return JSON.stringify(obj)
      if (Array.isArray(obj)) {
        var arr = []
        for (var a = 0; a < obj.length; a++) arr.push(canonicalize(obj[a]))
        return '[' + arr.join(',') + ']'
      }
      var keys = Object.keys(obj).sort(),
        parts = []
      for (var i = 0; i < keys.length; i++)
        parts.push(JSON.stringify(keys[i]) + ':' + canonicalize(obj[keys[i]]))
      return '{' + parts.join(',') + '}'
    }
    function perfil(app, user) {
      try {
        return app.findRecordById('com_perfis', user.getString('perfil_id')).getString('slug')
      } catch (_) {
        return ''
      }
    }
    function parseResultado(record) {
      try {
        var value = record.get('resultado')
        if (value && typeof value === 'object') return value
        return JSON.parse(record.getString('resultado') || '{}')
      } catch (_) {
        return {}
      }
    }
    function fingerprint(app, ids) {
      var versoes = []
      for (var i = 0; i < ids.length; i++) {
        var n = app.findRecordById('com_negocios', ids[i])
        versoes.push(n.id + ':' + n.getString('updated'))
      }
      return $security.sha256(versoes.sort().join('|'))
    }

    var ator = e.auth
    if (!ator) return e.unauthorizedError('Autenticacao necessaria')
    if (!ator.getBool('ativo_comercial')) return e.forbiddenError('Usuario comercial inativo')
    if (perfil($app, ator) !== 'superadministrador')
      return e.forbiddenError('SuperAdmin necessario')

    var body
    try {
      body = JSON.parse(toString(e.request.body))
    } catch (_) {
      return e.json(400, { error: 'JSON_INVALIDO' })
    }
    var chaves = Object.keys(body || {}).sort()
    if (
      chaves.join(',') !==
      'command_idempotency_key,confirmacao,fingerprint_versoes,justificativa,modo,negocio_ids'
    )
      return e.json(400, { error: 'CAMPOS_INVALIDOS' })

    var confirmacao = 'INATIVAR_13_NEGOCIOS_TESTE',
      justificativa = String(body.justificativa || '').trim(),
      idemKey = String(body.command_idempotency_key || '').trim()
    if (body.modo !== 'executar') return e.json(400, { error: 'MODO_EXECUTAR_OBRIGATORIO' })
    if (body.confirmacao !== confirmacao)
      return e.json(400, { error: 'CONFIRMACAO_LITERAL_OBRIGATORIA' })
    if (!justificativa || justificativa.length > 500)
      return e.json(400, { error: 'JUSTIFICATIVA_INVALIDA' })
    if (!idemKey || idemKey.length > 128) return e.json(400, { error: 'IDEMPOTENCY_KEY_INVALIDA' })
    if (!/^[a-f0-9]{64}$/.test(String(body.fingerprint_versoes || '')))
      return e.json(400, { error: 'FINGERPRINT_INVALIDO' })

    var aprovados = [
      '1gb8b13wky2gvdl',
      '2ism1gf4puqkmom',
      '6lz4lyhbjdh03hx',
      'axg5oe5y1ifox4g',
      'b2oro8l2t78egwk',
      'io77eusp8lu37qu',
      'joyy0k54kbd3bby',
      'kw6c565jj6j6soh',
      'l7pox1ouowsddzj',
      'lbhg291qzuy3xc9',
      'lqdxphf44mrshvj',
      'ni9s9kyijme7azj',
      'xjfnb5w6oh8l0d9',
    ]
    if (!Array.isArray(body.negocio_ids)) return e.json(400, { error: 'LISTA_INVALIDA' })
    var recebidos = body.negocio_ids.slice().sort()
    if (recebidos.length !== aprovados.length || recebidos.join(',') !== aprovados.join(','))
      return e.json(400, { error: 'LISTA_FORA_DO_GATE' })

    var comando = 'quarentena_testes_inativar',
      payload = {
        negocio_ids: aprovados,
        fingerprint_versoes: body.fingerprint_versoes,
        confirmacao: body.confirmacao,
        justificativa: justificativa,
      },
      payloadHash = $security.sha256(canonicalize(payload)),
      conhecidos = []
    try {
      conhecidos = $app.findRecordsByFilter(
        'com_idempotencia',
        "ator_id='" +
          ator.id +
          "' && comando='" +
          comando +
          "' && command_idempotency_key='" +
          idemKey +
          "'",
        '',
        1,
        0,
      )
    } catch (_) {}
    if (conhecidos.length) {
      var conhecido = conhecidos[0]
      if (conhecido.getString('payload_hash') !== payloadHash)
        return e.json(409, { error: 'CONFLICT' })
      if (conhecido.getString('estado') !== 'concluido')
        return e.json(409, { error: 'CONCORRENTE' })
      return e.json(200, Object.assign({ replay: true }, parseResultado(conhecido)))
    }

    var atualFingerprint
    try {
      atualFingerprint = fingerprint($app, aprovados)
    } catch (_) {
      return e.json(409, { error: 'ALVO_DO_GATE_AUSENTE' })
    }
    if (atualFingerprint !== body.fingerprint_versoes)
      return e.json(409, { error: 'STALE_WRITE', fingerprint_atual: atualFingerprint })

    var resposta = null,
      erro = ''
    try {
      $app.runInTransaction(function (tx) {
        var atorTx = tx.findRecordById('users', ator.id)
        if (!atorTx.getBool('ativo_comercial') || perfil(tx, atorTx) !== 'superadministrador')
          throw new Error('FORBIDDEN')
        var txFingerprint = fingerprint(tx, aprovados)
        if (txFingerprint !== body.fingerprint_versoes) throw new Error('STALE_WRITE')

        var registros = []
        for (var i = 0; i < aprovados.length; i++) {
          var negocio = tx.findRecordById('com_negocios', aprovados[i])
          if (negocio.getString('titulo').indexOf('[TESTE]') === -1)
            throw new Error('MARCADOR_TESTE_AUSENTE')
          if (negocio.getBool('inativo')) throw new Error('ALVO_JA_INATIVO')
          registros.push(negocio)
        }

        var auditoriaIds = []
        for (var r = 0; r < registros.length; r++) {
          var atual = registros[r],
            evidencia = {
              negocio_id: atual.id,
              titulo: atual.getString('titulo'),
              antes: { inativo: false, updated: atual.getString('updated') },
              depois: { inativo: true },
              fingerprint_gate: body.fingerprint_versoes,
            }
          atual.set('inativo', true)
          tx.save(atual)

          var auditoria = new Record(tx.findCollectionByNameOrId('com_auditoria'))
          auditoria.set('collection_name', 'com_negocios')
          auditoria.set('record_id', atual.id)
          auditoria.set('acao', 'update')
          auditoria.set('usuario_id', ator.id)
          auditoria.set('comando', comando)
          auditoria.set('command_idempotency_key', idemKey)
          auditoria.set('evento_em', new Date())
          auditoria.set('justificativa', justificativa)
          auditoria.set('perfil', 'superadministrador')
          auditoria.set('escopo', 'quarentena_pre_operacional')
          auditoria.set('origem', 'server-side')
          auditoria.set('evidencia_estruturada', evidencia)
          auditoria.set('snapshot_hash', $security.sha256(canonicalize(evidencia)))
          auditoria.set('snapshot_hash_versao', '1')
          tx.save(auditoria)
          auditoriaIds.push(auditoria.id)
        }

        resposta = {
          comando: comando,
          inativados: aprovados.length,
          negocio_ids: aprovados,
          auditoria_ids: auditoriaIds,
          fingerprint_gate: body.fingerprint_versoes,
          filhos_preservados: true,
        }
        var idem = new Record(tx.findCollectionByNameOrId('com_idempotencia'))
        idem.set('command_idempotency_key', idemKey)
        idem.set('comando', comando)
        idem.set('ator_id', ator.id)
        idem.set('payload_hash', payloadHash)
        idem.set('estado', 'concluido')
        idem.set('codigo_retorno', '200')
        idem.set('resultado', resposta)
        idem.set('registros_afetados', aprovados)
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
    if (erro.indexOf('ALVO_JA_INATIVO') >= 0) return e.json(409, { error: 'ALVO_JA_INATIVO' })
    if (erro.indexOf('MARCADOR_TESTE_AUSENTE') >= 0)
      return e.json(409, { error: 'MARCADOR_TESTE_AUSENTE' })
    if (erro.indexOf('FORBIDDEN') >= 0) return e.json(403, { error: 'FORBIDDEN' })
    if (erro) return e.json(500, { error: 'INTERNAL' })
    return e.json(200, Object.assign({ replay: false }, resposta))
  },
  $apis.requireAuth(),
)
