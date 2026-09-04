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
    var cc = Array.isArray(body.cc) ? body.cc : []
    cc = cc
      .map(function (email) {
        return String(email || '')
          .trim()
          .toLowerCase()
      })
      .filter(function (email, index, lista) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && lista.indexOf(email) === index
      })
      .slice(0, 20)
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
      var replyTo = String(
        body.reply_to || ator.getString('email') || 'luiz.moura@pmaisservicos.com.br',
      )
        .trim()
        .toLowerCase()
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(replyTo))
        return e.json(400, { error: 'REPLY_TO_INVALIDO' })
      var assunto = String(
        body.assunto || 'Proposta comercial PMais — ' + ctx.negocio.getString('titulo'),
      )
        .trim()
        .substring(0, 300)
      var corpo = String(
        body.corpo ||
          'Olá,\n\nSegue a proposta comercial da PMais para sua análise.\n\n[LINK_PROPOSTA]\n\nAtenciosamente,\nEquipe PMais',
      )
        .trim()
        .substring(0, 10000)
      if (!assunto || !corpo) return e.json(400, { error: 'VALIDATION' })
      var corpoComLink =
        corpo.indexOf('[LINK_PROPOSTA]') >= 0
          ? corpo.replace('[LINK_PROPOSTA]', String(body.link_publico))
          : corpo + '\n\n' + String(body.link_publico)
      var snapshot = corpo.replace(String(body.link_publico), '[LINK_SEGURO_NAO_PERSISTIDO]')
      if (cc.length) snapshot += '\n\nCc: ' + cc.join(', ')
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
          from: 'PMais Serviços <nao-responda@pmaisservicos.com.br>',
          to: [destinatario],
          cc: cc,
          reply_to: replyTo,
          subject: assunto,
          html:
            '<div style="font-family:Arial,sans-serif;line-height:1.6;white-space:pre-wrap">' +
            corpoComLink
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(
                String(body.link_publico),
                '<a href="' + String(body.link_publico) + '">Visualizar proposta</a>',
              ) +
            '</div>',
          text: corpoComLink,
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
