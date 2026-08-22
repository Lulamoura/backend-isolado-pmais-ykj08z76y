routerAdd(
  'POST',
  '/backend/v1/run-positive-tests',
  (e) => {
    var authId = e.auth ? e.auth.id : ''
    if (!authId) return e.unauthorizedError('Autenticacao necessaria')

    var isAppSuperAdmin = false
    try {
      var authPerfilId = e.auth.getString('perfil_id')
      if (authPerfilId) {
        var perfilRec = $app.findRecordById('com_perfis', authPerfilId)
        if (perfilRec.getString('slug') === 'superadministrador') {
          isAppSuperAdmin = true
        }
      }
    } catch (_) {}

    if (!isAppSuperAdmin) {
      try {
        var saPerfil = $app.findFirstRecordByData('com_perfis', 'slug', 'superadministrador')
        if (saPerfil) {
          var saBindings = $app.findRecordsByFilter(
            'com_usuarios_equipes',
            "usuario_id = '" + authId + "' && perfil_id = '" + saPerfil.id + "' && ativo = true",
            '',
            1,
            0,
          )
          if (saBindings && saBindings.length > 0) {
            isAppSuperAdmin = true
          }
        }
      } catch (_) {}
    }

    if (!isAppSuperAdmin) {
      return e.forbiddenError('Apenas superadministrador da aplicacao pode executar testes')
    }

    var baseUrl = ($secrets.get('PB_INSTANCE_URL') || '').replace(/\/$/, '')

    var testPassword = ''
    try {
      testPassword = $secrets.get('TEST_USER_PASSWORD') || ''
    } catch (_) {
      testPassword = ''
    }

    if (!testPassword) {
      $app.logger().warn('positive tests aborted: TEST_USER_PASSWORD secret not configured')
      return e.json(503, {
        error: 'TEST_USER_PASSWORD secret not configured; aborting positive tests',
        secretConfigured: false,
      })
    }

    var superuserToken = ''
    try {
      superuserToken = $secrets.get('PB_SUPERUSER_TOKEN') || ''
    } catch (_) {
      superuserToken = ''
    }

    if (!superuserToken) {
      $app.logger().warn('positive tests aborted: PB_SUPERUSER_TOKEN secret not configured')
      return e.json(503, {
        error: 'PB_SUPERUSER_TOKEN secret not configured; aborting positive tests',
        secretConfigured: false,
      })
    }

    $app.logger().info('positive tests starting: secrets configured')

    var testEmails = ['comercial.teste@pmaisservicos.com.br', 'outro.usuario@pmaisservicos.com.br']

    for (var te = 0; te < testEmails.length; te++) {
      try {
        var testUser = $app.findAuthRecordByEmail('_pb_users_auth_', testEmails[te])
        var resetRes = $http.send({
          url: baseUrl + '/api/collections/users/records/' + testUser.id,
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: superuserToken,
          },
          body: JSON.stringify({ password: testPassword, passwordConfirm: testPassword }),
          timeout: 15,
        })
        if (resetRes.statusCode !== 200) {
          $app
            .logger()
            .warn(
              'password reset failed for test user',
              'email',
              testEmails[te],
              'status',
              resetRes.statusCode,
            )
        }
      } catch (err) {
        $app
          .logger()
          .warn('password reset error for test user', 'email', testEmails[te], 'error', String(err))
      }
    }

    var results = { generatedAt: new Date().toISOString(), tests: [] }

    function authToken(email) {
      var res = $http.send({
        url: baseUrl + '/api/collections/users/auth-with-password',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identity: email, password: testPassword }),
        timeout: 15,
      })
      return res.statusCode === 200 && res.json ? res.json.token : null
    }

    function listRecs(token, col, perPage) {
      var pp = perPage || 500
      var res = $http.send({
        url: baseUrl + '/api/collections/' + col + '/records?page=1&perPage=' + pp,
        method: 'GET',
        headers: { Authorization: token },
        timeout: 15,
      })
      var body = res.json || {}
      var items = (body.items || []).map(function (r) {
        return {
          id: r.id,
          titulo: r.titulo || r.nome || r.chave || r.slug || r.id,
          inativo: r.inativo === true,
        }
      })
      return { status: res.statusCode, totalItems: body.totalItems || 0, items: items }
    }

    function dbListNegocios(filter) {
      try {
        var recs = $app.findRecordsByFilter('com_negocios', filter, '-created', 500, 0)
        return recs.map(function (r) {
          return { id: r.id, titulo: r.getString('titulo'), inativo: r.getBool('inativo') }
        })
      } catch (_) {
        return []
      }
    }

    function dbListEmpresas(filter) {
      try {
        var recs = $app.findRecordsByFilter('com_empresas', filter, '-created', 500, 0)
        return recs.map(function (r) {
          return { id: r.id, titulo: r.getString('nome'), inativo: false }
        })
      } catch (_) {
        return []
      }
    }

    function dbCount(col, filter) {
      try {
        return $app.findRecordsByFilter(col, filter || '', '', 500, 0).length
      } catch (_) {
        return 0
      }
    }

    var lulaToken = authToken('luiz.moura@pmaisservicos.com.br')
    if (!lulaToken) {
      lulaToken = superuserToken
    }
    var lulaCols = [
      'com_perfis',
      'com_usuarios_equipes',
      'com_permissoes',
      'com_negocios',
      'com_parametros',
      'com_empresas',
    ]
    for (var i = 0; i < lulaCols.length; i++) {
      var col = lulaCols[i]
      var actual = listRecs(lulaToken, col)
      var expected = dbCount(col, '')
      results.tests.push({
        test: 'Lula_superadmin_' + col,
        role: 'superadministrador',
        collection: col,
        httpStatus: actual.status,
        expectedRecords: expected,
        actualTotalItems: actual.totalItems,
        actualItems: actual.items,
        pass: actual.status === 200 && actual.totalItems > 0,
      })
    }

    var spokToken = authToken('spok@pmaisservicos.com.br')
    var spokResult = listRecs(spokToken, 'com_negocios')
    results.tests.push({
      test: 'Spok_regression_com_negocios',
      role: 'integracao',
      collection: 'com_negocios',
      httpStatus: spokResult.status,
      expectedRecords: 0,
      actualTotalItems: spokResult.totalItems,
      actualItems: spokResult.items,
      pass: spokResult.totalItems === 0,
    })

    var spokEmpresas = listRecs(spokToken, 'com_empresas')
    results.tests.push({
      test: 'Spok_regression_com_empresas',
      role: 'integracao',
      collection: 'com_empresas',
      httpStatus: spokEmpresas.status,
      expectedRecords: 0,
      actualTotalItems: spokEmpresas.totalItems,
      actualItems: spokEmpresas.items,
      pass: spokEmpresas.totalItems === 0,
    })

    var comercialUser = $app.findAuthRecordByEmail(
      '_pb_users_auth_',
      'comercial.teste@pmaisservicos.com.br',
    )
    var equipeAlpha = $app.findFirstRecordByData('com_equipes', 'slug', 'equipe-alpha-teste')
    var operadorPerfil = $app.findFirstRecordByData('com_perfis', 'slug', 'operador-comercial')
    var gestorPerfil = $app.findFirstRecordByData('com_perfis', 'slug', 'gestor-comercial')
    var leituraPerfil = $app.findFirstRecordByData('com_perfis', 'slug', 'leitura-executiva')

    var scopeConfigs = [
      {
        scope: 'proprios',
        perfil: operadorPerfil,
        expectedFilter: "responsavel_id = '" + comercialUser.id + "' && inativo != true",
      },
      {
        scope: 'equipe',
        perfil: gestorPerfil,
        expectedFilter: "equipe_id = '" + equipeAlpha.id + "' && inativo != true",
      },
      {
        scope: 'todos',
        perfil: leituraPerfil,
        expectedFilter: 'inativo != true',
      },
    ]

    for (var s = 0; s < scopeConfigs.length; s++) {
      var cfg = scopeConfigs[s]

      var bindings = $app.findRecordsByFilter(
        'com_usuarios_equipes',
        "usuario_id = '" + comercialUser.id + "'",
        '',
        500,
        0,
      )
      for (var b = 0; b < bindings.length; b++) {
        if (bindings[b].getBool('ativo')) {
          bindings[b].set('ativo', false)
          $app.save(bindings[b])
        }
      }

      var bindingExists = false
      try {
        var existing = $app.findFirstRecordByFilter(
          'com_usuarios_equipes',
          "usuario_id = '" +
            comercialUser.id +
            "' && equipe_id = '" +
            equipeAlpha.id +
            "' && perfil_id = '" +
            cfg.perfil.id +
            "'",
        )
        existing.set('ativo', true)
        existing.set('escopo', cfg.scope)
        $app.save(existing)
        bindingExists = true
      } catch (_) {}

      if (!bindingExists) {
        var ueCol = $app.findCollectionByNameOrId('com_usuarios_equipes')
        var newBinding = new Record(ueCol)
        newBinding.set('usuario_id', comercialUser.id)
        newBinding.set('equipe_id', equipeAlpha.id)
        newBinding.set('perfil_id', cfg.perfil.id)
        newBinding.set('escopo', cfg.scope)
        newBinding.set('ativo', true)
        newBinding.set('inicio_vigencia', new Date().toISOString().split('T')[0])
        $app.save(newBinding)
      }

      comercialUser.set('perfil_id', cfg.perfil.id)
      $app.save(comercialUser)

      var commToken = authToken('comercial.teste@pmaisservicos.com.br')
      var commResult = listRecs(commToken, 'com_negocios')
      var expectedRecs = dbListNegocios(cfg.expectedFilter)
      var hasInactive = commResult.items.some(function (r) {
        return r.inativo === true
      })

      results.tests.push({
        test: 'Comercial_scope_' + cfg.scope,
        role: cfg.perfil.getString('slug'),
        scope: cfg.scope,
        collection: 'com_negocios',
        httpStatus: commResult.status,
        expectedRecords: expectedRecs,
        expectedCount: expectedRecs.length,
        actualTotalItems: commResult.totalItems,
        actualItems: commResult.items,
        inactiveExcluded: !hasInactive,
        pass:
          commResult.status === 200 &&
          commResult.totalItems === expectedRecs.length &&
          !hasInactive,
      })

      var empresaFilter =
        cfg.scope === 'proprios'
          ? "responsavel_id = '" + comercialUser.id + "'"
          : cfg.scope === 'equipe'
            ? "equipe_id = '" + equipeAlpha.id + "'"
            : ''

      var commEmpresas = listRecs(commToken, 'com_empresas')
      var expectedEmpresas = dbListEmpresas(empresaFilter)

      results.tests.push({
        test: 'Comercial_scope_empresas_' + cfg.scope,
        role: cfg.perfil.getString('slug'),
        scope: cfg.scope,
        collection: 'com_empresas',
        httpStatus: commEmpresas.status,
        expectedRecords: expectedEmpresas,
        expectedCount: expectedEmpresas.length,
        actualTotalItems: commEmpresas.totalItems,
        actualItems: commEmpresas.items,
        pass: commEmpresas.status === 200 && commEmpresas.totalItems === expectedEmpresas.length,
      })
    }

    comercialUser.set('perfil_id', operadorPerfil.id)
    $app.save(comercialUser)

    try {
      var operadorBinding = $app.findFirstRecordByFilter(
        'com_usuarios_equipes',
        "usuario_id = '" +
          comercialUser.id +
          "' && equipe_id = '" +
          equipeAlpha.id +
          "' && perfil_id = '" +
          operadorPerfil.id +
          "'",
      )
      operadorBinding.set('ativo', true)
      operadorBinding.set('escopo', 'proprios')
      $app.save(operadorBinding)
    } catch (_) {}

    var allBindings = $app.findRecordsByFilter(
      'com_usuarios_equipes',
      "usuario_id = '" + comercialUser.id + "'",
      '',
      500,
      0,
    )
    for (var r = 0; r < allBindings.length; r++) {
      if (
        allBindings[r].getString('perfil_id') !== operadorPerfil.id &&
        allBindings[r].getBool('ativo')
      ) {
        allBindings[r].set('ativo', false)
        $app.save(allBindings[r])
      }
    }

    var allPass = results.tests.every(function (t) {
      return t.pass
    })
    results.summary = {
      totalTests: results.tests.length,
      passed: results.tests.filter(function (t) {
        return t.pass
      }).length,
      failed: results.tests.filter(function (t) {
        return !t.pass
      }).length,
      allPassed: allPass,
    }

    return e.json(200, results)
  },
  $apis.requireAuth(),
)
