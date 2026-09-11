// Nexo — contexto consolidado de negócio para orientação assistida.
// Contrato: GET /backend/v1/nexo/negocios/{externalId}/contexto

routerAdd(
  'GET',
  '/backend/v1/nexo/negocios/{externalId}/contexto',
  function (e) {
    function nexoLimparTexto(value, max) {
      var text = String(value || '')
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
      if (max && text.length > max) return text.slice(0, max)
      return text
    }

    function nexoPerfil(app, user) {
      try {
        return app.findRecordById('com_perfis', user.getString('perfil_id')).getString('slug')
      } catch (_) {
        return ''
      }
    }

    function propostaHojeRecife() {
      return new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10)
    }

    function propostaListaContem(lista, id) {
      if (!lista || !id) return false
      if (Array.isArray(lista)) return lista.indexOf(id) >= 0
      return String(lista).indexOf(id) >= 0
    }

    function propostaSubstituicaoAutoriza(app, user, negocio) {
      var titularId = negocio.getString('responsavel_id')
      if (!titularId || !user || !user.id) return false
      try {
        var hoje = propostaHojeRecife()
        var filtro =
          "titular_id='" +
          titularId +
          "' && cancelada_em = null && data_inicio <= '" +
          hoje +
          "' && data_fim >= '" +
          hoje +
          "' && (substituto_principal_id='" +
          user.id +
          "' || substituto_reserva_id='" +
          user.id +
          "')"
        var subs = app.findRecordsByFilter('com_substituicoes', filtro, '', 20, 0)
        for (var i = 0; i < subs.length; i++) {
          if (subs[i].getString('tipo_cobertura') === 'integral') return true
          if (propostaListaContem(subs[i].get('negocios_cobertos'), negocio.id)) return true
        }
      } catch (_) {}
      return false
    }

    function nexoPodeAcessarNegocio(app, user, perfil, negocio) {
      if (perfil === 'superadministrador' || perfil === 'leitura-executiva') return true
      if (negocio.getString('responsavel_id') === user.id) return true
      if (propostaSubstituicaoAutoriza(app, user, negocio)) return true
      var escopo = 'proprios'
      try {
        var links = app.findRecordsByFilter(
          'com_perfil_permissoes',
          "perfil_id='" + user.getString('perfil_id') + "'",
          '',
          500,
          0,
        )
        for (var i = 0; i < links.length; i++) {
          var permissao = app.findRecordById('com_permissoes', links[i].getString('permissao_id'))
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

    function nexoRelacionado(app, collection, id, fields) {
      if (!id) return null
      try {
        var record = app.findRecordById(collection, id)
        var result = { id: record.id }
        for (var i = 0; i < fields.length; i++) result[fields[i]] = record.getString(fields[i]) || null
        return result
      } catch (_) {
        return null
      }
    }

    function nexoCallAc(apiUrl, apiKey, path) {
      var response = $http.send({
        url: apiUrl + path,
        method: 'GET',
        headers: { 'Api-Token': apiKey, Accept: 'application/json' },
        timeout: 20,
      })
      if (response.statusCode !== 200) throw new Error('AC_HTTP_' + response.statusCode)
      return response.json || {}
    }

    function nexoListAc(apiUrl, apiKey, path, key, extra) {
      var rows = []
      for (var page = 0; page < 20; page++) {
        var suffix = '?limit=100&offset=' + page * 100
        if (extra) suffix += extra
        var json = nexoCallAc(apiUrl, apiKey, path + suffix)
        var batch = json[key] || []
        for (var i = 0; i < batch.length; i++) rows.push(batch[i])
        if (batch.length < 100) return rows
      }
      throw new Error('AC_PAGINACAO_EXCEDE_LIMITE')
    }

    function nexoCamposActiveCampaign(apiUrl, apiKey, externalId) {
      var deal = nexoCallAc(apiUrl, apiKey, '/api/3/deals/' + encodeURIComponent(externalId)).deal || {}
      var meta = nexoListAc(apiUrl, apiKey, '/api/3/dealCustomFieldMeta', 'dealCustomFieldMeta', '')
      var labels = {}
      for (var mi = 0; mi < meta.length; mi++) labels[String(meta[mi].id)] = meta[mi].fieldLabel || ''
      var customRows = nexoListAc(
        apiUrl,
        apiKey,
        '/api/3/dealCustomFieldData',
        'dealCustomFieldData',
        '&filters[dealId]=' + encodeURIComponent(String(externalId)),
      )
      var customByLabel = {}
      for (var ci = 0; ci < customRows.length; ci++) {
        if (String(customRows[ci].dealId || '') !== String(externalId)) continue
        var fieldId = String(customRows[ci].customFieldId || customRows[ci].dealCustomFieldMetumId || '')
        var label = labels[fieldId] || ''
        var fieldVal = nexoLimparTexto(customRows[ci].fieldValue, 4000)
        if (fieldId) customByLabel['meta:' + fieldId] = fieldVal
        if (label) customByLabel[label] = fieldVal
      }
      return {
        deal: {
          id: String(deal.id || externalId),
          titulo: nexoLimparTexto(deal.title, 500),
          descricao_negocio: nexoLimparTexto(deal.description, 4000),
          status: String(deal.status || ''),
          stage: String(deal.stage || ''),
          owner: String(deal.owner || ''),
          contact: String(deal.contact || ''),
          account: String(deal.account || deal.organization || ''),
          valor_centavos: Number(deal.value || 0),
          cdate: deal.cdate || null,
          mdate: deal.mdate || null,
          nextdate: deal.nextdate || null,
        },
        campos: {
          descricao_negocio: nexoLimparTexto(deal.description, 4000),
          tipo_servico: customByLabel['Tipo de Serviço'] || customByLabel['meta:13'] || '',
          detalhamento_proposta:
            customByLabel['Detalhamento da Proposta'] || customByLabel['meta:60'] || '',
        },
        campos_customizados_lidos: Object.keys(customByLabel).length,
      }
    }

    function nexoNotasActiveCampaign(apiUrl, apiKey, externalId) {
      var notes = nexoListAc(
        apiUrl,
        apiKey,
        '/api/3/notes',
        'notes',
        '&filters[relid]=' + encodeURIComponent(String(externalId)),
      )
      var result = []
      for (var i = 0; i < notes.length; i++) {
        // ActiveCampaign registra follow-ups comerciais com reltype Deal.
        if (String(notes[i].reltype || '').toLowerCase() !== 'deal') continue
        result.push({
          id: String(notes[i].id || ''),
          relid: String(notes[i].relid || ''),
          reltype: String(notes[i].reltype || ''),
          autor_external_id: String(notes[i].userid || ''),
          criada_em: notes[i].cdate || null,
          alterada_em: notes[i].mdate || null,
          texto: nexoLimparTexto(notes[i].note, 4000),
        })
      }
      return result
    }

    function nexoProposta(app, negocioId) {
      try {
        var proposta = app.findFirstRecordByData('com_propostas', 'negocio_id', negocioId)
        var versoes = app.findRecordsByFilter(
          'com_proposta_versoes',
          "proposta_id='" + proposta.id + "'",
          '-numero',
          1,
          0,
        )
        var versao = versoes.length ? versoes[0] : null
        return {
          id: proposta.id,
          identificador: proposta.getString('identificador') || null,
          status: proposta.getString('status') || null,
          publicacao_estado: proposta.getString('publicacao_estado') || null,
          versao_publicada_id: proposta.getString('versao_publicada_id') || null,
          total_acessos: proposta.getInt('total_acessos'),
          total_downloads: proposta.getInt('total_downloads'),
          primeiro_acesso_em: proposta.getString('primeiro_acesso_em') || null,
          ultimo_acesso_em: proposta.getString('ultimo_acesso_em') || null,
          mensagem_email_rascunho: nexoLimparTexto(proposta.getString('mensagem_email_rascunho'), 4000),
          versao_mais_recente: versao
            ? {
                id: versao.id,
                numero: versao.getInt('numero'),
                estado: versao.getString('estado') || null,
                arquivo_pdf: versao.getString('arquivo_pdf') || null,
                arquivo_sha256: versao.getString('arquivo_sha256') || null,
                arquivo_bytes: versao.getInt('arquivo_bytes'),
                arquivo_paginas: versao.getInt('arquivo_paginas'),
                valor_total_centavos: versao.getInt('valor_total_centavos'),
                valor_mensal_centavos: versao.getInt('valor_mensal_centavos'),
                email_snapshot: versao.getString('email_snapshot') || null,
                leitura_estado: versao.getString('leitura_estado') || null,
                primeira_leitura_em: versao.getString('primeira_leitura_em') || null,
                ultima_leitura_em: versao.getString('ultima_leitura_em') || null,
                enviada_em: versao.getString('enviada_em') || null,
                updated: versao.getString('updated') || null,
              }
            : null,
        }
      } catch (_) {
        return null
      }
    }

    var ator = e.auth
    if (!ator || !ator.getBool('ativo_comercial')) return e.forbiddenError('Usuario comercial necessario')
    var perfil = nexoPerfil($app, ator)
    var externalId = String(e.request.pathValue('externalId') || '').trim()
    if (!/^[0-9]+$/.test(externalId)) return e.badRequestError('ID externo invalido')

    var vinculo
    try {
      vinculo = $app.findFirstRecordByFilter(
        'com_vinculos_externos',
        "sistema_origem='activecampaign' && external_type='business' && external_id='" + externalId + "'",
      )
    } catch (_) {
      return e.notFoundError('Negocio nao espelhado')
    }

    var negocio
    try {
      negocio = $app.findRecordById('com_negocios', vinculo.getString('record_id'))
    } catch (_) {
      return e.notFoundError('Negocio local nao encontrado')
    }
    if (!nexoPodeAcessarNegocio($app, ator, perfil, negocio))
      return e.forbiddenError('Negocio fora do escopo')

    var apiUrl = String($secrets.get('AC_API_URL') || '').replace(/\/$/, '')
    var apiKey = $secrets.get('AC_API_KEY') || ''
    if (!apiUrl || !apiKey) return e.json(503, { error: 'CONFIGURACAO_AC_AUSENTE' })

    var ac
    var notas = []
    try {
      ac = nexoCamposActiveCampaign(apiUrl, apiKey, externalId)
      notas = nexoNotasActiveCampaign(apiUrl, apiKey, externalId)
    } catch (err) {
      return e.json(502, { error: 'CONSULTA_AC_FALHOU', detail: String(err).slice(0, 120) })
    }

    return e.json(200, {
      contrato: 'nexo_contexto_negocio_v1',
      external_id: externalId,
      negocio: {
        id: negocio.id,
        titulo: negocio.getString('titulo') || null,
        descricao_negocio: negocio.getString('descricao') || ac.campos.descricao_negocio || null,
        etapa: negocio.getString('etapa') || null,
        fase_crm: negocio.getString('fase_crm') || null,
        qualificacao: negocio.getString('qualificacao') || null,
        valor_centavos: Number(negocio.get('valor') || ac.deal.valor_centavos || 0),
        modalidade: negocio.getString('modalidade') || null,
        origem_canal: negocio.getString('origem_canal') || null,
        fonte_prospeccao: negocio.getString('fonte_prospeccao') || null,
        proxima_acao_em: negocio.getString('proxima_acao_em') || ac.deal.nextdate || null,
        crm_created_at: negocio.getString('crm_created_at') || ac.deal.cdate || null,
        crm_updated_at: negocio.getString('crm_updated_at') || ac.deal.mdate || null,
      },
      empresa: nexoRelacionado($app, 'com_empresas', negocio.getString('empresa_id'), [
        'nome',
        'cnpj',
        'email',
        'telefone',
      ]),
      contato: nexoRelacionado($app, 'com_contatos', negocio.getString('contato_principal_id'), [
        'nome',
        'email',
        'telefone',
      ]),
      responsavel: nexoRelacionado($app, 'users', negocio.getString('responsavel_id'), ['name', 'email']),
      campos_crm: {
        descricao_negocio: ac.campos.descricao_negocio || negocio.getString('descricao') || '',
        tipo_servico: ac.campos.tipo_servico || '',
        detalhamento_proposta: ac.campos.detalhamento_proposta || '',
      },
      proposta: nexoProposta($app, negocio.id),
      notas_followups: notas,
      fontes: {
        negocio_local: true,
        activecampaign_deal: true,
        activecampaign_campos: true,
        activecampaign_notas: true,
        proposta_aplicativo: true,
      },
    })
  },
  $apis.requireAuth('users'),
)
