// Opções humanas de usuários comerciais para combos operacionais
// Endpoint: GET /backend/v1/usuarios/opcoes-comerciais

routerAdd(
  'GET',
  '/backend/v1/usuarios/opcoes-comerciais',
  (e) => {
    var ator = e.auth
    if (!ator) return e.unauthorizedError('Autenticacao necessaria')

    function esc(value) {
      return String(value || '')
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
    }

    function norm(value) {
      return String(value || '').toLowerCase()
    }

    function getPerfilSlug(userRec) {
      try {
        var perfilId = userRec.getString('perfil_id')
        if (!perfilId) return ''
        return $app.findRecordById('com_perfis', perfilId).getString('slug')
      } catch (_) {
        return ''
      }
    }

    function hojeRecife() {
      return new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10)
    }

    function dataCivil(value) {
      if (!value) return ''
      return String(value).slice(0, 10)
    }

    function bindingVigente(inicio, fim, hoje) {
      var ini = dataCivil(inicio)
      var f = dataCivil(fim)
      if (ini && ini > hoje) return false
      if (f && f < hoje) return false
      return true
    }

    function perfilSlugById(id) {
      if (!id) return ''
      try {
        return $app.findRecordById('com_perfis', id).getString('slug')
      } catch (_) {
        return ''
      }
    }

    function equipesGeridasPorBinding(userId, hoje) {
      var equipes = {}
      try {
        var bindings = $app.findRecordsByFilter(
          'com_usuarios_equipes',
          "usuario_id = '" + esc(userId) + "' && ativo = true",
          '',
          200,
          0,
        )
        for (var i = 0; i < bindings.length; i++) {
          var slug = perfilSlugById(bindings[i].getString('perfil_id'))
          if (slug !== 'gestor' && slug !== 'gestor-comercial') continue
          if (!bindingVigente(bindings[i].getString('inicio_vigencia'), bindings[i].getString('fim_vigencia'), hoje)) continue
          var equipeId = bindings[i].getString('equipe_id')
          if (equipeId) equipes[equipeId] = true
        }
      } catch (_) {}
      return equipes
    }

    function filtroEquipes(equipes) {
      var ids = Object.keys(equipes || {})
      var partes = []
      for (var i = 0; i < ids.length; i++) partes.push("equipe_id = '" + esc(ids[i]) + "'")
      return partes.join(' || ')
    }

    var queryInfo = e.requestInfo().query || {}
    var q = String(queryInfo.q || '')
    var excludeId = String(queryInfo.exclude_id || '')
    var slug = getPerfilSlug(ator)
    var hoje = hojeRecife()
    var filtro = 'ativo_comercial = true'

    if (slug === 'superadministrador' || slug === 'aprovador' || slug === 'leitura-executiva') {
      // Mantém todos os usuários comerciais visíveis para perfis administrativos/leitura.
    } else if (slug === 'gestor' || slug === 'gestor-comercial') {
      var equipes = equipesGeridasPorBinding(ator.id, hoje)
      if (Object.keys(equipes).length === 0 && ator.getString('equipe_id')) equipes[ator.getString('equipe_id')] = true
      var fEq = filtroEquipes(equipes)
      if (!fEq) return e.json(200, { items: [], totalItems: 0 })
      filtro += ' && (' + fEq + ')'
    } else if (slug === 'operador-comercial' || slug === 'prospeccao') {
      filtro += " && id = '" + esc(ator.id) + "'"
    } else {
      return e.json(403, { error: 'FORBIDDEN', message: 'Sem permissao para listar usuarios comerciais' })
    }

    if (excludeId) filtro += " && id != '" + esc(excludeId) + "'"

    var records = []
    try {
      records = $app.findRecordsByFilter('users', filtro, 'name', 100, 0)
    } catch (err) {
      return e.json(500, { error: 'INTERNAL', message: String(err).substring(0, 300) })
    }

    var needle = norm(q)
    var items = []
    for (var r = 0; r < records.length; r++) {
      var name = records[r].getString('name') || ''
      var email = records[r].getString('email') || ''
      var haystack = norm(name + ' ' + email + ' ' + records[r].id)
      if (needle && haystack.indexOf(needle) === -1) continue
      items.push({ id: records[r].id, name: name || email || records[r].id })
      if (items.length >= 50) break
    }

    return e.json(200, { items: items, totalItems: items.length })
  },
  $apis.requireAuth(),
)
