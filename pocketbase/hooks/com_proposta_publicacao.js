// Proposta nativa V1 — Lote C: publicação, token e visão pública com gate fechado.

routerAdd(
  'POST',
  '/backend/v1/propostas/{negocioId}/publicar',
  (e) => {
    function perfil(app, user) {
      try {
        return app.findRecordById('com_perfis', user.getString('perfil_id')).getString('slug')
      } catch (_) {
        return ''
      }
    }
    function podeAcessar(user, slug, negocio) {
      if (slug === 'superadministrador') return true
      if (slug === 'leitura-executiva' || slug === 'negociacao-propria') return false
      if (negocio.getString('responsavel_id') === user.id) return true
      return (
        !!user.getString('equipe_id') &&
        negocio.getString('equipe_id') === user.getString('equipe_id')
      )
    }
    function parametro(app, chave, fallback) {
      try {
        var p = app.findFirstRecordByData('com_parametros', 'chave', chave)
        return p.getBool('ativo') ? p.getString('valor') : fallback
      } catch (_) {
        return fallback
      }
    }
    function canonicalize(obj) {
      if (obj === null || obj === undefined) return 'null'
      if (typeof obj !== 'object') return JSON.stringify(obj)
      var keys = Object.keys(obj).sort(),
        parts = []
      for (var i = 0; i < keys.length; i++)
        parts.push(JSON.stringify(keys[i]) + ':' + canonicalize(obj[keys[i]]))
      return '{' + parts.join(',') + '}'
    }
    var ator = e.auth
    if (!ator || !ator.getBool('ativo_comercial'))
      return e.forbiddenError('Usuario comercial necessario')
    var body = {}
    try {
      body = JSON.parse(toString(e.request.body))
    } catch (_) {
      return e.json(400, { error: 'VALIDATION' })
    }
    if (!body.updated_esperado || !body.command_idempotency_key)
      return e.json(400, { error: 'VALIDATION' })
    var negocioId = e.request.pathValue('negocioId'),
      slug = perfil($app, ator)
    if (slug === 'leitura-executiva' || slug === 'negociacao-propria')
      return e.json(403, { error: 'ACAO_NAO_AUTORIZADA' })
    var payloadHash = $security.sha256(
        canonicalize({ negocio_id: negocioId, updated_esperado: body.updated_esperado }),
      ),
      comando = 'publicar_proposta_nativa',
      conhecidos = []
    try {
      conhecidos = $app.findRecordsByFilter(
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
    if (conhecidos.length) {
      if (conhecidos[0].getString('payload_hash') !== payloadHash)
        return e.json(409, { error: 'CONFLICT' })
      if (conhecidos[0].getString('estado') !== 'concluido')
        return e.json(409, { error: 'CONCORRENTE' })
      var replay = {}
      try {
        replay = JSON.parse(conhecidos[0].getString('resultado') || '{}')
      } catch (_) {}
      replay.replay = true
      replay.token = null
      replay.token_nao_reexibivel = true
      return e.json(200, replay)
    }
    var token = $security.randomStringWithAlphabet(
        64,
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_',
      ),
      resposta = null,
      etapa = ''
    try {
      $app.runInTransaction(function (tx) {
        etapa = 'idempotencia'
        var idem = new Record(tx.findCollectionByNameOrId('com_idempotencia'))
        idem.set('command_idempotency_key', body.command_idempotency_key)
        idem.set('comando', comando)
        idem.set('ator_id', ator.id)
        idem.set('payload_hash', payloadHash)
        idem.set('estado', 'executando')
        idem.set('executor_id', 'pb-primary')
        idem.set('lease_ate', new Date(Date.now() + 300000))
        idem.set('tentativa', 1)
        idem.set('inicio_em', new Date())
        idem.set('resultado', {})
        tx.save(idem)
        etapa = 'autorizacao'
        var user = tx.findRecordById('users', ator.id),
          negocio = tx.findRecordById('com_negocios', negocioId),
          slugTx = perfil(tx, user)
        if (!podeAcessar(user, slugTx, negocio)) throw new Error('FORBIDDEN')
        var proposta = tx.findFirstRecordByData('com_propostas', 'negocio_id', negocio.id),
          versoes = tx.findRecordsByFilter(
            'com_proposta_versoes',
            "proposta_id='" + proposta.id + "'",
            '-numero',
            1,
            0,
          )
        if (!versoes.length) throw new Error('NAO_PREPARADA')
        var versao = versoes[0]
        if (versao.getString('updated') !== body.updated_esperado) throw new Error('STALE_WRITE')
        if (!versao.getString('arquivo_pdf') || !versao.getString('arquivo_sha256'))
          throw new Error('PDF_OBRIGATORIO')
        var exige = parametro(tx, 'proposta.aprovacao_interna_obrigatoria', 'false') === 'true'
        if (exige && versao.getString('aprovacao_estado') !== 'aprovada')
          throw new Error('APROVACAO_OBRIGATORIA')
        var ativas = []
        try {
          ativas = tx.findRecordsByFilter(
            'com_proposta_publicacoes',
            "proposta_id='" + proposta.id + "' && estado='ativa'",
            '',
            10,
            0,
          )
        } catch (_) {}
        for (var ai = 0; ai < ativas.length; ai++) {
          ativas[ai].set('estado', 'revogada')
          ativas[ai].set('revogada_em', new Date())
          ativas[ai].set('revogada_por', ator.id)
          tx.save(ativas[ai])
        }
        etapa = 'publicacao'
        var dias = Number(parametro(tx, 'proposta.link_expiracao_dias', '30'))
        if (!Number.isInteger(dias) || dias < 1 || dias > 90) dias = 30
        var publicacao = new Record(tx.findCollectionByNameOrId('com_proposta_publicacoes')),
          agora = new Date(),
          expira = new Date(agora.getTime() + dias * 86400000)
        publicacao.set('proposta_id', proposta.id)
        publicacao.set('versao_id', versao.id)
        publicacao.set('token_hash', $security.sha256(token))
        publicacao.set('token_prefix', token.substring(0, 8))
        publicacao.set('publicada_em', agora)
        publicacao.set('expira_em', expira)
        publicacao.set('estado', 'ativa')
        tx.save(publicacao)
        proposta.set('versao_publicada_id', versao.id)
        proposta.set('publicacao_estado', 'publicada')
        proposta.set('decisao_publica', 'pendente')
        tx.save(proposta)
        var evidencia = {
          proposta_id: proposta.id,
          versao_id: versao.id,
          publicacao_id: publicacao.id,
          expira_em: expira.toISOString(),
          token_prefix: token.substring(0, 8),
        }
        var aud = new Record(tx.findCollectionByNameOrId('com_auditoria'))
        aud.set('collection_name', 'com_proposta_publicacoes')
        aud.set('record_id', publicacao.id)
        aud.set('acao', 'create')
        aud.set('usuario_id', ator.id)
        aud.set('comando', 'proposta_publicada')
        aud.set('evento_em', agora)
        aud.set('justificativa', 'Publicação controlada da proposta')
        aud.set('perfil', slugTx)
        aud.set('origem', 'server-side')
        aud.set('evidencia_estruturada', evidencia)
        aud.set('snapshot_hash', $security.sha256(canonicalize(evidencia)))
        aud.set('snapshot_hash_versao', '1')
        tx.save(aud)
        resposta = {
          negocio_id: negocio.id,
          proposta_id: proposta.id,
          versao_id: versao.id,
          publicacao_id: publicacao.id,
          token: token,
          token_prefix: token.substring(0, 8),
          expira_em: expira.toISOString(),
          estado: 'ativa',
          replay: false,
        }
        idem.set('estado', 'concluido')
        idem.set('fim_em', new Date())
        idem.set('resultado', {
          negocio_id: negocio.id,
          proposta_id: proposta.id,
          versao_id: versao.id,
          publicacao_id: publicacao.id,
          token_prefix: token.substring(0, 8),
          expira_em: expira.toISOString(),
          estado: 'ativa',
        })
        idem.set('registros_afetados', [publicacao.id, proposta.id, aud.id])
        tx.save(idem)
        etapa = ''
      })
      return e.json(201, resposta)
    } catch (err) {
      var m = String(err && err.message ? err.message : err)
      var codigos = [
        'FORBIDDEN',
        'STALE_WRITE',
        'NAO_PREPARADA',
        'PDF_OBRIGATORIO',
        'APROVACAO_OBRIGATORIA',
      ]
      for (var ci = 0; ci < codigos.length; ci++)
        if (m.indexOf(codigos[ci]) >= 0) return e.json(409, { error: codigos[ci] })
      return e.json(500, { error: 'PUBLICAR_PROPOSTA', stage: etapa || 'desconhecida' })
    }
  },
  $apis.requireAuth(),
)

routerAdd(
  'POST',
  '/backend/v1/propostas/{negocioId}/revogar',
  (e) => {
    function perfil(app, user) {
      try {
        return app.findRecordById('com_perfis', user.getString('perfil_id')).getString('slug')
      } catch (_) {
        return ''
      }
    }
    var ator = e.auth,
      slug = perfil($app, ator)
    if (!ator || !ator.getBool('ativo_comercial'))
      return e.forbiddenError('Usuario comercial necessario')
    if (slug !== 'superadministrador' && slug !== 'gestor-comercial')
      return e.json(403, { error: 'ACAO_NAO_AUTORIZADA' })
    var body = {}
    try {
      body = JSON.parse(toString(e.request.body))
    } catch (_) {
      return e.json(400, { error: 'VALIDATION' })
    }
    if (!body.command_idempotency_key) return e.json(400, { error: 'VALIDATION' })
    try {
      var negocio = $app.findRecordById('com_negocios', e.request.pathValue('negocioId'))
      if (
        slug !== 'superadministrador' &&
        negocio.getString('equipe_id') !== ator.getString('equipe_id')
      )
        return e.json(403, { error: 'FORBIDDEN' })
      var proposta = $app.findFirstRecordByData('com_propostas', 'negocio_id', negocio.id),
        pub = $app.findFirstRecordByFilter(
          'com_proposta_publicacoes',
          "proposta_id='" + proposta.id + "' && estado='ativa'",
        )
      pub.set('estado', 'revogada')
      pub.set('revogada_em', new Date())
      pub.set('revogada_por', ator.id)
      $app.save(pub)
      proposta.set('publicacao_estado', 'revogada')
      $app.save(proposta)
      return e.json(200, { publicacao_id: pub.id, estado: 'revogada' })
    } catch (_) {
      return e.json(404, { error: 'PUBLICACAO_ATIVA_NAO_ENCONTRADA' })
    }
  },
  $apis.requireAuth(),
)

routerAdd(
  'GET',
  '/backend/v1/propostas/{negocioId}/publicacao',
  (e) => {
    if (!e.auth || !e.auth.getBool('ativo_comercial'))
      return e.forbiddenError('Usuario comercial necessario')
    try {
      var negocio = $app.findRecordById('com_negocios', e.request.pathValue('negocioId')),
        proposta = $app.findFirstRecordByData('com_propostas', 'negocio_id', negocio.id),
        rows = $app.findRecordsByFilter(
          'com_proposta_publicacoes',
          "proposta_id='" + proposta.id + "'",
          '-created',
          20,
          0,
        ),
        itens = []
      for (var i = 0; i < rows.length; i++)
        itens.push({
          id: rows[i].id,
          versao_id: rows[i].getString('versao_id'),
          token_prefix: rows[i].getString('token_prefix'),
          publicada_em: rows[i].getString('publicada_em'),
          expira_em: rows[i].getString('expira_em'),
          estado: rows[i].getString('estado'),
        })
      return e.json(200, { itens: itens })
    } catch (_) {
      return e.json(404, { error: 'PROPOSTA_NAO_ENCONTRADA' })
    }
  },
  $apis.requireAuth(),
)

routerAdd('GET', '/backend/v1/public/propostas/{token}', (e) => {
  function gate(app) {
    try {
      var p = app.findFirstRecordByData(
        'com_parametros',
        'chave',
        'proposta.pagina_publica_habilitada',
      )
      return p.getBool('ativo') && p.getString('valor') === 'true'
    } catch (_) {
      return false
    }
  }
  function indisponivel() {
    return e.json(404, { error: 'PROPOSTA_INDISPONIVEL' })
  }
  e.response.header().set('X-Robots-Tag', 'noindex, nofollow, noarchive')
  e.response.header().set('Cache-Control', 'no-store')
  if (!gate($app)) return indisponivel()
  var token = e.request.pathValue('token')
  if (!token || token.length !== 64) return indisponivel()
  try {
    var pub = $app.findFirstRecordByData(
      'com_proposta_publicacoes',
      'token_hash',
      $security.sha256(token),
    )
    if (pub.getString('estado') !== 'ativa' || new Date(pub.getString('expira_em')) <= new Date())
      return indisponivel()
    var proposta = $app.findRecordById('com_propostas', pub.getString('proposta_id')),
      versao = $app.findRecordById('com_proposta_versoes', pub.getString('versao_id'))
    return e.json(200, {
      identificador: proposta.getString('identificador'),
      numero: versao.getInt('numero'),
      cliente: versao.getString('cliente_snapshot'),
      contato: versao.getString('contato_snapshot'),
      responsavel: versao.getString('responsavel_snapshot'),
      modalidade: versao.getString('modalidade'),
      valor_total_centavos: Number(versao.get('valor_total_centavos') || 0),
      validade: versao.getString('validade') || null,
      expira_em: pub.getString('expira_em'),
      decisao: proposta.getString('decisao_publica') || 'pendente',
    })
  } catch (_) {
    return indisponivel()
  }
})
