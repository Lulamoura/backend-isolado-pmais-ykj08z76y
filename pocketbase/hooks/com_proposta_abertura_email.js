// E-mail idempotente ao remetente e ao Reply-To na primeira abertura real de cada publicação.
onRecordAfterCreateSuccess(function (e) {
  e.next()
  var evento = e.record
  if (!evento || evento.getString('tipo') !== 'pagina_acessada') return

  function parametro(chave, fallback) {
    try {
      var p = $app.findFirstRecordByData('com_parametros', 'chave', chave)
      return p.getBool('ativo') ? p.getString('valor') : fallback
    } catch (_) {
      return fallback
    }
  }
  if (parametro('proposta.email_habilitado', 'false') !== 'true') return
  if (parametro('proposta.email_notificar_remetente_abertura', 'false') !== 'true') return

  try {
    var publicacao = $app.findRecordById(
        'com_proposta_publicacoes',
        evento.getString('publicacao_id'),
      ),
      primeiros = $app.findRecordsByFilter(
        'com_proposta_eventos_publicos',
        "publicacao_id='" + publicacao.id + "' && tipo='pagina_acessada'",
        'ocorrido_em',
        1,
        0,
      )
    if (!primeiros.length) return

    var aviso = null
    try {
      aviso = $app.findFirstRecordByData(
        'com_proposta_abertura_emails',
        'publicacao_id',
        publicacao.id,
      )
      if (aviso.getString('estado') === 'enviado' || aviso.getString('estado') === 'enviando')
        return
      if (Number(aviso.get('tentativa') || 0) >= 3) return
    } catch (_) {}

    var proposta = $app.findRecordById('com_propostas', publicacao.getString('proposta_id')),
      versao = $app.findRecordById('com_proposta_versoes', publicacao.getString('versao_id')),
      negocio = $app.findRecordById('com_negocios', proposta.getString('negocio_id')),
      remetenteId = '',
      replyTo = ''
    try {
      var envios = $app.findRecordsByFilter(
        'com_proposta_envios',
        "publicacao_id='" + publicacao.id + "' && canal='email' && estado='enviado'",
        '-enviado_em',
        1,
        0,
      )
      if (envios.length) {
        remetenteId = envios[0].getString('remetente_id')
        replyTo = String(envios[0].getString('reply_to') || '')
          .trim()
          .toLowerCase()
      }
    } catch (_) {}
    if (!remetenteId) remetenteId = versao.getString('responsavel_envio_id')
    if (!remetenteId) remetenteId = negocio.getString('responsavel_id')
    if (!remetenteId) return

    var remetente = $app.findRecordById('users', remetenteId),
      destinatario = String(remetente.getString('email') || '')
        .trim()
        .toLowerCase()
    if (!remetente.getBool('ativo_comercial')) return
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(destinatario)) return
    var destinatarios = [destinatario]
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(replyTo) && destinatarios.indexOf(replyTo) === -1)
      destinatarios.push(replyTo)

    if (!aviso) {
      try {
        aviso = new Record($app.findCollectionByNameOrId('com_proposta_abertura_emails'))
        aviso.set('publicacao_id', publicacao.id)
        aviso.set('evento_id', primeiros[0].id)
        aviso.set('remetente_id', remetente.id)
        aviso.set('destinatario', destinatario)
        aviso.set('estado', 'enviando')
        aviso.set('tentativa', 1)
        $app.save(aviso)
      } catch (_) {
        return
      }
    } else {
      aviso.set('estado', 'enviando')
      aviso.set('tentativa', Number(aviso.get('tentativa') || 0) + 1)
      aviso.set('erro_codigo', '')
      $app.save(aviso)
    }

    var externalId = ''
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
    var cliente = versao.getString('cliente_snapshot') || negocio.getString('titulo'),
      visitante = primeiros[0].getString('visitante_nome'),
      ocorrido = primeiros[0].getString('ocorrido_em'),
      referencia = externalId ? 'AC #' + externalId : proposta.getString('identificador'),
      assunto = 'Proposta ' + referencia + ' aberta — ' + cliente,
      valor = Number(versao.get('valor_total_centavos') || 0) / 100,
      valorTexto = 'R$ ' + valor.toFixed(2).replace('.', ','),
      linhas = [
        'Olá, ' + (remetente.getString('name') || 'responsável') + '.',
        '',
        'A proposta ' + referencia + ' de ' + cliente + ' foi aberta.',
        '',
        'Data e hora: ' + ocorrido,
        'Visitante: ' + (visitante || 'não informado'),
        'Modalidade: ' + (versao.getString('modalidade') || 'não informada'),
        'Valor: ' + valorTexto,
        '',
        'Este aviso corresponde à primeira abertura desta publicação.',
      ],
      texto = linhas.join('\n'),
      html = texto
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>'),
      apiKey = $secrets.get('RESEND_API_KEY')
    if (!apiKey) throw new Error('RESEND_NAO_CONFIGURADO')
    var resposta = $http.send({
      url: 'https://api.resend.com/emails',
      method: 'POST',
      timeout: 20,
      headers: {
        Authorization: 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
        'Idempotency-Key': 'proposta-abertura-' + publicacao.id,
        'User-Agent': 'PMais-Comercial/1.0',
      },
      body: JSON.stringify({
        from: 'PMais Serviços <nao-responda@pmaisservicos.com.br>',
        to: destinatarios,
        subject: assunto,
        html: '<div style="font-family:Arial,sans-serif;line-height:1.6">' + html + '</div>',
        text: texto,
      }),
    })
    if (resposta.statusCode < 200 || resposta.statusCode >= 300)
      throw new Error('RESEND_HTTP_' + resposta.statusCode)
    var provider = {}
    try {
      provider = JSON.parse(resposta.raw || '{}')
    } catch (_) {}
    aviso.set('estado', 'enviado')
    aviso.set('provider_id', String(provider.id || '').substring(0, 300))
    aviso.set('enviado_em', new Date())
    $app.save(aviso)
  } catch (err) {
    try {
      if (aviso) {
        aviso.set('estado', 'falhou')
        aviso.set('erro_codigo', String(err && err.message ? err.message : err).substring(0, 200))
        $app.save(aviso)
      }
    } catch (_) {}
  }
}, 'com_proposta_eventos_publicos')

// E-mail interno ao responsável quando cliente aceita ou recusa pela página pública.
onRecordAfterCreateSuccess(function (e) {
  e.next()
  var evento = e.record
  if (
    !evento ||
    (evento.getString('tipo') !== 'aceite_confirmado' &&
      evento.getString('tipo') !== 'recusa_confirmada')
  )
    return

  function parametro(chave, fallback) {
    try {
      var p = $app.findFirstRecordByData('com_parametros', 'chave', chave)
      return p.getBool('ativo') ? p.getString('valor') : fallback
    } catch (_) {
      return fallback
    }
  }
  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
  }
  function emailValido(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim().toLowerCase())
  }

  if (parametro('proposta.email_habilitado', 'false') !== 'true') return
  if (parametro('proposta.email_notificar_responsavel_decisao', 'true') !== 'true') return

  try {
    var publicacao = $app.findRecordById(
        'com_proposta_publicacoes',
        evento.getString('publicacao_id'),
      ),
      proposta = $app.findRecordById('com_propostas', publicacao.getString('proposta_id')),
      versao = $app.findRecordById('com_proposta_versoes', publicacao.getString('versao_id')),
      negocio = $app.findRecordById('com_negocios', proposta.getString('negocio_id')),
      responsavelId = negocio.getString('responsavel_id') || versao.getString('responsavel_envio_id')
    if (!responsavelId) return
    var responsavel = $app.findRecordById('users', responsavelId),
      destinatario = String(responsavel.getString('email') || '')
        .trim()
        .toLowerCase()
    if (!responsavel.getBool('ativo_comercial') || !emailValido(destinatario)) return

    var externalId = ''
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

    var aceita = evento.getString('tipo') === 'aceite_confirmado',
      statusTexto = aceita ? 'aceita' : 'recusada',
      titulo = aceita ? 'Proposta aceita' : 'Proposta recusada',
      referencia = externalId ? 'AC #' + externalId : proposta.getString('identificador'),
      cliente = versao.getString('cliente_snapshot') || negocio.getString('titulo') || 'Cliente PMais',
      valor = Number(versao.get('valor_total_centavos') || 0) / 100,
      valorTexto = 'R$ ' + valor.toFixed(2).replace('.', ','),
      motivo = proposta.getString('decisao_publica_motivo') || '',
      link = 'https://comercial.pmaisservicos.com.br/propostas?negocio=' + negocio.id,
      linhas = [
        'Olá, ' + (responsavel.getString('name') || 'responsável') + '.',
        '',
        'A proposta ' + referencia + ' de ' + cliente + ' foi ' + statusTexto + ' pela tela pública.',
        '',
        'Data e hora: ' + evento.getString('ocorrido_em'),
        'Valor: ' + valorTexto,
        motivo ? 'Motivo informado: ' + motivo : '',
        '',
        'Ação recomendada: abrir o negócio no Aplicativo Comercial e registrar o próximo encaminhamento.',
        'Link interno: ' + link,
      ].filter(function (linha) {
        return linha !== null && linha !== undefined
      }),
      texto = linhas.join('\n'),
      html =
        '<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6">' +
        escapeHtml(texto).replace(/\n/g, '<br>') +
        '</div>',
      apiKey = $secrets.get('RESEND_API_KEY')
    if (!apiKey) throw new Error('RESEND_NAO_CONFIGURADO')

    var resposta = $http.send({
      url: 'https://api.resend.com/emails',
      method: 'POST',
      timeout: 20,
      headers: {
        Authorization: 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
        'Idempotency-Key': 'proposta-decisao-' + evento.id,
        'User-Agent': 'PMais-Comercial/1.0',
      },
      body: JSON.stringify({
        from: 'PMais Serviços <nao-responda@pmaisservicos.com.br>',
        to: [destinatario],
        subject: titulo + ' — ' + referencia,
        html: html,
        text: texto,
      }),
    })
    if (resposta.statusCode < 200 || resposta.statusCode >= 300)
      throw new Error('RESEND_HTTP_' + resposta.statusCode)
  } catch (_) {}
}, 'com_proposta_eventos_publicos')
