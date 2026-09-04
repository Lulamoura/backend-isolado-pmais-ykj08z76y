// T4.3 — ciclo transacional e auditável da proposta.
// Eventos canônicos: preparada, aprovada, emitida, visualizada e decidida.

;(function () {
  function propostaCanonicalize(obj) {
    if (obj === null || obj === undefined) return 'null'
    if (typeof obj !== 'object') return JSON.stringify(obj)
    var keys = Object.keys(obj).sort(),
      parts = []
    for (var i = 0; i < keys.length; i++)
      parts.push(JSON.stringify(keys[i]) + ':' + propostaCanonicalize(obj[keys[i]]))
    return '{' + parts.join(',') + '}'
  }

  function propostaPerfil(app, user) {
    try {
      return app.findRecordById('com_perfis', user.getString('perfil_id')).getString('slug')
    } catch (_) {
      return ''
    }
  }

  function propostaPodeAcessar(user, perfil, negocio) {
    if (perfil === 'superadministrador' || perfil === 'leitura-executiva') return true
    if (negocio.getString('responsavel_id') === user.id) return true
    var escopo = 'proprios'
    try {
      var links = $app.findRecordsByFilter(
        'com_perfil_permissoes',
        "perfil_id='" + user.getString('perfil_id') + "'",
        '',
        500,
        0,
      )
      for (var i = 0; i < links.length; i++) {
        var permissao = $app.findRecordById('com_permissoes', links[i].getString('permissao_id'))
        if (permissao.getString('slug') === 'negocios.view') escopo = links[i].getString('escopo')
      }
    } catch (_) {}
    if (escopo === 'todos') return true
    return (
      escopo === 'equipe' &&
      !!user.getString('equipe_id') &&
      negocio.getString('equipe_id') === user.getString('equipe_id')
    )
  }

  function propostaAuditoria(app, ator, perfil, comando, versao, chave, justificativa, evidencia) {
    var a = new Record(app.findCollectionByNameOrId('com_auditoria'))
    a.set('collection_name', 'com_proposta_versoes')
    a.set('record_id', versao.id)
    a.set('acao', 'create')
    a.set('usuario_id', ator.id)
    a.set('comando', comando)
    a.set('command_idempotency_key', chave)
    a.set('evento_em', new Date())
    a.set('justificativa', justificativa || '')
    a.set('perfil', perfil)
    a.set('escopo', 'proposta')
    a.set('origem', 'server-side')
    a.set('evidencia_estruturada', evidencia)
    a.set('snapshot_hash', $security.sha256(propostaCanonicalize(evidencia)))
    a.set('snapshot_hash_versao', '1')
    app.save(a)
    return a
  }

  function propostaEventos(app, versaoId) {
    var eventos = []
    try {
      var rows = app.findRecordsByFilter(
        'com_auditoria',
        "record_id='" + versaoId + "' && escopo='proposta'",
        'evento_em',
        100,
        0,
      )
      for (var i = 0; i < rows.length; i++)
        eventos.push({
          id: rows[i].id,
          tipo: rows[i].getString('comando').replace('proposta_', ''),
          autor_id: rows[i].getString('usuario_id'),
          data_hora: rows[i].getString('evento_em') || rows[i].getString('created'),
          justificativa: rows[i].getString('justificativa') || null,
          evidencia: rows[i].get('evidencia_estruturada') || {},
        })
    } catch (_) {}
    return eventos
  }

  routerAdd(
    'GET',
    '/backend/v1/propostas/fila',
    (e) => {
      function propostaPerfil(app, user) {
        try {
          return app.findRecordById('com_perfis', user.getString('perfil_id')).getString('slug')
        } catch (_) {
          return ''
        }
      }
      function propostaPodeAcessar(user, perfil, negocio) {
        if (perfil === 'superadministrador' || perfil === 'leitura-executiva') return true
        if (negocio.getString('responsavel_id') === user.id) return true
        var escopo = 'proprios'
        try {
          var links = $app.findRecordsByFilter(
            'com_perfil_permissoes',
            "perfil_id='" + user.getString('perfil_id') + "'",
            '',
            500,
            0,
          )
          for (var i = 0; i < links.length; i++) {
            var permissao = $app.findRecordById(
              'com_permissoes',
              links[i].getString('permissao_id'),
            )
            if (permissao.getString('slug') === 'negocios.view')
              escopo = links[i].getString('escopo')
          }
        } catch (_) {}
        if (escopo === 'todos') return true
        return (
          escopo === 'equipe' &&
          !!user.getString('equipe_id') &&
          negocio.getString('equipe_id') === user.getString('equipe_id')
        )
      }
      function propostaEventos(app, versaoId) {
        var eventos = []
        try {
          var rows = app.findRecordsByFilter(
            'com_auditoria',
            "record_id='" + versaoId + "' && escopo='proposta'",
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
              evidencia: rows[j].get('evidencia_estruturada') || {},
            })
        } catch (_) {}
        return eventos
      }
      function aprovacaoInternaObrigatoria(app) {
        try {
          var parametro = app.findFirstRecordByData(
            'com_parametros',
            'chave',
            'proposta.aprovacao_interna_obrigatoria',
          )
          return parametro.getBool('ativo') && parametro.getString('valor') === 'true'
        } catch (_) {
          return false
        }
      }
      function propostaContexto(app, negocio) {
        function relacionado(collection, id, fields) {
          if (!id) return null
          try {
            var record = app.findRecordById(collection, id),
              result = { id: record.id }
            for (var ri = 0; ri < fields.length; ri++)
              result[fields[ri]] = record.getString(fields[ri]) || null
            return result
          } catch (_) {
            return null
          }
        }
        function acompanhamento() {
          var reagendamento = null,
            nota = null
          try {
            reagendamento = app.findRecordsByFilter(
              'com_negocio_historico',
              "negocio_id='" + negocio.id + "' && origem_alteracao='activecampaign_data_acao'",
              '-reagendada_em,-created',
              1,
              0,
            )[0]
          } catch (_) {}
          try {
            nota = app.findRecordsByFilter(
              'com_notas_negocio',
              "negocio_id='" + negocio.id + "'",
              '-criada_em,-id',
              1,
              0,
            )[0]
          } catch (_) {}
          var reagendadaEm = reagendamento ? reagendamento.getString('reagendada_em') : ''
          var ultimaNotaEm = nota ? nota.getString('criada_em') : ''
          return {
            follow_up_pendente:
              !!reagendadaEm && (!ultimaNotaEm || new Date(ultimaNotaEm) <= new Date(reagendadaEm)),
            proxima_acao_reagendada_em: reagendadaEm || null,
            ultima_nota_em: ultimaNotaEm || null,
          }
        }
        var somenteLeitura = false
        // O ID externo é referência operacional obrigatória nos cards do pipeline.
        var externalId = null
        try {
          externalId = app
            .findFirstRecordByFilter(
              'com_vinculos_externos',
              "sistema_origem='activecampaign' && external_type='business' && record_id='" +
                negocio.id +
                "'",
            )
            .getString('external_id')
        } catch (_) {}
        try {
          var parametro = app.findFirstRecordByData(
            'com_parametros',
            'chave',
            'ac_preoperation_read_only',
          )
          somenteLeitura = parametro.getBool('ativo') && parametro.getString('valor') === 'true'
        } catch (_) {}
        var followUp = acompanhamento()
        return {
          external_id: externalId,
          empresa: relacionado('com_empresas', negocio.getString('empresa_id'), ['nome']),
          contato: relacionado('com_contatos', negocio.getString('contato_principal_id'), [
            'nome',
            'email',
            'telefone',
          ]),
          responsavel: relacionado('users', negocio.getString('responsavel_id'), ['name']),
          valor_centavos: Number(negocio.get('valor') || 0),
          modalidade: negocio.getString('modalidade') || null,
          fase_crm: negocio.getString('fase_crm') || null,
          fonte_prospeccao: negocio.getString('fonte_prospeccao') || null,
          proxima_acao_em: negocio.getString('proxima_acao_em') || null,
          follow_up_pendente: followUp.follow_up_pendente,
          proxima_acao_reagendada_em: followUp.proxima_acao_reagendada_em,
          ultima_nota_em: followUp.ultima_nota_em,
          crm_created_at: negocio.getString('crm_created_at') || null,
          crm_updated_at: negocio.getString('crm_updated_at') || null,
          origem_canal: negocio.getString('origem_canal') || null,
          somente_leitura: somenteLeitura && negocio.getString('origem_canal') === 'activecampaign',
        }
      }
      var ator = e.auth
      if (!ator || !ator.getBool('ativo_comercial'))
        return e.forbiddenError('Usuario comercial necessario')
      try {
        var perfil = propostaPerfil($app, ator)
        var negocios = $app.findRecordsByFilter(
            'com_negocios',
            'inativo = false',
            '-updated',
            100,
            0,
          ),
          itens = []
        for (var i = 0; i < negocios.length; i++) {
          var n = negocios[i],
            proposta = null,
            versao = null,
            eventos = [],
            abertaPublicacao = false,
            primeiroAcessoPublicacaoEm = null,
            enviadaSistema = false,
            ultimoEnvioSistemaEm = null
          if (['producao_proposta', 'negociacao'].indexOf(n.getString('etapa')) < 0) continue
          if (!propostaPodeAcessar(ator, perfil, n)) continue
          try {
            proposta = $app.findFirstRecordByData('com_propostas', 'negocio_id', n.id)
            var versoes = $app.findRecordsByFilter(
              'com_proposta_versoes',
              "proposta_id='" + proposta.id + "'",
              '-numero',
              1,
              0,
            )
            if (versoes.length) {
              versao = versoes[0]
              eventos = propostaEventos($app, versao.id)
            }
            try {
              var publicacaoAtiva = $app.findFirstRecordByFilter(
                'com_proposta_publicacoes',
                "proposta_id='" + proposta.id + "' && estado='ativa'",
              )
              var acessosPublicacao = $app.findRecordsByFilter(
                'com_proposta_eventos_publicos',
                "publicacao_id='" + publicacaoAtiva.id + "' && tipo='pagina_acessada'",
                'ocorrido_em',
                1,
                0,
              )
              abertaPublicacao = acessosPublicacao.length > 0
              if (abertaPublicacao)
                primeiroAcessoPublicacaoEm = acessosPublicacao[0].getString('ocorrido_em')
            } catch (_) {}
            try {
              var enviosSistema = $app.findRecordsByFilter(
                'com_proposta_envios',
                "proposta_id='" + proposta.id + "' && canal='email' && estado='enviado'",
                '-enviado_em',
                1,
                0,
              )
              enviadaSistema = enviosSistema.length > 0
              if (enviadaSistema)
                ultimoEnvioSistemaEm = enviosSistema[0].getString('enviado_em') || null
            } catch (_) {}
          } catch (_) {}
          itens.push({
            negocio: {
              id: n.id,
              titulo: n.getString('titulo'),
              etapa: n.getString('etapa'),
              updated: n.getString('updated'),
              data_periodo: n.getString('crm_created_at') || n.getString('created'),
            },
            contexto: propostaContexto($app, n),
            proposta:
              proposta && versao
                ? {
                    id: proposta.id,
                    identificador: proposta.getString('identificador'),
                    versao_id: versao.id,
                    numero: versao.getInt('numero'),
                    estado: versao.getString('estado'),
                    modalidade: versao.getString('modalidade'),
                    valor_total_centavos: versao.getInt('valor_total_centavos'),
                    valor_mensal_centavos: versao.getInt('valor_mensal_centavos'),
                    pdf_disponivel:
                      !!versao.getString('arquivo_pdf') && !!versao.getString('arquivo_sha256'),
                    destinatario: versao.getString('destinatario') || null,
                    canal_envio: versao.getString('canal_envio') || null,
                    updated: versao.getString('updated'),
                    aprovada: eventos.some(function (x) {
                      return x.tipo === 'aprovada'
                    }),
                    visualizada: eventos.some(function (x) {
                      return x.tipo === 'visualizada'
                    }),
                    aberta: abertaPublicacao,
                    enviada_sistema: enviadaSistema,
                    ultimo_envio_sistema_em: ultimoEnvioSistemaEm,
                    primeiro_acesso_publicacao_em: primeiroAcessoPublicacaoEm,
                    mensagem_email_rascunho: proposta.getString('mensagem_email_rascunho') || null,
                    eventos: eventos,
                  }
                : null,
          })
        }
        var identificacaoObrigatoria = true,
          identificacaoUpdated = ''
        try {
          var identificacaoParametro = $app.findFirstRecordByData(
            'com_parametros',
            'chave',
            'proposta.identificacao_visitante_obrigatoria',
          )
          identificacaoObrigatoria =
            identificacaoParametro.getBool('ativo') &&
            identificacaoParametro.getString('valor') === 'true'
          identificacaoUpdated = identificacaoParametro.getString('updated')
        } catch (_) {}
        return e.json(200, {
          itens: itens,
          configuracao: {
            aprovacao_interna_obrigatoria: aprovacaoInternaObrigatoria($app),
            identificacao_visitante_obrigatoria: identificacaoObrigatoria,
            identificacao_visitante_updated: identificacaoUpdated,
          },
        })
      } catch (err) {
        return e.json(500, { error: 'FILA_PROPOSTAS' })
      }
    },
    $apis.requireAuth(),
  )
  routerAdd(
    'PUT',
    '/backend/v1/propostas/{negocioId}/mensagem-email',
    (e) => {
      var ator = e.auth
      if (!ator || !ator.getBool('ativo_comercial'))
        return e.forbiddenError('Usuario comercial necessario')
      try {
        var negocio = $app.findRecordById('com_negocios', e.request.pathValue('negocioId'))
        var perfil = ''
        try {
          perfil = $app.findRecordById('com_perfis', ator.getString('perfil_id')).getString('slug')
        } catch (_) {}
        var podeAcessar = perfil === 'superadministrador' || perfil === 'leitura-executiva'
        if (!podeAcessar && negocio.getString('responsavel_id') === ator.id) podeAcessar = true
        if (!podeAcessar) {
          var escopo = 'proprios'
          try {
            var links = $app.findRecordsByFilter(
              'com_perfil_permissoes',
              "perfil_id='" + ator.getString('perfil_id') + "'",
              '',
              500,
              0,
            )
            for (var i = 0; i < links.length; i++) {
              var permissao = $app.findRecordById(
                'com_permissoes',
                links[i].getString('permissao_id'),
              )
              if (permissao.getString('slug') === 'negocios.view')
                escopo = links[i].getString('escopo')
            }
          } catch (_) {}
          podeAcessar =
            escopo === 'todos' ||
            (escopo === 'equipe' &&
              !!ator.getString('equipe_id') &&
              negocio.getString('equipe_id') === ator.getString('equipe_id'))
        }
        if (!podeAcessar) return e.forbiddenError('Negocio fora do escopo')
        var body = new DynamicModel({ mensagem: '' })
        e.bindBody(body)
        var mensagem = String(body.mensagem || '')
        if (mensagem.length > 10000) return e.badRequestError('Mensagem excede 10000 caracteres')
        var proposta = $app.findFirstRecordByData('com_propostas', 'negocio_id', negocio.id)
        proposta.set('mensagem_email_rascunho', mensagem)
        $app.save(proposta)
        return e.json(200, { mensagem: mensagem, updated: proposta.getString('updated') })
      } catch (_) {
        return e.json(404, { error: 'PROPOSTA_NAO_ENCONTRADA' })
      }
    },
    $apis.requireAuth(),
  )
  routerAdd(
    'POST',
    '/backend/v1/propostas/eventos',
    (e) => {
      function propostaCanonicalize(obj) {
        if (obj === null || obj === undefined) return 'null'
        if (typeof obj !== 'object') return JSON.stringify(obj)
        var keys = Object.keys(obj).sort(),
          parts = []
        for (var ci = 0; ci < keys.length; ci++)
          parts.push(JSON.stringify(keys[ci]) + ':' + propostaCanonicalize(obj[keys[ci]]))
        return '{' + parts.join(',') + '}'
      }
      function propostaPerfil(app, user) {
        try {
          return app.findRecordById('com_perfis', user.getString('perfil_id')).getString('slug')
        } catch (_) {
          return ''
        }
      }
      if (propostaPerfil($app, e.auth) === 'leitura-executiva')
        return e.json(403, { error: 'SOMENTE_LEITURA' })
      function propostaPodeAcessar(user, perfil, negocio) {
        if (perfil === 'superadministrador' || perfil === 'leitura-executiva') return true
        if (negocio.getString('responsavel_id') === user.id) return true
        if (perfil === 'negociacao-propria') return false
        return (
          !!user.getString('equipe_id') &&
          negocio.getString('equipe_id') === user.getString('equipe_id')
        )
      }
      function propostaPodeExecutar(app, user, tipo) {
        var perfil = propostaPerfil(app, user)
        if (perfil === 'superadministrador') return true
        if (perfil === 'negociacao-propria' || perfil === 'leitura-executiva') return false
        return true
      }
      function propostaEventos(app, versaoId) {
        var eventos = []
        try {
          var rows = app.findRecordsByFilter(
            'com_auditoria',
            "record_id='" + versaoId + "' && escopo='proposta'",
            'evento_em',
            100,
            0,
          )
          for (var ei = 0; ei < rows.length; ei++)
            eventos.push({
              tipo: rows[ei].getString('comando').replace('proposta_', ''),
            })
        } catch (_) {}
        return eventos
      }
      function propostaAuditoria(
        app,
        ator,
        perfil,
        comando,
        versao,
        chave,
        justificativa,
        evidencia,
      ) {
        var a = new Record(app.findCollectionByNameOrId('com_auditoria'))
        a.set('collection_name', 'com_proposta_versoes')
        a.set('record_id', versao.id)
        a.set('acao', 'create')
        a.set('usuario_id', ator.id)
        a.set('comando', comando)
        a.set('command_idempotency_key', chave)
        a.set('evento_em', new Date())
        a.set('justificativa', justificativa || '')
        a.set('perfil', perfil)
        a.set('escopo', 'proposta')
        a.set('origem', 'server-side')
        a.set('evidencia_estruturada', evidencia)
        a.set('snapshot_hash', $security.sha256(propostaCanonicalize(evidencia)))
        a.set('snapshot_hash_versao', '1')
        app.save(a)
        return a
      }
      var ator = e.auth
      if (!ator || !ator.getBool('ativo_comercial'))
        return e.forbiddenError('Usuario comercial necessario')
      var body
      try {
        body = JSON.parse(toString(e.request.body))
      } catch (_) {
        return e.json(400, { error: 'VALIDATION' })
      }
      var tipos = ['preparar', 'aprovar', 'emitir', 'visualizar', 'decidir']
      if (
        !body.negocio_id ||
        tipos.indexOf(body.tipo) < 0 ||
        !body.updated_esperado ||
        !body.command_idempotency_key
      )
        return e.json(400, { error: 'VALIDATION' })
      if (
        body.tipo === 'preparar' &&
        ['recorrente', 'evento', 'serv_eventual'].indexOf(body.modalidade) < 0
      )
        return e.json(400, { error: 'DADOS_PROPOSTA_OBRIGATORIOS' })
      if (
        body.tipo === 'emitir' &&
        (!String(body.destinatario || '').trim() ||
          ['email', 'provelo', 'whatsapp', 'presencial'].indexOf(body.canal_envio) < 0)
      )
        return e.json(400, { error: 'DADOS_EMISSAO_OBRIGATORIOS' })
      if (
        body.tipo === 'decidir' &&
        (['aceita', 'recusada'].indexOf(body.decisao) < 0 ||
          !String(body.evidencia_decisao || '').trim())
      )
        return e.json(400, { error: 'EVIDENCIA_DECISAO_OBRIGATORIA' })
      var perfil = propostaPerfil($app, ator)
      if (!propostaPodeExecutar($app, ator, body.tipo))
        return e.json(403, { error: 'ACAO_NAO_AUTORIZADA' })
      var payload = {
        negocio_id: body.negocio_id,
        tipo: body.tipo,
        modalidade: body.modalidade || null,
        valor_total_centavos: Number(body.valor_total_centavos || 0),
        valor_mensal_centavos: Number(body.valor_mensal_centavos || 0),
        destinatario: body.destinatario || null,
        canal_envio: body.canal_envio || null,
        decisao: body.decisao || null,
        evidencia_decisao: body.evidencia_decisao || null,
        updated_esperado: body.updated_esperado,
      }
      var hash = $security.sha256(propostaCanonicalize(payload)),
        comando = 'registrar_evento_proposta'
      var known = []
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
          proposta_id: replay.proposta_id,
          versao_id: replay.versao_id,
          estado: replay.estado,
          evento: replay.evento,
          replay: true,
        })
      }
      var resposta = null,
        erro = '',
        etapaFalha = ''
      try {
        $app.runInTransaction(function (tx) {
          etapaFalha = 'idempotencia_inicial'
          var idem = new Record(tx.findCollectionByNameOrId('com_idempotencia'))
          idem.set('command_idempotency_key', body.command_idempotency_key)
          idem.set('comando', comando)
          idem.set('ator_id', ator.id)
          idem.set('payload_hash', hash)
          idem.set('estado', 'executando')
          idem.set('executor_id', 'pb-primary')
          idem.set('lease_ate', new Date(Date.now() + 300000))
          idem.set('tentativa', 1)
          idem.set('claim_version', 1)
          idem.set('inicio_em', new Date())
          idem.set('resultado', {})
          idem.set('registros_afetados', [])
          tx.save(idem)

          etapaFalha = 'autorizacao'
          var user = tx.findRecordById('users', ator.id),
            perfilTx = propostaPerfil(tx, user)
          var negocio = tx.findRecordById('com_negocios', body.negocio_id)
          if (!propostaPodeAcessar(user, perfilTx, negocio)) throw new Error('FORBIDDEN')
          var proposta = null,
            versao = null
          try {
            proposta = tx.findFirstRecordByData('com_propostas', 'negocio_id', negocio.id)
            var vv = tx.findRecordsByFilter(
              'com_proposta_versoes',
              "proposta_id='" + proposta.id + "'",
              '-numero',
              1,
              0,
            )
            if (vv.length) versao = vv[0]
          } catch (_) {}
          if (body.tipo === 'preparar') {
            etapaFalha = 'preparar_proposta'
            if (proposta || versao) throw new Error('JA_PREPARADA')
            if (negocio.getString('updated') !== body.updated_esperado)
              throw new Error('STALE_WRITE')
            var valorNegocioCentavos = Number(negocio.get('valor') || 0)
            if (!Number.isInteger(valorNegocioCentavos) || valorNegocioCentavos <= 0)
              throw new Error('DADOS_PROPOSTA_OBRIGATORIOS')
            proposta = new Record(tx.findCollectionByNameOrId('com_propostas'))
            proposta.set('negocio_id', negocio.id)
            proposta.set('identificador', 'PROP-' + negocio.id.toUpperCase())
            proposta.set('autor_id', ator.id)
            proposta.set('status', 'ativa')
            tx.save(proposta)
            etapaFalha = 'preparar_versao'
            versao = new Record(tx.findCollectionByNameOrId('com_proposta_versoes'))
            versao.set('proposta_id', proposta.id)
            versao.set('numero', 1)
            versao.set('estado', 'rascunho')
            versao.set('modalidade', body.modalidade)
            versao.set('valor_total_centavos', valorNegocioCentavos)
            if (body.valor_mensal_centavos)
              versao.set('valor_mensal_centavos', Number(body.valor_mensal_centavos))
            versao.set('creation_idempotency_key', body.command_idempotency_key)
            versao.set('leitura_estado', 'nao_rastreavel')
            tx.save(versao)
          } else {
            if (!proposta || !versao) throw new Error('NAO_PREPARADA')
            if (versao.getString('updated') !== body.updated_esperado)
              throw new Error('STALE_WRITE')
            var eventos = propostaEventos(tx, versao.id),
              aprovada = eventos.some(function (x) {
                return x.tipo === 'aprovada'
              })
            if (body.tipo === 'aprovar' && versao.getString('estado') !== 'rascunho')
              throw new Error('TRANSICAO_INVALIDA')
            if (body.tipo === 'emitir') {
              if (versao.getString('estado') !== 'rascunho' || !aprovada)
                throw new Error('APROVACAO_OBRIGATORIA')
              versao.set('estado', 'enviada')
              versao.set('enviada_em', new Date())
              versao.set('destinatario', String(body.destinatario).trim())
              versao.set('canal_envio', body.canal_envio)
              versao.set('responsavel_envio_id', ator.id)
              tx.save(versao)
            }
            if (
              body.tipo === 'visualizar' &&
              ['enviada', 'aceita', 'recusada'].indexOf(versao.getString('estado')) < 0
            )
              throw new Error('EMISSAO_OBRIGATORIA')
            if (body.tipo === 'decidir') {
              if (versao.getString('estado') !== 'enviada') throw new Error('EMISSAO_OBRIGATORIA')
              versao.set('estado', body.decisao)
              versao.set('decisao_em', new Date())
              versao.set(
                'tipo_evidencia_decisao',
                body.tipo_evidencia_decisao || 'equivalente_formal',
              )
              versao.set('evidencia_decisao', String(body.evidencia_decisao).trim())
              tx.save(versao)
            }
          }
          var evento =
            body.tipo === 'preparar'
              ? 'preparada'
              : body.tipo === 'aprovar'
                ? 'aprovada'
                : body.tipo === 'emitir'
                  ? 'emitida'
                  : body.tipo === 'visualizar'
                    ? 'visualizada'
                    : 'decidida'
          var evidencia = {
            negocio_id: negocio.id,
            proposta_id: proposta.id,
            versao_id: versao.id,
            evento: evento,
            estado: versao.getString('estado'),
            decisao: body.decisao || null,
            autor_id: ator.id,
          }
          etapaFalha = 'auditoria'
          propostaAuditoria(
            tx,
            ator,
            perfilTx,
            'proposta_' + evento,
            versao,
            body.command_idempotency_key,
            String(body.justificativa || ''),
            evidencia,
          )
          var result = {
            negocio_id: negocio.id,
            proposta_id: proposta.id,
            versao_id: versao.id,
            estado: versao.getString('estado'),
            evento: evento,
          }
          etapaFalha = 'idempotencia_final'
          idem.set('estado', 'concluido')
          idem.set('codigo_retorno', '200')
          idem.set('resultado', result)
          idem.set('registros_afetados', [proposta.id, versao.id])
          idem.set('conclusao_em', new Date())
          tx.save(idem)
          resposta = result
          etapaFalha = ''
        })
      } catch (err) {
        erro = String(err)
      }
      if (erro.indexOf('STALE_WRITE') >= 0) return e.json(409, { error: 'STALE_WRITE' })
      if (erro.indexOf('FORBIDDEN') >= 0) return e.json(403, { error: 'FORBIDDEN' })
      if (erro.indexOf('APROVACAO_OBRIGATORIA') >= 0)
        return e.json(409, { error: 'APROVACAO_OBRIGATORIA' })
      if (erro.indexOf('EMISSAO_OBRIGATORIA') >= 0)
        return e.json(409, { error: 'EMISSAO_OBRIGATORIA' })
      if (
        erro.indexOf('TRANSICAO_INVALIDA') >= 0 ||
        erro.indexOf('JA_PREPARADA') >= 0 ||
        erro.indexOf('NAO_PREPARADA') >= 0
      )
        return e.json(409, { error: 'TRANSICAO_INVALIDA' })
      if (erro)
        return e.json(500, {
          error: 'INTERNAL',
          stage: etapaFalha || 'desconhecida',
        })
      return e.json(200, {
        negocio_id: resposta.negocio_id,
        proposta_id: resposta.proposta_id,
        versao_id: resposta.versao_id,
        estado: resposta.estado,
        evento: resposta.evento,
        replay: false,
      })
    },
    $apis.requireAuth(),
  )
})()
