// G39-E2C-C3B3B-R3 — Fila de negócios sem cobertura (somente leitura)
// Endpoint: GET /backend/v1/fila/sem-cobertura
//
// Hook EXCLUSIVAMENTE de leitura. ZERO $app.save, runInTransaction, INSERT,
// UPDATE, DELETE, com_auditoria, com_idempotencia, scheduler.
//
// LIST-only — sem ?id, sem VIEW.
//
// RBAC:
//   1. SA direto (perfil do ator = superadministrador) → acesso total
//   2. Fallback SA via binding ativo+vigente → acesso total
//   3. gestor/gestor-comercial com binding ativo+vigente → negócios das
//      equipes geridas
//   4. demais → 403 FORBIDDEN
//
// ativo_comercial = true obrigatório para todos (inclusive SA direto).

routerAdd(
  'GET',
  '/backend/v1/fila/sem-cobertura',
  (e) => {
    // ═══════ HELPERS (escopo do hook) ═══════

    // hojeRecife — guarda temporal determinística.
    // ⚠️ FUTURO: se o Brasil reintroduzir DST ou alterar o fuso de Recife,
    //    esta constante deverá ser revisada.
    function hojeRecife(nowMs) {
      var ms = typeof nowMs === 'number' ? nowMs : Date.now()
      var recifeMs = ms - 3 * 60 * 60 * 1000
      return new Date(recifeMs).toISOString().slice(0, 10)
    }

    // bindingVigente — função pura. Comparação inclusiva:
    //   inicio_vigencia vazio ou <= hojeCivil
    //   fim_vigencia    vazio ou >= hojeCivil
    function bindingVigente(inicio, fim, hojeCivil) {
      if (inicio && inicio > hojeCivil) return false
      if (fim && fim < hojeCivil) return false
      return true
    }

    // resolverFallbackSuperadmin — função pura. Considera somente bindings
    // ativos, com perfilSlug 'superadministrador' e vigentes.
    function resolverFallbackSuperadmin(bindings, hojeCivil) {
      if (!bindings || bindings.length === 0) return false
      for (var i = 0; i < bindings.length; i++) {
        var b = bindings[i]
        if (b.ativo !== true) continue
        if (b.perfilSlug !== 'superadministrador') continue
        if (!bindingVigente(b.inicio_vigencia, b.fim_vigencia, hojeCivil)) continue
        return true
      }
      return false
    }

    // validarUsuario — função pura. Perfil direto superadministrador TAMBÉM
    // exige ativo_comercial = true.
    function validarUsuario(usuario) {
      if (!usuario) return { aprovado: false, motivo: 'usuario_inexistente' }
      if (usuario.ativo_comercial !== true) return { aprovado: false, motivo: 'comercial_inativo' }
      return { aprovado: true, motivo: 'ok' }
    }

    // comporFiltro — compõe fragmentos com ' && ', envolvendo em parênteses
    // os fragmentos que contenham ' || '.
    function comporFiltro(fragmentos) {
      var partes = []
      for (var i = 0; i < fragmentos.length; i++) {
        var f = fragmentos[i]
        if (!f) continue
        if (f.indexOf(' || ') !== -1) f = '(' + f + ')'
        partes.push(f)
      }
      if (partes.length === 0) return ''
      return partes.join(' && ')
    }

    // construirSort — campo solicitado + tiebreak determinístico
    // (created DESC, id ASC). Não duplica created se já for o campo.
    function construirSort(ordenarPor, ordem) {
      var campo = ordenarPor || 'created'
      var desc = ordem !== 'asc'
      var primary = (desc ? '-' : '') + campo
      if (campo === 'created') return primary + ',id'
      return primary + ',-created,id'
    }

    // validarQuery — allowlist estrita (LIST-only). Retorna { valido, params }
    // ou { valido: false, erro: 'VALIDATION' }.
    function validarQuery(query) {
      var allow = ['pagina', 'por_pagina', 'ordenar_por', 'ordem']
      var params = {}
      if (!query) return { valido: true, params: params }
      var keys = Object.keys(query)
      for (var i = 0; i < keys.length; i++) {
        if (allow.indexOf(keys[i]) === -1) return { valido: false, erro: 'VALIDATION' }
      }
      var pagina = 1
      if (query.pagina !== undefined) {
        var p = parseInt(query.pagina, 10)
        if (isNaN(p) || p < 1) return { valido: false, erro: 'VALIDATION' }
        pagina = p
      }
      params.pagina = pagina
      var porPagina = 20
      if (query.por_pagina !== undefined) {
        var pp = parseInt(query.por_pagina, 10)
        if (isNaN(pp) || pp < 1 || pp > 50) return { valido: false, erro: 'VALIDATION' }
        porPagina = pp
      }
      params.por_pagina = porPagina
      var ordenarPor = 'created'
      if (query.ordenar_por !== undefined) {
        if (['titulo', 'valor', 'etapa', 'created'].indexOf(query.ordenar_por) === -1)
          return { valido: false, erro: 'VALIDATION' }
        ordenarPor = query.ordenar_por
      }
      params.ordenar_por = ordenarPor
      var ordem = 'desc'
      if (query.ordem !== undefined) {
        if (query.ordem !== 'asc' && query.ordem !== 'desc')
          return { valido: false, erro: 'VALIDATION' }
        ordem = query.ordem
      }
      params.ordem = ordem
      return { valido: true, params: params }
    }

    // construirFiltroResponsaveis — fragmento OR sobre responsavel_id.
    function construirFiltroResponsaveis(ids) {
      if (!ids || ids.length === 0) return ''
      var partes = []
      for (var i = 0; i < ids.length; i++) {
        partes.push("responsavel_id = '" + ids[i] + "'")
      }
      return partes.join(' || ')
    }

    // construirFiltroGestorEquipes — fragmento OR sobre equipe_id.
    function construirFiltroGestorEquipes(ids) {
      if (!ids || ids.length === 0) return ''
      var partes = []
      for (var i = 0; i < ids.length; i++) {
        partes.push("equipe_id = '" + ids[i] + "'")
      }
      return partes.join(' || ')
    }

    // construirFiltroQ1 — ausências vigentes SEM cobertura.
    function construirFiltroQ1(hoje) {
      return "cancelada_em = null && data_inicio <= '" + hoje + "' && data_fim >= '" + hoje + "'"
    }

    // isSemCobertura — JSVM: substituto_principal_id vazio.
    function isSemCobertura(rec) {
      return rec.getString('substituto_principal_id') === ''
    }

    // isAusenciaVigente — datas inclusivas.
    function isAusenciaVigente(dataInicio, dataFim, hoje) {
      if (dataInicio && dataInicio > hoje) return false
      if (dataFim && dataFim < hoje) return false
      return true
    }

    // coletarTitularesSemCobertura — dedupe titular_id das ausências vigentes
    // sem substituto principal.
    function coletarTitularesSemCobertura(recs) {
      var ids = []
      var seen = {}
      if (!recs) return ids
      for (var i = 0; i < recs.length; i++) {
        var r = recs[i]
        if (!isSemCobertura(r)) continue
        var tid = r.getString('titular_id')
        if (tid && !seen[tid]) {
          seen[tid] = true
          ids.push(tid)
        }
      }
      return ids
    }

    // elegivelNegocio — negócio cujo responsável está em ausência sem cobertura.
    function elegivelNegocio(negocio, titularesSemCobertura) {
      if (!negocio) return false
      if (negocio.inativo === true) return false
      if (!negocio.responsavel_id) return false
      if (!titularesSemCobertura || titularesSemCobertura.length === 0) return false
      return titularesSemCobertura.indexOf(negocio.responsavel_id) !== -1
    }

    function calcularPaginacao(pagina, porPagina) {
      var p = pagina || 1
      var pp = porPagina || 20
      return { limit: pp + 1, offset: (p - 1) * pp }
    }

    function calcularHasMore(resultsLen, porPagina) {
      return resultsLen > porPagina
    }

    function redatorUser(user) {
      if (!user) return null
      return { id: user.id, name: user.name }
    }

    function redatorEquipe(eq) {
      if (!eq) return null
      return { id: eq.id, nome: eq.nome }
    }

    function redatorAusencia(rec) {
      if (!rec) return null
      return {
        id: rec.id,
        data_inicio: rec.getString('data_inicio'),
        data_fim: rec.getString('data_fim'),
        motivo: rec.getString('motivo'),
      }
    }

    function deveBatch(ids) {
      return !!ids && ids.length > 0
    }

    function limiteBatchUsers() {
      return 200
    }

    function limiteBatchEquipes() {
      return 50
    }

    function limiteBatchQ1() {
      return 500
    }

    function batchUsers(ids) {
      var map = {}
      if (!deveBatch(ids)) return map
      var partes = []
      for (var i = 0; i < ids.length; i++) partes.push("id = '" + ids[i] + "'")
      try {
        var recs = $app.findRecordsByFilter('users', partes.join(' || '), '', limiteBatchUsers(), 0)
        for (var j = 0; j < recs.length; j++) {
          map[recs[j].id] = { id: recs[j].id, name: recs[j].getString('name') }
        }
      } catch (_) {}
      return map
    }

    function batchEquipes(ids) {
      var map = {}
      if (!deveBatch(ids)) return map
      var partes = []
      for (var i = 0; i < ids.length; i++) partes.push("id = '" + ids[i] + "'")
      try {
        var recs = $app.findRecordsByFilter(
          'com_equipes',
          partes.join(' || '),
          '',
          limiteBatchEquipes(),
          0,
        )
        for (var j = 0; j < recs.length; j++) {
          map[recs[j].id] = { id: recs[j].id, nome: recs[j].getString('nome') }
        }
      } catch (_) {}
      return map
    }

    function shapeItem(rec, userMap, equipeMap, ausenciaMap) {
      var responsavelId = rec.getString('responsavel_id')
      var equipeId = rec.getString('equipe_id')
      return {
        id: rec.id,
        titulo: rec.getString('titulo'),
        valor: rec.get('valor'),
        etapa: rec.getString('etapa'),
        responsavel: responsavelId ? userMap[responsavelId] || null : null,
        equipe: equipeId ? equipeMap[equipeId] || null : null,
        ausencia: responsavelId ? ausenciaMap[responsavelId] || null : null,
      }
    }

    // ═══════ FASE 1 — AUTENTICAÇÃO + VALIDAÇÃO USUÁRIO ═══════

    var ator = e.auth
    if (!ator) return e.unauthorizedError('Autenticacao necessaria')
    var atorId = ator.id

    var valUsuario = validarUsuario({ ativo_comercial: ator.getBool('ativo_comercial') })
    if (!valUsuario.aprovado) return e.json(403, { error: 'FORBIDDEN' })

    // ═══════ FASE 2 — PERFIL DO ATOR + BINDINGS ═══════

    var hoje = hojeRecife()
    var atorPerfilSlug = ''
    try {
      var authPerfilId = ator.getString('perfil_id')
      if (authPerfilId) {
        var perfilRec = $app.findRecordById('com_perfis', authPerfilId)
        atorPerfilSlug = perfilRec.getString('slug')
      }
    } catch (_) {}

    var bindingsArr = []
    try {
      var foundBindings = $app.findRecordsByFilter(
        'com_usuarios_equipes',
        "usuario_id = '" + atorId + "' && ativo = true",
        '',
        500,
        0,
      )
      for (var bi = 0; bi < foundBindings.length; bi++) {
        var bRec = foundBindings[bi]
        var bPerfilSlug = ''
        try {
          var bPerfilRec = $app.findRecordById('com_perfis', bRec.getString('perfil_id'))
          bPerfilSlug = bPerfilRec.getString('slug')
        } catch (_) {}
        var inicioVig = bRec.getString('inicio_vigencia')
        var fimVig = bRec.getString('fim_vigencia')
        bindingsArr.push({
          equipe_id: bRec.getString('equipe_id'),
          perfilSlug: bPerfilSlug,
          ativo: bRec.getBool('ativo'),
          vigente: bindingVigente(inicioVig, fimVig, hoje),
          inicio_vigencia: inicioVig,
          fim_vigencia: fimVig,
        })
      }
    } catch (_) {}

    // SA direto ou fallback via binding ativo+vigente
    var isSA = atorPerfilSlug === 'superadministrador'
    if (!isSA && resolverFallbackSuperadmin(bindingsArr, hoje)) isSA = true

    // ═══════ FASE 3 — QUERY STRING (allowlist estrita) ═══════

    var query = e.requestInfo().query || {}
    var vq = validarQuery(query)
    if (!vq.valido) return e.json(400, { error: 'VALIDATION' })
    var params = vq.params

    // ═══════ FASE 4 — RBAC GATE ═══════

    var filtroRBAC = ''
    var equipesGeridas = []

    if (isSA) {
      filtroRBAC = ''
    } else {
      // Verifica binding de gestor ativo+vigente
      var hasGestorBinding = false
      var equipesGeridasMap = {}
      for (var gi = 0; gi < bindingsArr.length; gi++) {
        var gb = bindingsArr[gi]
        if (
          (gb.perfilSlug === 'gestor' || gb.perfilSlug === 'gestor-comercial') &&
          gb.ativo === true &&
          gb.vigente === true
        ) {
          hasGestorBinding = true
          if (gb.equipe_id) equipesGeridasMap[gb.equipe_id] = true
        }
      }
      if (!hasGestorBinding) {
        return e.json(403, { error: 'FORBIDDEN' })
      }
      equipesGeridas = Object.keys(equipesGeridasMap)
      if (equipesGeridas.length === 0) {
        // Gestor sem equipes geridas → lista vazia imediata
        return e.json(200, {
          negocios_sem_cobertura: [],
          pagina: params.pagina,
          por_pagina: params.por_pagina,
          has_more: false,
        })
      }
      filtroRBAC = construirFiltroGestorEquipes(equipesGeridas)
    }

    // ═══════ FASE 5 — Q1: AUSÊNCIAS VIGENTES SEM COBERTURA ═══════

    var filtroQ1 = construirFiltroQ1(hoje)
    var titularesSemCobertura = []
    var seenTitular = {}
    var ausenciaMap = {}
    var q1Offset = 0
    var q1Batch
    do {
      try {
        q1Batch = $app.findRecordsByFilter(
          'com_substituicoes',
          filtroQ1,
          '',
          limiteBatchQ1(),
          q1Offset,
        )
      } catch (_) {
        q1Batch = []
      }
      for (var qi = 0; qi < q1Batch.length; qi++) {
        var ausRec = q1Batch[qi]
        if (!isSemCobertura(ausRec)) continue
        var titularId = ausRec.getString('titular_id')
        if (titularId && !seenTitular[titularId]) {
          seenTitular[titularId] = true
          titularesSemCobertura.push(titularId)
          ausenciaMap[titularId] = ausRec
        }
      }
      q1Offset += limiteBatchQ1()
    } while (q1Batch.length === limiteBatchQ1())

    // Sem titulares em ausência sem cobertura → lista vazia
    if (titularesSemCobertura.length === 0) {
      return e.json(200, {
        negocios_sem_cobertura: [],
        pagina: params.pagina,
        por_pagina: params.por_pagina,
        has_more: false,
      })
    }

    // ═══════ FASE 6 — Q2: NEGÓCIOS PAGINADOS ═══════

    var filtroResponsaveis = construirFiltroResponsaveis(titularesSemCobertura)
    var filtroFinal = comporFiltro([filtroRBAC, filtroResponsaveis, 'inativo = false'])

    var sort = construirSort(params.ordenar_por, params.ordem)
    var pag = calcularPaginacao(params.pagina, params.por_pagina)

    var results = []
    try {
      results = $app.findRecordsByFilter('com_negocios', filtroFinal, sort, pag.limit, pag.offset)
    } catch (_) {}

    var hasMore = calcularHasMore(results.length, params.por_pagina)
    var page = results.slice(0, params.por_pagina)

    // ═══════ FASE 7 — ANTI-N+1 ═══════

    // B1 — Users batch: responsavel_id de cada negócio + autor_id da ausência
    var userIds = []
    var seenUser = {}
    for (var pi = 0; pi < page.length; pi++) {
      var rid = page[pi].getString('responsavel_id')
      if (rid && !seenUser[rid]) {
        seenUser[rid] = true
        userIds.push(rid)
      }
    }
    for (var tk = 0; tk < titularesSemCobertura.length; tk++) {
      var tid2 = titularesSemCobertura[tk]
      if (!seenUser[tid2]) {
        seenUser[tid2] = true
        userIds.push(tid2)
      }
      // autor_id da ausência
      var ausRec2 = ausenciaMap[tid2]
      if (ausRec2) {
        var autorId = ausRec2.getString('autor_id')
        if (autorId && !seenUser[autorId]) {
          seenUser[autorId] = true
          userIds.push(autorId)
        }
      }
    }
    var userMap = batchUsers(userIds)

    // B2 — Equipes batch: equipe_id de cada negócio
    var equipeIds = []
    var seenEq = {}
    for (var ei = 0; ei < page.length; ei++) {
      var eqId = page[ei].getString('equipe_id')
      if (eqId && !seenEq[eqId]) {
        seenEq[eqId] = true
        equipeIds.push(eqId)
      }
    }
    var equipeMap = batchEquipes(equipeIds)

    // ═══════ FASE 8 — SHAPE + RESPOSTA ═══════

    var items = []
    for (var ii = 0; ii < page.length; ii++) {
      items.push(shapeItem(page[ii], userMap, equipeMap, ausenciaMap))
    }

    return e.json(200, {
      negocios_sem_cobertura: items,
      pagina: params.pagina,
      por_pagina: params.por_pagina,
      has_more: hasMore,
    })
  },
  $apis.requireAuth(),
)

/* ──── BLOCO DE TESTES ESTÁTICOS ──── */
var __testExports = (function () {
  function hojeRecife(nowMs) {
    var ms = typeof nowMs === 'number' ? nowMs : Date.now()
    var recifeMs = ms - 3 * 60 * 60 * 1000
    return new Date(recifeMs).toISOString().slice(0, 10)
  }

  function bindingVigente(inicio, fim, hojeCivil) {
    if (inicio && inicio > hojeCivil) return false
    if (fim && fim < hojeCivil) return false
    return true
  }

  function resolverFallbackSuperadmin(bindings, hojeCivil) {
    if (!bindings || bindings.length === 0) return false
    for (var i = 0; i < bindings.length; i++) {
      var b = bindings[i]
      if (b.ativo !== true) continue
      if (b.perfilSlug !== 'superadministrador') continue
      if (!bindingVigente(b.inicio_vigencia, b.fim_vigencia, hojeCivil)) continue
      return true
    }
    return false
  }

  function validarUsuario(usuario) {
    if (!usuario) return { aprovado: false, motivo: 'usuario_inexistente' }
    if (usuario.ativo_comercial !== true) return { aprovado: false, motivo: 'comercial_inativo' }
    return { aprovado: true, motivo: 'ok' }
  }

  function comporFiltro(fragmentos) {
    var partes = []
    for (var i = 0; i < fragmentos.length; i++) {
      var f = fragmentos[i]
      if (!f) continue
      if (f.indexOf(' || ') !== -1) f = '(' + f + ')'
      partes.push(f)
    }
    if (partes.length === 0) return ''
    return partes.join(' && ')
  }

  function construirSort(ordenarPor, ordem) {
    var campo = ordenarPor || 'created'
    var desc = ordem !== 'asc'
    var primary = (desc ? '-' : '') + campo
    if (campo === 'created') return primary + ',id'
    return primary + ',-created,id'
  }

  function validarQuery(query) {
    var allow = ['pagina', 'por_pagina', 'ordenar_por', 'ordem']
    var params = {}
    if (!query) return { valido: true, params: params }
    var keys = Object.keys(query)
    for (var i = 0; i < keys.length; i++) {
      if (allow.indexOf(keys[i]) === -1) return { valido: false, erro: 'VALIDATION' }
    }
    var pagina = 1
    if (query.pagina !== undefined) {
      var p = parseInt(query.pagina, 10)
      if (isNaN(p) || p < 1) return { valido: false, erro: 'VALIDATION' }
      pagina = p
    }
    params.pagina = pagina
    var porPagina = 20
    if (query.por_pagina !== undefined) {
      var pp = parseInt(query.por_pagina, 10)
      if (isNaN(pp) || pp < 1 || pp > 50) return { valido: false, erro: 'VALIDATION' }
      porPagina = pp
    }
    params.por_pagina = porPagina
    var ordenarPor = 'created'
    if (query.ordenar_por !== undefined) {
      if (['titulo', 'valor', 'etapa', 'created'].indexOf(query.ordenar_por) === -1)
        return { valido: false, erro: 'VALIDATION' }
      ordenarPor = query.ordenar_por
    }
    params.ordenar_por = ordenarPor
    var ordem = 'desc'
    if (query.ordem !== undefined) {
      if (query.ordem !== 'asc' && query.ordem !== 'desc')
        return { valido: false, erro: 'VALIDATION' }
      ordem = query.ordem
    }
    params.ordem = ordem
    return { valido: true, params: params }
  }

  function construirFiltroResponsaveis(ids) {
    if (!ids || ids.length === 0) return ''
    var partes = []
    for (var i = 0; i < ids.length; i++) {
      partes.push("responsavel_id = '" + ids[i] + "'")
    }
    return partes.join(' || ')
  }

  function construirFiltroGestorEquipes(ids) {
    if (!ids || ids.length === 0) return ''
    var partes = []
    for (var i = 0; i < ids.length; i++) {
      partes.push("equipe_id = '" + ids[i] + "'")
    }
    return partes.join(' || ')
  }

  function construirFiltroQ1(hoje) {
    return "cancelada_em = null && data_inicio <= '" + hoje + "' && data_fim >= '" + hoje + "'"
  }

  function isSemCobertura(rec) {
    return rec.getString('substituto_principal_id') === ''
  }

  function isAusenciaVigente(dataInicio, dataFim, hoje) {
    if (dataInicio && dataInicio > hoje) return false
    if (dataFim && dataFim < hoje) return false
    return true
  }

  function coletarTitularesSemCobertura(recs) {
    var ids = []
    var seen = {}
    if (!recs) return ids
    for (var i = 0; i < recs.length; i++) {
      var r = recs[i]
      if (!isSemCobertura(r)) continue
      var tid = r.getString('titular_id')
      if (tid && !seen[tid]) {
        seen[tid] = true
        ids.push(tid)
      }
    }
    return ids
  }

  function elegivelNegocio(negocio, titularesSemCobertura) {
    if (!negocio) return false
    if (negocio.inativo === true) return false
    if (!negocio.responsavel_id) return false
    if (!titularesSemCobertura || titularesSemCobertura.length === 0) return false
    return titularesSemCobertura.indexOf(negocio.responsavel_id) !== -1
  }

  function calcularPaginacao(pagina, porPagina) {
    var p = pagina || 1
    var pp = porPagina || 20
    return { limit: pp + 1, offset: (p - 1) * pp }
  }

  function calcularHasMore(resultsLen, porPagina) {
    return resultsLen > porPagina
  }

  function redatorUser(user) {
    if (!user) return null
    return { id: user.id, name: user.name }
  }

  function redatorEquipe(eq) {
    if (!eq) return null
    return { id: eq.id, nome: eq.nome }
  }

  function redatorAusencia(rec) {
    if (!rec) return null
    return {
      id: rec.id,
      data_inicio: rec.getString('data_inicio'),
      data_fim: rec.getString('data_fim'),
      motivo: rec.getString('motivo'),
    }
  }

  function deveBatch(ids) {
    return !!ids && ids.length > 0
  }

  function limiteBatchUsers() {
    return 200
  }

  function limiteBatchEquipes() {
    return 50
  }

  function limiteBatchQ1() {
    return 500
  }

  return {
    hojeRecife: hojeRecife,
    bindingVigente: bindingVigente,
    resolverFallbackSuperadmin: resolverFallbackSuperadmin,
    validarUsuario: validarUsuario,
    comporFiltro: comporFiltro,
    construirSort: construirSort,
    validarQuery: validarQuery,
    construirFiltroResponsaveis: construirFiltroResponsaveis,
    construirFiltroGestorEquipes: construirFiltroGestorEquipes,
    construirFiltroQ1: construirFiltroQ1,
    isSemCobertura: isSemCobertura,
    isAusenciaVigente: isAusenciaVigente,
    coletarTitularesSemCobertura: coletarTitularesSemCobertura,
    elegivelNegocio: elegivelNegocio,
    calcularPaginacao: calcularPaginacao,
    calcularHasMore: calcularHasMore,
    redatorUser: redatorUser,
    redatorEquipe: redatorEquipe,
    redatorAusencia: redatorAusencia,
    deveBatch: deveBatch,
    limiteBatchUsers: limiteBatchUsers,
    limiteBatchEquipes: limiteBatchEquipes,
    limiteBatchQ1: limiteBatchQ1,
  }
})()
/* ──── FIM DO BLOCO DE TESTES ESTÁTICOS ──── */
