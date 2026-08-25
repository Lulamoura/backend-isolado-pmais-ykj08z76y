routerAdd(
  'GET',
  '/backend/v1/my-permissions',
  (e) => {
    var userId = e.auth ? e.auth.id : ''
    if (!userId) return e.unauthorizedError('Autenticacao necessaria')

    var now = new Date().toISOString().split('T')[0]
    var permissions = {}
    var profileSlug = ''

    // Check direct perfil_id on user auth record
    if (e.auth) {
      var userPerfilId = e.auth.getString('perfil_id')
      if (userPerfilId) {
        try {
          var userPerfil = $app.findRecordById('com_perfis', userPerfilId)
          if (userPerfil && userPerfil.getBool('ativo')) {
            profileSlug = userPerfil.getString('slug')
            var directLinks = $app.findRecordsByFilter(
              'com_perfil_permissoes',
              "perfil_id = '" + userPerfilId + "'",
              '',
              500,
              0,
            )
            for (var k = 0; k < directLinks.length; k++) {
              var permIdDirect = directLinks[k].getString('permissao_id')
              var scopeDirect = directLinks[k].getString('escopo')
              try {
                var permDirect = $app.findRecordById('com_permissoes', permIdDirect)
                var slugDirect = permDirect.getString('slug')
                permissions[slugDirect] = scopeDirect
              } catch (_) {}
            }
          }
        } catch (_) {}
      }
    }

    // Check com_usuarios_equipes bindings
    try {
      var bindings = $app.findRecordsByFilter(
        'com_usuarios_equipes',
        "usuario_id = '" + userId + "' && ativo = true",
        '',
        500,
        0,
      )

      for (var i = 0; i < bindings.length; i++) {
        var binding = bindings[i]
        var inicio = binding.getString('inicio_vigencia')
        var fim = binding.getString('fim_vigencia')

        if (inicio && now < inicio.split('T')[0]) continue
        if (fim && now > fim.split('T')[0]) continue

        var perfilId = binding.getString('perfil_id')

        try {
          var links = $app.findRecordsByFilter(
            'com_perfil_permissoes',
            "perfil_id = '" + perfilId + "'",
            '',
            500,
            0,
          )

          for (var j = 0; j < links.length; j++) {
            var permId = links[j].getString('permissao_id')
            var scope = links[j].getString('escopo')

            try {
              var perm = $app.findRecordById('com_permissoes', permId)
              var slug = perm.getString('slug')

              if (
                !permissions[slug] ||
                scope === 'todos' ||
                (scope === 'equipe' && permissions[slug] === 'proprios')
              ) {
                permissions[slug] = scope
              }
            } catch (_) {}
          }
        } catch (_) {}
      }
    } catch (_) {}

    // Safety fallback: if user is superadministrador, grant all permissions in com_permissoes
    try {
      var isSuperAdmin = false
      if (e.auth && e.auth.getString('perfil_id')) {
        try {
          var pRec = $app.findRecordById('com_perfis', e.auth.getString('perfil_id'))
          if (pRec && pRec.getString('slug') === 'superadministrador') {
            isSuperAdmin = true
          }
        } catch (_) {}
      }

      if (!isSuperAdmin) {
        try {
          var saProfil = $app.findFirstRecordByData('com_perfis', 'slug', 'superadministrador')
          if (saProfil) {
            var saBindings = $app.findRecordsByFilter(
              'com_usuarios_equipes',
              "usuario_id = '" + userId + "' && perfil_id = '" + saProfil.id + "' && ativo = true",
              '',
              1,
              0,
            )
            if (saBindings && saBindings.length > 0) {
              isSuperAdmin = true
            }
          }
        } catch (_) {}
      }

      if (isSuperAdmin) {
        var allPerms = $app.findRecordsByFilter('com_permissoes', '', '', 500, 0)
        for (var p = 0; p < allPerms.length; p++) {
          var pSlug = allPerms[p].getString('slug')
          permissions[pSlug] = 'todos'
        }
      }
    } catch (_) {}

    if (!profileSlug) return e.forbiddenError('Perfil comercial ativo nao encontrado')
    return e.json(200, { permissions: permissions, perfil_slug: profileSlug })
  },
  $apis.requireAuth(),
)
