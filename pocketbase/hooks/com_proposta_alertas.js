// Alertas comerciais derivados exclusivamente de eventos reais da publicação nativa.
;(function () {
  routerAdd(
    'GET',
    '/backend/v1/propostas/notificacoes',
    function (e) {
      function perfil(app, user) {
        try {
          return app.findRecordById('com_perfis', user.getString('perfil_id')).getString('slug')
        } catch (_) {
          return ''
        }
      }
      function parametro(app, chave, fallback) {
        try {
          var p = app.findFirstRecordByData('com_parametros', 'chave', chave)
          return p.getBool('ativo') ? p.getString('valor') : fallback
        } catch (_) {
          return fallback
        }
      }
      function contexto(app, publicacao) {
        var proposta = app.findRecordById('com_propostas', publicacao.getString('proposta_id'))
        var negocio = app.findRecordById('com_negocios', proposta.getString('negocio_id'))
        var externalId = ''
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
        function nome(collection, id, field) {
          try {
            return app.findRecordById(collection, id).getString(field)
          } catch (_) {
            return ''
          }
        }
        return {
          negocio: negocio,
          external_id: externalId,
          cliente: nome('com_empresas', negocio.getString('empresa_id'), 'nome'),
        }
      }
      function podeReceber(app, user, slug, negocio) {
        if (
          slug === 'superadministrador' &&
          parametro(app, 'proposta.notificar_superadmin_abertura', 'true') === 'true'
        )
          return true
        if (
          (slug === 'gestor' || slug === 'gestor-comercial') &&
          parametro(app, 'proposta.notificar_gestor_abertura', 'true') === 'true' &&
          user.getString('equipe_id') &&
          user.getString('equipe_id') === negocio.getString('equipe_id')
        )
          return true
        return (
          parametro(app, 'proposta.notificar_responsavel_abertura', 'true') === 'true' &&
          negocio.getString('responsavel_id') === user.id
        )
      }
      var user = e.auth
      if (!user || !user.getBool('ativo_comercial'))
        return e.forbiddenError('Usuario comercial necessario')
      var slug = perfil($app, user),
        itens = [],
        eventos = []
      try {
        eventos = $app.findRecordsByFilter(
          'com_proposta_eventos_publicos',
          "tipo='pagina_acessada'",
          '-ocorrido_em',
          100,
          0,
        )
      } catch (_) {}
      for (var i = 0; i < eventos.length; i++) {
        try {
          var pub = $app.findRecordById(
            'com_proposta_publicacoes',
            eventos[i].getString('publicacao_id'),
          )
          var ctx = contexto($app, pub)
          if (!podeReceber($app, user, slug, ctx.negocio)) continue
          var primeiro = $app.findRecordsByFilter(
            'com_proposta_eventos_publicos',
            "publicacao_id='" + pub.id + "' && tipo='pagina_acessada'",
            'ocorrido_em',
            1,
            0,
          )
          if (!primeiro.length || primeiro[0].id !== eventos[i].id) continue
          var lida = false
          try {
            $app.findFirstRecordByFilter(
              'com_proposta_notificacao_leituras',
              "usuario_id='" + user.id + "' && evento_id='" + eventos[i].id + "'",
            )
            lida = true
          } catch (_) {}
          itens.push({
            id: eventos[i].id,
            negocio_id: ctx.negocio.id,
            external_id: ctx.external_id,
            cliente: ctx.cliente,
            visitante_nome: eventos[i].getString('visitante_nome') || null,
            ocorrido_em: eventos[i].getString('ocorrido_em'),
            lida: lida,
          })
        } catch (_) {}
      }
      return e.json(200, {
        itens: itens,
        nao_lidas: itens.filter(function (x) {
          return !x.lida
        }).length,
      })
    },
    $apis.requireAuth('users'),
  )

  routerAdd(
    'POST',
    '/backend/v1/propostas/notificacoes/ler',
    function (e) {
      function perfil(app, user) {
        try {
          return app.findRecordById('com_perfis', user.getString('perfil_id')).getString('slug')
        } catch (_) {
          return ''
        }
      }
      function parametro(app, chave, fallback) {
        try {
          var p = app.findFirstRecordByData('com_parametros', 'chave', chave)
          return p.getBool('ativo') ? p.getString('valor') : fallback
        } catch (_) {
          return fallback
        }
      }
      function contexto(app, publicacao) {
        var proposta = app.findRecordById('com_propostas', publicacao.getString('proposta_id'))
        return { negocio: app.findRecordById('com_negocios', proposta.getString('negocio_id')) }
      }
      function podeReceber(app, user, slug, negocio) {
        if (
          slug === 'superadministrador' &&
          parametro(app, 'proposta.notificar_superadmin_abertura', 'true') === 'true'
        )
          return true
        if (
          (slug === 'gestor' || slug === 'gestor-comercial') &&
          parametro(app, 'proposta.notificar_gestor_abertura', 'true') === 'true' &&
          user.getString('equipe_id') &&
          user.getString('equipe_id') === negocio.getString('equipe_id')
        )
          return true
        return (
          parametro(app, 'proposta.notificar_responsavel_abertura', 'true') === 'true' &&
          negocio.getString('responsavel_id') === user.id
        )
      }
      var user = e.auth,
        body = e.requestInfo().body || {},
        ids = body.evento_ids || []
      if (!user || !user.getBool('ativo_comercial'))
        return e.forbiddenError('Usuario comercial necessario')
      if (!Array.isArray(ids) || ids.length > 100) return e.json(400, { error: 'VALIDATION' })
      for (var i = 0; i < ids.length; i++) {
        try {
          var evento = $app.findRecordById('com_proposta_eventos_publicos', String(ids[i]))
          var pub = $app.findRecordById(
            'com_proposta_publicacoes',
            evento.getString('publicacao_id'),
          )
          var ctx = contexto($app, pub)
          if (!podeReceber($app, user, perfil($app, user), ctx.negocio)) continue
        } catch (_) {
          continue
        }
        try {
          $app.findFirstRecordByFilter(
            'com_proposta_notificacao_leituras',
            "usuario_id='" + user.id + "' && evento_id='" + String(ids[i]) + "'",
          )
        } catch (_) {
          try {
            var row = new Record($app.findCollectionByNameOrId('com_proposta_notificacao_leituras'))
            row.set('usuario_id', user.id)
            row.set('evento_id', String(ids[i]))
            row.set('lida_em', new Date())
            $app.save(row)
          } catch (_) {}
        }
      }
      return e.json(200, { ok: true })
    },
    $apis.requireAuth('users'),
  )

  routerAdd(
    'GET',
    '/backend/v1/propostas/sem-abertura',
    function (e) {
      function perfil(app, user) {
        try {
          return app.findRecordById('com_perfis', user.getString('perfil_id')).getString('slug')
        } catch (_) {
          return ''
        }
      }
      function parametro(app, chave, fallback) {
        try {
          var p = app.findFirstRecordByData('com_parametros', 'chave', chave)
          return p.getBool('ativo') ? p.getString('valor') : fallback
        } catch (_) {
          return fallback
        }
      }
      function contexto(app, publicacao) {
        var proposta = app.findRecordById('com_propostas', publicacao.getString('proposta_id'))
        var negocio = app.findRecordById('com_negocios', proposta.getString('negocio_id'))
        var versao = app.findRecordById('com_proposta_versoes', publicacao.getString('versao_id'))
        var externalId = ''
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
        function nome(collection, id, field) {
          try {
            return app.findRecordById(collection, id).getString(field)
          } catch (_) {
            return ''
          }
        }
        return {
          proposta: proposta,
          negocio: negocio,
          versao: versao,
          external_id: externalId,
          cliente: nome('com_empresas', negocio.getString('empresa_id'), 'nome'),
          responsavel: nome('users', negocio.getString('responsavel_id'), 'name'),
        }
      }
      function podeAcessar(user, slug, negocio) {
        if (slug === 'superadministrador' || slug === 'leitura-executiva') return true
        if (negocio.getString('responsavel_id') === user.id) return true
        return (
          (slug === 'gestor' || slug === 'gestor-comercial') &&
          !!user.getString('equipe_id') &&
          user.getString('equipe_id') === negocio.getString('equipe_id')
        )
      }
      function feriados(app) {
        var result = {}
        try {
          var rows = app.findRecordsByFilter('com_calendario_feriados', 'ativo = true', '', 500, 0)
          for (var fi = 0; fi < rows.length; fi++)
            result[rows[fi].getString('data').slice(0, 10)] = true
        } catch (_) {}
        return result
      }
      function chaveData(date) {
        return date.toISOString().slice(0, 10)
      }
      function uteisCompletos(inicio, agora, fs) {
        var cursor = new Date(
          Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth(), inicio.getUTCDate() + 1),
        )
        var hoje = new Date(
          Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate()),
        )
        var total = 0
        while (cursor < hoje) {
          var dia = cursor.getUTCDay()
          if (dia !== 0 && dia !== 6 && !fs[chaveData(cursor)]) total++
          cursor.setUTCDate(cursor.getUTCDate() + 1)
        }
        return total
      }
      var user = e.auth
      if (!user || !user.getBool('ativo_comercial'))
        return e.forbiddenError('Usuario comercial necessario')
      var slug = perfil($app, user),
        limite = Math.max(1, Number(parametro($app, 'proposta.sem_abertura_dias_uteis', '2')) || 2)
      var envios = [],
        vistos = {},
        itens = [],
        fs = feriados($app),
        agora = new Date()
      try {
        envios = $app.findRecordsByFilter(
          'com_proposta_envios',
          "estado='enviado'",
          '-enviado_em,-created',
          500,
          0,
        )
      } catch (_) {}
      for (var i = 0; i < envios.length; i++) {
        var propostaId = envios[i].getString('proposta_id')
        if (vistos[propostaId]) continue
        vistos[propostaId] = true
        try {
          var pub = $app.findRecordById(
            'com_proposta_publicacoes',
            envios[i].getString('publicacao_id'),
          )
          var ctx = contexto($app, pub)
          if (!podeAcessar(user, slug, ctx.negocio)) continue
          var abriu =
            $app.findRecordsByFilter(
              'com_proposta_eventos_publicos',
              "publicacao_id='" + pub.id + "' && tipo='pagina_acessada'",
              '',
              1,
              0,
            ).length > 0
          if (abriu || (ctx.proposta.getString('decisao_publica') || 'pendente') !== 'pendente')
            continue
          var enviadoEm = new Date(
            envios[i].getString('enviado_em') || envios[i].getString('created'),
          )
          var dias = uteisCompletos(enviadoEm, agora, fs)
          if (dias < limite) continue
          itens.push({
            negocio_id: ctx.negocio.id,
            external_id: ctx.external_id,
            cliente: ctx.cliente,
            data_envio: envios[i].getString('enviado_em') || envios[i].getString('created'),
            modalidade: ctx.versao.getString('modalidade'),
            responsavel: ctx.responsavel,
            dias_vida: Math.max(
              0,
              Math.floor(
                (agora.getTime() -
                  new Date(
                    ctx.negocio.getString('crm_created_at') || ctx.negocio.getString('created'),
                  ).getTime()) /
                  86400000,
              ),
            ),
            valor_centavos: Number(ctx.versao.get('valor_total_centavos') || 0),
            dias_uteis_sem_abertura: dias,
          })
        } catch (_) {}
      }
      return e.json(200, { itens: itens, limite_dias_uteis: limite })
    },
    $apis.requireAuth('users'),
  )
})()
