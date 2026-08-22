// T6.2 — materialização controlada do menor privilégio.
// Publicar este hook não altera dados. A escrita exige chamada autenticada,
// confirmação literal, fingerprint atual e chave de idempotência.

;(function () {
  var ROTA = '/backend/v1/admin/t6-2/materializacao'
  var COMANDO = 't62_materializar_menor_privilegio'
  var HOOK_VERSION = 't62-materializacao-precheck-v7'
  var ID_SHIRLEIDE = 'pmdghnoqc5x3rnn'
  var EMAIL_SHIRLEIDE = 'comercial06@pmaisservicos.com.br'
  var PERFIL_SLUG = 'negociacao-propria'
  var CONFIRMACAO = 'MATERIALIZAR_T62_MENOR_PRIVILEGIO'
  var SLA = [
    ['sla.lead_dias_uteis', '1', 'Lead vence no fim do próximo dia útil'],
    ['sla.proposta_dias_uteis', '5', 'Proposta vence em cinco dias úteis'],
    [
      'sla.negociacao_dias_uteis',
      '2',
      'Primeiro acompanhamento da negociação vence em dois dias úteis',
    ],
    ['sla.alerta_antecedencia_dias_uteis', '1', 'Antecedência padrão dos alertas de SLA'],
  ]
  var PERMISSOES = ['empresas.view', 'negocios.view', 'dashboard.view']
  var ETAPAS_SNAPSHOT = [
    'CONTA_ALVO',
    'PERFIL_DESTINO',
    'VINCULOS',
    'PERMISSOES',
    'SLA',
    'CALENDARIO',
    'REGRAS',
  ]

  function autenticarSeguro(e) {
    try {
      return exigirSuperadmin(e)
    } catch (_) {
      return { erro: e.json(409, { error: 'PRECHECK_AUTH' }) }
    }
  }

  function corpoSeguro(e) {
    try {
      var info = e.requestInfo()
      var body = info && info.body
      if (!body || typeof body !== 'object' || Array.isArray(body))
        return { erro: e.json(400, { error: 'PRECHECK_BODY' }) }
      return { body: body }
    } catch (_) {
      return { erro: e.json(400, { error: 'PRECHECK_BODY' }) }
    }
  }

  function canonicalize(obj) {
    if (obj === null || obj === undefined) return 'null'
    if (typeof obj !== 'object') return JSON.stringify(obj)
    if (Array.isArray(obj)) {
      var arr = []
      for (var a = 0; a < obj.length; a++) arr.push(canonicalize(obj[a]))
      return '[' + arr.join(',') + ']'
    }
    var keys = Object.keys(obj).sort(),
      parts = []
    for (var i = 0; i < keys.length; i++)
      parts.push(JSON.stringify(keys[i]) + ':' + canonicalize(obj[keys[i]]))
    return '{' + parts.join(',') + '}'
  }

  function perfilSlug(app, user) {
    try {
      return app.findRecordById('com_perfis', user.getString('perfil_id')).getString('slug')
    } catch (_) {
      return ''
    }
  }

  function regra(collection, name) {
    var value = collection[name]
    return value === null || value === undefined ? null : String(value)
  }

  function primeiro(app, collection, filter) {
    try {
      return app.findFirstRecordByFilter(collection, filter)
    } catch (_) {
      return null
    }
  }

  function snapshot(app) {
    var etapa = 'CONTA_ALVO'
    try {
      // A conta-alvo é fechada pelo ID imutável criado no gate T6.2. O e-mail
      // permanece como segunda trava, mas não é usado como índice de busca.
      var shirleide = app.findRecordById('users', ID_SHIRLEIDE)
      if (shirleide.getString('email').toLowerCase() !== EMAIL_SHIRLEIDE)
        throw new Error('CONTA_ALVO_DIVERGENTE')

      etapa = 'PERFIL_DESTINO'
      var profile = primeiro(app, 'com_perfis', "slug='" + PERFIL_SLUG + "'")

      etapa = 'VINCULOS'
      var bindings = app.findRecordsByFilter(
        'com_usuarios_equipes',
        "usuario_id='" + shirleide.id + "'",
        'id',
        50,
        0,
      )
      var bindingState = []
      for (var b = 0; b < bindings.length; b++)
        bindingState.push({
          id: bindings[b].id,
          perfil_id: bindings[b].getString('perfil_id'),
          escopo: bindings[b].getString('escopo'),
          ativo: bindings[b].getBool('ativo'),
        })

      etapa = 'PERMISSOES'
      var profilePermissions = []
      if (profile) {
        var links = app.findRecordsByFilter(
          'com_perfil_permissoes',
          "perfil_id='" + profile.id + "'",
          'id',
          100,
          0,
        )
        for (var p = 0; p < links.length; p++) {
          var permissionSlug = ''
          try {
            permissionSlug = app
              .findRecordById('com_permissoes', links[p].getString('permissao_id'))
              .getString('slug')
          } catch (_) {}
          profilePermissions.push({
            id: links[p].id,
            slug: permissionSlug,
            escopo: links[p].getString('escopo'),
          })
        }
      }

      etapa = 'SLA'
      var slaState = []
      for (var s = 0; s < SLA.length; s++) {
        var parametro = primeiro(app, 'com_parametros', "chave='" + SLA[s][0] + "'")
        slaState.push(
          parametro
            ? {
                chave: SLA[s][0],
                id: parametro.id,
                valor: parametro.getString('valor'),
                ativo: parametro.getBool('ativo'),
              }
            : { chave: SLA[s][0], id: null, valor: null, ativo: false },
        )
      }

      etapa = 'CALENDARIO'
      var calendarioExiste = true
      try {
        app.findCollectionByNameOrId('com_calendario_feriados')
      } catch (_) {
        calendarioExiste = false
      }

      etapa = 'REGRAS'
      var users = app.findCollectionByNameOrId('users')
      var audit = app.findCollectionByNameOrId('com_auditoria')
      return {
        shirleide: {
          id: shirleide.id,
          ativo_comercial: shirleide.getBool('ativo_comercial'),
          perfil_id: shirleide.getString('perfil_id'),
          perfil_slug: perfilSlug(app, shirleide),
          updated: shirleide.getString('updated'),
        },
        perfil: profile
          ? { id: profile.id, ativo: profile.getBool('ativo'), nome: profile.getString('nome') }
          : null,
        bindings: bindingState,
        permissoes: profilePermissions,
        sla: slaState,
        calendario_existe: calendarioExiste,
        regras: {
          users_list: regra(users, 'listRule'),
          users_view: regra(users, 'viewRule'),
          auditoria_list: regra(audit, 'listRule'),
          auditoria_view: regra(audit, 'viewRule'),
        },
      }
    } catch (_) {
      throw new Error('SNAPSHOT_' + etapa)
    }
  }

  function codigoSnapshot(err) {
    var text = String(err || '')
    for (var i = 0; i < ETAPAS_SNAPSHOT.length; i++) {
      var code = 'SNAPSHOT_' + ETAPAS_SNAPSHOT[i]
      if (text.indexOf(code) >= 0) return code
    }
    return 'SNAPSHOT_INDISPONIVEL'
  }

  function fingerprint(app) {
    return $security.sha256(canonicalize(snapshot(app)))
  }

  function exigirSuperadmin(e) {
    var ator = e.auth
    if (!ator) return { erro: e.unauthorizedError('Autenticacao necessaria') }
    if (!ator.getBool('ativo_comercial'))
      return { erro: e.forbiddenError('Usuario comercial inativo') }
    if (perfilSlug($app, ator) !== 'superadministrador')
      return { erro: e.forbiddenError('SuperAdmin necessario') }
    return { ator: ator }
  }

  function previsto(state) {
    var permissionSlugs = []
    for (var p = 0; p < state.permissoes.length; p++)
      permissionSlugs.push(state.permissoes[p].slug + ':' + state.permissoes[p].escopo)
    permissionSlugs.sort()
    return {
      calendario_criar: !state.calendario_existe,
      parametros_sla_criar: state.sla.filter(function (item) {
        return !item.id
      }).length,
      perfil_criar: !state.perfil,
      perfil_ativar_ou_normalizar:
        !!state.perfil &&
        (state.perfil.ativo !== true || state.perfil.nome !== 'Negociação Própria'),
      permissoes_esperadas: PERMISSOES,
      permissoes_atuais: permissionSlugs,
      shirleide_perfil_atual: state.shirleide.perfil_slug,
      shirleide_perfil_destino: PERFIL_SLUG,
      vinculos_atualizar: state.bindings.filter(function (item) {
        return !state.perfil || item.perfil_id !== state.perfil.id || item.escopo !== 'proprios'
      }).length,
      regras_users_auditoria_atualizar: true,
    }
  }

  routerAdd(
    'GET',
    ROTA + '/diagnostico-v7',
    function (e) {
      // O SKIP serializa cada callback de rota em um wrapper /pb.js próprio.
      // Por isso este diagnóstico é deliberadamente autocontido e não usa
      // constantes ou funções do fechamento lexical da IIFE.
      var ator = e.auth
      if (!ator) return e.unauthorizedError('Autenticacao necessaria')
      if (!ator.getBool('ativo_comercial')) return e.forbiddenError('Usuario comercial inativo')
      var perfilSlug = ''
      try {
        perfilSlug = $app
          .findRecordById('com_perfis', ator.getString('perfil_id'))
          .getString('slug')
      } catch (_) {}
      if (perfilSlug !== 'superadministrador') return e.forbiddenError('SuperAdmin necessario')
      return e.json(200, {
        hook_version: 't62-materializacao-precheck-v7',
        handler_alcancado: true,
        somente_leitura: true,
        mutacoes_executadas: 0,
      })
    },
    $apis.requireAuth('users'),
  )

  routerAdd(
    'POST',
    ROTA + '/dry-run',
    function (e) {
      var ID_SHIRLEIDE = 'pmdghnoqc5x3rnn'
      var EMAIL_SHIRLEIDE = 'comercial06@pmaisservicos.com.br'
      var PERFIL_SLUG = 'negociacao-propria'
      var SLA = [
        ['sla.lead_dias_uteis', '1'],
        ['sla.proposta_dias_uteis', '5'],
        ['sla.negociacao_dias_uteis', '2'],
        ['sla.alerta_antecedencia_dias_uteis', '1'],
      ]
      var PERMISSOES = ['empresas.view', 'negocios.view', 'dashboard.view']
      var ETAPAS_SNAPSHOT = [
        'CONTA_ALVO',
        'PERFIL_DESTINO',
        'VINCULOS',
        'PERMISSOES',
        'SLA',
        'CALENDARIO',
        'REGRAS',
      ]
      function perfilSlug(app, user) {
        try {
          return app.findRecordById('com_perfis', user.getString('perfil_id')).getString('slug')
        } catch (_) {
          return ''
        }
      }
      function autenticarSeguro(evento) {
        try {
          var ator = evento.auth
          if (!ator) return { erro: evento.unauthorizedError('Autenticacao necessaria') }
          if (!ator.getBool('ativo_comercial'))
            return { erro: evento.forbiddenError('Usuario comercial inativo') }
          if (perfilSlug($app, ator) !== 'superadministrador')
            return { erro: evento.forbiddenError('SuperAdmin necessario') }
          return { ator: ator }
        } catch (_) {
          return { erro: evento.json(409, { error: 'PRECHECK_AUTH' }) }
        }
      }
      function corpoSeguro(evento) {
        try {
          var info = evento.requestInfo()
          var body = info && info.body
          if (!body || typeof body !== 'object' || Array.isArray(body))
            return { erro: evento.json(400, { error: 'PRECHECK_BODY' }) }
          return { body: body }
        } catch (_) {
          return { erro: evento.json(400, { error: 'PRECHECK_BODY' }) }
        }
      }
      function canonicalize(obj) {
        if (obj === null || obj === undefined) return 'null'
        if (typeof obj !== 'object') return JSON.stringify(obj)
        if (Array.isArray(obj)) {
          var arr = []
          for (var a = 0; a < obj.length; a++) arr.push(canonicalize(obj[a]))
          return '[' + arr.join(',') + ']'
        }
        var keys = Object.keys(obj).sort()
        var parts = []
        for (var i = 0; i < keys.length; i++)
          parts.push(JSON.stringify(keys[i]) + ':' + canonicalize(obj[keys[i]]))
        return '{' + parts.join(',') + '}'
      }
      function regra(collection, name) {
        var value = collection[name]
        return value === null || value === undefined ? null : String(value)
      }
      function primeiro(app, collection, filter) {
        try {
          return app.findFirstRecordByFilter(collection, filter)
        } catch (_) {
          return null
        }
      }
      function snapshot(app) {
        var etapa = 'CONTA_ALVO'
        try {
          var shirleide = app.findRecordById('users', ID_SHIRLEIDE)
          if (shirleide.getString('email').toLowerCase() !== EMAIL_SHIRLEIDE)
            throw new Error('CONTA_ALVO_DIVERGENTE')
          etapa = 'PERFIL_DESTINO'
          var profile = primeiro(app, 'com_perfis', "slug='" + PERFIL_SLUG + "'")
          etapa = 'VINCULOS'
          var bindings = app.findRecordsByFilter(
            'com_usuarios_equipes',
            "usuario_id='" + shirleide.id + "'",
            'id',
            50,
            0,
          )
          var bindingState = []
          for (var b = 0; b < bindings.length; b++)
            bindingState.push({
              id: bindings[b].id,
              perfil_id: bindings[b].getString('perfil_id'),
              escopo: bindings[b].getString('escopo'),
              ativo: bindings[b].getBool('ativo'),
            })
          etapa = 'PERMISSOES'
          var profilePermissions = []
          if (profile) {
            var links = app.findRecordsByFilter(
              'com_perfil_permissoes',
              "perfil_id='" + profile.id + "'",
              'id',
              100,
              0,
            )
            for (var p = 0; p < links.length; p++) {
              var permissionSlug = ''
              try {
                permissionSlug = app
                  .findRecordById('com_permissoes', links[p].getString('permissao_id'))
                  .getString('slug')
              } catch (_) {}
              profilePermissions.push({
                id: links[p].id,
                slug: permissionSlug,
                escopo: links[p].getString('escopo'),
              })
            }
          }
          etapa = 'SLA'
          var slaState = []
          for (var s = 0; s < SLA.length; s++) {
            var parametro = primeiro(app, 'com_parametros', "chave='" + SLA[s][0] + "'")
            slaState.push(
              parametro
                ? {
                    chave: SLA[s][0],
                    id: parametro.id,
                    valor: parametro.getString('valor'),
                    ativo: parametro.getBool('ativo'),
                  }
                : { chave: SLA[s][0], id: null, valor: null, ativo: false },
            )
          }
          etapa = 'CALENDARIO'
          var calendarioExiste = true
          try {
            app.findCollectionByNameOrId('com_calendario_feriados')
          } catch (_) {
            calendarioExiste = false
          }
          etapa = 'REGRAS'
          var users = app.findCollectionByNameOrId('users')
          var audit = app.findCollectionByNameOrId('com_auditoria')
          return {
            shirleide: {
              id: shirleide.id,
              ativo_comercial: shirleide.getBool('ativo_comercial'),
              perfil_id: shirleide.getString('perfil_id'),
              perfil_slug: perfilSlug(app, shirleide),
              updated: shirleide.getString('updated'),
            },
            perfil: profile
              ? { id: profile.id, ativo: profile.getBool('ativo'), nome: profile.getString('nome') }
              : null,
            bindings: bindingState,
            permissoes: profilePermissions,
            sla: slaState,
            calendario_existe: calendarioExiste,
            regras: {
              users_list: regra(users, 'listRule'),
              users_view: regra(users, 'viewRule'),
              auditoria_list: regra(audit, 'listRule'),
              auditoria_view: regra(audit, 'viewRule'),
            },
          }
        } catch (_) {
          throw new Error('SNAPSHOT_' + etapa)
        }
      }
      function codigoSnapshot(err) {
        var text = String(err || '')
        for (var i = 0; i < ETAPAS_SNAPSHOT.length; i++) {
          var code = 'SNAPSHOT_' + ETAPAS_SNAPSHOT[i]
          if (text.indexOf(code) >= 0) return code
        }
        return 'SNAPSHOT_INDISPONIVEL'
      }
      function previsto(state) {
        var permissionSlugs = []
        for (var p = 0; p < state.permissoes.length; p++)
          permissionSlugs.push(state.permissoes[p].slug + ':' + state.permissoes[p].escopo)
        permissionSlugs.sort()
        return {
          calendario_criar: !state.calendario_existe,
          parametros_sla_criar: state.sla.filter(function (item) {
            return !item.id
          }).length,
          perfil_criar: !state.perfil,
          perfil_ativar_ou_normalizar:
            !!state.perfil &&
            (state.perfil.ativo !== true || state.perfil.nome !== 'Negociação Própria'),
          permissoes_esperadas: PERMISSOES,
          permissoes_atuais: permissionSlugs,
          shirleide_perfil_atual: state.shirleide.perfil_slug,
          shirleide_perfil_destino: PERFIL_SLUG,
          vinculos_atualizar: state.bindings.filter(function (item) {
            return !state.perfil || item.perfil_id !== state.perfil.id || item.escopo !== 'proprios'
          }).length,
          regras_users_auditoria_atualizar: true,
        }
      }
      var auth = autenticarSeguro(e)
      if (auth.erro) return auth.erro
      var parsed = corpoSeguro(e)
      if (parsed.erro) return parsed.erro
      var body = parsed.body
      if (
        Object.keys(body || {})
          .sort()
          .join(',') !== 'modo' ||
        body.modo !== 'dry_run'
      )
        return e.json(400, { error: 'CONTRATO_DRY_RUN_INVALIDO' })
      var state
      try {
        state = snapshot($app)
      } catch (err) {
        return e.json(409, { error: codigoSnapshot(err) })
      }
      return e.json(200, {
        modo: 'dry_run',
        somente_leitura: true,
        mutacoes_executadas: 0,
        fingerprint_estado: $security.sha256(canonicalize(state)),
        estado_atual: state,
        alteracoes_previstas: previsto(state),
        proximo_gate: 'AUTORIZACAO_EXPLICITA_PARA_PUBLICAR_SEM_EXECUTAR',
      })
    },
    $apis.requireAuth(),
  )

  routerAdd(
    'POST',
    ROTA + '/executar',
    function (e) {
      var COMANDO = 't62_materializar_menor_privilegio'
      var ID_SHIRLEIDE = 'pmdghnoqc5x3rnn'
      var EMAIL_SHIRLEIDE = 'comercial06@pmaisservicos.com.br'
      var PERFIL_SLUG = 'negociacao-propria'
      var CONFIRMACAO = 'MATERIALIZAR_T62_MENOR_PRIVILEGIO'
      var SLA = [
        ['sla.lead_dias_uteis', '1', 'Lead vence no fim do próximo dia útil'],
        ['sla.proposta_dias_uteis', '5', 'Proposta vence em cinco dias úteis'],
        [
          'sla.negociacao_dias_uteis',
          '2',
          'Primeiro acompanhamento da negociação vence em dois dias úteis',
        ],
        ['sla.alerta_antecedencia_dias_uteis', '1', 'Antecedência padrão dos alertas de SLA'],
      ]
      var PERMISSOES = ['empresas.view', 'negocios.view', 'dashboard.view']
      var ETAPAS_SNAPSHOT = [
        'CONTA_ALVO',
        'PERFIL_DESTINO',
        'VINCULOS',
        'PERMISSOES',
        'SLA',
        'CALENDARIO',
        'REGRAS',
      ]
      function perfilSlug(app, user) {
        try {
          return app.findRecordById('com_perfis', user.getString('perfil_id')).getString('slug')
        } catch (_) {
          return ''
        }
      }
      function autenticarSeguro(evento) {
        try {
          var ator = evento.auth
          if (!ator) return { erro: evento.unauthorizedError('Autenticacao necessaria') }
          if (!ator.getBool('ativo_comercial'))
            return { erro: evento.forbiddenError('Usuario comercial inativo') }
          if (perfilSlug($app, ator) !== 'superadministrador')
            return { erro: evento.forbiddenError('SuperAdmin necessario') }
          return { ator: ator }
        } catch (_) {
          return { erro: evento.json(409, { error: 'PRECHECK_AUTH' }) }
        }
      }
      function corpoSeguro(evento) {
        try {
          var info = evento.requestInfo()
          var body = info && info.body
          if (!body || typeof body !== 'object' || Array.isArray(body))
            return { erro: evento.json(400, { error: 'PRECHECK_BODY' }) }
          return { body: body }
        } catch (_) {
          return { erro: evento.json(400, { error: 'PRECHECK_BODY' }) }
        }
      }
      function canonicalize(obj) {
        if (obj === null || obj === undefined) return 'null'
        if (typeof obj !== 'object') return JSON.stringify(obj)
        if (Array.isArray(obj)) {
          var arr = []
          for (var a = 0; a < obj.length; a++) arr.push(canonicalize(obj[a]))
          return '[' + arr.join(',') + ']'
        }
        var keys = Object.keys(obj).sort()
        var parts = []
        for (var i = 0; i < keys.length; i++)
          parts.push(JSON.stringify(keys[i]) + ':' + canonicalize(obj[keys[i]]))
        return '{' + parts.join(',') + '}'
      }
      function regra(collection, name) {
        var value = collection[name]
        return value === null || value === undefined ? null : String(value)
      }
      function primeiro(app, collection, filter) {
        try {
          return app.findFirstRecordByFilter(collection, filter)
        } catch (_) {
          return null
        }
      }
      function snapshot(app) {
        var etapa = 'CONTA_ALVO'
        try {
          var shirleide = app.findRecordById('users', ID_SHIRLEIDE)
          if (shirleide.getString('email').toLowerCase() !== EMAIL_SHIRLEIDE)
            throw new Error('CONTA_ALVO_DIVERGENTE')
          etapa = 'PERFIL_DESTINO'
          var profile = primeiro(app, 'com_perfis', "slug='" + PERFIL_SLUG + "'")
          etapa = 'VINCULOS'
          var bindings = app.findRecordsByFilter(
            'com_usuarios_equipes',
            "usuario_id='" + shirleide.id + "'",
            'id',
            50,
            0,
          )
          var bindingState = []
          for (var b = 0; b < bindings.length; b++)
            bindingState.push({
              id: bindings[b].id,
              perfil_id: bindings[b].getString('perfil_id'),
              escopo: bindings[b].getString('escopo'),
              ativo: bindings[b].getBool('ativo'),
            })
          etapa = 'PERMISSOES'
          var profilePermissions = []
          if (profile) {
            var links = app.findRecordsByFilter(
              'com_perfil_permissoes',
              "perfil_id='" + profile.id + "'",
              'id',
              100,
              0,
            )
            for (var p = 0; p < links.length; p++) {
              var permissionSlug = ''
              try {
                permissionSlug = app
                  .findRecordById('com_permissoes', links[p].getString('permissao_id'))
                  .getString('slug')
              } catch (_) {}
              profilePermissions.push({
                id: links[p].id,
                slug: permissionSlug,
                escopo: links[p].getString('escopo'),
              })
            }
          }
          etapa = 'SLA'
          var slaState = []
          for (var s = 0; s < SLA.length; s++) {
            var parametro = primeiro(app, 'com_parametros', "chave='" + SLA[s][0] + "'")
            slaState.push(
              parametro
                ? {
                    chave: SLA[s][0],
                    id: parametro.id,
                    valor: parametro.getString('valor'),
                    ativo: parametro.getBool('ativo'),
                  }
                : { chave: SLA[s][0], id: null, valor: null, ativo: false },
            )
          }
          etapa = 'CALENDARIO'
          var calendarioExiste = true
          try {
            app.findCollectionByNameOrId('com_calendario_feriados')
          } catch (_) {
            calendarioExiste = false
          }
          etapa = 'REGRAS'
          var users = app.findCollectionByNameOrId('users')
          var audit = app.findCollectionByNameOrId('com_auditoria')
          return {
            shirleide: {
              id: shirleide.id,
              ativo_comercial: shirleide.getBool('ativo_comercial'),
              perfil_id: shirleide.getString('perfil_id'),
              perfil_slug: perfilSlug(app, shirleide),
              updated: shirleide.getString('updated'),
            },
            perfil: profile
              ? { id: profile.id, ativo: profile.getBool('ativo'), nome: profile.getString('nome') }
              : null,
            bindings: bindingState,
            permissoes: profilePermissions,
            sla: slaState,
            calendario_existe: calendarioExiste,
            regras: {
              users_list: regra(users, 'listRule'),
              users_view: regra(users, 'viewRule'),
              auditoria_list: regra(audit, 'listRule'),
              auditoria_view: regra(audit, 'viewRule'),
            },
          }
        } catch (_) {
          throw new Error('SNAPSHOT_' + etapa)
        }
      }
      function codigoSnapshot(err) {
        var text = String(err || '')
        for (var i = 0; i < ETAPAS_SNAPSHOT.length; i++) {
          var code = 'SNAPSHOT_' + ETAPAS_SNAPSHOT[i]
          if (text.indexOf(code) >= 0) return code
        }
        return 'SNAPSHOT_INDISPONIVEL'
      }
      function fingerprint(app) {
        return $security.sha256(canonicalize(snapshot(app)))
      }
      var auth = autenticarSeguro(e)
      if (auth.erro) return auth.erro
      var ator = auth.ator
      var parsed = corpoSeguro(e)
      if (parsed.erro) return parsed.erro
      var body = parsed.body
      var keys = Object.keys(body || {})
        .sort()
        .join(',')
      if (keys !== 'command_idempotency_key,confirmacao,fingerprint_estado,justificativa,modo')
        return e.json(400, { error: 'CAMPOS_INVALIDOS' })
      if (body.modo !== 'executar') return e.json(400, { error: 'MODO_EXECUTAR_OBRIGATORIO' })
      if (body.confirmacao !== CONFIRMACAO)
        return e.json(400, { error: 'CONFIRMACAO_LITERAL_OBRIGATORIA' })
      var idemKey = String(body.command_idempotency_key || '').trim()
      var justificativa = String(body.justificativa || '').trim()
      if (!idemKey || idemKey.length > 128)
        return e.json(400, { error: 'IDEMPOTENCY_KEY_INVALIDA' })
      if (!justificativa || justificativa.length > 500)
        return e.json(400, { error: 'JUSTIFICATIVA_INVALIDA' })
      if (!/^[a-f0-9]{64}$/.test(String(body.fingerprint_estado || '')))
        return e.json(400, { error: 'FINGERPRINT_INVALIDO' })

      var payload = {
        confirmacao: body.confirmacao,
        fingerprint_estado: body.fingerprint_estado,
        justificativa: justificativa,
      }
      var payloadHash = $security.sha256(canonicalize(payload))
      var existentes = []
      try {
        existentes = $app.findRecordsByFilter(
          'com_idempotencia',
          "ator_id='" +
            ator.id +
            "' && comando='" +
            COMANDO +
            "' && command_idempotency_key='" +
            idemKey +
            "'",
          '',
          1,
          0,
        )
      } catch (_) {}
      if (existentes.length) {
        var existente = existentes[0]
        if (existente.getString('payload_hash') !== payloadHash)
          return e.json(409, { error: 'CONFLICT' })
        if (existente.getString('estado') !== 'concluido')
          return e.json(409, { error: 'CONCORRENTE' })
        var replay = {}
        try {
          replay = existente.get('resultado') || {}
        } catch (_) {}
        return e.json(200, Object.assign({ replay: true }, replay))
      }

      var atual
      try {
        atual = fingerprint($app)
      } catch (err) {
        return e.json(409, { error: codigoSnapshot(err) })
      }
      if (atual !== body.fingerprint_estado)
        return e.json(409, { error: 'STALE_WRITE', fingerprint_atual: atual })

      var resposta = null,
        erro = ''
      try {
        $app.runInTransaction(function (tx) {
          var atorTx = tx.findRecordById('users', ator.id)
          if (!atorTx.getBool('ativo_comercial') || perfilSlug(tx, atorTx) !== 'superadministrador')
            throw new Error('FORBIDDEN')
          if (fingerprint(tx) !== body.fingerprint_estado) throw new Error('STALE_WRITE')

          var calendario
          try {
            calendario = tx.findCollectionByNameOrId('com_calendario_feriados')
          } catch (_) {
            calendario = new Collection({
              name: 'com_calendario_feriados',
              type: 'base',
              listRule: "@request.auth.id != ''",
              viewRule: "@request.auth.id != ''",
              createRule: null,
              updateRule: null,
              deleteRule: null,
              fields: [
                { name: 'data', type: 'date', required: true },
                { name: 'descricao', type: 'text', required: true, max: 200 },
                { name: 'ativo', type: 'bool' },
                { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
                { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
              ],
              indexes: [
                'CREATE UNIQUE INDEX idx_com_calendario_feriados_data ON com_calendario_feriados (data)',
              ],
            })
            tx.save(calendario)
          }

          var parametrosCol = tx.findCollectionByNameOrId('com_parametros')
          for (var s = 0; s < SLA.length; s++) {
            var parametro = primeiro(tx, 'com_parametros', "chave='" + SLA[s][0] + "'")
            if (!parametro) {
              parametro = new Record(parametrosCol)
              parametro.set('chave', SLA[s][0])
              parametro.set('valor', SLA[s][1])
              parametro.set('descricao', SLA[s][2])
              parametro.set('versao', 1)
              parametro.set('ativo', true)
              tx.save(parametro)
            }
          }
          parametrosCol.createRule = null
          parametrosCol.updateRule = null
          parametrosCol.deleteRule = null
          tx.save(parametrosCol)

          var perfil = primeiro(tx, 'com_perfis', "slug='" + PERFIL_SLUG + "'")
          if (!perfil) perfil = new Record(tx.findCollectionByNameOrId('com_perfis'))
          perfil.set('nome', 'Negociação Própria')
          perfil.set('slug', PERFIL_SLUG)
          perfil.set(
            'descricao',
            'Acompanhamento somente leitura da negociação e alertas dos próprios negócios',
          )
          perfil.set('ativo', true)
          tx.save(perfil)

          var linkCol = tx.findCollectionByNameOrId('com_perfil_permissoes')
          var linkIds = []
          for (var p = 0; p < PERMISSOES.length; p++) {
            var permission = tx.findFirstRecordByData('com_permissoes', 'slug', PERMISSOES[p])
            var link = primeiro(
              tx,
              'com_perfil_permissoes',
              "perfil_id='" + perfil.id + "' && permissao_id='" + permission.id + "'",
            )
            if (!link) link = new Record(linkCol)
            link.set('perfil_id', perfil.id)
            link.set('permissao_id', permission.id)
            link.set('escopo', 'proprios')
            tx.save(link)
            linkIds.push(link.id)
          }

          var shirleide = tx.findRecordById('users', ID_SHIRLEIDE)
          if (shirleide.getString('email').toLowerCase() !== EMAIL_SHIRLEIDE)
            throw new Error('CONTA_ALVO_DIVERGENTE')
          if (shirleide.getBool('ativo_comercial')) throw new Error('CONTA_ALVO_ATIVA')
          var perfilAnterior = perfilSlug(tx, shirleide)
          shirleide.set('perfil_id', perfil.id)
          tx.save(shirleide)
          var bindings = tx.findRecordsByFilter(
            'com_usuarios_equipes',
            "usuario_id='" + shirleide.id + "'",
            '',
            50,
            0,
          )
          for (var b = 0; b < bindings.length; b++) {
            bindings[b].set('perfil_id', perfil.id)
            bindings[b].set('escopo', 'proprios')
            tx.save(bindings[b])
          }

          var users = tx.findCollectionByNameOrId('users')
          users.listRule =
            "@request.auth.id != '' && @request.auth.perfil_id.slug = 'superadministrador'"
          users.viewRule =
            "@request.auth.id != '' && (@request.auth.id = id || @request.auth.perfil_id.slug = 'superadministrador')"
          tx.save(users)

          var audit = tx.findCollectionByNameOrId('com_auditoria')
          var auditProfiles =
            "(@request.auth.perfil_id.slug = 'superadministrador' || @request.auth.perfil_id.slug = 'gestor-comercial' || @request.auth.perfil_id.slug = 'aprovador' || @request.auth.perfil_id.slug = 'leitura-executiva')"
          audit.listRule = "@request.auth.id != '' && " + auditProfiles
          audit.viewRule = "@request.auth.id != '' && " + auditProfiles
          tx.save(audit)

          var evidencia = {
            comando: COMANDO,
            fingerprint_antes: body.fingerprint_estado,
            perfil_id: perfil.id,
            perfil_slug: PERFIL_SLUG,
            perfil_anterior_shirleide: perfilAnterior,
            shirleide_id: shirleide.id,
            bindings_atualizados: bindings.length,
            permissoes_ids: linkIds,
            parametros_sla: SLA.length,
          }
          var auditoria = new Record(tx.findCollectionByNameOrId('com_auditoria'))
          auditoria.set('collection_name', 'users')
          auditoria.set('record_id', shirleide.id)
          auditoria.set('acao', 'update')
          auditoria.set('usuario_id', ator.id)
          auditoria.set('comando', COMANDO)
          auditoria.set('command_idempotency_key', idemKey)
          auditoria.set('evento_em', new Date())
          auditoria.set('justificativa', justificativa)
          auditoria.set('perfil', 'superadministrador')
          auditoria.set('escopo', 't6_2_menor_privilegio')
          auditoria.set('origem', 'server-side')
          auditoria.set('evidencia_estruturada', evidencia)
          auditoria.set('snapshot_hash', $security.sha256(canonicalize(evidencia)))
          auditoria.set('snapshot_hash_versao', '1')
          tx.save(auditoria)

          resposta = {
            comando: COMANDO,
            perfil_id: perfil.id,
            perfil_slug: PERFIL_SLUG,
            shirleide_id: shirleide.id,
            bindings_atualizados: bindings.length,
            permissoes_configuradas: PERMISSOES.length,
            auditoria_id: auditoria.id,
            contas_ativadas: 0,
          }
          var idem = new Record(tx.findCollectionByNameOrId('com_idempotencia'))
          idem.set('command_idempotency_key', idemKey)
          idem.set('comando', COMANDO)
          idem.set('ator_id', ator.id)
          idem.set('payload_hash', payloadHash)
          idem.set('estado', 'concluido')
          idem.set('codigo_retorno', '200')
          idem.set('resultado', resposta)
          idem.set('registros_afetados', [shirleide.id, perfil.id])
          idem.set('executor_id', 'pb-primary')
          idem.set('lease_ate', new Date(Date.now() + 300000))
          idem.set('tentativa', 1)
          idem.set('claim_version', 1)
          idem.set('inicio_em', new Date())
          idem.set('conclusao_em', new Date())
          tx.save(idem)
        })
      } catch (err) {
        erro = String(err)
      }
      if (erro.indexOf('STALE_WRITE') >= 0) return e.json(409, { error: 'STALE_WRITE' })
      if (erro.indexOf('CONTA_ALVO_ATIVA') >= 0) return e.json(409, { error: 'CONTA_ALVO_ATIVA' })
      if (erro.indexOf('SNAPSHOT_') >= 0) return e.json(409, { error: codigoSnapshot(erro) })
      if (erro.indexOf('FORBIDDEN') >= 0) return e.json(403, { error: 'FORBIDDEN' })
      if (erro) return e.json(500, { error: 'INTERNAL' })
      return e.json(200, Object.assign({ replay: false }, resposta))
    },
    $apis.requireAuth(),
  )
})()
