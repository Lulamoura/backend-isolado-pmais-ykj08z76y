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
    if (propostaSubstituicaoAutoriza($app, user, negocio)) return true
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

  function propostaFiltroIdsNegocios(ids) {
    if (!ids || !ids.length) return ''
    var partes = []
    for (var i = 0; i < ids.length; i++) partes.push("id='" + ids[i] + "'")
    return '(' + partes.join(' || ') + ')'
  }

  function propostaIdsNegociosSubstituidos(app, user) {
    var ids = [],
      vistos = {}
    if (!user || !user.id) return ids
    try {
      var hoje = propostaHojeRecife()
      var filtro =
        "cancelada_em = null && data_inicio <= '" +
        hoje +
        "' && data_fim >= '" +
        hoje +
        "' && (substituto_principal_id='" +
        user.id +
        "' || substituto_reserva_id='" +
        user.id +
        "')"
      var subs = app.findRecordsByFilter('com_substituicoes', filtro, '', 100, 0)
      for (var i = 0; i < subs.length; i++) {
        if (subs[i].getString('tipo_cobertura') === 'integral') {
          var titularId = subs[i].getString('titular_id')
          if (!titularId) continue
          var negociosTitular = app.findRecordsByFilter(
            'com_negocios',
            "responsavel_id='" + titularId + "' && inativo = false",
            '',
            500,
            0,
          )
          for (var ti = 0; ti < negociosTitular.length; ti++) {
            if (!vistos[negociosTitular[ti].id]) {
              vistos[negociosTitular[ti].id] = true
              ids.push(negociosTitular[ti].id)
            }
          }
        } else {
          var lista = subs[i].get('negocios_cobertos') || []
          if (!Array.isArray(lista)) lista = String(lista).split(',')
          for (var li = 0; li < lista.length; li++) {
            var id = String(lista[li] || '').trim()
            if (id && !vistos[id]) {
              vistos[id] = true
              ids.push(id)
            }
          }
        }
      }
    } catch (_) {}
    return ids
  }

  function propostaFiltroNegociosFila(app, user, perfil) {
    var etapa = "(etapa='producao_proposta' || etapa='negociacao')"
    if (perfil === 'superadministrador' || perfil === 'leitura-executiva')
      return 'inativo = false && ' + etapa
    var partesEscopo = ["responsavel_id='" + user.id + "'"]
    var substituidos = propostaIdsNegociosSubstituidos(app, user)
    var filtroSubstituidos = propostaFiltroIdsNegocios(substituidos)
    if (filtroSubstituidos) partesEscopo.push(filtroSubstituidos)
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
    if (escopo === 'todos') return 'inativo = false && ' + etapa
    if (escopo === 'equipe' && user.getString('equipe_id'))
      partesEscopo.push("equipe_id='" + user.getString('equipe_id') + "'")
    return 'inativo = false && ' + etapa + ' && (' + partesEscopo.join(' || ') + ')'
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
      function propostaFiltroIdsNegocios(ids) {
        if (!ids || !ids.length) return ''
        var partes = []
        for (var i = 0; i < ids.length; i++) partes.push("id='" + ids[i] + "'")
        return '(' + partes.join(' || ') + ')'
      }
      function propostaIdsNegociosSubstituidos(app, user) {
        var ids = [],
          vistos = {}
        if (!user || !user.id) return ids
        try {
          var hoje = propostaHojeRecife()
          var filtro =
            "cancelada_em = null && data_inicio <= '" +
            hoje +
            "' && data_fim >= '" +
            hoje +
            "' && (substituto_principal_id='" +
            user.id +
            "' || substituto_reserva_id='" +
            user.id +
            "')"
          var subs = app.findRecordsByFilter('com_substituicoes', filtro, '', 100, 0)
          for (var i = 0; i < subs.length; i++) {
            if (subs[i].getString('tipo_cobertura') === 'integral') {
              var titularId = subs[i].getString('titular_id')
              if (!titularId) continue
              var negociosTitular = app.findRecordsByFilter(
                'com_negocios',
                "responsavel_id='" + titularId + "' && inativo = false",
                '',
                500,
                0,
              )
              for (var ti = 0; ti < negociosTitular.length; ti++) {
                if (!vistos[negociosTitular[ti].id]) {
                  vistos[negociosTitular[ti].id] = true
                  ids.push(negociosTitular[ti].id)
                }
              }
            } else {
              var lista = subs[i].get('negocios_cobertos') || []
              if (!Array.isArray(lista)) lista = String(lista).split(',')
              for (var li = 0; li < lista.length; li++) {
                var id = String(lista[li] || '').trim()
                if (id && !vistos[id]) {
                  vistos[id] = true
                  ids.push(id)
                }
              }
            }
          }
        } catch (_) {}
        return ids
      }
      function propostaFiltroNegociosFila(app, user, perfil) {
        var etapa = "(etapa='producao_proposta' || etapa='negociacao')"
        if (perfil === 'superadministrador' || perfil === 'leitura-executiva')
          return 'inativo = false && ' + etapa
        var partesEscopo = ["responsavel_id='" + user.id + "'"]
        var substituidos = propostaIdsNegociosSubstituidos(app, user)
        var filtroSubstituidos = propostaFiltroIdsNegocios(substituidos)
        if (filtroSubstituidos) partesEscopo.push(filtroSubstituidos)
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
            if (permissao.getString('slug') === 'negocios.view')
              escopo = links[i].getString('escopo')
          }
        } catch (_) {}
        if (escopo === 'todos') return 'inativo = false && ' + etapa
        if (escopo === 'equipe' && user.getString('equipe_id'))
          partesEscopo.push("equipe_id='" + user.getString('equipe_id') + "'")
        return 'inativo = false && ' + etapa + ' && (' + partesEscopo.join(' || ') + ')'
      }
      function propostaPodeAcessar(user, perfil, negocio) {
        if (perfil === 'superadministrador' || perfil === 'leitura-executiva') return true
        if (negocio.getString('responsavel_id') === user.id) return true
        if (propostaSubstituicaoAutoriza($app, user, negocio)) return true
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
            propostaFiltroNegociosFila($app, ator, perfil),
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
        if (propostaSubstituicaoAutoriza($app, user, negocio)) return true
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

      function nexoRelacionado(app, collection, id, fields) {
        if (!id) return null
        try {
          var record = app.findRecordById(collection, id)
          var result = { id: record.id }
          for (var i = 0; i < fields.length; i++)
            result[fields[i]] = record.getString(fields[i]) || null
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
        var deal =
          nexoCallAc(apiUrl, apiKey, '/api/3/deals/' + encodeURIComponent(externalId)).deal || {}
        var meta = nexoListAc(
          apiUrl,
          apiKey,
          '/api/3/dealCustomFieldMeta',
          'dealCustomFieldMeta',
          '',
        )
        var labels = {}
        for (var mi = 0; mi < meta.length; mi++)
          labels[String(meta[mi].id)] = meta[mi].fieldLabel || ''
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
          var fieldId = String(
            customRows[ci].customFieldId || customRows[ci].dealCustomFieldMetumId || '',
          )
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
            mensagem_email_rascunho: nexoLimparTexto(
              proposta.getString('mensagem_email_rascunho'),
              4000,
            ),
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
      if (!ator || !ator.getBool('ativo_comercial'))
        return e.forbiddenError('Usuario comercial necessario')
      var perfil = nexoPerfil($app, ator)
      var externalId = String(e.request.pathValue('externalId') || '').trim()
      if (!/^[0-9]+$/.test(externalId)) return e.badRequestError('ID externo invalido')

      var vinculo
      try {
        vinculo = $app.findFirstRecordByFilter(
          'com_vinculos_externos',
          "sistema_origem='activecampaign' && external_type='business' && external_id='" +
            externalId +
            "'",
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
        responsavel: nexoRelacionado($app, 'users', negocio.getString('responsavel_id'), [
          'name',
          'email',
        ]),
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

  // Nexo — geração assistida por IA para apoio comercial contextual.
  // Contrato: POST /backend/v1/nexo/negocios/{externalId}/ajuda
  routerAdd(
    'POST',
    '/backend/v1/nexo/negocios/{externalId}/ajuda',
    function (e) {
      function nexoLimparTextoAjuda(value, max) {
        var text = String(value || '')
          .replace(/<[^>]*>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
        if (max && text.length > max) return text.slice(0, max)
        return text
      }

      function nexoArrayTextos(value, fallback) {
        if (!value) return fallback ? [fallback] : []
        if (Array.isArray(value))
          return value
            .map(function (x) {
              return nexoLimparTextoAjuda(x, 700)
            })
            .filter(Boolean)
        var text = nexoLimparTextoAjuda(value, 700)
        return text ? [text] : fallback ? [fallback] : []
      }

      function nexoJsonSeguro(text) {
        var raw = String(text || '').trim()
        try {
          return JSON.parse(raw)
        } catch (_) {
          var match = raw.match(/\{[\s\S]*\}/)
          if (match) return JSON.parse(match[0])
          throw new Error('IA_JSON_INVALIDO')
        }
      }

      function nexoRespostaFallback(externalId, acao, motivo, resumo) {
        resumo = resumo || {}
        var negocio = resumo.negocio || {}
        var empresa = resumo.empresa || {}
        var contato = resumo.contato || {}
        var proposta = resumo.proposta || {}
        var notas = resumo.notas_followups || []
        var ultimoFollowUp = notas.length ? notas[0].texto : ''
        var servico =
          resumo.tipo_servico || resumo['Detalhamento da Proposta'] || 'serviço não detalhado'
        var empresaNome = empresa.nome || negocio.titulo || 'cliente'
        var contatoNome = contato.nome || 'contato'
        var proximaAcao = negocio.proxima_acao_em || 'sem próxima ação registrada'
        var diagnostico =
          'A IA do Nexo ainda não está configurada neste ambiente, então esta é uma contingência contextual. Para ' +
          empresaNome +
          ', o negócio está na fase ' +
          (negocio.fase || 'não informada') +
          ', com serviço/proposta relacionado a ' +
          servico +
          '. Último sinal registrado: ' +
          (ultimoFollowUp || 'sem follow-up textual disponível') +
          '. Próxima ação atual: ' +
          proximaAcao +
          '.'
        return {
          contrato: 'nexo_ajuda_comercial_v1',
          external_id: externalId,
          acao: acao,
          diagnostico: diagnostico,
          perguntas_criticas: [
            'Qual prazo o cliente informou para análise ou decisão deste caso específico?',
            'A próxima ação cadastrada para ' +
              empresaNome +
              ' está coerente com o prazo informado pelo cliente?',
            'Quem decide ou influencia a decisão além de ' + contatoNome + '?',
          ],
          riscos: [
            'Ajuda de IA indisponível: ' + motivo,
            'Se o próximo contato não estiver alinhado ao prazo real do cliente, o negócio pode esfriar.',
          ],
          proximos_passos: [
            'Confirmar com ' +
              contatoNome +
              ' o prazo real de retorno e se existe dúvida sobre a proposta.',
            proposta
              ? 'Conectar o follow-up ao escopo e ao valor da proposta, não apenas perguntar se foi aprovada.'
              : 'Verificar se já existe proposta formal vinculada antes do próximo contato.',
          ],
          mensagem_sugerida:
            'Olá, ' +
            contatoNome +
            '. Tudo bem? Estou passando para acompanhar a análise da proposta referente a ' +
            servico +
            '. Você conseguiu algum retorno ou existe algum ponto que eu possa esclarecer para facilitar a avaliação? Se já houver uma previsão de decisão, eu me organizo para acompanhar no prazo correto.',
          dicas_para_melhorar_notas: [
            'Registrar quem respondeu, qual pendência ficou, prazo citado, decisor envolvido e próxima ação combinada.',
            'Quando houver análise interna do cliente, registrar quem analisa, até quando e qual ponto da proposta pode travar a decisão.',
          ],
          aviso:
            'Contingência contextual porque a chave de IA não está configurada. Nenhuma mensagem foi enviada automaticamente.',
          fallback: true,
        }
      }

      function nexoContextoResumo(contexto) {
        var negocio = contexto.negocio || {}
        var campos = contexto.campos_crm || {}
        var proposta = contexto.proposta || {}
        var versao = proposta.versao_mais_recente || {}
        var notas = contexto.notas_followups || []
        var notasResumo = []
        for (var i = 0; i < notas.length && i < 12; i++) {
          notasResumo.push({
            data: notas[i].criada_em || notas[i].created || notas[i].data || null,
            texto: nexoLimparTextoAjuda(notas[i].texto || notas[i].conteudo || notas[i].note, 1200),
          })
        }
        return {
          negocio: {
            id_activecampaign: contexto.external_id,
            titulo: negocio.titulo || null,
            fase: negocio.fase_crm || negocio.etapa || null,
            valor_centavos: negocio.valor_centavos || null,
            proxima_acao_em: negocio.proxima_acao_em || null,
            fonte_prospeccao: negocio.fonte_prospeccao || null,
            modalidade: negocio.modalidade || null,
          },
          empresa: contexto.empresa || null,
          contato: contexto.contato || null,
          responsavel: contexto.responsavel || null,
          tipo_servico: campos.tipo_servico || '',
          descricao_negocio: campos.descricao_negocio || negocio.descricao_negocio || '',
          'Detalhamento da Proposta': campos.detalhamento_proposta || '',
          proposta: proposta
            ? {
                identificador: proposta.identificador || proposta.id || null,
                status: proposta.status || proposta.publicacao_estado || null,
                acessos: proposta.total_acessos || 0,
                downloads: proposta.total_downloads || 0,
                versao: versao.numero || null,
                valor_total_centavos: versao.valor_total_centavos || null,
                leitura_estado: versao.leitura_estado || null,
                enviada_em: versao.enviada_em || null,
              }
            : null,
          notas_followups: notasResumo,
        }
      }

      var ator = e.auth
      if (!ator || !ator.getBool('ativo_comercial'))
        return e.forbiddenError('Usuario comercial necessario')
      var externalId = String(e.request.pathValue('externalId') || '').trim()
      if (!/^[0-9]+$/.test(externalId)) return e.badRequestError('ID externo invalido')

      var body = e.requestInfo().body || {}
      var acao = String(body.acao || 'proximo_follow_up')
      var permitidas = {
        proximo_follow_up: true,
        preparar_whatsapp: true,
        roteiro_ligacao: true,
        avaliar_risco_perda: true,
        melhorar_notas: true,
      }
      if (!permitidas[acao]) return e.badRequestError('Acao do Nexo invalida')
      var contexto = body.contexto || {}
      if (String(contexto.external_id || '') !== externalId)
        return e.badRequestError('Contexto divergente do negocio')

      function nexoEnv(nome) {
        try {
          if (typeof $os !== 'undefined' && $os.getenv) return $os.getenv(nome) || ''
        } catch (_) {}
        return ''
      }

      var contextoSeguro = nexoContextoResumo(contexto)
      var apiKey =
        $secrets.get('NEXO_OPENAI_API_KEY') ||
        $secrets.get('OPENAI_API_KEY') ||
        nexoEnv('NEXO_OPENAI_API_KEY') ||
        nexoEnv('OPENAI_API_KEY') ||
        ''
      var model = String(
        $secrets.get('NEXO_OPENAI_MODEL') || nexoEnv('NEXO_OPENAI_MODEL') || 'gpt-4o-mini',
      )
      if (!apiKey)
        return e.json(
          200,
          nexoRespostaFallback(externalId, acao, 'CONFIGURACAO_IA_AUSENTE', contextoSeguro),
        )

      var instrucaoOperador = nexoLimparTextoAjuda(body.instrucao_operador, 1200)
      var systemPrompt = [
        'Você é o Nexo - Inteligência Comercial PMais, agente de apoio comercial consultivo.',
        'Responda em português brasileiro, com tom profissional, objetivo e útil para o operador comercial.',
        'Use somente o contexto fornecido: tipo de serviço, Descrição do Negócio, Detalhamento da Proposta, proposta, contato e notas/follow-ups.',
        'A resposta deve ser específica para este negócio. Não use texto genérico aplicável a qualquer cliente.',
        'Faça inferências comerciais prudentes e aponte incertezas quando faltarem dados.',
        'Compare prazo do cliente, data de próxima ação e risco de esfriamento/perda quando houver elementos para isso.',
        'Se o histórico indicar que o cliente aguarda RH, orçamento, diretoria ou operação, pergunte quem decide e qual prazo foi dado.',
        'Inclua Dicas para melhorar notas quando o histórico não tiver decisor, prazo, objeção, pendência ou próximo passo claro.',
        'Nunca prometa preço, prazo operacional, desconto, condição comercial ou disponibilidade de equipe.',
        'Sem envio automático: você apenas recomenda e rascunha; o operador humano revisa e decide.',
        'Retorne exclusivamente JSON válido no contrato nexo_ajuda_comercial_v1.',
      ].join('\n')

      var userPrompt = JSON.stringify({
        contrato_esperado: 'nexo_ajuda_comercial_v1',
        acao_solicitada: acao,
        instrucao_operador: instrucaoOperador,
        contexto_do_negocio: contextoSeguro,
        formato_obrigatorio: {
          contrato: 'nexo_ajuda_comercial_v1',
          external_id: externalId,
          acao: acao,
          diagnostico: 'texto específico do negócio',
          perguntas_criticas: ['pergunta 1', 'pergunta 2'],
          riscos: ['risco 1'],
          proximos_passos: ['passo 1'],
          mensagem_sugerida:
            'rascunho para WhatsApp, email ou ligação conforme a ação; vazio apenas se inadequado',
          dicas_para_melhorar_notas: ['dica 1'],
          aviso: 'Sugestão para revisão humana. Nenhuma mensagem foi enviada automaticamente.',
        },
      })

      var response = $http.send({
        url: 'https://api.openai.com/v1/chat/completions',
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + apiKey,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          model: model,
          temperature: 0.3,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        }),
        timeout: 45,
      })
      if (response.statusCode < 200 || response.statusCode >= 300) {
        return e.json(
          502,
          nexoRespostaFallback(externalId, acao, 'IA_HTTP_' + response.statusCode, contextoSeguro),
        )
      }

      try {
        var content = (((response.json || {}).choices || [])[0] || {}).message || {}
        var parsed = nexoJsonSeguro(content.content || '')
        return e.json(200, {
          contrato: 'nexo_ajuda_comercial_v1',
          external_id: externalId,
          acao: acao,
          diagnostico: nexoLimparTextoAjuda(parsed.diagnostico, 3000),
          perguntas_criticas: nexoArrayTextos(
            parsed.perguntas_criticas,
            'Confirmar prazo, decisor e próxima ação.',
          ),
          riscos: nexoArrayTextos(parsed.riscos, 'Sem riscos adicionais explicitados pela IA.'),
          proximos_passos: nexoArrayTextos(
            parsed.proximos_passos,
            'Definir próximo contato e registrar no CRM.',
          ),
          mensagem_sugerida: nexoLimparTextoAjuda(parsed.mensagem_sugerida, 3000),
          dicas_para_melhorar_notas: nexoArrayTextos(
            parsed.dicas_para_melhorar_notas,
            'Registrar decisor, prazo, pendência e próximo passo.',
          ),
          aviso:
            nexoLimparTextoAjuda(parsed.aviso, 500) ||
            'Sugestão gerada para revisão humana. Nenhuma mensagem foi enviada automaticamente.',
          modelo: model,
          fallback: false,
        })
      } catch (err) {
        return e.json(
          502,
          nexoRespostaFallback(externalId, acao, String(err).slice(0, 80), contextoSeguro),
        )
      }
    },
    $apis.requireAuth('users'),
  )
})()
