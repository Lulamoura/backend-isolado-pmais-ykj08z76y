routerAdd(
  'GET',
  '/backend/v1/integracao/ac/precheck',
  (e) => {
    var authId = e.auth ? e.auth.id : ''
    if (!authId) return e.unauthorizedError('Autenticacao necessaria')

    var isSuperAdmin = false
    try {
      var authPerfilId = e.auth.getString('perfil_id')
      if (authPerfilId) {
        var perfilRec = $app.findRecordById('com_perfis', authPerfilId)
        if (perfilRec.getString('slug') === 'superadministrador') isSuperAdmin = true
      }
    } catch (_) {}
    if (!isSuperAdmin) {
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
          if (saBindings && saBindings.length > 0) isSuperAdmin = true
        }
      } catch (_) {}
    }
    if (!isSuperAdmin)
      return e.forbiddenError('Apenas superadministrador pode executar o pre-check')

    var secretNames = ['AC_API_URL', 'AC_API_KEY', 'AC_WEBHOOK_SECRET']
    var secrets = {}
    var allPresent = true
    var absent = []
    for (var i = 0; i < secretNames.length; i++) {
      var present = $secrets.has(secretNames[i])
      secrets[secretNames[i]] = present ? 'PRESENTE' : 'AUSENTE'
      if (!present) {
        allPresent = false
        absent.push(secretNames[i])
      }
    }

    var hs256Test = { tested: false, passed: false, error: '' }
    try {
      var actualHmac = $security.hs256('what do ya want for nothing?', 'Jefe')
      hs256Test.tested = true
      hs256Test.passed =
        actualHmac === '5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843'
      if (!hs256Test.passed) hs256Test.error = 'Output mismatch — expected RFC 4231 Test Case 2'
    } catch (err) {
      hs256Test.tested = true
      hs256Test.error = String(err).substring(0, 200)
    }

    var integracaoCheck = {
      profileExists: false,
      profileActive: false,
      accountCount: 0,
      uniqueAccount: false,
    }
    try {
      var intPerfil = $app.findFirstRecordByData('com_perfis', 'slug', 'integracao')
      integracaoCheck.profileExists = true
      integracaoCheck.profileActive = intPerfil.getBool('ativo')
      var intUsers = $app.findRecordsByFilter(
        'users',
        "perfil_id = '" + intPerfil.id + "'",
        '',
        100,
        0,
      )
      integracaoCheck.accountCount = intUsers.length
      integracaoCheck.uniqueAccount = intUsers.length === 1
    } catch (_) {}

    function safeCount(n) {
      try {
        return $app.countRecords(n)
      } catch (_) {
        return -1
      }
    }
    var counts = {
      eventos_integracao: safeCount('com_eventos_integracao'),
      execucoes_sincronizacao: safeCount('com_execucoes_sincronizacao'),
      vinculos_externos: safeCount('com_vinculos_externos'),
      negocios: safeCount('com_negocios'),
      snapshots_negocio: safeCount('com_snapshots_negocio'),
      ocorrencias_qualidade: safeCount('com_ocorrencias_qualidade'),
    }

    var webhookEnabled = false
    try {
      var flagParam = $app.findFirstRecordByData('com_parametros', 'chave', 'ac_webhook_enabled')
      if (flagParam && flagParam.getString('valor') === 'true' && flagParam.getBool('ativo'))
        webhookEnabled = true
    } catch (_) {}

    return e.json(200, {
      stage: 'porta-2d-etapa-2a',
      secrets: secrets,
      allPresent: allPresent,
      ready: allPresent && hs256Test.passed,
      absentSecrets: absent,
      hs256Test: hs256Test,
      integracaoCheck: integracaoCheck,
      counts: counts,
      webhookEnabled: webhookEnabled,
      zeroExternalTraffic: true,
      zeroRealData: true,
      message: allPresent
        ? 'Secrets presentes. Pronto para matriz de testes.'
        : 'Secrets ausentes: ' + absent.join(', '),
    })
  },
  $apis.requireAuth(),
)
