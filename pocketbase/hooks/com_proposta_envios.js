// Proposta nativa V1 — Lote E: Resend com gate fechado e WhatsApp assistido.

routerAdd(
  'POST',
  '/backend/v1/propostas/{negocioId}/enviar-email',
  (e) => {
    function parametro(app, chave, fallback) {
      try {
        var p = app.findFirstRecordByData('com_parametros', 'chave', chave)
        return p.getBool('ativo') ? p.getString('valor') : fallback
      } catch (_) {
        return fallback
      }
    }
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
    function contexto(app, negocioId, link) {
      var token = String(link || '').split('/p/')[1] || ''
      token = token.split(/[?#]/)[0]
      if (token.length !== 64) throw new Error('LINK_INVALIDO')
      var negocio = app.findRecordById('com_negocios', negocioId)
      var proposta = app.findFirstRecordByData('com_propostas', 'negocio_id', negocio.id)
      var pub = app.findFirstRecordByData(
        'com_proposta_publicacoes',
        'token_hash',
        $security.sha256(token),
      )
      if (
        pub.getString('proposta_id') !== proposta.id ||
        pub.getString('estado') !== 'ativa' ||
        new Date(pub.getString('expira_em')) <= new Date()
      )
        throw new Error('LINK_INVALIDO')
      return {
        negocio: negocio,
        proposta: proposta,
        publicacao: pub,
        versao: app.findRecordById('com_proposta_versoes', pub.getString('versao_id')),
      }
    }
    var ator = e.auth
    if (!ator || !ator.getBool('ativo_comercial'))
      return e.forbiddenError('Usuario comercial necessario')
    var slug = perfil($app, ator)
    if (slug === 'leitura-executiva' || slug === 'negociacao-propria')
      return e.json(403, { error: 'ACAO_NAO_AUTORIZADA' })
    // O gate antecede leitura de segredo, persistência e qualquer chamada externa.
    if (parametro($app, 'proposta.email_habilitado', 'false') !== 'true')
      return e.json(503, { error: 'EMAIL_DESABILITADO' })
    var body = {}
    try {
      body = JSON.parse(toString(e.request.body))
    } catch (_) {
      return e.json(400, { error: 'VALIDATION' })
    }
    var destinatario = String(body.destinatario || '')
      .trim()
      .toLowerCase()
    var chave = String(body.command_idempotency_key || '')
    if (!chave || !body.link_publico || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(destinatario))
      return e.json(400, { error: 'VALIDATION' })
    try {
      var existente = $app.findFirstRecordByData(
        'com_proposta_envios',
        'command_idempotency_key',
        chave,
      )
      return e.json(200, {
        envio_id: existente.id,
        estado: existente.getString('estado'),
        replay: true,
      })
    } catch (_) {}
    try {
      var ctx = contexto($app, e.request.pathValue('negocioId'), body.link_publico)
      if (!podeAcessar(ator, slug, ctx.negocio)) return e.json(403, { error: 'FORBIDDEN' })
      var replyTo = ator.getString('email') || 'luiz.moura@pmaisservicos.com.br'
      var assunto = String(
        body.assunto || 'Proposta comercial PMais — ' + ctx.negocio.getString('titulo'),
      ).substring(0, 300)
      var snapshot = 'Mensagem com link seguro individual [LINK_SEGURO_NAO_PERSISTIDO]'
      var envio = new Record($app.findCollectionByNameOrId('com_proposta_envios'))
      envio.set('proposta_id', ctx.proposta.id)
      envio.set('versao_id', ctx.versao.id)
      envio.set('publicacao_id', ctx.publicacao.id)
      envio.set('canal', 'email')
      envio.set('destinatario', destinatario)
      envio.set('assunto', assunto)
      envio.set('mensagem_snapshot', snapshot)
      envio.set('reply_to', replyTo)
      envio.set('estado', 'enviando')
      envio.set('tentativa', 1)
      envio.set('command_idempotency_key', chave)
      $app.save(envio)
      var apiKey = $secrets.get('RESEND_API_KEY')
      if (!apiKey) throw new Error('RESEND_NAO_CONFIGURADO')
      var resposta = $http.send({
        url: 'https://api.resend.com/emails',
        method: 'POST',
        timeout: 20,
        headers: {
          Authorization: 'Bearer ' + apiKey,
          'Content-Type': 'application/json',
          'Idempotency-Key': chave,
          'User-Agent': 'PMais-Comercial/1.0',
        },
        body: JSON.stringify({
          from: 'PMais Serviços <spok@lulamoura.com.br>',
          to: [destinatario],
          reply_to: replyTo,
          subject: assunto,
          html:
            '<p>Olá,</p><p>Segue a proposta comercial da PMais para sua análise.</p><p><a href="' +
            String(body.link_publico) +
            '">Acessar proposta</a></p><p>Atenciosamente,<br>Equipe PMais</p>',
          text:
            'Segue a proposta comercial da PMais para sua análise: ' + String(body.link_publico),
        }),
      })
      if (resposta.statusCode < 200 || resposta.statusCode >= 300)
        throw new Error('RESEND_HTTP_' + resposta.statusCode)
      var provider = {}
      try {
        provider = JSON.parse(resposta.raw || '{}')
      } catch (_) {}
      envio.set('estado', 'enviado')
      envio.set('provider_id', String(provider.id || '').substring(0, 300))
      envio.set('enviado_em', new Date())
      $app.save(envio)
      return e.json(201, { envio_id: envio.id, estado: 'enviado', replay: false })
    } catch (err) {
      try {
        if (typeof envio !== 'undefined' && envio) {
          envio.set('estado', 'falhou')
          envio.set('erro_codigo', String(err && err.message ? err.message : err).substring(0, 200))
          $app.save(envio)
        }
      } catch (_) {}
      var msg = String(err && err.message ? err.message : err)
      if (msg.indexOf('LINK_INVALIDO') >= 0) return e.json(409, { error: 'LINK_INVALIDO' })
      return e.json(502, { error: 'ENVIO_EMAIL_FALHOU' })
    }
  },
  $apis.requireAuth(),
)

// Rota temporária do QA controlado Lote F. Será removida após a limpeza comprovada.
routerAdd(
  'POST',
  '/backend/v1/propostas/qa-f/criar',
  (e) => {
    function superadmin(app, user) {
      try {
        return (
          app.findRecordById('com_perfis', user.getString('perfil_id')).getString('slug') ===
          'superadministrador'
        )
      } catch (_) {
        return false
      }
    }
    if (!e.auth || !e.auth.getBool('ativo_comercial') || !superadmin($app, e.auth))
      return e.json(403, { error: 'FORBIDDEN' })
    var body = {}
    try {
      body = JSON.parse(toString(e.request.body))
    } catch (_) {
      return e.json(400, { error: 'VALIDATION' })
    }
    if (body.confirmacao !== 'CRIAR TESTE DESCARTAVEL LOTE F')
      return e.json(400, { error: 'CONFIRMACAO' })
    try {
      $app.findRecordById('com_negocios', 'lotefnegocio001')
      return e.json(409, { error: 'TESTE_JA_EXISTE' })
    } catch (_) {}
    try {
      var empresa = new Record($app.findCollectionByNameOrId('com_empresas'))
      empresa.id = 'lotefempresa001'
      empresa.set('nome', '[TESTE LOTE F] Cliente descartável')
      empresa.set('email', 'luiz.moura@pmaisservicos.com.br')
      empresa.set('telefone', '81999999999')
      empresa.set('status', 'ativo')
      empresa.set('equipe_id', e.auth.getString('equipe_id'))
      empresa.set('responsavel_id', e.auth.id)
      $app.save(empresa)
      var negocio = new Record($app.findCollectionByNameOrId('com_negocios'))
      negocio.id = 'lotefnegocio001'
      negocio.set('titulo', '[TESTE LOTE F] Proposta descartável')
      negocio.set('empresa_id', empresa.id)
      negocio.set('equipe_id', e.auth.getString('equipe_id'))
      negocio.set('responsavel_id', e.auth.id)
      negocio.set('valor', 1000)
      negocio.set('descricao', 'QA controlado da proposta nativa')
      negocio.set('etapa', 'producao_proposta')
      negocio.set('inativo', false)
      negocio.set('tipo_entrada', 'pre_qualificada')
      negocio.set('qualificacao', 'qualificada')
      negocio.set('prospectivo', true)
      negocio.set('modalidade', 'serv_eventual')
      negocio.set('origem_canal', 'qa_controlado')
      $app.save(negocio)
      return e.json(201, {
        empresa_id: empresa.id,
        negocio_id: negocio.id,
        negocio_updated: negocio.getString('updated'),
      })
    } catch (err) {
      try {
        $app.delete($app.findRecordById('com_empresas', 'lotefempresa001'))
      } catch (_) {}
      return e.json(500, { error: 'QA_CRIAR' })
    }
  },
  $apis.requireAuth(),
)

routerAdd(
  'POST',
  '/backend/v1/propostas/qa-f/limpar',
  (e) => {
    function superadmin(app, user) {
      try {
        return (
          app.findRecordById('com_perfis', user.getString('perfil_id')).getString('slug') ===
          'superadministrador'
        )
      } catch (_) {
        return false
      }
    }
    function apagarFiltro(app, colecao, filtro) {
      var rows = []
      try {
        rows = app.findRecordsByFilter(colecao, filtro, '', 1000, 0)
      } catch (_) {}
      for (var i = 0; i < rows.length; i++)
        try {
          app.delete(rows[i])
        } catch (_) {}
    }
    if (!e.auth || !e.auth.getBool('ativo_comercial') || !superadmin($app, e.auth))
      return e.json(403, { error: 'FORBIDDEN' })
    var body = {}
    try {
      body = JSON.parse(toString(e.request.body))
    } catch (_) {
      return e.json(400, { error: 'VALIDATION' })
    }
    if (body.confirmacao !== 'ELIMINAR TESTE DESCARTAVEL LOTE F')
      return e.json(400, { error: 'CONFIRMACAO' })
    try {
      var proposta = null,
        versoes = [],
        pubs = []
      try {
        proposta = $app.findFirstRecordByData('com_propostas', 'negocio_id', 'lotefnegocio001')
      } catch (_) {}
      if (proposta) {
        try {
          versoes = $app.findRecordsByFilter(
            'com_proposta_versoes',
            "proposta_id='" + proposta.id + "'",
            '',
            100,
            0,
          )
        } catch (_) {}
        try {
          pubs = $app.findRecordsByFilter(
            'com_proposta_publicacoes',
            "proposta_id='" + proposta.id + "'",
            '',
            100,
            0,
          )
        } catch (_) {}
      }
      if (proposta) apagarFiltro($app, 'com_proposta_envios', "proposta_id='" + proposta.id + "'")
      for (var p = 0; p < pubs.length; p++)
        apagarFiltro($app, 'com_proposta_eventos_publicos', "publicacao_id='" + pubs[p].id + "'")
      for (var p2 = 0; p2 < pubs.length; p2++)
        try {
          $app.delete(pubs[p2])
        } catch (_) {}
      for (var v = 0; v < versoes.length; v++)
        apagarFiltro($app, 'com_auditoria', "record_id='" + versoes[v].id + "'")
      for (var v2 = 0; v2 < versoes.length; v2++)
        try {
          $app.delete(versoes[v2])
        } catch (_) {}
      if (proposta)
        try {
          $app.delete(proposta)
        } catch (_) {}
      apagarFiltro($app, 'com_atividades', "negocio_id='lotefnegocio001'")
      apagarFiltro($app, 'com_negocio_historico', "negocio_id='lotefnegocio001'")
      apagarFiltro($app, 'com_auditoria', "record_id='lotefnegocio001'")
      apagarFiltro($app, 'com_auditoria', "record_id='lotefempresa001'")
      var idems = []
      try {
        idems = $app.findRecordsByFilter(
          'com_idempotencia',
          "command_idempotency_key~'lotef-'",
          '',
          1000,
          0,
        )
      } catch (_) {}
      for (var z = 0; z < idems.length; z++)
        try {
          $app.delete(idems[z])
        } catch (_) {}
      try {
        $app.delete($app.findRecordById('com_negocios', 'lotefnegocio001'))
      } catch (_) {}
      try {
        $app.delete($app.findRecordById('com_empresas', 'lotefempresa001'))
      } catch (_) {}
      var restante = false
      try {
        $app.findRecordById('com_negocios', 'lotefnegocio001')
        restante = true
      } catch (_) {}
      try {
        $app.findRecordById('com_empresas', 'lotefempresa001')
        restante = true
      } catch (_) {}
      return e.json(restante ? 500 : 200, { limpo: !restante })
    } catch (_) {
      return e.json(500, { error: 'QA_LIMPAR' })
    }
  },
  $apis.requireAuth(),
)

routerAdd(
  'POST',
  '/backend/v1/propostas/qa-f/gates',
  (e) => {
    function superadmin(app, user) {
      try {
        return (
          app.findRecordById('com_perfis', user.getString('perfil_id')).getString('slug') ===
          'superadministrador'
        )
      } catch (_) {
        return false
      }
    }
    if (!e.auth || !e.auth.getBool('ativo_comercial') || !superadmin($app, e.auth))
      return e.json(403, { error: 'FORBIDDEN' })
    var body = {}
    try {
      body = JSON.parse(toString(e.request.body))
    } catch (_) {
      return e.json(400, { error: 'VALIDATION' })
    }
    if (
      body.confirmacao !== 'ALTERAR GATES TEMPORARIOS LOTE F' ||
      typeof body.pagina_publica !== 'boolean' ||
      typeof body.email !== 'boolean'
    )
      return e.json(400, { error: 'CONFIRMACAO' })
    try {
      var p = $app.findFirstRecordByData(
          'com_parametros',
          'chave',
          'proposta.pagina_publica_habilitada',
        ),
        m = $app.findFirstRecordByData('com_parametros', 'chave', 'proposta.email_habilitado')
      p.set('valor', body.pagina_publica ? 'true' : 'false')
      p.set('justificativa', '[TESTE LOTE F] gate temporário')
      m.set('valor', body.email ? 'true' : 'false')
      m.set('justificativa', '[TESTE LOTE F] gate temporário')
      $app.save(p)
      $app.save(m)
      return e.json(200, { pagina_publica: p.getString('valor'), email: m.getString('valor') })
    } catch (_) {
      return e.json(500, { error: 'QA_GATES' })
    }
  },
  $apis.requireAuth(),
)

routerAdd(
  'POST',
  '/backend/v1/propostas/{negocioId}/preparar-whatsapp',
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
      return (
        negocio.getString('responsavel_id') === user.id ||
        (!!user.getString('equipe_id') &&
          negocio.getString('equipe_id') === user.getString('equipe_id'))
      )
    }
    var ator = e.auth
    if (!ator || !ator.getBool('ativo_comercial'))
      return e.forbiddenError('Usuario comercial necessario')
    var slug = perfil($app, ator)
    if (slug === 'leitura-executiva' || slug === 'negociacao-propria')
      return e.json(403, { error: 'ACAO_NAO_AUTORIZADA' })
    var body = {}
    try {
      body = JSON.parse(toString(e.request.body))
    } catch (_) {
      return e.json(400, { error: 'VALIDATION' })
    }
    var telefone = String(body.telefone || '').replace(/\D/g, ''),
      link = String(body.link_publico || ''),
      chave = String(body.command_idempotency_key || '')
    var token = (link.split('/p/')[1] || '').split(/[?#]/)[0]
    if (!chave || telefone.length < 10 || telefone.length > 15 || token.length !== 64)
      return e.json(400, { error: 'VALIDATION' })
    try {
      var existente = $app.findFirstRecordByData(
        'com_proposta_envios',
        'command_idempotency_key',
        chave,
      )
      var mensagemReplay = String(
        body.mensagem || 'Olá! Segue a proposta comercial da PMais para sua análise: ' + link,
      ).substring(0, 4000)
      return e.json(200, {
        envio_id: existente.id,
        estado: existente.getString('estado'),
        replay: true,
        mensagem: mensagemReplay,
        url_whatsapp: 'https://wa.me/' + telefone + '?text=' + encodeURIComponent(mensagemReplay),
      })
    } catch (_) {}
    try {
      var negocio = $app.findRecordById('com_negocios', e.request.pathValue('negocioId')),
        proposta = $app.findFirstRecordByData('com_propostas', 'negocio_id', negocio.id)
      if (!podeAcessar(ator, slug, negocio)) return e.json(403, { error: 'FORBIDDEN' })
      var pub = $app.findFirstRecordByData(
        'com_proposta_publicacoes',
        'token_hash',
        $security.sha256(token),
      )
      if (
        pub.getString('proposta_id') !== proposta.id ||
        pub.getString('estado') !== 'ativa' ||
        new Date(pub.getString('expira_em')) <= new Date()
      )
        return e.json(409, { error: 'LINK_INVALIDO' })
      var mensagem = String(
        body.mensagem || 'Olá! Segue a proposta comercial da PMais para sua análise: ' + link,
      ).substring(0, 4000)
      var envio = new Record($app.findCollectionByNameOrId('com_proposta_envios'))
      envio.set('proposta_id', proposta.id)
      envio.set('versao_id', pub.getString('versao_id'))
      envio.set('publicacao_id', pub.id)
      envio.set('canal', 'whatsapp_assistido')
      envio.set('assunto', 'Compartilhamento assistido por WhatsApp')
      envio.set('mensagem_snapshot', mensagem.replace(link, '[LINK_SEGURO_NAO_PERSISTIDO]'))
      envio.set('estado', 'solicitado')
      envio.set('tentativa', 1)
      envio.set('command_idempotency_key', chave)
      $app.save(envio)
      return e.json(201, {
        envio_id: envio.id,
        estado: 'solicitado',
        replay: false,
        mensagem: mensagem,
        url_whatsapp: 'https://wa.me/' + telefone + '?text=' + encodeURIComponent(mensagem),
      })
    } catch (_) {
      return e.json(409, { error: 'LINK_INVALIDO' })
    }
  },
  $apis.requireAuth(),
)
