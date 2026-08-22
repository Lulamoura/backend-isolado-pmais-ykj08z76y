// G39-E2C-C3B1 — Implantação do comando criar_ausencia_ou_substituicao
// Endpoint: POST /backend/v1/substituicoes/criar
//
// Observação de domínio: o perfil de gestor comercial é seedado com slug
// "gestor-comercial" (migration 0026). O plano de comando referencia o slug
// "gestor"; o RBAC abaixo aceita AMBOS ("gestor" e "gestor-comercial") para
// permanecer fiel ao plano e compatível com o estado real do banco.

routerAdd(
  'POST',
  '/backend/v1/substituicoes/criar',
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
    // separadamente na FASE 1 porque depende de dados persistentes).
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
      // Comparação lexicográfica funciona para ISO YYYY-MM-DD.
      if (data_inicio && data_fim) {
        if (data_fim < data_inicio) erros.push('I2')
      } else {
        erros.push('I2')
      }

      // I3: reserva preenchido ⇒ principal preenchido
      if (temReserva && !temPrincipal) erros.push('I3')

      // I4: tipo_cobertura = "por_negocios" ⇒ principal preenchido &&
      //     negocios_cobertos não vazio && todos os negócios têm
      //     responsavel_id = titular_id.
      //     (A verificação de responsavel_id depende de dados persistidos e
      //     é realizada na FASE 1; aqui validamos apenas a parte pura:
      //     principal preenchido e negocios_cobertos não vazio.)
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
      // Superadmin → aprovado
      if (perfilSlug === 'superadministrador') {
        return { aprovado: true, motivo: 'superadmin' }
      }

      // Titular sem equipe → somente superadmin pode
      if (!titularEquipeId) {
        return { aprovado: false, motivo: 'titular_sem_equipe' }
      }

      // Gestor: basta UMA correspondência ativa e vigente na mesma equipe
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

    // ═══════ FASE 1 — PRÉ-VALIDAÇÃO (fora da transação) ═══════

    // 1. Autenticar, extrair autor_id
    var ator = e.auth
    if (!ator) return e.unauthorizedError('Autenticacao necessaria')
    var atorId = ator.id

    // autor_id SEMPRE derivado do auth; REJEITAR autor_id no body
    var rawBody = toString(e.request.body)
    if (!rawBody) return e.badRequestError('Corpo da requisicao vazio')
    var body
    try {
      body = JSON.parse(rawBody)
    } catch (parseErr) {
      return e.badRequestError('Corpo da requisicao nao e JSON valido')
    }
    if (body && Object.prototype.hasOwnProperty.call(body, 'autor_id')) {
      return e.json(400, {
        error: 'AUTOR_ID_PROIBIDO',
        message: 'autor_id nao e permitido no body; derivado do usuario autenticado',
      })
    }

    // Determinar perfil do ator (slug) — padrão ac_rollback.js:25-46
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

    // 2. Validar RBAC
    //    Para o caminho do gestor, consultar bindings ativos e vigentes.
    var titular_id = body.titular_id || ''
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
        var hoje = hojeRecife()
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
            vigente: bindingVigente(inicioVig, fimVig, hoje),
          })
        }
      } catch (_) {}
    }

    var rbac = validarRBAC(atorPerfilSlug, bindingsArr, titularEquipeId)
    if (!rbac.aprovado) {
      return e.json(403, {
        error: 'FORBIDDEN',
        message: 'Sem permissao para criar substituicao/ausencia',
        motivo: rbac.motivo,
      })
    }

    // 3. Validar body (campos obrigatórios, tipos)
    function isStr(v) {
      return typeof v === 'string'
    }
    if (!isStr(body.command_idempotency_key) || !body.command_idempotency_key) {
      return e.json(400, { error: 'VALIDATION', message: 'command_idempotency_key obrigatorio' })
    }
    if (body.command_idempotency_key.length > 128) {
      return e.json(400, { error: 'VALIDATION', message: 'command_idempotency_key excede 128' })
    }
    if (!isStr(body.titular_id) || !body.titular_id) {
      return e.json(400, { error: 'VALIDATION', message: 'titular_id obrigatorio' })
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
    // Normaliza para YYYY-MM-DD (aceita apenas formato ISO de data)
    var dateRe = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRe.test(body.data_inicio) || !dateRe.test(body.data_fim)) {
      return e.json(400, {
        error: 'VALIDATION',
        message: 'data_inicio/data_fim devem ser YYYY-MM-DD',
      })
    }
    if (body.tipo_cobertura !== 'integral' && body.tipo_cobertura !== 'por_negocios') {
      return e.json(400, { error: 'VALIDATION', message: 'tipo_cobertura invalido' })
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
    if (body.motivo !== 'ferias' && body.motivo !== 'licenca' && body.motivo !== 'falta') {
      return e.json(400, { error: 'VALIDATION', message: 'motivo invalido' })
    }
    if (body.observacao !== null && body.observacao !== undefined) {
      if (!isStr(body.observacao)) {
        return e.json(400, { error: 'VALIDATION', message: 'observacao invalida' })
      }
      if (body.observacao.length > 1000) {
        return e.json(400, { error: 'VALIDATION', message: 'observacao excede 1000' })
      }
    }
    if (!isStr(body.creation_idempotency_key) || !body.creation_idempotency_key) {
      return e.json(400, { error: 'VALIDATION', message: 'creation_idempotency_key obrigatoria' })
    }
    if (body.creation_idempotency_key.length > 128) {
      return e.json(400, { error: 'VALIDATION', message: 'creation_idempotency_key excede 128' })
    }

    // Normaliza opcionais null/undefined → null
    var substituto_principal_id = body.substituto_principal_id || null
    var substituto_reserva_id = body.substituto_reserva_id || null
    var negocios_cobertos = body.negocios_cobertos || []
    var observacao = body.observacao || null

    var payloadDomain = {
      titular_id: body.titular_id,
      substituto_principal_id: substituto_principal_id,
      substituto_reserva_id: substituto_reserva_id,
      data_inicio: body.data_inicio,
      data_fim: body.data_fim,
      tipo_cobertura: body.tipo_cobertura,
      negocios_cobertos: negocios_cobertos,
      motivo: body.motivo,
      observacao: observacao,
      creation_idempotency_key: body.creation_idempotency_key,
    }

    // 4. Validar invariantes I2-I8 (puras)
    var inv = validarInvariantes(payloadDomain)
    if (!inv.valido) {
      return e.json(400, {
        error: 'INVARIANTE',
        message: 'Invariante violada',
        invariantes: inv.erros,
      })
    }

    // I4 (parte persistida): todos os negócios têm responsavel_id = titular_id
    if (body.tipo_cobertura === 'por_negocios' && negocios_cobertos.length > 0) {
      for (var nci = 0; nci < negocios_cobertos.length; nci++) {
        var negRec = null
        try {
          negRec = $app.findRecordById('com_negocios', negocios_cobertos[nci])
        } catch (_) {}
        if (!negRec) {
          return e.json(400, {
            error: 'INVARIANTE',
            message: 'I4: negocio inexistente',
            invariantes: ['I4'],
          })
        }
        if (negRec.getString('responsavel_id') !== body.titular_id) {
          return e.json(400, {
            error: 'INVARIANTE',
            message: 'I4: negocio nao pertence ao titular',
            invariantes: ['I4'],
          })
        }
      }
    }

    // 5. Consultar I1 (sobreposição inclusiva)
    var existentes = []
    try {
      existentes = $app.findRecordsByFilter(
        'com_substituicoes',
        "titular_id = '" + body.titular_id + "' && cancelada_em = null",
        '',
        500,
        0,
      )
    } catch (_) {}
    var novaInicio = body.data_inicio
    var novaFim = body.data_fim
    for (var ei = 0; ei < existentes.length; ei++) {
      var exInicio = existentes[ei].getString('data_inicio')
      var exFim = existentes[ei].getString('data_fim')
      if (exInicio <= novaFim && exFim >= novaInicio) {
        return e.json(409, {
          error: 'SOBREPOSICAO',
          message: 'I1: existe substituicao/ausencia vigente sobreposta para o titular',
        })
      }
    }

    // payload_hash (canônico)
    var payload_hash = $security.sha256(canonicalize(payloadDomain))

    // ═══════ FASE 2 — TRANSAÇÃO ATÔMICA ═══════

    var replayId = null
    var replayFlag = false
    var txError = null
    var subRecId = null

    try {
      $app.runInTransaction(function (txApp) {
        // 6. TENTAR inserir com_idempotencia com estado="executando"
        var idempCol = txApp.findCollectionByNameOrId('com_idempotencia')
        var idempRec = new Record(idempCol)
        idempRec.set('command_idempotency_key', body.command_idempotency_key)
        idempRec.set('comando', 'criar_ausencia_ou_substituicao')
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
          // UNIQUE constraint violation no índice composto
          if (errMsg.indexOf('UNIQUE') !== -1) {
            // Re-ler DENTRO da transação
            var existing = []
            try {
              existing = txApp.findRecordsByFilter(
                'com_idempotencia',
                "ator_id='" +
                  atorId +
                  "' && comando='criar_ausencia_ou_substituicao' && command_idempotency_key='" +
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
                // REPLAY
                var regs = []
                try {
                  regs = existRec.get('registros_afetados') || []
                } catch (_) {}
                if (regs && regs.length > 0) {
                  replayId = regs[0]
                  replayFlag = true
                  return // sai da transação sem persistir nada novo
                }
                // Concluído sem registros afetados — replay vazio
                replayId = null
                replayFlag = true
                return
              } else {
                // CONFLICT: mesma chave, payload diferente
                if (existEstado === 'executando') {
                  throw new Error('CONCORRENTE')
                }
                throw new Error('CONFLICT')
              }
            } else {
              // não encontrado → relançar erro original
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

        // 7. Criar registro em com_substituicoes
        var subCol = txApp.findCollectionByNameOrId('com_substituicoes')
        var subRec = new Record(subCol)
        subRec.set('titular_id', body.titular_id)
        if (substituto_principal_id) subRec.set('substituto_principal_id', substituto_principal_id)
        if (substituto_reserva_id) subRec.set('substituto_reserva_id', substituto_reserva_id)
        subRec.set('data_inicio', body.data_inicio)
        subRec.set('data_fim', body.data_fim)
        subRec.set('tipo_cobertura', body.tipo_cobertura)
        subRec.set('negocios_cobertos', negocios_cobertos)
        subRec.set('motivo', body.motivo)
        if (observacao) subRec.set('observacao', observacao)
        subRec.set('autor_id', atorId)
        subRec.set('creation_idempotency_key', body.creation_idempotency_key)
        txApp.save(subRec)
        subRecId = subRec.id

        // 8. Criar registro em com_auditoria
        var snapshot = {
          titular_id: body.titular_id,
          substituto_principal_id: substituto_principal_id,
          substituto_reserva_id: substituto_reserva_id,
          data_inicio: body.data_inicio,
          data_fim: body.data_fim,
          tipo_cobertura: body.tipo_cobertura,
          negocios_cobertos: negocios_cobertos,
          motivo: body.motivo,
          observacao: observacao,
          autor_id: atorId,
        }
        if (JSON.stringify(snapshot).length > 2048) {
          throw new Error('SNAPSHOT_TOO_LARGE')
        }
        var audCol = txApp.findCollectionByNameOrId('com_auditoria')
        var audRec = new Record(audCol)
        audRec.set('collection_name', 'com_substituicoes')
        audRec.set('record_id', subRec.id)
        audRec.set('acao', 'create')
        audRec.set('usuario_id', atorId)
        audRec.set('comando', 'criar_ausencia_ou_substituicao')
        audRec.set('command_idempotency_key', body.command_idempotency_key)
        audRec.set(
          'transacao_id',
          $security.sha256(
            body.command_idempotency_key +
              '|' +
              body.creation_idempotency_key +
              '|' +
              String(Date.now()) +
              '|' +
              $security.randomString(8),
          ),
        )
        audRec.set('evento_em', new Date())
        audRec.set('snapshot_hash', $security.sha256(canonicalize(snapshot)))
        audRec.set('snapshot_hash_versao', '1')
        audRec.set('evidencia_estruturada', snapshot)
        audRec.set('perfil', atorPerfilSlug)
        audRec.set('escopo', 'comando')
        audRec.set('origem', 'server-side')
        audRec.set('sequencia', 1)
        txApp.save(audRec)

        // 9. ATUALIZAR registro de idempotência
        idempRec.set('estado', 'concluido')
        idempRec.set('conclusao_em', new Date())
        idempRec.set('codigo_retorno', '200')
        idempRec.set('registros_afetados', [subRec.id])
        idempRec.set('resultado', { acao: 'created' })
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
      if (txError.indexOf('SNAPSHOT_TOO_LARGE') !== -1) {
        return e.json(400, {
          error: 'SNAPSHOT_TOO_LARGE',
          message: 'Snapshot excede 2048 bytes',
        })
      }
      if (txError.indexOf('FORBIDDEN') !== -1) {
        return e.json(403, {
          error: 'FORBIDDEN',
          message: 'Sem permissao para criar substituicao/ausencia',
        })
      }
      // Tratamento de creation_idempotency_key duplicada (com command_idempotency_key diferente):
      // O txApp.save(com_substituicoes) lança erro de UNIQUE constraint; a transação aborta.
      // FORA da transação: capturar erro, ler registro existente por creation_idempotency_key.
      if (txError.indexOf('UNIQUE') !== -1) {
        var existSub = null
        try {
          existSub = $app.findFirstRecordByData(
            'com_substituicoes',
            'creation_idempotency_key',
            body.creation_idempotency_key,
          )
        } catch (_) {}
        if (existSub) {
          var sameAutor = existSub.getString('autor_id') === atorId
          var sameSemantics =
            existSub.getString('titular_id') === body.titular_id &&
            existSub.getString('data_inicio') === body.data_inicio &&
            existSub.getString('data_fim') === body.data_fim &&
            existSub.getString('tipo_cobertura') === body.tipo_cobertura &&
            existSub.getString('motivo') === body.motivo &&
            (existSub.getString('substituto_principal_id') || null) === substituto_principal_id &&
            (existSub.getString('substituto_reserva_id') || null) === substituto_reserva_id
          if (sameAutor && sameSemantics) {
            return e.json(200, { id: existSub.id })
          }
          return e.json(409, {
            error: 'CREATION_KEY_CONFLICT',
            message: 'creation_idempotency_key ja existe com dados diferentes',
          })
        }
      }
      return e.json(500, { error: 'INTERNAL', message: txError })
    }

    if (replayFlag) {
      return e.json(200, { id: replayId })
    }
    return e.json(200, { id: subRecId })
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

  return {
    canonicalize: canonicalize,
    validarInvariantes: validarInvariantes,
    validarRBAC: validarRBAC,
    hojeRecife: hojeRecife,
    bindingVigente: bindingVigente,
    validarUsuario: validarUsuario,
    resolverFallbackSuperadmin: resolverFallbackSuperadmin,
  }
})()
/* ──── FIM DO BLOCO DE TESTES ESTÁTICOS ──── */
