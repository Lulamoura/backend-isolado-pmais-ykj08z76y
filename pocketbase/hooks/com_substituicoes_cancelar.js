// G39-E2C-C3B2B-R5 — Implantação do comando cancelar_ausencia_ou_substituicao
// Endpoint: POST /backend/v1/substituicoes/cancelar
//
// Observação de domínio: o perfil de gestor comercial é seedado com slug
// "gestor-comercial" (migration 0026). O plano de comando referencia o slug
// "gestor"; o RBAC abaixo aceita AMBOS ("gestor" e "gestor-comercial") para
// permanecer fiel ao plano e compatível com o estado real do banco.

routerAdd(
  'POST',
  '/backend/v1/substituicoes/cancelar',
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

    // 2. Validar envelope FECHADO — exatamente as 4 chaves permitidas
    var chavesPermitidas = [
      'id',
      'updated_esperado',
      'justificativa_cancelamento',
      'command_idempotency_key',
    ]
    if (body && typeof body === 'object') {
      var chavesPresentes = Object.keys(body)
      for (var ci = 0; ci < chavesPresentes.length; ci++) {
        if (chavesPermitidas.indexOf(chavesPresentes[ci]) === -1) {
          return e.json(400, {
            error: 'VALIDATION',
            message: 'Chave nao permitida no body: ' + chavesPresentes[ci],
          })
        }
      }
    }

    function isStr(v) {
      return typeof v === 'string'
    }

    // 3. Trim da justificativa (antes do hash e do save)
    var justificativaTrimada = ''
    if (isStr(body.justificativa_cancelamento)) {
      justificativaTrimada = body.justificativa_cancelamento.trim()
    }

    // Validação estrutural — campos obrigatórios
    if (!isStr(body.id) || !body.id) {
      return e.json(400, { error: 'VALIDATION', message: 'id obrigatorio' })
    }
    if (!isStr(body.updated_esperado) || !body.updated_esperado) {
      return e.json(400, { error: 'VALIDATION', message: 'updated_esperado obrigatorio' })
    }
    if (!justificativaTrimada) {
      return e.json(400, {
        error: 'VALIDATION',
        message: 'justificativa_cancelamento obrigatoria e nao vazia',
      })
    }
    if (justificativaTrimada.length > 500) {
      return e.json(400, {
        error: 'VALIDATION',
        message: 'justificativa_cancelamento excede 500 caracteres',
      })
    }
    if (!isStr(body.command_idempotency_key) || !body.command_idempotency_key) {
      return e.json(400, { error: 'VALIDATION', message: 'command_idempotency_key obrigatorio' })
    }
    if (body.command_idempotency_key.length > 128) {
      return e.json(400, { error: 'VALIDATION', message: 'command_idempotency_key excede 128' })
    }

    // 4. Canonicalização e payload_hash
    var payload_hash = $security.sha256(
      canonicalize({
        id: body.id,
        updated_esperado: body.updated_esperado,
        justificativa: justificativaTrimada,
      }),
    )

    // 5. Classificar idempotência ANTES de buscar registro, RBAC ou guardas
    var idempExistente = null
    try {
      var idempFound = $app.findRecordsByFilter(
        'com_idempotencia',
        "ator_id='" +
          atorId +
          "' && comando='cancelar_ausencia_ou_substituicao' && command_idempotency_key='" +
          body.command_idempotency_key +
          "'",
        '',
        5,
        0,
      )
      if (idempFound && idempFound.length > 0) {
        idempExistente = idempFound[0]
      }
    } catch (_) {}

    if (idempExistente) {
      var existHash = idempExistente.getString('payload_hash')
      var existEstado = idempExistente.getString('estado')
      if (existHash === payload_hash) {
        if (existEstado === 'concluido') {
          // Replay íntegro?
          var regsExist = []
          try {
            regsExist = idempExistente.get('registros_afetados') || []
          } catch (_) {}
          if (regsExist && regsExist.length > 0) {
            // resultado íntegro → replay 200 {id}
            return e.json(200, { id: regsExist[0] })
          }
          // concluído sem resultado íntegro
          return e.json(500, {
            error: 'INTEGRIDADE_IDEMPOTENCIA',
            message: 'Registro de idempotencia concluido sem registros_afetados integros',
          })
        }
        if (existEstado === 'executando') {
          return e.json(409, {
            error: 'CONCORRENTE',
            message: 'Request em andamento para esta chave',
          })
        }
        // estado rejeitado/abandonado com mesmo hash — trata como concorrente
        return e.json(409, {
          error: 'CONCORRENTE',
          message: 'Request em andamento para esta chave',
        })
      } else {
        // mesma chave, hash diferente
        return e.json(409, {
          error: 'CONFLICT',
          message: 'Mesma chave de idempotencia com payload diferente',
        })
      }
    }

    // ═══════ FASE 2 — TRANSAÇÃO ATÔMICA ═══════

    var replayId = null
    var replayFlag = false
    var txError = null
    var staleUpdatedAtual = null

    try {
      $app.runInTransaction(function (txApp) {
        // 1. Criar claim executando, com salvaguarda UNIQUE/race e
        //    reclassificação idempotente
        var idempCol = txApp.findCollectionByNameOrId('com_idempotencia')
        var idempRec = new Record(idempCol)
        idempRec.set('command_idempotency_key', body.command_idempotency_key)
        idempRec.set('comando', 'cancelar_ausencia_ou_substituicao')
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
          var errMsgTx = String(saveErr)
          if (errMsgTx.indexOf('UNIQUE') !== -1) {
            // Re-classificação idempotente DENTRO da transação
            var existingTx = []
            try {
              existingTx = txApp.findRecordsByFilter(
                'com_idempotencia',
                "ator_id='" +
                  atorId +
                  "' && comando='cancelar_ausencia_ou_substituicao' && command_idempotency_key='" +
                  body.command_idempotency_key +
                  "'",
                '',
                5,
                0,
              )
            } catch (_) {}
            if (existingTx && existingTx.length > 0) {
              var existRecTx = existingTx[0]
              var existHashTx = existRecTx.getString('payload_hash')
              var existEstadoTx = existRecTx.getString('estado')
              if (existHashTx === payload_hash) {
                if (existEstadoTx === 'concluido') {
                  var regsTx = []
                  try {
                    regsTx = existRecTx.get('registros_afetados') || []
                  } catch (_) {}
                  if (regsTx && regsTx.length > 0) {
                    replayId = regsTx[0]
                    replayFlag = true
                    return // replay íntegro — não persiste nada novo
                  }
                  // concluído sem resultado íntegro
                  throw new Error('INTEGRIDADE_IDEMPOTENCIA')
                }
                if (existEstadoTx === 'executando') {
                  throw new Error('CONCORRENTE')
                }
                throw new Error('CONCORRENTE')
              } else {
                throw new Error('CONFLICT')
              }
            } else {
              throw saveErr
            }
          }
          throw saveErr
        }

        // 2. REVALIDAÇÃO RBAC INTRA-TRANSAÇÃO (RBAC-1 a RBAC-5)
        // RBAC-1. Reler usuário autenticado via txApp
        var usuarioAtualTx = null
        try {
          usuarioAtualTx = txApp.findRecordById('users', atorId)
        } catch (_) {}
        if (!usuarioAtualTx) throw new Error('FORBIDDEN')

        // RBAC-2. Validar ativo_comercial (obrigatório inclusive para SA direto)
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

        // 3. Reler com_substituicoes por id
        var registroAtual = null
        try {
          registroAtual = txApp.findRecordById('com_substituicoes', body.id)
        } catch (_) {
          throw new Error('NAO_ENCONTRADO')
        }
        if (!registroAtual) {
          throw new Error('NAO_ENCONTRADO')
        }

        var atualObj = recordToObj(registroAtual)

        // RBAC-5. Se NÃO é superadmin, validar bindings de gestor na equipe do
        // titular do registro
        if (atorPerfilSlugTx !== 'superadministrador') {
          var titularEquipeIdTx = ''
          if (atualObj.titular_id) {
            try {
              var titularUserTx = txApp.findRecordById('users', atualObj.titular_id)
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

        // 4. Comparar updated com updated_esperado; divergência → STALE_WRITE
        var updatedAtual = registroAtual.getString('updated') || ''
        if (updatedAtual !== body.updated_esperado) {
          staleUpdatedAtual = updatedAtual
          throw new Error('STALE_WRITE')
        }

        // 5. Se cancelada_em preenchido → JA_CANCELADO
        if (registroAtual.getString('cancelada_em')) {
          throw new Error('JA_CANCELADO')
        }

        // 6. Se hojeRecife() > data_fim → JANELA_ENCERRADA
        var dataFimAtual = (registroAtual.getString('data_fim') || '').slice(0, 10)
        if (dataFimAtual && hojeRecife() > dataFimAtual) {
          throw new Error('JANELA_ENCERRADA')
        }

        // 7. Construir snapshot PRÉ completo com cancelada_em e
        //    justificativa_cancelamento explicitamente null; excluir apenas
        //    id/created/updated conforme padrão
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
          creation_idempotency_key: atualObj.creation_idempotency_key,
          cancelada_em: null,
          justificativa_cancelamento: null,
        }
        var valorAnterior = canonicalize(snapshotPre)
        if (valorAnterior.length > 2048) {
          throw new Error('SNAPSHOT_TOO_LARGE')
        }

        // 8. Gerar cancelada_em como timestamp UTC completo do servidor
        var canceladaEmIso = new Date().toISOString()

        // 9. Setar somente cancelada_em e justificativa_cancelamento (trimada)
        var recToUpdate = txApp.findRecordById('com_substituicoes', body.id)
        recToUpdate.set('cancelada_em', canceladaEmIso)
        recToUpdate.set('justificativa_cancelamento', justificativaTrimada)

        // 10. txApp.save(registro)
        txApp.save(recToUpdate)

        // 11. Construir snapshot PÓS completo e diff exclusivamente dos dois
        //     campos (cancelada_em, justificativa_cancelamento)
        var snapshotPos = {
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
          creation_idempotency_key: atualObj.creation_idempotency_key,
          cancelada_em: canceladaEmIso,
          justificativa_cancelamento: justificativaTrimada,
        }
        if (JSON.stringify(snapshotPos).length > 2048) {
          throw new Error('SNAPSHOT_TOO_LARGE')
        }

        // 12. Inserir com_auditoria com acao='update', valor_anterior/snapshot
        //     pré canônico, evidencia_estruturada pós e snapshot_hash
        var audCol = txApp.findCollectionByNameOrId('com_auditoria')
        var audRec = new Record(audCol)
        audRec.set('collection_name', 'com_substituicoes')
        audRec.set('record_id', body.id)
        audRec.set('acao', 'update')
        audRec.set('usuario_id', atorId)
        audRec.set('comando', 'cancelar_ausencia_ou_substituicao')
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
        audRec.set('perfil', atorPerfilSlugTx)
        audRec.set('escopo', 'comando')
        audRec.set('origem', 'server-side')
        audRec.set('sequencia', 1)
        txApp.save(audRec)

        // 13. Concluir com_idempotencia com registros_afetados=[id] e
        //     resultado íntegro
        idempRec.set('estado', 'concluido')
        idempRec.set('conclusao_em', new Date())
        idempRec.set('codigo_retorno', '200')
        idempRec.set('registros_afetados', [body.id])
        idempRec.set('resultado', { acao: 'cancelled' })
        txApp.save(idempRec)

        // 14. commit implícito ao fim do callback
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
      if (txError.indexOf('INTEGRIDADE_IDEMPOTENCIA') !== -1) {
        return e.json(500, {
          error: 'INTEGRIDADE_IDEMPOTENCIA',
          message: 'Registro de idempotencia concluido sem registros_afetados integros',
        })
      }
      if (txError.indexOf('STALE_WRITE') !== -1) {
        return e.json(409, {
          error: 'STALE_WRITE',
          message: 'Registro foi alterado concorrentemente. Releia e tente novamente.',
          updated_atual: staleUpdatedAtual || '',
        })
      }
      if (txError.indexOf('JA_CANCELADO') !== -1) {
        return e.json(409, {
          error: 'JA_CANCELADO',
          message: 'Registro ja esta cancelado',
        })
      }
      if (txError.indexOf('JANELA_ENCERRADA') !== -1) {
        return e.json(409, {
          error: 'JANELA_ENCERRADA',
          message: 'A janela do registro esta encerrada; nao pode ser cancelada',
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
          message: 'Sem permissao para cancelar substituicao/ausencia',
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

  // ── Helpers de simulação de payload/snapshot para testes ──

  // monta payload canônico do cancelar
  function payloadCancelar(id, updated_esperado, justificativa) {
    return {
      id: id,
      updated_esperado: updated_esperado,
      justificativa: justificativa.trim(),
    }
  }

  // snapshot pré — cancelada_em e justificativa_cancelamento explicitamente null
  function snapshotPre(reg) {
    var s = {}
    for (var k in reg) {
      if (Object.prototype.hasOwnProperty.call(reg, k)) {
        s[k] = reg[k]
      }
    }
    s.cancelada_em = null
    s.justificativa_cancelamento = null
    return s
  }

  // snapshot pós — cancelada_em e justificativa_cancelamento preenchidos
  function snapshotPos(reg, canceladaEm, justificativa) {
    var s = {}
    for (var k in reg) {
      if (Object.prototype.hasOwnProperty.call(reg, k)) {
        s[k] = reg[k]
      }
    }
    s.cancelada_em = canceladaEm
    s.justificativa_cancelamento = justificativa
    return s
  }

  // diff exclusivo dos dois campos — retorna chaves alteradas
  function diffCancelar(pre, pos) {
    var alterados = []
    if (pre.cancelada_em !== pos.cancelada_em) alterados.push('cancelada_em')
    if (pre.justificativa_cancelamento !== pos.justificativa_cancelamento) {
      alterados.push('justificativa_cancelamento')
    }
    return alterados
  }

  return {
    canonicalize: canonicalize,
    validarRBAC: validarRBAC,
    hojeRecife: hojeRecife,
    bindingVigente: bindingVigente,
    validarUsuario: validarUsuario,
    resolverFallbackSuperadmin: resolverFallbackSuperadmin,
    payloadCancelar: payloadCancelar,
    snapshotPre: snapshotPre,
    snapshotPos: snapshotPos,
    diffCancelar: diffCancelar,
  }
})()
/* ──── FIM DO BLOCO DE TESTES ESTÁTICOS ──── */
