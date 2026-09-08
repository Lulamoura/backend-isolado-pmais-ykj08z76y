// Opções humanas de negócios para cobertura/substituição
// Endpoint: GET /backend/v1/negocios/opcoes-cobertura

routerAdd(
  'GET',
  '/backend/v1/negocios/opcoes-cobertura',
  (e) => {
    var ator = e.auth
    if (!ator) return e.unauthorizedError('Autenticacao necessaria')

    function esc(value) {
      return String(value || '')
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
    }

    function norm(value) {
      return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
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

    function podeListar(atorRec, titularRec) {
      var slug = getPerfilSlug(atorRec)
      if (slug === 'superadministrador' || slug === 'aprovador' || slug === 'leitura-executiva') {
        return true
      }
      if (slug === 'gestor' || slug === 'gestor-comercial') {
        return (
          atorRec.getString('equipe_id') &&
          atorRec.getString('equipe_id') === titularRec.getString('equipe_id')
        )
      }
      // Operadores só enxergam os próprios negócios por segurança.
      return atorRec.id === titularRec.id
    }

    function recString(rec, field) {
      try {
        return rec.getString(field) || ''
      } catch (_) {
        return ''
      }
    }

    function recBool(rec, field) {
      try {
        return rec.getBool(field) === true
      } catch (_) {
        return false
      }
    }

    function findNome(collection, id) {
      if (!id) return ''
      try {
        return $app.findRecordById(collection, id).getString('nome') || ''
      } catch (_) {
        return ''
      }
    }

    function findExternalBusinessId(negocioId) {
      try {
        var vinculos = $app.findRecordsByFilter(
          'com_vinculos_externos',
          "collection_name = 'com_negocios' && record_id = '" +
            esc(negocioId) +
            "' && sistema_origem = 'activecampaign' && external_type = 'business'",
          '',
          1,
          0,
        )
        if (vinculos && vinculos.length > 0) return vinculos[0].getString('external_id') || ''
      } catch (_) {}
      return ''
    }

    function isGenericTitulo(titulo) {
      return (
        String(titulo || '')
          .trim()
          .toLowerCase() === 'proposta qualificada'
      )
    }

    function buildOption(rec) {
      var empresa = findNome('com_empresas', recString(rec, 'empresa_id'))
      var contato = findNome('com_contatos', recString(rec, 'contato_principal_id'))
      var titulo = recString(rec, 'titulo')
      var oe = recString(rec, 'oe_numero')
      var external = findExternalBusinessId(rec.id) || recString(rec, 'external_id')
      var etapa = recString(rec, 'etapa').replace(/_/g, ' ')
      var identificador = oe || external
      var labelParts = []
      if (empresa) labelParts.push(empresa)
      else if (titulo && !isGenericTitulo(titulo)) labelParts.push(titulo)
      if (contato) labelParts.push(contato)
      if (identificador) labelParts.push('ID ' + identificador)
      var subtitleParts = []
      if (!empresa && isGenericTitulo(titulo)) subtitleParts.push(titulo)
      if (!identificador) subtitleParts.push('Sem ID externo')
      if (etapa) subtitleParts.push(etapa)
      return {
        id: rec.id,
        label: labelParts.join(' — ') || titulo || 'Negocio sem identificacao',
        subtitle: subtitleParts.join(' · '),
        external_id: external,
        oe_numero: oe,
        empresa_nome: empresa,
        contato_nome: contato,
        etapa: etapa,
      }
    }

    var titularId = e.request.URL.query().get('titular_id') || ''
    var q = e.request.URL.query().get('q') || ''
    if (!titularId) return e.json(400, { error: 'VALIDATION', message: 'titular_id obrigatorio' })

    var titular = null
    try {
      titular = $app.findRecordById('users', titularId)
    } catch (_) {}
    if (!titular) return e.json(404, { error: 'NOT_FOUND', message: 'titular nao encontrado' })
    if (!podeListar(ator, titular)) {
      return e.json(403, {
        error: 'FORBIDDEN',
        message: 'Sem permissao para listar negocios do titular',
      })
    }

    var records = []
    try {
      records = $app.findRecordsByFilter(
        'com_negocios',
        "responsavel_id = '" +
          esc(titularId) +
          "' && inativo != true && status = '' && resultado = ''",
        '-updated',
        100,
        0,
      )
    } catch (err) {
      return e.json(500, { error: 'INTERNAL', message: String(err).substring(0, 300) })
    }

    var query = norm(q)
    var items = []
    for (var i = 0; i < records.length; i++) {
      if (recBool(records[i], 'inativo')) continue
      if (recString(records[i], 'status') || recString(records[i], 'resultado')) continue
      var opt = buildOption(records[i])
      var haystack = norm(
        [opt.label, opt.subtitle, opt.id, opt.external_id, opt.oe_numero].join(' '),
      )
      if (query && haystack.indexOf(query) === -1) continue
      items.push(opt)
    }

    return e.json(200, { items: items, totalItems: items.length })
  },
  $apis.requireAuth(),
)
