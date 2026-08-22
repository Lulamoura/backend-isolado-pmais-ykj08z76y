// G39-E2C-C3B3A-R4 — Consulta de substituições/ausências (somente leitura)
// Endpoint: GET /backend/v1/substituicoes/consulta
//
// Hook EXCLUSIVAMENTE de leitura. ZERO $app.save, runInTransaction, INSERT,
// UPDATE, DELETE, com_auditoria, com_idempotencia, scheduler.
//
// ?id=X  → view (200 objeto ou 404 uniforme)
// sem id → list paginada
//
// RBAC:
//   1. SA direto (perfil do ator = superadministrador) → acesso total
//   2. Fallback SA via binding ativo+vigente → acesso total
//   3. gestor/gestor-comercial com binding ativo+vigente → titular OU
//      substituto principal pertence às equipes geridas
//   4. operador-comercial/prospeccao → ator é titular OU substituto principal
//      OU substituto reserva
//   5. demais → 403 FORBIDDEN
//
// ativo_comercial = true obrigatório para todos (inclusive SA direto).

routerAdd(
  'GET',
  '/backend/v1/substituicoes/consulta',
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

    // classificarSituacao — projeção não persistida (datas inclusivas).
    function classificarSituacao(rec, hoje) {
      if (rec.cancelada_em) return 'cancelada'
      if (hoje < rec.data_inicio) return 'futura'
      if (hoje <= rec.data_fim) return 'vigente'
      return 'encerrada'
    }

    // aplicarFiltroSituacao — tradução para filtro PocketBase nativo.
    function aplicarFiltroSituacao(situacao, hoje) {
      if (situacao === 'cancelada') return 'cancelada_em != null'
      if (situacao === 'futura') return "cancelada_em = null && data_inicio > '" + hoje + "'"
      if (situacao === 'vigente')
        return "cancelada_em = null && data_inicio <= '" + hoje + "' && data_fim >= '" + hoje + "'"
      if (situacao === 'encerrada') return "cancelada_em = null && data_fim < '" + hoje + "'"
      return ''
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

    // validarRBACLeitura — função pura. Decide se o ator pode ver um registro.
    //   perfilSlug: slug direto do ator (ou '')
    //   bindings: array de { equipe_id, perfilSlug, ativo, vigente }
    //   atorId: id do ator autenticado
    //   titularId, substitutoPrincipalId, substitutoReservaId: campos do registro
    //   allowedUserIds: IDs de users das equipes geridas (gestor) ou [] demais
    function validarRBACLeitura(
      perfilSlug,
      bindings,
      atorId,
      titularId,
      substitutoPrincipalId,
      substitutoReservaId,
      allowedUserIds,
    ) {
      if (perfilSlug === 'superadministrador') {
        return { aprovado: true, motivo: 'superadmin' }
      }
      if (perfilSlug === 'gestor' || perfilSlug === 'gestor-comercial') {
        if (!bindings || bindings.length === 0) {
          return { aprovado: false, motivo: 'sem_bindings' }
        }
        var hasGestorBinding = false
        for (var i = 0; i < bindings.length; i++) {
          var b = bindings[i]
          if (
            (b.perfilSlug === 'gestor' || b.perfilSlug === 'gestor-comercial') &&
            b.ativo === true &&
            b.vigente === true
          ) {
            hasGestorBinding = true
            break
          }
        }
        if (!hasGestorBinding) return { aprovado: false, motivo: 'sem_binding_gestor' }
        var allowed = allowedUserIds || []
        if (titularId && allowed.indexOf(titularId) !== -1) {
          return { aprovado: true, motivo: 'gestor_equipe' }
        }
        if (substitutoPrincipalId && allowed.indexOf(substitutoPrincipalId) !== -1) {
          return { aprovado: true, motivo: 'gestor_equipe' }
        }
        return { aprovado: false, motivo: 'fora_equipes_geridas' }
      }
      if (perfilSlug === 'operador-comercial' || perfilSlug === 'prospeccao') {
        if (titularId && titularId === atorId) return { aprovado: true, motivo: 'titular' }
        if (substitutoPrincipalId && substitutoPrincipalId === atorId)
          return { aprovado: true, motivo: 'substituto_principal' }
        if (substitutoReservaId && substitutoReservaId === atorId)
          return { aprovado: true, motivo: 'substituto_reserva' }
        return { aprovado: false, motivo: 'nao_envolvido' }
      }
      // leitura-executiva, aprovador, integracao, demais
      return { aprovado: false, motivo: 'perfil_sem_acesso' }
    }

    function construirFiltroGestor(userIds) {
      if (!userIds || userIds.length === 0) return ''
      var partes = []
      for (var i = 0; i < userIds.length; i++) {
        partes.push("titular_id = '" + userIds[i] + "'")
        partes.push("substituto_principal_id = '" + userIds[i] + "'")
      }
      return partes.join(' || ')
    }

    function construirFiltroComercial(atorId) {
      return (
        "titular_id = '" +
        atorId +
        "' || substituto_principal_id = '" +
        atorId +
        "' || substituto_reserva_id = '" +
        atorId +
        "'"
      )
    }

    // construirSort — campo solicitado + tiebreak determinístico
    // (created DESC, id ASC). Não duplica created se já for o campo.
    function construirSort(ordenarPor, ordem) {
      var campo = ordenarPor || 'data_inicio'
      var desc = ordem !== 'asc'
      var primary = (desc ? '-' : '') + campo
      if (campo === 'created') return primary + ',id'
      return primary + ',-created,id'
    }

    function validarIdFormato(id) {
      return /^[a-z0-9]{15}$/.test(id)
    }

    // validarQuery — allowlist estrita. Retorna { valido, params } ou
    // { valido: false, erro: 'VALIDATION' }.
    function validarQuery(query) {
      var allow = [
        'id',
        'situacao',
        'titular_id',
        'substituto_principal_id',
        'data_inicio_apos',
        'data_fim_antes',
        'pagina',
        'por_pagina',
        'ordenar_por',
        'ordem',
      ]
      var params = {}
      if (!query) return { valido: true, params: params }
      var keys = Object.keys(query)
      for (var i = 0; i < keys.length; i++) {
        if (allow.indexOf(keys[i]) === -1) return { valido: false, erro: 'VALIDATION' }
      }
      var dateRe = /^\d{4}-\d{2}-\d{2}$/
      if (query.id !== undefined) {
        if (!validarIdFormato(query.id)) return { valido: false, erro: 'VALIDATION' }
        params.id = query.id
      }
      if (query.situacao !== undefined) {
        if (['futura', 'vigente', 'encerrada', 'cancelada'].indexOf(query.situacao) === -1)
          return { valido: false, erro: 'VALIDATION' }
        params.situacao = query.situacao
      }
      if (query.titular_id !== undefined) {
        if (!validarIdFormato(query.titular_id)) return { valido: false, erro: 'VALIDATION' }
        params.titular_id = query.titular_id
      }
      if (query.substituto_principal_id !== undefined) {
        if (!validarIdFormato(query.substituto_principal_id))
          return { valido: false, erro: 'VALIDATION' }
        params.substituto_principal_id = query.substituto_principal_id
      }
      if (query.data_inicio_apos !== undefined) {
        if (!dateRe.test(query.data_inicio_apos)) return { valido: false, erro: 'VALIDATION' }
        params.data_inicio_apos = query.data_inicio_apos
      }
      if (query.data_fim_antes !== undefined) {
        if (!dateRe.test(query.data_fim_antes)) return { valido: false, erro: 'VALIDATION' }
        params.data_fim_antes = query.data_fim_antes
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
      var ordenarPor = 'data_inicio'
      if (query.ordenar_por !== undefined) {
        if (['data_inicio', 'data_fim', 'created'].indexOf(query.ordenar_por) === -1)
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

    function normalizarCanceladaEm(raw) {
      if (!raw) return null
      return raw
    }

    function normalizarRef(raw) {
      if (!raw) return null
      return raw
    }

    function coletarUserIds(recs) {
      var ids = []
      var seen = {}
      if (!recs) return ids
      for (var i = 0; i < recs.length; i++) {
        var r = recs[i]
        var fields = [r.titular_id, r.substituto_principal_id, r.substituto_reserva_id]
        for (var j = 0; j < fields.length; j++) {
          var id = fields[j]
          if (id && !seen[id]) {
            seen[id] = true
            ids.push(id)
          }
        }
      }
      return ids
    }

    function calcularPaginacao(pagina, porPagina) {
      var p = pagina || 1
      var pp = porPagina || 20
      return { limit: pp + 1, offset: (p - 1) * pp }
    }

    function calcularHasMore(resultsLen, porPagina) {
      return resultsLen > porPagina
    }

    function construirRespostaList(items, pagina, porPagina, hasMore) {
      return {
        substituicoes: items,
        pagina: pagina,
        por_pagina: porPagina,
        has_more: hasMore,
      }
    }

    function redatorUser(user) {
      if (!user) return null
      return { id: user.id, name: user.name }
    }

    function statusAcessoNegado(motivo) {
      // perfis sem acesso ao comando (aprovador, leitura-executiva, etc.) → 403
      // registros invisíveis ao perfil (comercial não envolvido, gestor fora
      // das equipes) → 404 uniforme (sem distinguir existência)
      if (motivo === 'perfil_sem_acesso') return 403
      return 404
    }

    function deveBatch(ids) {
      return !!ids && ids.length > 0
    }

    function limiteBatchUsers() {
      return 200
    }

    function limiteBatchNegocios() {
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

    function batchNegocios(ids) {
      var map = {}
      if (!deveBatch(ids)) return map
      var partes = []
      for (var i = 0; i < ids.length; i++) partes.push("id = '" + ids[i] + "'")
      try {
        var recs = $app.findRecordsByFilter(
          'com_negocios',
          partes.join(' || '),
          '',
          limiteBatchNegocios(),
          0,
        )
        for (var j = 0; j < recs.length; j++) {
          map[recs[j].id] = { id: recs[j].id, titulo: recs[j].getString('titulo') }
        }
      } catch (_) {}
      return map
    }

    function shapeItem(rec, userMap, hoje) {
      var titularId = rec.getString('titular_id')
      var subPrincipalId = normalizarRef(rec.getString('substituto_principal_id'))
      var subReservaId = normalizarRef(rec.getString('substituto_reserva_id'))
      var situacao = classificarSituacao(
        {
          cancelada_em: rec.getString('cancelada_em'),
          data_inicio: rec.getString('data_inicio'),
          data_fim: rec.getString('data_fim'),
        },
        hoje,
      )
      return {
        id: rec.id,
        data_inicio: rec.getString('data_inicio'),
        data_fim: rec.getString('data_fim'),
        tipo_cobertura: rec.getString('tipo_cobertura'),
        motivo: rec.getString('motivo'),
        cancelada_em: normalizarCanceladaEm(rec.getString('cancelada_em')),
        situacao: situacao,
        titular: userMap[titularId] || null,
        substituto_principal: subPrincipalId ? userMap[subPrincipalId] || null : null,
        substituto_reserva: subReservaId ? userMap[subReservaId] || null : null,
      }
    }

    function shapeView(rec, userMap, negMap, hoje) {
      var base = shapeItem(rec, userMap, hoje)
      var negIds = []
      try {
        negIds = rec.get('negocios_cobertos') || []
      } catch (_) {}
      var negocios = []
      for (var i = 0; i < negIds.length; i++) {
        if (negMap[negIds[i]]) negocios.push(negMap[negIds[i]])
      }
      var autorId = rec.getString('autor_id')
      base.negocios_cobertos = negocios
      base.observacao = rec.getString('observacao') || null
      base.justificativa_cancelamento = rec.getString('justificativa_cancelamento') || null
      base.autor = userMap[autorId] || null
      base.created = rec.getString('created')
      base.updated = rec.getString('updated')
      return base
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

    // ═══════ FASE 4 — RBAC + FILTRO DE ACESSO ═══════

    var filtroRbac = ''
    var perfilAcesso = '' // 'sa' | 'gestor' | 'comercial'
    var allowedUserIds = []
    var userMap = {} // id -> {id, name} (pré-preenchido para gestor via Q1)
    var gestorSemUsers = false

    if (isSA) {
      perfilAcesso = 'sa'
      filtroRbac = ''
    } else {
      // Verifica binding de gestor ativo+vigente
      var hasGestorBinding = false
      var equipesGeridas = {}
      for (var gi = 0; gi < bindingsArr.length; gi++) {
        var gb = bindingsArr[gi]
        if (
          (gb.perfilSlug === 'gestor' || gb.perfilSlug === 'gestor-comercial') &&
          gb.ativo === true &&
          gb.vigente === true
        ) {
          hasGestorBinding = true
          if (gb.equipe_id) equipesGeridas[gb.equipe_id] = true
        }
      }
      if (hasGestorBinding) {
        perfilAcesso = 'gestor'
        // Q1: buscar todos os users das equipes geridas (anti-N+1)
        var eqIds = Object.keys(equipesGeridas)
        if (eqIds.length > 0) {
          var partesEq = []
          for (var ei = 0; ei < eqIds.length; ei++) {
            partesEq.push("equipe_id = '" + eqIds[ei] + "'")
          }
          var filtroEquipes = partesEq.join(' || ')
          var off = 0
          var batch
          do {
            batch = $app.findRecordsByFilter('users', filtroEquipes, '', 500, off)
            for (var ui = 0; ui < batch.length; ui++) {
              allowedUserIds.push(batch[ui].id)
              userMap[batch[ui].id] = { id: batch[ui].id, name: batch[ui].getString('name') }
            }
            off += 500
          } while (batch.length === 500)
        }
        if (allowedUserIds.length === 0) {
          gestorSemUsers = true
        } else {
          filtroRbac = construirFiltroGestor(allowedUserIds)
        }
      } else if (atorPerfilSlug === 'operador-comercial' || atorPerfilSlug === 'prospeccao') {
        perfilAcesso = 'comercial'
        filtroRbac = construirFiltroComercial(atorId)
      } else {
        return e.json(403, { error: 'FORBIDDEN' })
      }
    }

    // ═══════ FASE 5 — VIEW (?id=X) ═══════

    if (params.id) {
      // Gestor sem users nas equipes geridas → 404 uniforme
      if (gestorSemUsers) return e.json(404, { error: 'NAO_ENCONTRADO' })

      var viewRec = null
      try {
        viewRec = $app.findRecordById('com_substituicoes', params.id)
      } catch (_) {}
      if (!viewRec) return e.json(404, { error: 'NAO_ENCONTRADO' })

      // Validação RBAC sobre o registro
      var titularIdV = viewRec.getString('titular_id')
      var subPrincipalIdV = normalizarRef(viewRec.getString('substituto_principal_id'))
      var subReservaIdV = normalizarRef(viewRec.getString('substituto_reserva_id'))
      var slugParaRbac = isSA ? 'superadministrador' : atorPerfilSlug
      if (perfilAcesso === 'gestor') slugParaRbac = 'gestor-comercial'
      var rbacV = validarRBACLeitura(
        slugParaRbac,
        bindingsArr,
        atorId,
        titularIdV,
        subPrincipalIdV,
        subReservaIdV,
        allowedUserIds,
      )
      if (!rbacV.aprovado) {
        var statusV = statusAcessoNegado(rbacV.motivo)
        return e.json(statusV, { error: statusV === 403 ? 'FORBIDDEN' : 'NAO_ENCONTRADO' })
      }

      // Anti-N+1: complemento de users (autor + titulares/subs ainda não mapeados)
      var neededIds = [titularIdV, subPrincipalIdV, subReservaIdV, viewRec.getString('autor_id')]
      var missingIds = []
      var seenMissing = {}
      for (var ni = 0; ni < neededIds.length; ni++) {
        var nid = neededIds[ni]
        if (nid && !userMap[nid] && !seenMissing[nid]) {
          seenMissing[nid] = true
          missingIds.push(nid)
        }
      }
      var complemento = batchUsers(missingIds)
      var ck = Object.keys(complemento)
      for (var ci = 0; ci < ck.length; ci++) userMap[ck[ci]] = complemento[ck[ci]]

      // Batch negócios cobertos
      var negIds = []
      try {
        negIds = viewRec.get('negocios_cobertos') || []
      } catch (_) {}
      var negMap = batchNegocios(negIds)

      return e.json(200, shapeView(viewRec, userMap, negMap, hoje))
    }

    // ═══════ FASE 6 — LIST (sem ?id=) ═══════

    // Gestor sem users nas equipes geridas → lista vazia imediata
    if (gestorSemUsers) {
      return e.json(200, construirRespostaList([], params.pagina, params.por_pagina, false))
    }

    // Compor filtro final: RBAC + situação + allowlist
    var fragmentos = [filtroRbac]
    if (params.situacao) fragmentos.push(aplicarFiltroSituacao(params.situacao, hoje))
    if (params.titular_id) fragmentos.push("titular_id = '" + params.titular_id + "'")
    if (params.substituto_principal_id)
      fragmentos.push("substituto_principal_id = '" + params.substituto_principal_id + "'")
    if (params.data_inicio_apos) fragmentos.push("data_inicio > '" + params.data_inicio_apos + "'")
    if (params.data_fim_antes) fragmentos.push("data_fim < '" + params.data_fim_antes + "'")
    var filtroFinal = comporFiltro(fragmentos)

    var sort = construirSort(params.ordenar_por, params.ordem)
    var pag = calcularPaginacao(params.pagina, params.por_pagina)

    var results = []
    try {
      results = $app.findRecordsByFilter(
        'com_substituicoes',
        filtroFinal,
        sort,
        pag.limit,
        pag.offset,
      )
    } catch (_) {}

    var hasMore = calcularHasMore(results.length, params.por_pagina)
    var page = results.slice(0, params.por_pagina)

    // Anti-N+1: coletar IDs únicos da página e batch users (complemento p/ gestor)
    var pageRecs = []
    for (var pri = 0; pri < page.length; pri++) {
      pageRecs.push({
        titular_id: page[pri].getString('titular_id'),
        substituto_principal_id: normalizarRef(page[pri].getString('substituto_principal_id')),
        substituto_reserva_id: normalizarRef(page[pri].getString('substituto_reserva_id')),
      })
    }
    var collectedIds = coletarUserIds(pageRecs)
    var missingList = []
    var seenList = {}
    for (var mli = 0; mli < collectedIds.length; mli++) {
      var mid = collectedIds[mli]
      if (!userMap[mid] && !seenList[mid]) {
        seenList[mid] = true
        missingList.push(mid)
      }
    }
    var complementoList = batchUsers(missingList)
    var clkk = Object.keys(complementoList)
    for (var cli = 0; cli < clkk.length; cli++) {
      userMap[clkk[cli]] = complementoList[clkk[cli]]
    }

    var items = []
    for (var ii = 0; ii < page.length; ii++) {
      items.push(shapeItem(page[ii], userMap, hoje))
    }

    return e.json(200, construirRespostaList(items, params.pagina, params.por_pagina, hasMore))
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

  function classificarSituacao(rec, hoje) {
    if (rec.cancelada_em) return 'cancelada'
    if (hoje < rec.data_inicio) return 'futura'
    if (hoje <= rec.data_fim) return 'vigente'
    return 'encerrada'
  }

  function aplicarFiltroSituacao(situacao, hoje) {
    if (situacao === 'cancelada') return 'cancelada_em != null'
    if (situacao === 'futura') return "cancelada_em = null && data_inicio > '" + hoje + "'"
    if (situacao === 'vigente')
      return "cancelada_em = null && data_inicio <= '" + hoje + "' && data_fim >= '" + hoje + "'"
    if (situacao === 'encerrada') return "cancelada_em = null && data_fim < '" + hoje + "'"
    return ''
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

  function validarRBACLeitura(
    perfilSlug,
    bindings,
    atorId,
    titularId,
    substitutoPrincipalId,
    substitutoReservaId,
    allowedUserIds,
  ) {
    if (perfilSlug === 'superadministrador') {
      return { aprovado: true, motivo: 'superadmin' }
    }
    if (perfilSlug === 'gestor' || perfilSlug === 'gestor-comercial') {
      if (!bindings || bindings.length === 0) {
        return { aprovado: false, motivo: 'sem_bindings' }
      }
      var hasGestorBinding = false
      for (var i = 0; i < bindings.length; i++) {
        var b = bindings[i]
        if (
          (b.perfilSlug === 'gestor' || b.perfilSlug === 'gestor-comercial') &&
          b.ativo === true &&
          b.vigente === true
        ) {
          hasGestorBinding = true
          break
        }
      }
      if (!hasGestorBinding) return { aprovado: false, motivo: 'sem_binding_gestor' }
      var allowed = allowedUserIds || []
      if (titularId && allowed.indexOf(titularId) !== -1) {
        return { aprovado: true, motivo: 'gestor_equipe' }
      }
      if (substitutoPrincipalId && allowed.indexOf(substitutoPrincipalId) !== -1) {
        return { aprovado: true, motivo: 'gestor_equipe' }
      }
      return { aprovado: false, motivo: 'fora_equipes_geridas' }
    }
    if (perfilSlug === 'operador-comercial' || perfilSlug === 'prospeccao') {
      if (titularId && titularId === atorId) return { aprovado: true, motivo: 'titular' }
      if (substitutoPrincipalId && substitutoPrincipalId === atorId)
        return { aprovado: true, motivo: 'substituto_principal' }
      if (substitutoReservaId && substitutoReservaId === atorId)
        return { aprovado: true, motivo: 'substituto_reserva' }
      return { aprovado: false, motivo: 'nao_envolvido' }
    }
    return { aprovado: false, motivo: 'perfil_sem_acesso' }
  }

  function construirFiltroGestor(userIds) {
    if (!userIds || userIds.length === 0) return ''
    var partes = []
    for (var i = 0; i < userIds.length; i++) {
      partes.push("titular_id = '" + userIds[i] + "'")
      partes.push("substituto_principal_id = '" + userIds[i] + "'")
    }
    return partes.join(' || ')
  }

  function construirFiltroComercial(atorId) {
    return (
      "titular_id = '" +
      atorId +
      "' || substituto_principal_id = '" +
      atorId +
      "' || substituto_reserva_id = '" +
      atorId +
      "'"
    )
  }

  function construirSort(ordenarPor, ordem) {
    var campo = ordenarPor || 'data_inicio'
    var desc = ordem !== 'asc'
    var primary = (desc ? '-' : '') + campo
    if (campo === 'created') return primary + ',id'
    return primary + ',-created,id'
  }

  function validarIdFormato(id) {
    return /^[a-z0-9]{15}$/.test(id)
  }

  function validarQuery(query) {
    var allow = [
      'id',
      'situacao',
      'titular_id',
      'substituto_principal_id',
      'data_inicio_apos',
      'data_fim_antes',
      'pagina',
      'por_pagina',
      'ordenar_por',
      'ordem',
    ]
    var params = {}
    if (!query) return { valido: true, params: params }
    var keys = Object.keys(query)
    for (var i = 0; i < keys.length; i++) {
      if (allow.indexOf(keys[i]) === -1) return { valido: false, erro: 'VALIDATION' }
    }
    var dateRe = /^\d{4}-\d{2}-\d{2}$/
    if (query.id !== undefined) {
      if (!validarIdFormato(query.id)) return { valido: false, erro: 'VALIDATION' }
      params.id = query.id
    }
    if (query.situacao !== undefined) {
      if (['futura', 'vigente', 'encerrada', 'cancelada'].indexOf(query.situacao) === -1)
        return { valido: false, erro: 'VALIDATION' }
      params.situacao = query.situacao
    }
    if (query.titular_id !== undefined) {
      if (!validarIdFormato(query.titular_id)) return { valido: false, erro: 'VALIDATION' }
      params.titular_id = query.titular_id
    }
    if (query.substituto_principal_id !== undefined) {
      if (!validarIdFormato(query.substituto_principal_id))
        return { valido: false, erro: 'VALIDATION' }
      params.substituto_principal_id = query.substituto_principal_id
    }
    if (query.data_inicio_apos !== undefined) {
      if (!dateRe.test(query.data_inicio_apos)) return { valido: false, erro: 'VALIDATION' }
      params.data_inicio_apos = query.data_inicio_apos
    }
    if (query.data_fim_antes !== undefined) {
      if (!dateRe.test(query.data_fim_antes)) return { valido: false, erro: 'VALIDATION' }
      params.data_fim_antes = query.data_fim_antes
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
    var ordenarPor = 'data_inicio'
    if (query.ordenar_por !== undefined) {
      if (['data_inicio', 'data_fim', 'created'].indexOf(query.ordenar_por) === -1)
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

  function normalizarCanceladaEm(raw) {
    if (!raw) return null
    return raw
  }

  function normalizarRef(raw) {
    if (!raw) return null
    return raw
  }

  function coletarUserIds(recs) {
    var ids = []
    var seen = {}
    if (!recs) return ids
    for (var i = 0; i < recs.length; i++) {
      var r = recs[i]
      var fields = [r.titular_id, r.substituto_principal_id, r.substituto_reserva_id]
      for (var j = 0; j < fields.length; j++) {
        var id = fields[j]
        if (id && !seen[id]) {
          seen[id] = true
          ids.push(id)
        }
      }
    }
    return ids
  }

  function calcularPaginacao(pagina, porPagina) {
    var p = pagina || 1
    var pp = porPagina || 20
    return { limit: pp + 1, offset: (p - 1) * pp }
  }

  function calcularHasMore(resultsLen, porPagina) {
    return resultsLen > porPagina
  }

  function construirRespostaList(items, pagina, porPagina, hasMore) {
    return {
      substituicoes: items,
      pagina: pagina,
      por_pagina: porPagina,
      has_more: hasMore,
    }
  }

  function redatorUser(user) {
    if (!user) return null
    return { id: user.id, name: user.name }
  }

  function statusAcessoNegado(motivo) {
    if (motivo === 'perfil_sem_acesso') return 403
    return 404
  }

  function deveBatch(ids) {
    return !!ids && ids.length > 0
  }

  function limiteBatchUsers() {
    return 200
  }

  function limiteBatchNegocios() {
    return 500
  }

  return {
    hojeRecife: hojeRecife,
    bindingVigente: bindingVigente,
    resolverFallbackSuperadmin: resolverFallbackSuperadmin,
    validarUsuario: validarUsuario,
    classificarSituacao: classificarSituacao,
    aplicarFiltroSituacao: aplicarFiltroSituacao,
    comporFiltro: comporFiltro,
    validarRBACLeitura: validarRBACLeitura,
    construirFiltroGestor: construirFiltroGestor,
    construirFiltroComercial: construirFiltroComercial,
    construirSort: construirSort,
    validarIdFormato: validarIdFormato,
    validarQuery: validarQuery,
    normalizarCanceladaEm: normalizarCanceladaEm,
    normalizarRef: normalizarRef,
    coletarUserIds: coletarUserIds,
    calcularPaginacao: calcularPaginacao,
    calcularHasMore: calcularHasMore,
    construirRespostaList: construirRespostaList,
    redatorUser: redatorUser,
    statusAcessoNegado: statusAcessoNegado,
    deveBatch: deveBatch,
    limiteBatchUsers: limiteBatchUsers,
    limiteBatchNegocios: limiteBatchNegocios,
  }
})()
/* ──── FIM DO BLOCO DE TESTES ESTÁTICOS ──── */
