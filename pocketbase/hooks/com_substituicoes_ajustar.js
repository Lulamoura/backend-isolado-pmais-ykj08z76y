// G39-E2C-C3B2A-R1 — Implantação do comando ajustar_ausencia_ou_substituicao
// Endpoint: POST /backend/v1/substituicoes/ajustar
//
// Observação de domínio: o perfil de gestor comercial é seedado com slug
// "gestor-comercial" (migration 0026). O plano de comando referencia o slug
// "gestor"; o RBAC abaixo aceita AMBOS ("gestor" e "gestor-comercial") para
// permanecer fiel ao plano e compatível com o estado real do banco.

routerAdd(
  'POST',
  '/backend/v1/substituicoes/ajustar',
  (e) => {
    // ═══════ FASE 0 — helpers no escopo do hook ═══════

    function canonicalize(obj) {
      if (obj === null || obj === undefined) return 'null'
      if (typeof obj !== 'object') return JSON.stringify(obj)
      if (Array.isArray(obj)) {
        var items = []
        for (var i = 0; i < obj.length; i++) items.push(canonicalize(obj[i]))
        return '[' + items.join(',') + ']'
      }
      var keys = Object.keys(obj)
        .filter(function (k) {
          return obj[k] !== undefined
        })
        .sort()
      var parts = []
      for (var j = 0; j < keys.length; j++)
        parts.push(JSON.stringify(keys[j]) + ':' + canonicalize(obj[keys[j]]))
      return '{' + parts.join(',') + '}'
    }

    // validarInvariantes — função pura. Recebe payload (objeto) e retorna
    // { valido: bool, erros: string[] }. Não consulta banco (I1 é checada
    // separadamente porque depende de dados persistentes).
    function validarInvariantes(payload) {
      var erros = []
      if (!payload || typeof payload !== 'object') {
        return { valido: false, erros: ['payload_invalido'] }
      }

      var titular_id = payload.titular_id || ''
      var substituto_principal_id = payload.substituto_principal_id || null
      var substituto_reserva_id = payload.substituto_reserva_id || null
      var data_inicio = payload.data_inicio || ''
      var data_fim = payload.data_fim || ''
      var tipo_cobertura = payload.tipo_cobertura || ''
      var negocios_cobertos = payload.negocios_cobertos
      if (!negocios_cobertos) negocios_cobertos = []

      var temPrincipal = !!substituto_principal_id
      var temReserva = !!substituto_reserva_id

      // I2: data_fim >= data_inicio (datas normalizadas YYYY-MM-DD)
      if (data_inicio && data_fim) {
        if (data_fim < data_inicio) erros.push('I2')
      } else {
        erros.push('I2')
      }

      // I3: reserva preenchido ⇒ principal preenchido
      if (temReserva && !temPrincipal) erros.push('I3')

      // I4: tipo_cobertura = "por_negocios" ⇒ principal preenchido &&
      //     negocios_cobertos não vazio. (A verificação de responsavel_id
      //     depende de dados persistidos e é realizada separadamente.)
      if (tipo_cobertura === 'por_negocios') {
        if (!temPrincipal) erros.push('I4')
        if (!negocios_cobertos || negocios_cobertos.length === 0) erros.push('I4')
      }

      // I5: tipo_cobertura = "integral" && principal preenchido ⇒
      //     negocios_cobertos vazio
      if (tipo_cobertura === 'integral' && temPrincipal) {
        if (negocios_cobertos && negocios_cobertos.length > 0) erros.push('I5')
      }

      // I6: principal vazio (ausência sem cobertura) ⇒ tipo_cobertura = "integral"
      //     && reserva vazio && negocios_cobertos vazio
      if (!temPrincipal) {
        if (tipo_cobertura !== 'integral') erros.push('I6')
        if (temReserva) erros.push('I6')
        if (negocios_cobertos && negocios_cobertos.length > 0) erros.push('I6')
      }

      // I7: titular_id != substituto_principal_id (quando principal preenchido)
      if (temPrincipal && titular_id && substituto_principal_id === titular_id) {
        erros.push('I7')
      }

      // I8: substituto_principal_id != substituto_reserva_id (quando ambos preenchidos)
      if (temPrincipal && temReserva && substituto_principal_id === substituto_reserva_id) {
        erros.push('I8')
      }

      // Deduplica preservando ordem
      var uniq = []
      for (var k = 0; k < erros.length; k++) {
        if (uniq.indexOf(erros[k]) === -1) uniq.push(erros[k])
      }
      return { valido: uniq.length === 0, erros: uniq }
    }

    // validarRBAC — função pura.
    //   perfilSlug: slug do perfil direto do auth (ou '')
    //   bindings: array de { equipe_id, perfilSlug, ativo, vigente }
    //   titularEquipeId: equipe_id do titular (string ou null/vazio)
    // Retorna { aprovado: bool, motivo: string }
    function validarRBAC(perfilSlug, bindings, titularEquipeId) {
      if (perfilSlug === 'superadministrador') {
        return { aprovado: true, motivo: 'superadmin' }
      }
      if (!titularEquipeId) {
        return { aprovado: false, motivo: 'titular_sem_equipe' }
      }
      if (!bindings || bindings.length === 0) {
        return { aprovado: false, motivo: 'sem_bindings' }
      }
      for (var i = 0; i < bindings.length; i++) {
        var b = bindings[i]
        var isGestor = b.perfilSlug === 'gestor' || b.perfilSlug === 'gestor-comercial'
        if (isGestor && b.ativo === true && b.vigente === true && b.equipe_id === titularEquipeId) {
          return { aprovado: true, motivo: 'gestor_equipe' }
        }
      }
      return { aprovado: false, motivo: 'sem_correspondencia' }
    }

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

    // mergePayload — função pura. Aplica campos mutáveis do body sobre o
    // registro existente. Campos NÃO presentes no body (hasOwnProperty false)
    // são preservados do registro existente. Campos presentes (mesmo null)
    // sobrescrevem.
    function mergePayload(registroExistente, camposMutaveis) {
      var mutaveis = [
        'substituto_principal_id',
        'substituto_reserva_id',
        'data_inicio',
        'data_fim',
        'negocios_cobertos',
        'observacao',
      ]
      var result = {}
      for (var k in registroExistente) {
        if (Object.prototype.hasOwnProperty.call(registroExistente, k)) {
          result[k] = registroExistente[k]
        }
      }
      for (var i = 0; i < mutaveis.length; i++) {
        var f = mutaveis[i]
        if (Object.prototype.hasOwnProperty.call(camposMutaveis, f)) {
          result[f] = camposMutaveis[f]
        }
      }
      return result
    }

    function hasOwn(obj, key) {
      return Object.prototype.hasOwnProperty.call(obj, key)
    }

    // Extrai um objeto simples dos campos de domínio de um Record.
    function recordToObj(rec) {
      var nc = null
      try {
        nc = rec.get('negocios_cobertos')
      } catch (_) {}
      if (!nc) nc = []
      return {
        titular_id: rec.getString('titular_id') || '',
        substituto_principal_id: rec.getString('substituto_principal_id') || null,
        substituto_reserva_id: rec.getString('substituto_reserva_id') || null,
        data_inicio: (rec.getString('data_inicio') || '').slice(0, 10),
        data_fim: (rec.getString('data_fim') || '').slice(0, 10),
        tipo_cobertura: rec.getString('tipo_cobertura') || '',
        negocios_cobertos: nc,
        motivo: rec.getString('motivo') || '',
        observacao: rec.getString('observacao') || null,
        autor_id: rec.getString('autor_id') || '',
        creation_idempotency_key: rec.getString('creation_idempotency_key') || '',
        cancelada_em: rec.getString('cancelada_em') || null,
        justificativa_cancelamento: rec.getString('justificativa_cancelamento') || null,
      }
    }

    // ═══════ FASE 1 — PRÉ-VALIDAÇÃO (fora da transação) ═══════

    // 1. Autenticar, extrair ator
    var ator = e.auth
    if (!ator) return e.unauthorizedError('Autenticacao necessaria')
    var atorId = ator.id

    var rawBody = toString(e.request.body)
    if (!rawBody) return e.badRequestError('Corpo da requisicao vazio')
    var body
    try {
      body = JSON.parse(rawBody)
    } catch (parseErr) {
      return e.badRequestError('Corpo da requisicao nao e JSON valido')
    }

    // 2. Rejeitar campos imutáveis no body (inclui autor_id)
    var imutaveis = [
      'titular_id',
      'tipo_cobertura',
      'motivo',
      'autor_id',
      'creation_idempotency_key',
      'cancelada_em',
      'justificativa_cancelamento',
      'created',
      'updated',
    ]
    for (var ii = 0; ii < imutaveis.length; ii++) {
      if (body && hasOwn(body, imutaveis[ii])) {
        return e.json(400, {
          error: 'CAMPO_IMUTAVEL',
          message: 'Campo imutavel nao pode ser enviado no body: ' + imutaveis[ii],
          campo: imutaveis[ii],
        })
      }
    }

    // 3. Validar envelope
    function isStr(v) {
      return typeof v === 'string'
    }
    if (!isStr(body.command_idempotency_key) || !body.command_idempotency_key) {
      return e.json(400, { error: 'VALIDATION', message: 'command_idempotency_key obrigatorio' })
    }
    if (body.command_idempotency_key.length > 128) {
      return e.json(400, { error: 'VALIDATION', message: 'command_idempotency_key excede 128' })
    }
    if (!isStr(body.id) || !body.id) {
      return e.json(400, { error: 'VALIDATION', message: 'id obrigatorio' })
    }
    if (!isStr(body.updated_esperado) || !body.updated_esperado) {
      return e.json(400, { error: 'VALIDATION', message: 'updated_esperado obrigatorio' })
    }
    if (
      body.substituto_principal_id !== null &&
      body.substituto_principal_id !== undefined &&
      !isStr(body.substituto_principal_id)
    ) {
      return e.json(400, { error: 'VALIDATION', message: 'substituto_principal_id invalido' })
    }
    if (
      body.substituto_reserva_id !== null &&
      body.substituto_reserva_id !== undefined &&
      !isStr(body.substituto_reserva_id)
    ) {
      return e.json(400, { error: 'VALIDATION', message: 'substituto_reserva_id invalido' })
    }
    if (!isStr(body.data_inicio) || !body.data_inicio) {
      return e.json(400, { error: 'VALIDATION', message: 'data_inicio obrigatoria' })
    }
    if (!isStr(body.data_fim) || !body.data_fim) {
      return e.json(400, { error: 'VALIDATION', message: 'data_fim obrigatoria' })
    }
    var dateRe = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRe.test(body.data_inicio) || !dateRe.test(body.data_fim)) {
      return e.json(400, {
        error: 'VALIDATION',
        message: 'data_inicio/data_fim devem ser YYYY-MM-DD',
      })
    }
    if (body.negocios_cobertos !== null && body.negocios_cobertos !== undefined) {
      if (!Array.isArray(body.negocios_cobertos)) {
        return e.json(400, { error: 'VALIDATION', message: 'negocios_cobertos deve ser array' })
      }
      for (var ni = 0; ni < body.negocios_cobertos.length; ni++) {
        if (!isStr(body.negocios_cobertos[ni])) {
          return e.json(400, {
            error: 'VALIDATION',
            message: 'negocios_cobertos deve conter strings',
          })
        }
      }
    }
    if (body.observacao !== null && body.observacao !== undefined) {
      if (!isStr(body.observacao)) {
        return e.json(400, { error: 'VALIDATION', message: 'observacao invalida' })
      }
      if (body.observacao.length > 1000) {
        return e.json(400, { error: 'VALIDATION', message: 'observacao excede 1000' })
      }
    }

    // 4. Buscar registro existente
    var registroExistente = null
    try {
      registroExistente = $app.findRecordById('com_substituicoes', body.id)
    } catch (_) {
      return e.json(404, { error: 'NAO_ENCONTRADO', message: 'Registro nao encontrado' })
    }
    if (!registroExistente) {
      return e.json(404, { error: 'NAO_ENCONTRADO', message: 'Registro nao encontrado' })
    }
    if (registroExistente.getString('cancelada_em')) {
      return e.json(409, {
        error: 'CANCELADO',
        message: 'Registro cancelado nao pode ser ajustado',
      })
    }

    var existingObj = recordToObj(registroExistente)

    // 5. Determinar perfil do ator (slug) — padrão ac_rollback.js:25-46
    var atorPerfilSlug = ''
    try {
      var authPerfilId = ator.getString('perfil_id')
      if (authPerfilId) {
        var perfilRec = $app.findRecordById('com_perfis', authPerfilId)
        atorPerfilSlug = perfilRec.getString('slug')
      }
    } catch (_) {}
    if (!atorPerfilSlug) {
      // fallback superadmin por binding (com vigência)
      try {
        var saPerfil = $app.findFirstRecordByData('com_perfis', 'slug', 'superadministrador')
        if (saPerfil) {
          var saBindings = $app.findRecordsByFilter(
            'com_usuarios_equipes',
            "usuario_id = '" + atorId + "' && perfil_id = '" + saPerfil.id + "' && ativo = true",
            '',
            100,
            0,
          )
          if (saBindings && saBindings.length > 0) {
            var bindingsFb = []
            for (var sbi = 0; sbi < saBindings.length; sbi++) {
              var sbRec = saBindings[sbi]
              bindingsFb.push({
                ativo: sbRec.getBool('ativo'),
                perfilSlug: 'superadministrador',
                inicio_vigencia: sbRec.getString('inicio_vigencia'),
                fim_vigencia: sbRec.getString('fim_vigencia'),
              })
            }
            if (resolverFallbackSuperadmin(bindingsFb, hojeRecife())) {
              atorPerfilSlug = 'superadministrador'
            }
          }
        }
      } catch (_) {}
    }

    // 6. RBAC contra o titular_id do registro existente
    var titular_id = existingObj.titular_id
    var titularEquipeId = ''
    if (titular_id) {
      try {
        var titularUser = $app.findRecordById('users', titular_id)
        titularEquipeId = titularUser.getString('equipe_id')
      } catch (_) {}
    }

    var bindingsArr = []
    if (atorPerfilSlug !== 'superadministrador' && titularEquipeId) {
      try {
        var hojeBind = hojeRecife()
        var foundBindings = $app.findRecordsByFilter(
          'com_usuarios_equipes',
          "usuario_id = '" + atorId + "' && ativo = true",
          '',
          100,
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
            vigente: bindingVigente(inicioVig, fimVig, hojeBind),
          })
        }
      } catch (_) {}
    }

    var rbac = validarRBAC(atorPerfilSlug, bindingsArr, titularEquipeId)
    if (!rbac.aprovado) {
      return e.json(403, {
        error: 'FORBIDDEN',
        message: 'Sem permissao para ajustar substituicao/ausencia',
        motivo: rbac.motivo,
      })
    }

    // 7. Guarda temporal — hojeRecife() >= data_inicio do registro existente
    var dataInicioExistente = existingObj.data_inicio
    if (dataInicioExistente && hojeRecife() >= dataInicioExistente) {
      return e.json(409, {
        error: 'JANELA_FECHADA',
        message: 'A janela do registro ja esta aberta/encerrada; nao pode ser ajustada',
      })
    }

    // 8. Construir campos mutáveis normalizados
    var camposMutaveisBody = {}
    if (hasOwn(body, 'substituto_principal_id')) {
      var spBody = body.substituto_principal_id
      camposMutaveisBody.substituto_principal_id =
        spBody === null || spBody === undefined ? null : spBody
    }
    if (hasOwn(body, 'substituto_reserva_id')) {
      var srBody = body.substituto_reserva_id
      camposMutaveisBody.substituto_reserva_id =
        srBody === null || srBody === undefined ? null : srBody
    }
    // data_inicio e data_fim são obrigatórios no envelope → sempre presentes
    camposMutaveisBody.data_inicio = body.data_inicio
    camposMutaveisBody.data_fim = body.data_fim
    if (hasOwn(body, 'negocios_cobertos')) {
      var ncBody = body.negocios_cobertos
      camposMutaveisBody.negocios_cobertos = ncBody === null || ncBody === undefined ? [] : ncBody
    }
    if (hasOwn(body, 'observacao')) {
      var obsBody = body.observacao
      camposMutaveisBody.observacao = obsBody === null || obsBody === undefined ? null : obsBody
    }

    // 9. Payload pós-ajuste (merge) e invariantes puras I2-I8
    var payloadPosAjuste = mergePayload(existingObj, camposMutaveisBody)
    var inv = validarInvariantes(payloadPosAjuste)
    if (!inv.valido) {
      return e.json(400, {
        error: 'INVARIANTE',
        message: 'Invariante violada',
        invariantes: inv.erros,
      })
    }

    // 10. payload_hash (canônico)
    var payload_hash = $security.sha256(
      canonicalize({
        id: body.id,
        updated_esperado: body.updated_esperado,
        payload: payloadPosAjuste,
      }),
    )

    // ═══════ FASE 2 — TRANSAÇÃO ATÔMICA ═══════

    var replayId = null
    var replayFlag = false
    var txError = null
    var staleUpdatedAtual = null

    try {
      $app.runInTransaction(function (txApp) {
        // 11. INSERT com_idempotencia (estado=executando)
        var idempCol = txApp.findCollectionByNameOrId('com_idempotencia')
        var idempRec = new Record(idempCol)
        idempRec.set('command_idempotency_key', body.command_idempotency_key)
        idempRec.set('comando', 'ajustar_ausencia_ou_substituicao')
        idempRec.set('ator_id', atorId)
        idempRec.set('payload_hash', payload_hash)
        idempRec.set('estado', 'executando')
        idempRec.set('executor_id', 'pb-primary')
        idempRec.set('tentativa', 1)
        idempRec.set('claim_version', 1)
        idempRec.set('inicio_em', new Date())
        idempRec.set('lease_ate', new Date(Date.now() + 300000))
        idempRec.set('codigo_retorno', '')
        idempRec.set('resultado', {})
        idempRec.set('registros_afetados', [])

        try {
          txApp.save(idempRec)
        } catch (saveErr) {
          var errMsg = String(saveErr)
          if (errMsg.indexOf('UNIQUE') !== -1) {
            var existing = []
            try {
              existing = txApp.findRecordsByFilter(
                'com_idempotencia',
                "ator_id='" +
                  atorId +
                  "' && comando='ajustar_ausencia_ou_substituicao' && command_idempotency_key='" +
                  body.command_idempotency_key +
                  "'",
                '',
                5,
                0,
              )
            } catch (_) {}
            if (existing && existing.length > 0) {
              var existRec = existing[0]
              var existHash = existRec.getString('payload_hash')
              var existEstado = existRec.getString('estado')
              if (existHash === payload_hash) {
                var regs = []
                try {
                  regs = existRec.get('registros_afetados') || []
                } catch (_) {}
                if (regs && regs.length > 0) {
                  replayId = regs[0]
                  replayFlag = true
                  return
                }
                replayId = null
                replayFlag = true
                return
              } else {
                if (existEstado === 'executando') {
                  throw new Error('CONCORRENTE')
                }
                throw new Error('CONFLICT')
              }
            } else {
              throw saveErr
            }
          }
          throw saveErr
        }

        // ── REVALIDAÇÃO RBAC INTRA-TRANSAÇÃO ──
        // RBAC-1. Reler usuário autenticado via txApp
        var usuarioAtualTx = null
        try {
          usuarioAtualTx = txApp.findRecordById('users', atorId)
        } catch (_) {}
        if (!usuarioAtualTx) throw new Error('FORBIDDEN')

        // RBAC-2. Validar ativo_comercial
        var valUsuario = validarUsuario({
          ativo_comercial: usuarioAtualTx.getBool('ativo_comercial'),
        })
        if (!valUsuario.aprovado) throw new Error('FORBIDDEN')

        // RBAC-3. Perfil direto (via txApp)
        var atorPerfilSlugTx = ''
        try {
          var perfilIdAtualTx = usuarioAtualTx.getString('perfil_id')
          if (perfilIdAtualTx) {
            var perfilRecTx = txApp.findRecordById('com_perfis', perfilIdAtualTx)
            atorPerfilSlugTx = perfilRecTx.getString('slug')
          }
        } catch (_) {}

        // RBAC-4. Fallback superadmin por binding (via txApp, COM vigência)
        var hojeTx = hojeRecife()
        if (!atorPerfilSlugTx) {
          try {
            var saBindingsTx = txApp.findRecordsByFilter(
              'com_usuarios_equipes',
              "usuario_id = '" + atorId + "' && ativo = true",
              '',
              100,
              0,
            )
            if (saBindingsTx && saBindingsTx.length > 0) {
              var bindingsFbTx = []
              for (var sbi = 0; sbi < saBindingsTx.length; sbi++) {
                var sbRec = saBindingsTx[sbi]
                var sbPerfilSlug = ''
                try {
                  var sbPerfilRec = txApp.findRecordById('com_perfis', sbRec.getString('perfil_id'))
                  sbPerfilSlug = sbPerfilRec.getString('slug')
                } catch (_) {}
                bindingsFbTx.push({
                  ativo: sbRec.getBool('ativo'),
                  perfilSlug: sbPerfilSlug,
                  inicio_vigencia: sbRec.getString('inicio_vigencia'),
                  fim_vigencia: sbRec.getString('fim_vigencia'),
                })
              }
              if (resolverFallbackSuperadmin(bindingsFbTx, hojeTx)) {
                atorPerfilSlugTx = 'superadministrador'
              }
            }
          } catch (_) {}
        }
        if (!atorPerfilSlugTx) throw new Error('FORBIDDEN')

        // RBAC-5. Se NÃO é superadmin, validar bindings de gestor
        if (atorPerfilSlugTx !== 'superadministrador') {
          var titularEquipeIdTx = ''
          if (titular_id) {
            try {
              var titularUserTx = txApp.findRecordById('users', titular_id)
              titularEquipeIdTx = titularUserTx.getString('equipe_id')
            } catch (_) {}
          }
          if (!titularEquipeIdTx) throw new Error('FORBIDDEN')

          var bindingsArrTx = []
          try {
            var foundTx = txApp.findRecordsByFilter(
              'com_usuarios_equipes',
              "usuario_id = '" + atorId + "' && ativo = true",
              '',
              100,
              0,
            )
            for (var bi = 0; bi < foundTx.length; bi++) {
              var bRecTx = foundTx[bi]
              var bPerfilSlugTx = ''
              try {
                var bPerfilRecTx = txApp.findRecordById('com_perfis', bRecTx.getString('perfil_id'))
                bPerfilSlugTx = bPerfilRecTx.getString('slug')
              } catch (_) {}
              var inicioVigTx = bRecTx.getString('inicio_vigencia')
              var fimVigTx = bRecTx.getString('fim_vigencia')
              bindingsArrTx.push({
                equipe_id: bRecTx.getString('equipe_id'),
                perfilSlug: bPerfilSlugTx,
                ativo: bRecTx.getBool('ativo'),
                vigente: bindingVigente(inicioVigTx, fimVigTx, hojeTx),
              })
            }
          } catch (_) {}

          var rbacTx = validarRBAC(atorPerfilSlugTx, bindingsArrTx, titularEquipeIdTx)
          if (!rbacTx.aprovado) throw new Error('FORBIDDEN')
        }

        // 12. RE-LEITURA do registro DENTRO da transação
        var registroAtual = null
        try {
          registroAtual = txApp.findRecordById('com_substituicoes', body.id)
        } catch (_) {
          throw new Error('NAO_ENCONTRADO')
        }
        if (!registroAtual) {
          throw new Error('NAO_ENCONTRADO')
        }
        if (registroAtual.getString('cancelada_em')) {
          throw new Error('CANCELADO')
        }
        var atualObj = recordToObj(registroAtual)
        if (atualObj.data_inicio && hojeRecife() >= atualObj.data_inicio) {
          throw new Error('JANELA_FECHADA')
        }

        // 13. OPTIMISTIC CONCURRENCY
        var updatedAtual = registroAtual.getString('updated') || ''
        if (updatedAtual !== body.updated_esperado) {
          staleUpdatedAtual = updatedAtual
          throw new Error('STALE_WRITE')
        }

        // 14. Revalidar invariantes sobre o registro ATUAL (relido)
        var payloadResultante = mergePayload(atualObj, camposMutaveisBody)
        var invTx = validarInvariantes(payloadResultante)
        if (!invTx.valido) {
          throw new Error('INVARIANTE')
        }

        // I1 (sobreposição) excluindo o próprio id
        var existentes = []
        try {
          existentes = txApp.findRecordsByFilter(
            'com_substituicoes',
            "titular_id = '" + atualObj.titular_id + "' && cancelada_em = null",
            '',
            500,
            0,
          )
        } catch (_) {}
        var novaInicio = payloadResultante.data_inicio
        var novaFim = payloadResultante.data_fim
        for (var ei = 0; ei < existentes.length; ei++) {
          if (existentes[ei].id === body.id) continue
          var exInicio = (existentes[ei].getString('data_inicio') || '').slice(0, 10)
          var exFim = (existentes[ei].getString('data_fim') || '').slice(0, 10)
          if (exInicio <= novaFim && exFim >= novaInicio) {
            throw new Error('SOBREPOSICAO')
          }
        }

        // I4 (responsável negócios) — checagem persistida
        if (
          payloadResultante.tipo_cobertura === 'por_negocios' &&
          payloadResultante.negocios_cobertos &&
          payloadResultante.negocios_cobertos.length > 0
        ) {
          for (var nci = 0; nci < payloadResultante.negocios_cobertos.length; nci++) {
            var negRec = null
            try {
              negRec = txApp.findRecordById(
                'com_negocios',
                payloadResultante.negocios_cobertos[nci],
              )
            } catch (_) {}
            if (!negRec) {
              throw new Error('I4_NEGOCIO_INEXISTENTE')
            }
            if (negRec.getString('responsavel_id') !== atualObj.titular_id) {
              throw new Error('I4_RESPONSAVEL')
            }
          }
        }

        // 15. Snapshot PRÉ-update (valor_anterior)
        var snapshotPre = {
          titular_id: atualObj.titular_id,
          substituto_principal_id: atualObj.substituto_principal_id,
          substituto_reserva_id: atualObj.substituto_reserva_id,
          data_inicio: atualObj.data_inicio,
          data_fim: atualObj.data_fim,
          tipo_cobertura: atualObj.tipo_cobertura,
          negocios_cobertos: atualObj.negocios_cobertos,
          motivo: atualObj.motivo,
          observacao: atualObj.observacao,
          autor_id: atualObj.autor_id,
        }
        var valorAnterior = canonicalize(snapshotPre)
        if (valorAnterior.length > 2048) {
          throw new Error('SNAPSHOT_TOO_LARGE')
        }

        // 16. UPDATE com_substituicoes (campos mutáveis)
        var recToUpdate = txApp.findRecordById('com_substituicoes', body.id)
        if (hasOwn(camposMutaveisBody, 'substituto_principal_id')) {
          recToUpdate.set(
            'substituto_principal_id',
            camposMutaveisBody.substituto_principal_id || null,
          )
        }
        if (hasOwn(camposMutaveisBody, 'substituto_reserva_id')) {
          recToUpdate.set('substituto_reserva_id', camposMutaveisBody.substituto_reserva_id || null)
        }
        recToUpdate.set('data_inicio', camposMutaveisBody.data_inicio)
        recToUpdate.set('data_fim', camposMutaveisBody.data_fim)
        if (hasOwn(camposMutaveisBody, 'negocios_cobertos')) {
          recToUpdate.set('negocios_cobertos', camposMutaveisBody.negocios_cobertos)
        }
        if (hasOwn(camposMutaveisBody, 'observacao')) {
          var obsVal = camposMutaveisBody.observacao
          recToUpdate.set('observacao', obsVal ? obsVal : '')
        }
        txApp.save(recToUpdate)

        // 17. INSERT com_auditoria
        var snapshotPos = {
          titular_id: payloadResultante.titular_id,
          substituto_principal_id: payloadResultante.substituto_principal_id,
          substituto_reserva_id: payloadResultante.substituto_reserva_id,
          data_inicio: payloadResultante.data_inicio,
          data_fim: payloadResultante.data_fim,
          tipo_cobertura: payloadResultante.tipo_cobertura,
          negocios_cobertos: payloadResultante.negocios_cobertos,
          motivo: payloadResultante.motivo,
          observacao: payloadResultante.observacao,
          autor_id: payloadResultante.autor_id,
        }
        if (JSON.stringify(snapshotPos).length > 2048) {
          throw new Error('SNAPSHOT_TOO_LARGE')
        }
        var audCol = txApp.findCollectionByNameOrId('com_auditoria')
        var audRec = new Record(audCol)
        audRec.set('collection_name', 'com_substituicoes')
        audRec.set('record_id', body.id)
        audRec.set('acao', 'update')
        audRec.set('usuario_id', atorId)
        audRec.set('comando', 'ajustar_ausencia_ou_substituicao')
        audRec.set('command_idempotency_key', body.command_idempotency_key)
        audRec.set(
          'transacao_id',
          $security.sha256(
            body.command_idempotency_key +
              '|' +
              body.id +
              '|' +
              String(Date.now()) +
              '|' +
              $security.randomString(8),
          ),
        )
        audRec.set('evento_em', new Date())
        audRec.set('valor_anterior', valorAnterior)
        audRec.set('snapshot_hash', $security.sha256(canonicalize(snapshotPos)))
        audRec.set('snapshot_hash_versao', '1')
        audRec.set('evidencia_estruturada', snapshotPos)
        audRec.set('perfil', atorPerfilSlug)
        audRec.set('escopo', 'comando')
        audRec.set('origem', 'server-side')
        audRec.set('sequencia', 1)
        txApp.save(audRec)

        // 18. UPDATE com_idempotencia (estado=concluído)
        idempRec.set('estado', 'concluido')
        idempRec.set('conclusao_em', new Date())
        idempRec.set('codigo_retorno', '200')
        idempRec.set('registros_afetados', [body.id])
        idempRec.set('resultado', { acao: 'updated' })
        txApp.save(idempRec)
      })
    } catch (err) {
      txError = String(err).substring(0, 500)
    }

    // ═══════ FASE 3 — RESPOSTA (pós-transação) ═══════

    if (txError) {
      if (txError.indexOf('CONFLICT') !== -1) {
        return e.json(409, {
          error: 'CONFLICT',
          message: 'Mesma chave de idempotencia com payload diferente',
        })
      }
      if (txError.indexOf('CONCORRENTE') !== -1) {
        return e.json(409, {
          error: 'CONCORRENTE',
          message: 'Request em andamento para esta chave',
        })
      }
      if (txError.indexOf('STALE_WRITE') !== -1) {
        return e.json(409, {
          error: 'STALE_WRITE',
          message: 'Registro foi alterado concorrentemente. Releia e tente novamente.',
          updated_atual: staleUpdatedAtual || '',
        })
      }
      if (txError.indexOf('CANCELADO') !== -1) {
        return e.json(409, {
          error: 'CANCELADO',
          message: 'Registro cancelado nao pode ser ajustado',
        })
      }
      if (txError.indexOf('JANELA_FECHADA') !== -1) {
        return e.json(409, {
          error: 'JANELA_FECHADA',
          message: 'A janela do registro ja esta aberta/encerrada; nao pode ser ajustada',
        })
      }
      if (txError.indexOf('SOBREPOSICAO') !== -1) {
        return e.json(409, {
          error: 'SOBREPOSICAO',
          message: 'I1: existe substituicao/ausencia vigente sobreposta para o titular',
        })
      }
      if (
        txError.indexOf('INVARIANTE') !== -1 ||
        txError.indexOf('I4_NEGOCIO_INEXISTENTE') !== -1 ||
        txError.indexOf('I4_RESPONSAVEL') !== -1
      ) {
        var invMsg = 'Invariante violada'
        var invErrs = []
        if (txError.indexOf('I4_NEGOCIO_INEXISTENTE') !== -1) {
          invErrs.push('I4')
          invMsg = 'I4: negocio inexistente'
        } else if (txError.indexOf('I4_RESPONSAVEL') !== -1) {
          invErrs.push('I4')
          invMsg = 'I4: negocio nao pertence ao titular'
        }
        return e.json(400, {
          error: 'INVARIANTE',
          message: invMsg,
          invariantes: invErrs,
        })
      }
      if (txError.indexOf('NAO_ENCONTRADO') !== -1) {
        return e.json(404, { error: 'NAO_ENCONTRADO', message: 'Registro nao encontrado' })
      }
      if (txError.indexOf('SNAPSHOT_TOO_LARGE') !== -1) {
        return e.json(400, {
          error: 'SNAPSHOT_TOO_LARGE',
          message: 'Snapshot excede 2048 bytes',
        })
      }
      if (txError.indexOf('FORBIDDEN') !== -1) {
        return e.json(403, {
          error: 'FORBIDDEN',
          message: 'Sem permissao para ajustar substituicao/ausencia',
        })
      }
      return e.json(500, { error: 'INTERNAL', message: txError })
    }

    if (replayFlag) {
      return e.json(200, { id: replayId })
    }
    return e.json(200, { id: body.id })
  },
  $apis.requireAuth(),
  $apis.bodyLimit(262144),
)

/* ──── BLOCO DE TESTES ESTÁTICOS ──── */
var __testExports = (function () {
  function canonicalize(obj) {
    if (obj === null || obj === undefined) return 'null'
    if (typeof obj !== 'object') return JSON.stringify(obj)
    if (Array.isArray(obj)) {
      var items = []
      for (var i = 0; i < obj.length; i++) items.push(canonicalize(obj[i]))
      return '[' + items.join(',') + ']'
    }
    var keys = Object.keys(obj)
      .filter(function (k) {
        return obj[k] !== undefined
      })
      .sort()
    var parts = []
    for (var j = 0; j < keys.length; j++)
      parts.push(JSON.stringify(keys[j]) + ':' + canonicalize(obj[keys[j]]))
    return '{' + parts.join(',') + '}'
  }

  function validarInvariantes(payload) {
    var erros = []
    if (!payload || typeof payload !== 'object') {
      return { valido: false, erros: ['payload_invalido'] }
    }

    var titular_id = payload.titular_id || ''
    var substituto_principal_id = payload.substituto_principal_id || null
    var substituto_reserva_id = payload.substituto_reserva_id || null
    var data_inicio = payload.data_inicio || ''
    var data_fim = payload.data_fim || ''
    var tipo_cobertura = payload.tipo_cobertura || ''
    var negocios_cobertos = payload.negocios_cobertos
    if (!negocios_cobertos) negocios_cobertos = []

    var temPrincipal = !!substituto_principal_id
    var temReserva = !!substituto_reserva_id

    if (data_inicio && data_fim) {
      if (data_fim < data_inicio) erros.push('I2')
    } else {
      erros.push('I2')
    }

    if (temReserva && !temPrincipal) erros.push('I3')

    if (tipo_cobertura === 'por_negocios') {
      if (!temPrincipal) erros.push('I4')
      if (!negocios_cobertos || negocios_cobertos.length === 0) erros.push('I4')
    }

    if (tipo_cobertura === 'integral' && temPrincipal) {
      if (negocios_cobertos && negocios_cobertos.length > 0) erros.push('I5')
    }

    if (!temPrincipal) {
      if (tipo_cobertura !== 'integral') erros.push('I6')
      if (temReserva) erros.push('I6')
      if (negocios_cobertos && negocios_cobertos.length > 0) erros.push('I6')
    }

    if (temPrincipal && titular_id && substituto_principal_id === titular_id) {
      erros.push('I7')
    }

    if (temPrincipal && temReserva && substituto_principal_id === substituto_reserva_id) {
      erros.push('I8')
    }

    var uniq = []
    for (var k = 0; k < erros.length; k++) {
      if (uniq.indexOf(erros[k]) === -1) uniq.push(erros[k])
    }
    return { valido: uniq.length === 0, erros: uniq }
  }

  function validarRBAC(perfilSlug, bindings, titularEquipeId) {
    if (perfilSlug === 'superadministrador') {
      return { aprovado: true, motivo: 'superadmin' }
    }
    if (!titularEquipeId) {
      return { aprovado: false, motivo: 'titular_sem_equipe' }
    }
    if (!bindings || bindings.length === 0) {
      return { aprovado: false, motivo: 'sem_bindings' }
    }
    for (var i = 0; i < bindings.length; i++) {
      var b = bindings[i]
      var isGestor = b.perfilSlug === 'gestor' || b.perfilSlug === 'gestor-comercial'
      if (isGestor && b.ativo === true && b.vigente === true && b.equipe_id === titularEquipeId) {
        return { aprovado: true, motivo: 'gestor_equipe' }
      }
    }
    return { aprovado: false, motivo: 'sem_correspondencia' }
  }

  // hojeRecife — offset fixo UTC-03.
  // ⚠️ FUTURO: se o Brasil reintroduzir DST ou alterar o fuso de Recife,
  //    esta constante deverá ser revisada.
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

  function validarUsuario(usuario) {
    if (!usuario) return { aprovado: false, motivo: 'usuario_inexistente' }
    if (usuario.ativo_comercial !== true) return { aprovado: false, motivo: 'comercial_inativo' }
    return { aprovado: true, motivo: 'ok' }
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

  function mergePayload(registroExistente, camposMutaveis) {
    var mutaveis = [
      'substituto_principal_id',
      'substituto_reserva_id',
      'data_inicio',
      'data_fim',
      'negocios_cobertos',
      'observacao',
    ]
    var result = {}
    for (var k in registroExistente) {
      if (Object.prototype.hasOwnProperty.call(registroExistente, k)) {
        result[k] = registroExistente[k]
      }
    }
    for (var i = 0; i < mutaveis.length; i++) {
      var f = mutaveis[i]
      if (Object.prototype.hasOwnProperty.call(camposMutaveis, f)) {
        result[f] = camposMutaveis[f]
      }
    }
    return result
  }

  return {
    canonicalize: canonicalize,
    validarInvariantes: validarInvariantes,
    validarRBAC: validarRBAC,
    hojeRecife: hojeRecife,
    mergePayload: mergePayload,
    bindingVigente: bindingVigente,
    validarUsuario: validarUsuario,
    resolverFallbackSuperadmin: resolverFallbackSuperadmin,
  }
})()
/* ──── FIM DO BLOCO DE TESTES ESTÁTICOS ──── */
