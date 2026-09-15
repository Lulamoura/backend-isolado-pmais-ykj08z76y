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
  function nome(collection, id, field) {
    try {
      return $app.findRecordById(collection, id).getString(field)
    } catch (_) {
      return ''
    }
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
      html = '<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6">' +
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
