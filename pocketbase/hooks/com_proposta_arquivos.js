// Proposta nativa V1 — upload privado, versoes imutaveis e timeline interna.
// Lote B: materializado e validado no backend candidato / Preview.

routerAdd(
  'POST',
  '/backend/v1/propostas/{negocioId}/versoes',
  (e) => {
    function perfil(app, user) {
      try {
        return app.findRecordById('com_perfis', user.getString('perfil_id')).getString('slug')
      } catch (_) {
        return ''
      }
    }
    function podeAcessar(app, user, slug, negocio) {
      if (slug === 'superadministrador') return true
      if (slug === 'leitura-executiva' || slug === 'negociacao-propria') return false
      if (negocio.getString('responsavel_id') === user.id) return true
      return (
        !!user.getString('equipe_id') &&
        negocio.getString('equipe_id') === user.getString('equipe_id')
      )
    }
    function canonicalize(obj) {
      if (obj === null || obj === undefined) return 'null'
      if (typeof obj !== 'object') return JSON.stringify(obj)
      var keys = Object.keys(obj).sort(),
        parts = []
      for (var ci = 0; ci < keys.length; ci++)
        parts.push(JSON.stringify(keys[ci]) + ':' + canonicalize(obj[keys[ci]]))
      return '{' + parts.join(',') + '}'
    }
    function snapshot(app, collection, id, field) {
      if (!id) return ''
      try {
        return app.findRecordById(collection, id).getString(field)
      } catch (_) {
        return ''
      }
    }

    var ator = e.auth
    if (!ator || !ator.getBool('ativo_comercial'))
      return e.forbiddenError('Usuario comercial necessario')
    var slug = perfil($app, ator)
    if (slug === 'leitura-executiva' || slug === 'negociacao-propria')
      return e.json(403, { error: 'ACAO_NAO_AUTORIZADA' })

    var negocioId = e.request.pathValue('negocioId'),
      info = e.requestInfo(),
      body = info.body || {},
      chave = String(body.command_idempotency_key || ''),
      updatedEsperado = String(body.updated_esperado || ''),
      arquivos = e.findUploadedFiles('arquivo_pdf')
    if (!negocioId || !chave || !updatedEsperado || arquivos.length !== 1)
      return e.json(400, { error: 'VALIDATION' })

    var arquivo = arquivos[0],
      maxBytes = 20 * 1024 * 1024
    if (!arquivo.size || arquivo.size > maxBytes)
      return e.json(400, { error: 'PDF_TAMANHO_INVALIDO' })
    if (!/\.pdf$/i.test(String(arquivo.originalName || arquivo.name || '')))
      return e.json(400, { error: 'PDF_TIPO_INVALIDO' })

    var conteudo = ''
    try {
      var leitor = arquivo.reader.open()
      conteudo = toString(leitor, maxBytes + 1)
      leitor.close()
    } catch (_) {
      return e.json(400, { error: 'PDF_LEITURA_INVALIDA' })
    }
    if (conteudo.substring(0, 5) !== '%PDF-')
      return e.json(400, { error: 'PDF_ASSINATURA_INVALIDA' })
    var arquivoHash = $security.sha256(conteudo),
      comando = 'criar_versao_pdf_proposta',
      payloadHash = $security.sha256(
        canonicalize({
          negocio_id: negocioId,
          updated_esperado: updatedEsperado,
          arquivo_sha256: arquivoHash,
          arquivo_bytes: arquivo.size,
        }),
      )

    var conhecidos = []
    try {
      conhecidos = $app.findRecordsByFilter(
        'com_idempotencia',
        "ator_id='" +
          ator.id +
          "' && comando='" +
          comando +
          "' && command_idempotency_key='" +
          chave +
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
      return e.json(200, replay)
    }

    var resposta = null,
      etapa = ''
    try {
      $app.runInTransaction(function (tx) {
        etapa = 'idempotencia_inicial'
        var idem = new Record(tx.findCollectionByNameOrId('com_idempotencia'))
        idem.set('command_idempotency_key', chave)
        idem.set('comando', comando)
        idem.set('ator_id', ator.id)
        idem.set('payload_hash', payloadHash)
        idem.set('estado', 'executando')
        idem.set('executor_id', 'pb-primary')
        idem.set('lease_ate', new Date(Date.now() + 300000))
        idem.set('tentativa', 1)
        idem.set('claim_version', 1)
        idem.set('inicio_em', new Date())
        idem.set('resultado', {})
        idem.set('registros_afetados', [])
        tx.save(idem)

        etapa = 'autorizacao'
        var user = tx.findRecordById('users', ator.id),
          negocio = tx.findRecordById('com_negocios', negocioId),
          slugTx = perfil(tx, user)
        if (!podeAcessar(tx, user, slugTx, negocio)) throw new Error('FORBIDDEN')
        var proposta = tx.findFirstRecordByData('com_propostas', 'negocio_id', negocio.id),
          anteriores = tx.findRecordsByFilter(
            'com_proposta_versoes',
            "proposta_id='" + proposta.id + "'",
            '-numero',
            1,
            0,
          )
        if (!anteriores.length) throw new Error('NAO_PREPARADA')
        var anterior = anteriores[0]
        if (anterior.getString('updated') !== updatedEsperado) throw new Error('STALE_WRITE')
        if (anterior.getString('estado') !== 'rascunho') throw new Error('TRANSICAO_INVALIDA')

        etapa = 'nova_versao'
        var versao = new Record(tx.findCollectionByNameOrId('com_proposta_versoes'))
        versao.set('proposta_id', proposta.id)
        versao.set('numero', Number(anterior.get('numero') || 0) + 1)
        versao.set('estado', 'rascunho')
        versao.set('modalidade', anterior.getString('modalidade'))
        versao.set('valor_total_centavos', Number(anterior.get('valor_total_centavos') || 0))
        if (Number(anterior.get('valor_mensal_centavos') || 0))
          versao.set('valor_mensal_centavos', Number(anterior.get('valor_mensal_centavos')))
        versao.set('creation_idempotency_key', chave)
        versao.set('leitura_estado', 'nao_rastreavel')
        versao.set('arquivo_pdf', arquivo)
        versao.set('arquivo_sha256', arquivoHash)
        versao.set('arquivo_bytes', arquivo.size)
        versao.set(
          'cliente_snapshot',
          snapshot(tx, 'com_empresas', negocio.getString('empresa_id'), 'nome'),
        )
        versao.set(
          'contato_snapshot',
          snapshot(tx, 'com_contatos', negocio.getString('contato_principal_id'), 'nome'),
        )
        versao.set(
          'email_snapshot',
          snapshot(tx, 'com_contatos', negocio.getString('contato_principal_id'), 'email'),
        )
        versao.set(
          'telefone_snapshot',
          snapshot(tx, 'com_contatos', negocio.getString('contato_principal_id'), 'telefone'),
        )
        versao.set(
          'responsavel_snapshot',
          snapshot(tx, 'users', negocio.getString('responsavel_id'), 'name'),
        )
        var exigeAprovacao = false
        try {
          var parametro = tx.findFirstRecordByData(
            'com_parametros',
            'chave',
            'proposta.aprovacao_interna_obrigatoria',
          )
          exigeAprovacao = parametro.getBool('ativo') && parametro.getString('valor') === 'true'
        } catch (_) {}
        versao.set('aprovacao_estado', exigeAprovacao ? 'pendente' : 'nao_exigida')
        tx.save(versao)

        etapa = 'auditoria'
        var evidencia = {
          proposta_id: proposta.id,
          versao_id: versao.id,
          numero: versao.getInt('numero'),
          arquivo_sha256: arquivoHash,
          arquivo_bytes: arquivo.size,
          aprovacao_estado: versao.getString('aprovacao_estado'),
        }
        var auditoria = new Record(tx.findCollectionByNameOrId('com_auditoria'))
        auditoria.set('collection_name', 'com_proposta_versoes')
        auditoria.set('record_id', versao.id)
        auditoria.set('acao', 'create')
        auditoria.set('usuario_id', ator.id)
        auditoria.set('comando', 'proposta_versao_pdf_criada')
        auditoria.set('command_idempotency_key', chave)
        auditoria.set('evento_em', new Date())
        auditoria.set('justificativa', 'Nova versao privada da proposta')
        auditoria.set('perfil', slugTx)
        auditoria.set('escopo', 'proposta')
        auditoria.set('origem', 'server-side')
        auditoria.set('evidencia_estruturada', evidencia)
        auditoria.set('snapshot_hash', $security.sha256(canonicalize(evidencia)))
        auditoria.set('snapshot_hash_versao', '1')
        tx.save(auditoria)

        resposta = {
          negocio_id: negocio.id,
          proposta_id: proposta.id,
          versao_id: versao.id,
          numero: versao.getInt('numero'),
          arquivo_nome: versao.getString('arquivo_pdf'),
          arquivo_sha256: arquivoHash,
          arquivo_bytes: arquivo.size,
          aprovacao_estado: versao.getString('aprovacao_estado'),
          updated: versao.getString('updated'),
          replay: false,
        }
        etapa = 'idempotencia_final'
        idem.set('estado', 'concluido')
        idem.set('fim_em', new Date())
        idem.set('resultado', resposta)
        idem.set('registros_afetados', [versao.id, auditoria.id])
        tx.save(idem)
        etapa = ''
      })
      return e.json(201, resposta)
    } catch (err) {
      var mensagem = String(err && err.message ? err.message : err)
      if (mensagem.indexOf('STALE_WRITE') >= 0) return e.json(409, { error: 'STALE_WRITE' })
      if (mensagem.indexOf('FORBIDDEN') >= 0) return e.json(403, { error: 'FORBIDDEN' })
      if (mensagem.indexOf('NAO_PREPARADA') >= 0) return e.json(409, { error: 'NAO_PREPARADA' })
      if (mensagem.indexOf('TRANSICAO_INVALIDA') >= 0)
        return e.json(409, { error: 'TRANSICAO_INVALIDA' })
      return e.json(500, { error: 'CRIAR_VERSAO_PDF', stage: etapa || 'desconhecida' })
    }
  },
  $apis.requireAuth(),
)

routerAdd(
  'GET',
  '/backend/v1/propostas/{negocioId}/timeline',
  (e) => {
    function perfil(app, user) {
      try {
        return app.findRecordById('com_perfis', user.getString('perfil_id')).getString('slug')
      } catch (_) {
        return ''
      }
    }
    function podeAcessar(user, slug, negocio) {
      if (slug === 'superadministrador' || slug === 'leitura-executiva') return true
      if (negocio.getString('responsavel_id') === user.id) return true
      return (
        slug !== 'negociacao-propria' &&
        !!user.getString('equipe_id') &&
        negocio.getString('equipe_id') === user.getString('equipe_id')
      )
    }
    var ator = e.auth
    if (!ator || !ator.getBool('ativo_comercial'))
      return e.forbiddenError('Usuario comercial necessario')
    try {
      var negocio = $app.findRecordById('com_negocios', e.request.pathValue('negocioId')),
        slug = perfil($app, ator)
      if (!podeAcessar(ator, slug, negocio)) return e.json(403, { error: 'FORBIDDEN' })
      var proposta = $app.findFirstRecordByData('com_propostas', 'negocio_id', negocio.id),
        versoes = $app.findRecordsByFilter(
          'com_proposta_versoes',
          "proposta_id='" + proposta.id + "'",
          '-numero',
          100,
          0,
        ),
        itens = []
      for (var i = 0; i < versoes.length; i++) {
        var v = versoes[i],
          eventos = []
        try {
          var rows = $app.findRecordsByFilter(
            'com_auditoria',
            "record_id='" + v.id + "' && escopo='proposta'",
            'evento_em',
            100,
            0,
          )
          for (var j = 0; j < rows.length; j++)
            eventos.push({
              id: rows[j].id,
              tipo: rows[j].getString('comando').replace('proposta_', ''),
              autor_id: rows[j].getString('usuario_id'),
              data_hora: rows[j].getString('evento_em') || rows[j].getString('created'),
              justificativa: rows[j].getString('justificativa') || null,
            })
        } catch (_) {}
        itens.push({
          id: v.id,
          numero: v.getInt('numero'),
          estado: v.getString('estado'),
          arquivo_nome: v.getString('arquivo_pdf') || null,
          arquivo_sha256: v.getString('arquivo_sha256') || null,
          arquivo_bytes: Number(v.get('arquivo_bytes') || 0),
          aprovacao_estado: v.getString('aprovacao_estado') || null,
          created: v.getString('created'),
          updated: v.getString('updated'),
          eventos: eventos,
        })
      }
      var eventosPublicos = []
      try {
        var publicacoes = $app.findRecordsByFilter(
          'com_proposta_publicacoes',
          "proposta_id='" + proposta.id + "'",
          '',
          100,
          0,
        )
        for (var pi = 0; pi < publicacoes.length; pi++) {
          var eventosRows = $app.findRecordsByFilter(
            'com_proposta_eventos_publicos',
            "publicacao_id='" + publicacoes[pi].id + "'",
            'ocorrido_em',
            200,
            0,
          )
          for (var ei = 0; ei < eventosRows.length; ei++)
            eventosPublicos.push({
              id: eventosRows[ei].id,
              publicacao_id: publicacoes[pi].id,
              tipo: eventosRows[ei].getString('tipo'),
              ocorrido_em: eventosRows[ei].getString('ocorrido_em'),
            })
        }
      } catch (_) {}
      eventosPublicos.sort(function (a, b) {
        return String(a.ocorrido_em).localeCompare(String(b.ocorrido_em))
      })
      var envios = []
      try {
        var enviosRows = $app.findRecordsByFilter('com_proposta_envios', "proposta_id='" + proposta.id + "'", 'created', 200, 0)
        for (var xi = 0; xi < enviosRows.length; xi++) envios.push({ id: enviosRows[xi].id, canal: enviosRows[xi].getString('canal'), destinatario: enviosRows[xi].getString('destinatario') || null, assunto: enviosRows[xi].getString('assunto') || null, estado: enviosRows[xi].getString('estado'), provider_id: enviosRows[xi].getString('provider_id') || null, erro_codigo: enviosRows[xi].getString('erro_codigo') || null, enviado_em: enviosRows[xi].getString('enviado_em') || null, created: enviosRows[xi].getString('created') })
      } catch (_) {}
      return e.json(200, {
        proposta_id: proposta.id,
        versoes: itens,
        total_acessos: Number(proposta.get('total_acessos') || 0),
        total_downloads: Number(proposta.get('total_downloads') || 0),
        decisao: proposta.getString('decisao_publica') || 'pendente',
        decisao_motivo: proposta.getString('decisao_publica_motivo') || null,
        eventos_publicos: eventosPublicos,
        envios: envios,
      })
    } catch (_) {
      return e.json(404, { error: 'PROPOSTA_NAO_ENCONTRADA' })
    }
  },
  $apis.requireAuth(),
)
