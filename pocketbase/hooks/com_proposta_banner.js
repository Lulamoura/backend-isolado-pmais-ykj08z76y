// Banner global configurável da página pública de propostas.
// A imagem empacotada em /proposta-banner.jpg permanece como fallback seguro.

function propostaBannerPerfil(app, user) {
  try {
    return app.findRecordById('com_perfis', user.getString('perfil_id')).getString('slug')
  } catch (_) {
    return ''
  }
}

function propostaBannerRegistro(app) {
  try {
    return app.findFirstRecordByData(
      'com_configuracoes_arquivos',
      'chave',
      'proposta.banner_publico',
    )
  } catch (_) {
    return null
  }
}

function propostaBannerResposta(record) {
  if (!record || !record.getString('arquivo')) {
    return {
      personalizado: false,
      url: '/proposta-banner.jpg',
      arquivo_nome: 'proposta-banner.jpg',
      arquivo_bytes: 0,
      updated: '',
    }
  }
  return {
    personalizado: true,
    url:
      '/api/files/cfgbannercoll01/' +
      record.id +
      '/' +
      encodeURIComponent(record.getString('arquivo')),
    arquivo_nome: record.getString('arquivo'),
    arquivo_bytes: Number(record.get('arquivo_bytes') || 0),
    updated: record.getString('updated'),
  }
}

function propostaBannerAuditar(app, ator, acao, recordId, justificativa, evidencia) {
  try {
    var auditoria = new Record(app.findCollectionByNameOrId('com_auditoria'))
    auditoria.set('collection_name', 'com_configuracoes_arquivos')
    auditoria.set('record_id', recordId || 'proposta.banner_publico')
    auditoria.set('acao', acao)
    auditoria.set('usuario_id', ator.id)
    auditoria.set('comando', 'configurar_banner_proposta_publica')
    auditoria.set('command_idempotency_key', 'banner-' + Date.now() + '-' + ator.id)
    auditoria.set('evento_em', new Date())
    auditoria.set('justificativa', justificativa)
    auditoria.set('perfil', 'superadministrador')
    auditoria.set('escopo', 'configuracao')
    auditoria.set('origem', 'server-side')
    auditoria.set('evidencia_estruturada', evidencia)
    auditoria.set('snapshot_hash', $security.sha256(JSON.stringify(evidencia)))
    auditoria.set('snapshot_hash_versao', '1')
    app.save(auditoria)
  } catch (_) {}
}

routerAdd('GET', '/backend/v1/configuracoes/proposta-banner', function (e) {
  return e.json(200, propostaBannerResposta(propostaBannerRegistro($app)))
})

routerAdd(
  'GET',
  '/backend/v1/admin/configuracoes/proposta-banner',
  function (e) {
    var ator = e.auth
    if (!ator || !ator.getBool('ativo_comercial')) return e.forbiddenError('Usuario necessario')
    if (propostaBannerPerfil($app, ator) !== 'superadministrador')
      return e.json(403, { error: 'ACAO_NAO_AUTORIZADA' })
    return e.json(200, propostaBannerResposta(propostaBannerRegistro($app)))
  },
  $apis.requireAuth(),
)

routerAdd(
  'POST',
  '/backend/v1/admin/configuracoes/proposta-banner',
  function (e) {
    var ator = e.auth
    if (!ator || !ator.getBool('ativo_comercial')) return e.forbiddenError('Usuario necessario')
    if (propostaBannerPerfil($app, ator) !== 'superadministrador')
      return e.json(403, { error: 'ACAO_NAO_AUTORIZADA' })

    var info = e.requestInfo(),
      body = info.body || {},
      justificativa = String(body.justificativa || '').trim(),
      arquivos = e.findUploadedFiles('arquivo')
    if (!justificativa || arquivos.length !== 1) return e.json(400, { error: 'VALIDATION' })

    var arquivo = arquivos[0],
      nome = String(arquivo.originalName || arquivo.name || ''),
      mime = String(arquivo.contentType || '').toLowerCase(),
      maxBytes = 5 * 1024 * 1024
    if (!arquivo.size || arquivo.size > maxBytes)
      return e.json(400, { error: 'IMAGEM_TAMANHO_INVALIDO' })
    if (!/\.(jpe?g|png|webp)$/i.test(nome)) return e.json(400, { error: 'IMAGEM_TIPO_INVALIDO' })

    var conteudo = ''
    try {
      var leitor = arquivo.reader.open()
      conteudo = toString(leitor, maxBytes + 1)
      leitor.close()
    } catch (_) {
      return e.json(400, { error: 'IMAGEM_LEITURA_INVALIDA' })
    }
    var jpeg =
        conteudo.charCodeAt(0) === 255 &&
        conteudo.charCodeAt(1) === 216 &&
        conteudo.charCodeAt(2) === 255,
      png = conteudo.charCodeAt(0) === 137 && conteudo.substring(1, 4) === 'PNG',
      webp = conteudo.substring(0, 4) === 'RIFF' && conteudo.substring(8, 12) === 'WEBP'
    if (!jpeg && !png && !webp) return e.json(400, { error: 'IMAGEM_ASSINATURA_INVALIDA' })
    mime = jpeg ? 'image/jpeg' : png ? 'image/png' : 'image/webp'

    try {
      var record = propostaBannerRegistro($app)
      if (!record) record = new Record($app.findCollectionByNameOrId('com_configuracoes_arquivos'))
      record.set('chave', 'proposta.banner_publico')
      record.set('arquivo', arquivo)
      record.set('arquivo_sha256', $security.sha256(conteudo))
      record.set('arquivo_bytes', arquivo.size)
      record.set('arquivo_mime', mime)
      record.set('atualizado_por', ator.id)
      record.set('justificativa', justificativa)
      $app.save(record)
      propostaBannerAuditar($app, ator, 'update', record.id, justificativa, {
        chave: 'proposta.banner_publico',
        arquivo_sha256: record.getString('arquivo_sha256'),
        arquivo_bytes: arquivo.size,
        arquivo_mime: mime,
      })
      return e.json(200, propostaBannerResposta(record))
    } catch (_) {
      return e.json(500, { error: 'SALVAR_BANNER' })
    }
  },
  $apis.requireAuth(),
)

routerAdd(
  'DELETE',
  '/backend/v1/admin/configuracoes/proposta-banner',
  function (e) {
    var ator = e.auth
    if (!ator || !ator.getBool('ativo_comercial')) return e.forbiddenError('Usuario necessario')
    if (propostaBannerPerfil($app, ator) !== 'superadministrador')
      return e.json(403, { error: 'ACAO_NAO_AUTORIZADA' })
    var body = e.requestInfo().body || {},
      justificativa = String(body.justificativa || '').trim(),
      record = propostaBannerRegistro($app)
    if (!justificativa) return e.json(400, { error: 'VALIDATION' })
    if (record) {
      propostaBannerAuditar($app, ator, 'delete', record.id, justificativa, {
        chave: 'proposta.banner_publico',
        restaurado_padrao: true,
      })
      $app.delete(record)
    }
    return e.json(200, propostaBannerResposta(null))
  },
  $apis.requireAuth(),
)
