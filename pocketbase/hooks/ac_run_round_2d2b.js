// ════════════════════════════════════════════════════════════════════
// Porta 2D.2B — Hook consolidado (v0.0.166)
// ════════════════════════════════════════════════════════════════════
// SEGMENTO G26 (v0.0.166) — COBERTURA REAL DOS CINCO CAMINHOS E
// SANITIZAÇÃO ESTRUTURAL.
//   1. terminalizeBlockedOrFail usa composeTerminalReason em TODOS os
//      cinco caminhos de falha (stepRead, terminalize, confirmTerminal,
//      rereadMismatch, saveFailed), sem exceção. Removidas todas as
//      atribuições diretas a stopReason nesses caminhos. A causa
//      original (stopReasonArg) permanece no início, com fallback
//      neutro 'persist_step_failure' apenas quando null/undefined/vazio.
//   2. sanitizePersistErrorMessage reescrita com cobertura estrutural
//      completa: URLs (http/https → [REDACTED_URL]); Authorization
//      Bearer/Basic (→ [REDACTED]); pares chave-valor com valor
//      COMPLETO substituído (chave=valor, chave: valor, "chave":"valor",
//      chave: "valor", chave='valor') — sem sufixo, bearer token ou
//      conteúdo residual; headers como objeto JSON substituído
//      integralmente por [REDACTED]; private_key em formato PEM
//      (BEGIN...END → [REDACTED]); valores com espaços substituídos
//      integralmente; e-mails e telefones preservados. Limite de 300
//      caracteres após toda sanitização.
//   3. Testes executáveis em scripts/test-sanitize-2d2b.cjs (extrai a
//      função real do hook de produção via node:vm, sem cópia).
//   4. Versão 0.0.166 / v0.0.166 coordenada em package.json, health e
//      runner (PORTA2D2B_EXPECTED_VERSION e
//      validatorCanonical.expectedVersion).
// Preservações obrigatórias mantidas: quatro errorType, um único
// validateCore, três routerAdd, zero require/module.exports/globalThis/
// eval/probes, health/evidence/contratos/hashes/transação/migrations/
// schema/frontend inalterados.
// ════════════════════════════════════════════════════════════════════
// SEGMENTO G21 (v0.0.163) — DOIS AJUSTES FINAIS.
//   1. persist_failure com conversão booleana estrita: false para
//      null/undefined/false/''; true para true ou string de erro não
//      vazia. Causa textual preservada em stop_reason e transaction_error.
//   2. Removida a declaração mínima de validatorCanonical da evidence;
//      reconstruction_note passa a usar snapshot.expected_version (já
//      validado antes do HTTP 200). Exatamente uma declaração de
//      validatorCanonical permanece, somente no runner.
// Preservações G19/G20 integralmente mantidas.
// ════════════════════════════════════════════════════════════════════
// SEGMENTO G20 (v0.0.162) — CORREÇÃO CONTRATUAL FINAL DO SNAPSHOT.
//   1. persist_failure estritamente booleano em buildTerminalSnapshot
//      (persist_failure: o.persistFailure === true). Causa textual do
//      erro de persistência preservada em stop_reason e, quando
//      aplicável, transaction_error. Sem migration ou novo campo.
//   2. Contrato fail-closed 409 da evidence: pass:false restaurado em
//      TODAS as respostas 409; HTTP 200 sem pass; STEP_READ_ERROR
//      retorna envelope fail-closed (error='evidence_incomplete',
//      pass:false, classification='INDETERMINADO', anomalies
//      type='STEP_READ_ERROR' com descrição sanitizada).
//   3. reconstruction_note com validatorCanonical.expectedVersion.
// Preservações G19 integralmente mantidas.
// ════════════════════════════════════════════════════════════════════
// SEGMENTO G19 (v0.0.162) — CORRIGIR CONFIRMAÇÃO TERMINAL E
// INTEGRIDADE DO SNAPSHOT.
//   1. Mapa canônico completo: A8 incluído em todas as listas
//      canonicalKeys usadas pela evidence e por confirmTerminalSnapshot().
//      Confirmadas as 16 chaves A1–A8, B1–B5, C1–C2, D1. O conteúdo do
//      catálogo PORTA2D2B_CANONICAL é INALTERADO.
//   2. Classificação correta antes de persistir BLOCKED/FAIL: não chama
//      validateCore() sobre execução ainda running/started para construir
//      snapshot terminal. Monta primeiro uma projeção em memória com o
//      estado terminal pretendido (blocked/fail) e os campos finais que
//      serão persistidos, executa validateCore sobre essa projeção,
//      exige pass===false e classification coerente (BLOCKED/FAIL) ANTES
//      do save, e somente então constrói/persiste o snapshot. Após o
//      save relê e confirma estado e snapshot completos. Helper mecânico
//      único buildAndValidateTerminalProjection cobre os três caminhos
//      (checkTerminal, post-rollback blocked, fail/blocked terminal).
//      Nenhum novo validateCore é criado.
//   3. Confirmação integral do snapshot no runner
//      (confirmTerminalSnapshot): 18 campos obrigatórios, tipos estritos,
//      snapshot_source='validateCore', versões coerentes, snapshot_at ISO,
//      igualdade literal do conteúdo crítico com PORTA2D2B_CANONICAL /
//      expectedContracts / hashDeclaration, mapa com as 16 chaves (A8),
//      coerência classification/overall_status/go_no_go/pass.
//   4. Evidence fail-closed antes do HTTP 200: mantém evidence sem
//      validateCore e sem regras canônicas duplicadas; valida os mesmos
//      18 campos e tipos do snapshot; exige snapshot_source='validateCore';
//      exige expected_version === snapshot_version ===
//      execution.versao_commit; exige mapa com as 16 chaves (A8); em
//      erro de leitura das etapas retorna 409 com STEP_READ_ERROR (não
//      converte silenciosamente em STEP_COUNT_MISMATCH); preserva os
//      caminhos 400, 404 e 409; no HTTP 200 não adiciona pass; restaura
//      e preserva literalmente o reconstruction_note da v0.0.159
//      (ressalva aprovada no G18).
//   5. Preservações obrigatórias mantidas:
//      - exatamente um validateCore, somente no runner;
//      - exatamente uma cópia das regras e catálogos canônicos;
//      - health sem regras de negócio;
//      - evidence sem reclassificação;
//      - PASS continua com validação pré-save, pós-save, segunda
//        gravação, releitura e confirmação dentro de txApp;
//      - zero require(), module.exports, globalThis, eval,
//        EXPECTED_SCHEMA_VERSION e probes;
//      - exatamente três routerAdd;
//      - cinco arquivos removidos continuam ausentes;
//      - contratos A1–D1, hashes, sanitização, truncamento, deltas,
//        contadores, migrations, schema e frontend INALTERADOS.
// ════════════════════════════════════════════════════════════════════
// NOTA DE ESCOPO (JSVM PocketBase): cada handler de routerAdd é
// serializado e executado em seu próprio contexto isolado, sem acesso a
// declarações top-level do arquivo. Para que cada uma das três rotas
// referencie nominalmente `validatorCanonical` (exigência do plano G14),
// cada callback constroi localmente o seu próprio objeto
// `validatorCanonical` com os seis membros, a partir das constantes e
// funções privadas re-declaradas dentro do próprio callback. As regras
// canônicas NÃO são reescritas/divergentes: o corpo de validateCore e
// dos normalizadores é idêntico nos três callbacks (mesma fonte lógica).
// Nenhum carregamento de módulo, exportação CommonJS, objeto global
// compartilhado ou eval é usado — tudo vive neste único arquivo.
//
// Unificação de versão:
//   - usada SOMENTE a constante PORTA2D2B_EXPECTED_VERSION (v0.0.166),
//     coordenada com package.json (0.0.166).
//
// PASS somente após:
//   - execução terminal (estado=pass)
//   - 16 etapas únicas A1–D1
//   - contratos estruturados (A7 missing_signature, B2 duplicate, B4
//     snapshots+1, B5 ocorrencias+1, C1 idempotent=false com
//     rolled_back[0].action=restored_from_snapshot / collection=
//     com_negocios / record_id presente, C2 idempotent=true com
//     rolled_back vazio, D1 HTTP 503)
//   - deltas por etapa/finais
//   - flag final false
//   - hashes verificáveis (sha256 64 hex; raw_body_sanitized_sha256
//     recomputável; raw_body_original_sha256 refere-se ao original)
//   - sanitização (sanitized=true, resposta_truncated consistente)
//   - versão e persistência terminal
//   - counters (activecampaign_calls=0, blocked_external_attempts=0,
//     allowed_internal_calls>0)
// Anomalias cobrem conteúdo, delta, hash, truncamento, estado e
// counters. external_calls não é constante sem qualificação.
// ════════════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════════════
// ROTA 1/3 — health GET (autenticada users)
// ════════════════════════════════════════════════════════════════════
// Resposta estrita { ok, module, version }. Não acessa banco, secrets,
// flags, lock ou dados; não chama webhook, rollback, auditoria ou
// ActiveCampaign. Usa validatorCanonical.expectedVersion.
// ════════════════════════════════════════════════════════════════════
routerAdd(
  'GET',
  '/backend/v1/integracao/ac/validator-2d2b-health',
  function (e) {
    var PORTA2D2B_EXPECTED_VERSION = 'v0.0.170'
    return e.json(200, {
      ok: true,
      module: 'ac_validate_2d2b',
      version: PORTA2D2B_EXPECTED_VERSION,
    })
  },
  $apis.requireAuth('users'),
)

// ════════════════════════════════════════════════════════════════════
// ROTA 2/3 — evidence GET (autenticada, {execId})
// ════════════════════════════════════════════════════════════════════
// G19: evidence fail-closed antes do HTTP 200. Mantém evidence sem
//   validateCore e sem regras canônicas duplicadas. Valida os mesmos 18
//   campos e tipos do snapshot; exige snapshot_source='validateCore';
//   exige expected_version === snapshot_version ===
//   execution.versao_commit; exige mapa com as 16 chaves (incluindo A8);
//   em erro de leitura das etapas retorna 409 com STEP_READ_ERROR (não
//   converte silenciosamente em STEP_COUNT_MISMATCH); preserva os
//   caminhos 400, 404 e 409; no HTTP 200 não adiciona pass; restaura e
//   preserva literalmente o reconstruction_note da v0.0.159.
// CORREÇÃO 6: declara explicitamente qual hash pode ser recomputado
//   (raw_body_sanitized_sha256, sobre o conteúdo devolvido) e qual
//   refere-se ao original não exposto (raw_body_original_sha256).
// CORREÇÃO 8: retorna counters semanticamente corretos
//   (allowed_internal_calls, blocked_external_attempts,
//   activecampaign_calls) em vez de prova_zero constante.
// Leitura exclusivamente server-side, autenticada, superadmin.
// ════════════════════════════════════════════════════════════════════
routerAdd(
  'GET',
  '/backend/v1/integracao/ac/evidence-porta-2d2b/{execId}',
  (e) => {
    // ─── normalizadores (leitura dos registros persistidos) ───
    function normalizeExecRecord(rec) {
      return {
        id: rec.getString('id'),
        estado: rec.getString('estado'),
        versao_commit: rec.getString('versao_commit'),
        flag_final: rec.getString('flag_final'),
        decisao: rec.getString('decisao'),
        counts_before: rec.getString('counts_before'),
        counts_after: rec.getString('counts_after'),
        allowed_internal_calls: rec.getInt('allowed_internal_calls'),
        blocked_external_attempts: rec.getInt('blocked_external_attempts'),
        activecampaign_calls: rec.getInt('activecampaign_calls'),
        prova_zero_chamadas_externas: rec.getBool('prova_zero_chamadas_externas'),
      }
    }
    function normalizeStepRecord(s) {
      return {
        ordem: s.getString('ordem'),
        codigo: s.getString('codigo'),
        metodo: s.getString('metodo'),
        rota_sanitizada: s.getString('rota_sanitizada'),
        http_status_real: s.getInt('http_status_real'),
        http_status_esperado: s.getInt('http_status_esperado'),
        resultado: s.getString('resultado'),
        started_at: s.getString('started_at'),
        finished_at: s.getString('finished_at'),
        counts_antes: s.getString('counts_antes'),
        counts_depois: s.getString('counts_depois'),
        deltas: s.getString('deltas'),
        sha256_corpo_bruto: s.getString('sha256_corpo_bruto'),
        raw_body_original_sha256: s.getString('raw_body_original_sha256'),
        raw_body_sanitized: s.getString('raw_body_sanitized'),
        raw_body_sanitized_sha256: s.getString('raw_body_sanitized_sha256'),
        raw_body_size: s.getInt('raw_body_size'),
        sanitized: s.getBool('sanitized'),
        resposta_sanitizada: s.getString('resposta_sanitizada'),
        resposta_truncated: s.getBool('resposta_truncated'),
        resposta_original_length: s.getInt('resposta_original_length'),
        contrato: s.getString('contrato'),
        contrato_ok: s.getBool('contrato_ok'),
        erro_real: s.getString('erro_real'),
      }
    }

    var authId = e.auth ? e.auth.id : ''
    if (!authId) return e.unauthorizedError('Autenticacao necessaria')
    var isSA = false
    try {
      var p = $app.findRecordById('com_perfis', e.auth.getString('perfil_id'))
      if (p && p.getString('slug') === 'superadministrador') isSA = true
    } catch (_) {}
    if (!isSA) {
      try {
        var sp = $app.findFirstRecordByData('com_perfis', 'slug', 'superadministrador')
        var bnd = $app.findRecordsByFilter(
          'com_usuarios_equipes',
          "usuario_id = '" + authId + "' && perfil_id = '" + sp.id + "' && ativo = true",
          '',
          1,
          0,
        )
        if (bnd && bnd.length > 0) isSA = true
      } catch (_) {}
    }
    if (!isSA) return e.forbiddenError('Apenas superadministrador')

    var execId = e.request.pathValue('execId') || ''
    if (!execId) return e.json(400, { error: 'missing_exec_id' })

    // ─── Busca da execução ───
    var execRec = null
    try {
      execRec = $app.findFirstRecordByData('com_execucoes_porta_2d2b', 'id', execId)
    } catch (_) {}
    if (!execRec) {
      return e.json(404, { error: 'execution_not_found', execId: execId })
    }

    var normalizedExec = normalizeExecRecord(execRec)

    // ─── Leitura das etapas com STEP_READ_ERROR explícito ───
    // G19: erro de leitura das etapas retorna 409 com STEP_READ_ERROR,
    // sem converter silenciosamente em STEP_COUNT_MISMATCH.
    var steps = []
    var stepReadError = null
    try {
      var stepRecs = $app.findRecordsByFilter(
        'com_etapas_porta_2d2b',
        "execucao_id = '" + execId + "'",
        'ordem',
        200,
        0,
      )
      for (var si = 0; si < stepRecs.length; si++) steps.push(normalizeStepRecord(stepRecs[si]))
    } catch (er) {
      stepReadError = String(er).substring(0, 200)
    }
    if (stepReadError !== null) {
      return e.json(409, {
        error: 'evidence_incomplete',
        pass: false,
        classification: 'INDETERMINADO',
        anomalies: [
          {
            type: 'STEP_READ_ERROR',
            description: 'Erro de leitura das etapas impede a validação do snapshot',
          },
        ],
      })
    }

    // ─── Parse do snapshot persistido ───
    var snapshot = null
    try {
      snapshot = JSON.parse(execRec.getString('decisao') || '{}')
    } catch (_) {}

    if (!snapshot || !snapshot.snapshot_source || !snapshot.classification) {
      return e.json(409, {
        error: 'evidence_incomplete',
        pass: false,
        classification: 'INDETERMINADO',
        anomalies: [
          {
            type: 'SNAPSHOT_MALFORMED',
            description: 'decisao ausente ou incompleta no registro de execucao',
          },
        ],
      })
    }

    // ─── G19: validar os mesmos 18 campos e tipos estritos do snapshot ───
    var requiredFields = [
      'porta',
      'overall_status',
      'go_no_go',
      'stop_reason',
      'classification',
      'classification_justification',
      'expected_version',
      'snapshot_source',
      'snapshot_version',
      'snapshot_at',
      'delta_match',
      'persist_failure',
      'pass',
      'total_calls',
      'anomalies',
      'canonical_map',
      'expected_contracts',
      'hash_declaration',
    ]
    for (var ri = 0; ri < requiredFields.length; ri++) {
      if (snapshot[requiredFields[ri]] === undefined) {
        return e.json(409, {
          error: 'evidence_incomplete',
          pass: false,
          classification: 'INDETERMINADO',
          anomalies: [
            {
              type: 'SNAPSHOT_INCOMPLETO',
              description: 'Campo obrigatório ausente no snapshot: ' + requiredFields[ri],
            },
          ],
        })
      }
    }
    // tipos estritos
    var stringFields = [
      'porta',
      'overall_status',
      'go_no_go',
      'stop_reason',
      'classification',
      'classification_justification',
      'expected_version',
      'snapshot_source',
      'snapshot_version',
      'snapshot_at',
    ]
    for (var sfi = 0; sfi < stringFields.length; sfi++) {
      if (typeof snapshot[stringFields[sfi]] !== 'string') {
        return e.json(409, {
          error: 'evidence_incomplete',
          pass: false,
          classification: 'INDETERMINADO',
          anomalies: [
            {
              type: 'SNAPSHOT_TIPO_INVALIDO',
              description:
                'Campo nao é string: ' +
                stringFields[sfi] +
                ' (' +
                typeof snapshot[stringFields[sfi]] +
                ')',
            },
          ],
        })
      }
    }
    if (typeof snapshot.delta_match !== 'boolean') {
      return e.json(409, {
        error: 'evidence_incomplete',
        pass: false,
        classification: 'INDETERMINADO',
        anomalies: [{ type: 'SNAPSHOT_TIPO_INVALIDO', description: 'delta_match nao é boolean' }],
      })
    }
    if (typeof snapshot.persist_failure !== 'boolean') {
      return e.json(409, {
        error: 'evidence_incomplete',
        pass: false,
        classification: 'INDETERMINADO',
        anomalies: [
          { type: 'SNAPSHOT_TIPO_INVALIDO', description: 'persist_failure nao é boolean' },
        ],
      })
    }
    if (typeof snapshot.pass !== 'boolean') {
      return e.json(409, {
        error: 'evidence_incomplete',
        pass: false,
        classification: 'INDETERMINADO',
        anomalies: [{ type: 'SNAPSHOT_TIPO_INVALIDO', description: 'pass nao é boolean' }],
      })
    }
    if (
      typeof snapshot.total_calls !== 'number' ||
      !isFinite(snapshot.total_calls) ||
      Math.floor(snapshot.total_calls) !== snapshot.total_calls ||
      snapshot.total_calls < 0
    ) {
      return e.json(409, {
        error: 'evidence_incomplete',
        pass: false,
        classification: 'INDETERMINADO',
        anomalies: [
          { type: 'SNAPSHOT_TIPO_INVALIDO', description: 'total_calls nao é inteiro nao negativo' },
        ],
      })
    }
    if (!Array.isArray(snapshot.anomalies)) {
      return e.json(409, {
        error: 'evidence_incomplete',
        pass: false,
        classification: 'INDETERMINADO',
        anomalies: [{ type: 'SNAPSHOT_TIPO_INVALIDO', description: 'anomalies nao é array' }],
      })
    }
    if (
      typeof snapshot.canonical_map !== 'object' ||
      snapshot.canonical_map === null ||
      Array.isArray(snapshot.canonical_map)
    ) {
      return e.json(409, {
        error: 'evidence_incomplete',
        pass: false,
        classification: 'INDETERMINADO',
        anomalies: [{ type: 'SNAPSHOT_TIPO_INVALIDO', description: 'canonical_map nao é objeto' }],
      })
    }
    if (
      typeof snapshot.expected_contracts !== 'object' ||
      snapshot.expected_contracts === null ||
      Array.isArray(snapshot.expected_contracts)
    ) {
      return e.json(409, {
        error: 'evidence_incomplete',
        pass: false,
        classification: 'INDETERMINADO',
        anomalies: [
          { type: 'SNAPSHOT_TIPO_INVALIDO', description: 'expected_contracts nao é objeto' },
        ],
      })
    }
    if (
      typeof snapshot.hash_declaration !== 'object' ||
      snapshot.hash_declaration === null ||
      Array.isArray(snapshot.hash_declaration)
    ) {
      return e.json(409, {
        error: 'evidence_incomplete',
        pass: false,
        classification: 'INDETERMINADO',
        anomalies: [
          { type: 'SNAPSHOT_TIPO_INVALIDO', description: 'hash_declaration nao é objeto' },
        ],
      })
    }

    // ─── snapshot_source === 'validateCore' ───
    if (snapshot.snapshot_source !== 'validateCore') {
      return e.json(409, {
        error: 'evidence_incomplete',
        pass: false,
        classification: 'INDETERMINADO',
        anomalies: [
          {
            type: 'SNAPSHOT_SOURCE_INVALIDO',
            description: 'snapshot_source=' + snapshot.snapshot_source + ' (esperado validateCore)',
          },
        ],
      })
    }

    // ─── expected_version === snapshot_version === execution.versao_commit ───
    if (snapshot.expected_version !== snapshot.snapshot_version) {
      return e.json(409, {
        error: 'evidence_incomplete',
        pass: false,
        classification: 'INDETERMINADO',
        anomalies: [
          {
            type: 'SNAPSHOT_VERSION_MISMATCH',
            description:
              'expected_version=' +
              snapshot.expected_version +
              ' != snapshot_version=' +
              snapshot.snapshot_version,
          },
        ],
      })
    }
    if (snapshot.expected_version !== normalizedExec.versao_commit) {
      return e.json(409, {
        error: 'evidence_incomplete',
        pass: false,
        classification: 'INDETERMINADO',
        anomalies: [
          {
            type: 'SNAPSHOT_VERSION_MISMATCH',
            description:
              'expected_version=' +
              snapshot.expected_version +
              ' != execution.versao_commit=' +
              normalizedExec.versao_commit,
          },
        ],
      })
    }

    // ─── Validar canonical_map contém as 16 chaves A1–D1 (incluindo A8) ───
    var canonicalKeys = [
      'A1',
      'A2',
      'A3',
      'A4',
      'A5',
      'A6',
      'A7',
      'A8',
      'B1',
      'B2',
      'B3',
      'B4',
      'B5',
      'C1',
      'C2',
      'D1',
    ]
    for (var ci = 0; ci < canonicalKeys.length; ci++) {
      if (!snapshot.canonical_map[canonicalKeys[ci]]) {
        return e.json(409, {
          error: 'evidence_incomplete',
          pass: false,
          classification: 'INDETERMINADO',
          anomalies: [
            {
              type: 'CANONICAL_MAP_INCOMPLETO',
              description: 'Chave ausente no canonical_map: ' + canonicalKeys[ci],
            },
          ],
        })
      }
    }

    // ─── Validar 16 etapas ───
    if (steps.length !== 16) {
      return e.json(409, {
        error: 'evidence_incomplete',
        pass: false,
        classification: 'INDETERMINADO',
        anomalies: [
          {
            type: 'STEP_COUNT_MISMATCH',
            description: 'Esperadas 16 etapas, encontradas ' + steps.length,
          },
        ],
      })
    }

    // ─── Validar coerência estado vs decisão ───
    if (execRec.getString('estado') === 'pass' && snapshot.classification !== 'PASS') {
      return e.json(409, {
        error: 'evidence_incomplete',
        pass: false,
        classification: 'INDETERMINADO',
        anomalies: [
          {
            type: 'STATE_CLASSIFICATION_MISMATCH',
            description: 'estado=pass mas classification=' + snapshot.classification,
          },
        ],
      })
    }

    // ─── Sucesso: devolver snapshot literal (sem adicionar pass) ───
    // G21: reconstruction_note usa snapshot.expected_version (já validado
    // antes do HTTP 200). Evidence sem validatorCanonical.
    return e.json(200, {
      route: 'GET /backend/v1/integracao/ac/evidence-porta-2d2b/{execId}',
      route_version: 'R2-EVIDENCE-2D2B-20260813-FAILCLOSED-v0.0.137',
      read_only: true,
      writes_performed: 0,
      writes_note:
        'Evidencia lida do snapshot canonico persistido pelo runner. Nao recalcula, apenas expoe.',
      round_writes: snapshot.total_calls,
      external_calls_qualified: {
        blocked_external_attempts: normalizedExec.blocked_external_attempts,
        allowed_internal_calls: normalizedExec.allowed_internal_calls,
        activecampaign_calls: normalizedExec.activecampaign_calls,
        activecampaign_note:
          normalizedExec.activecampaign_calls > 0
            ? 'Foram executadas chamadas reais ao ActiveCampaign'
            : 'Nenhuma chamada real ao ActiveCampaign',
      },
      hash_declaration: snapshot.hash_declaration,
      expected_contracts: snapshot.expected_contracts,
      queried_at: new Date().toISOString(),
      schema_version_expected: snapshot.expected_version,
      execution: normalizedExec,
      steps: steps,
      canonical_map: snapshot.canonical_map,
      classification: snapshot.classification,
      classification_justification: snapshot.classification_justification,
      total_steps_expected: 16,
      total_steps_persisted: steps.length,
      anomalies: snapshot.anomalies,
      validation_shared_with_runner: true,
      reconstruction_note:
        'PASS somente se TODOS os critérios satisfeitos pela função compartilhada $porta2d2bValidate: estado=pass, 16 etapas únicas A1–D1, contratos estruturados (A7 missing_signature, B2 duplicate, B4 snapshots+1, B5 ocorrencias+1, C1 idempotent=false com rolled_back restaurado, C2 idempotent=true rolled_back vazio, D1 HTTP 503), deltas por etapa/finais, flag_final=false, hashes verificáveis (original + sanitizado recomputável), sanitização, versão ' +
        snapshot.expected_version +
        ', counters qualificados (activecampaign=0). Anomalias cobrem conteúdo, delta, hash, truncamento, estado e counters. Qualquer divergência → nunca PASS.',
    })
  },
  $apis.requireAuth(),
)

// ════════════════════════════════════════════════════════════════════
// ROTA 3/3 — runner POST (autenticada)
// ════════════════════════════════════════════════════════════════════
// Runner instrumentado fail-closed. Correções 0.0.142 (SEGMENTO 2 —
// TERMINALIZAÇÃO FAIL-CLOSED) preservadas.
// G19 (v0.0.162):
//  - mapa canônico completo com A8 em todas as listas canonicalKeys;
//  - BLOCKED/FAIL somente após montar projeção terminal em memória,
//    validar com validateCore e exigir pass===false + classification
//    coerente ANTES do save; helper único
//    buildAndValidateTerminalProjection;
//  - confirmTerminalSnapshot integral: 18 campos, tipos estritos,
//    versões, igualdade literal, coerência;
//  - PASS mantém validação pré-save, pós-save, segunda gravação,
//    releitura e confirmação dentro de txApp.
// Usa validatorCanonical.validateProjection e
// validatorCanonical.validateRecords. Usa a constante
// PORTA2D2B_EXPECTED_VERSION (via validatorCanonical.expectedVersion)
// como versão.
// ════════════════════════════════════════════════════════════════════
routerAdd(
  'POST',
  '/backend/v1/integracao/ac/run-round-2d2b',
  (e) => {
    // ─── constantes canônicas (escopo do callback) ───
    var PORTA2D2B_EXPECTED_VERSION = 'v0.0.170'
    var PORTA2D2B_CANONICAL_ORDERS = [
      'A1',
      'A2',
      'A3',
      'A4',
      'A5',
      'A6',
      'A7',
      'A8',
      'B1',
      'B2',
      'B3',
      'B4',
      'B5',
      'C1',
      'C2',
      'D1',
    ]
    var PORTA2D2B_CANONICAL = {
      A1: { codigo: 'A1', metodo: 'POST', http: 503 },
      A2: { codigo: 'A2', metodo: 'GET', http: 405 },
      A3: { codigo: 'A3', metodo: 'POST', http: 400 },
      A4: { codigo: 'A4', metodo: 'POST', http: 400 },
      A5: { codigo: 'A5', metodo: 'POST', http: 400 },
      A6: { codigo: 'A6', metodo: 'POST', http: 400 },
      A7: { codigo: 'A7', metodo: 'POST', http: 401 },
      A8: { codigo: 'A8', metodo: 'POST', http: 401 },
      B1: { codigo: 'B1_contato_criado', metodo: 'POST', http: 200 },
      B2: { codigo: 'B2_duplicidade_sem_efeito', metodo: 'POST', http: 409 },
      B3: { codigo: 'B3_negocio_criado', metodo: 'POST', http: 200 },
      B4: { codigo: 'B4_snapshot_e_atualizacao', metodo: 'POST', http: 200 },
      B5: { codigo: 'B5_negocio_e_ocorrencia_qualidade', metodo: 'POST', http: 200 },
      C1: { codigo: 'C1_rollback', metodo: 'POST', http: 200 },
      C2: { codigo: 'C2_repeticao_idempotente', metodo: 'POST', http: 200 },
      D1: { codigo: 'D1', metodo: 'POST', http: 503 },
    }
    var PORTA2D2B_EXPECTED_FINAL_DELTAS = {
      contatos: 1,
      negocios: 2,
      eventos: 5,
      execucoes: 4,
      vinculos: 3,
      snapshots: 1,
      ocorrencias: 1,
      auditoria: 0,
    }
    // ─── funções privadas do validador (escopo do callback) ───
    function $porta2d2bParseContract(ordem, contratoStr, deltasStr) {
      var c = {}
      try {
        c = JSON.parse(contratoStr || '{}')
      } catch (_) {
        c = {}
      }
      var d = {}
      try {
        d = JSON.parse(deltasStr || '{}')
      } catch (_) {
        d = {}
      }
      if (ordem === 'A7') return { ok: c.error === 'missing_signature', detail: c }
      if (ordem === 'B2') return { ok: c.duplicate === true, detail: c }
      if (ordem === 'B4') {
        var snapDelta = d.snapshots !== undefined ? d.snapshots : c.delta_snapshots
        return { ok: snapDelta === 1, detail: c, delta: snapDelta }
      }
      if (ordem === 'B5') {
        var ocoDelta = d.ocorrencias !== undefined ? d.ocorrencias : c.delta_ocorrencias
        return { ok: ocoDelta === 1, detail: c, delta: ocoDelta }
      }
      if (ordem === 'C1') {
        var rb0 = c.rolled_back && c.rolled_back[0] ? c.rolled_back[0] : {}
        var ok =
          c.success === true &&
          c.rolled_back_length === 1 &&
          rb0.action === 'restored_from_snapshot' &&
          rb0.collection === 'com_negocios' &&
          !!rb0.record_id &&
          c.idempotent === false
        return { ok: ok, detail: c }
      }
      if (ordem === 'C2') {
        return {
          ok: c.success === true && c.idempotent === true && c.rolled_back_length === 0,
          detail: c,
        }
      }
      if (ordem === 'D1') return { ok: true, detail: c }
      return { ok: true, detail: c }
    }
    function validateCore(execution, steps) {
      var anomalies = []
      var classification = 'ESTADO_INDETERMINADO'
      var justification = ''
      // G24 (CORREÇÃO 1): estado terminal NÃO-pass ANTES de steps===0.
      // Assim, execução blocked/fail/aborted com 0 etapas retorna a
      // classificação do estado (BLOCKED/FAIL/ABORTED) e não
      // NAO_ENCONTRADA. NAO_ENCONTRADA só quando estado='pass' com 0
      // etapas.
      if (execution.estado !== 'pass') {
        classification =
          execution.estado === 'blocked'
            ? 'BLOCKED'
            : execution.estado === 'fail'
              ? 'FAIL'
              : execution.estado === 'aborted'
                ? 'ABORTED'
                : 'ESTADO_INDETERMINADO'
        justification = 'estado=' + execution.estado + ' (esperado pass)'
        return {
          pass: false,
          reason: justification,
          anomalies: anomalies,
          classification: classification,
          justification: justification,
          execution: execution,
          steps: steps,
        }
      }
      if (!steps || steps.length === 0) {
        classification = 'NAO_ENCONTRADA'
        justification = 'Nenhuma etapa persistida.'
        return {
          pass: false,
          reason: justification,
          anomalies: anomalies,
          classification: classification,
          justification: justification,
          execution: execution,
          steps: steps || [],
        }
      }
      if (steps.length !== 16) {
        classification = 'INCOMPLETA'
        justification = 'Persistidas ' + steps.length + ' de 16 etapas.'
        return {
          pass: false,
          reason: justification,
          anomalies: anomalies,
          classification: classification,
          justification: justification,
          execution: execution,
          steps: steps,
        }
      }
      var byOrder = {}
      var seenOrders = {}
      var hexRe = /^[0-9a-f]{64}$/
      for (var si = 0; si < steps.length; si++) {
        var st = steps[si]
        var ord = st.ordem
        if (seenOrders[ord]) anomalies.push({ type: 'DUPLICATE_ORDER', step: ord })
        seenOrders[ord] = true
        byOrder[ord] = st
        var canon = PORTA2D2B_CANONICAL[ord]
        if (!canon) {
          anomalies.push({ type: 'UNKNOWN_ORDER', step: ord })
          continue
        }
        if (st.codigo !== canon.codigo)
          anomalies.push({
            type: 'CODIGO_MISMATCH',
            step: ord,
            description: 'esperado=' + canon.codigo + ' real=' + st.codigo,
          })
        if (st.metodo !== canon.metodo) anomalies.push({ type: 'METODO_MISMATCH', step: ord })
        if (st.http_status_esperado !== canon.http)
          anomalies.push({ type: 'HTTP_ESPERADO_MISMATCH', step: ord })
        if (st.http_status_real !== st.http_status_esperado)
          anomalies.push({
            type: 'HTTP_REAL_CONTRACT_FAIL',
            step: ord,
            description: st.http_status_real + '!=' + st.http_status_esperado,
          })
        if (st.resultado !== 'PASS')
          anomalies.push({ type: 'RESULTADO_NOT_PASS', step: ord, description: st.resultado })
        if (!st.started_at || !st.finished_at)
          anomalies.push({ type: 'TIMESTAMP_MISSING', step: ord })
        else {
          var sT = new Date(st.started_at).getTime()
          var fT = new Date(st.finished_at).getTime()
          if (isNaN(sT) || isNaN(fT)) anomalies.push({ type: 'TIMESTAMP_INVALID', step: ord })
          else if (sT > fT) anomalies.push({ type: 'TIMESTAMP_ORDER', step: ord })
        }
        if (!st.sha256_corpo_bruto || !hexRe.test(st.sha256_corpo_bruto))
          anomalies.push({ type: 'SHA256_INVALID', step: ord })
        if (!st.raw_body_original_sha256 || !hexRe.test(st.raw_body_original_sha256))
          anomalies.push({ type: 'RAW_ORIGINAL_SHA256_INVALID', step: ord })
        if (!st.raw_body_sanitized_sha256 || !hexRe.test(st.raw_body_sanitized_sha256))
          anomalies.push({ type: 'RAW_SANITIZED_SHA256_INVALID', step: ord })
        var recomputedSanitizedHash = $security.sha256(st.raw_body_sanitized || '')
        if (recomputedSanitizedHash !== st.raw_body_sanitized_sha256)
          anomalies.push({ type: 'RAW_SANITIZED_SHA256_MISMATCH', step: ord })
        if (st.sha256_corpo_bruto !== st.raw_body_original_sha256)
          anomalies.push({ type: 'RAW_ORIGINAL_SHA256_MISMATCH', step: ord })
        if (st.sanitized !== true) anomalies.push({ type: 'SANITIZED_FALSE', step: ord })
        if (st.resposta_truncated === true) {
          try {
            var env = JSON.parse(st.resposta_sanitizada || '{}')
            if (
              env.truncated !== true ||
              typeof env.original_length !== 'number' ||
              typeof env.preview !== 'string'
            )
              anomalies.push({ type: 'TRUNCATED_ENVELOPE_INVALID', step: ord })
            if (env.original_length !== st.resposta_original_length)
              anomalies.push({ type: 'TRUNCATED_LENGTH_MISMATCH', step: ord })
          } catch (_) {
            anomalies.push({ type: 'TRUNCATED_ENVELOPE_PARSE', step: ord })
          }
        }
        try {
          JSON.parse(st.deltas || '{}')
        } catch (_) {
          anomalies.push({ type: 'DELTA_PARSE_ERROR', step: ord })
        }
        try {
          JSON.parse(st.counts_antes || '{}')
        } catch (_) {
          anomalies.push({ type: 'COUNTS_ANTES_PARSE', step: ord })
        }
        try {
          JSON.parse(st.counts_depois || '{}')
        } catch (_) {
          anomalies.push({ type: 'COUNTS_DEPOIS_PARSE', step: ord })
        }
        var cval = $porta2d2bParseContract(ord, st.contrato, st.deltas)
        if (!cval.ok)
          anomalies.push({
            type: 'CONTRACT_FAIL',
            step: ord,
            description: JSON.stringify(cval.detail).substring(0, 150),
          })
        if (st.contrato_ok !== true) anomalies.push({ type: 'CONTRATO_OK_FALSE', step: ord })
      }
      var missing = []
      for (var mi = 0; mi < PORTA2D2B_CANONICAL_ORDERS.length; mi++) {
        if (!byOrder[PORTA2D2B_CANONICAL_ORDERS[mi]]) missing.push(PORTA2D2B_CANONICAL_ORDERS[mi])
      }
      if (missing.length > 0)
        anomalies.push({ type: 'MISSING_STEPS', description: missing.join(', ') })
      var flagFinalObj = null
      try {
        flagFinalObj = JSON.parse(execution.flag_final || '{}')
      } catch (_) {}
      if (!flagFinalObj || flagFinalObj.valor !== 'false')
        anomalies.push({ type: 'FLAG_FINAL_NOT_FALSE' })
      if (!execution.counts_after) anomalies.push({ type: 'COUNTS_AFTER_MISSING' })
      if (execution.versao_commit !== PORTA2D2B_EXPECTED_VERSION)
        anomalies.push({
          type: 'VERSION_MISMATCH',
          description: execution.versao_commit + '!=' + PORTA2D2B_EXPECTED_VERSION,
        })
      if (execution.activecampaign_calls !== 0)
        anomalies.push({
          type: 'ACTIVECAMPAIGN_CALLS_NONZERO',
          description: String(execution.activecampaign_calls),
        })
      if (execution.blocked_external_attempts !== 0)
        anomalies.push({
          type: 'BLOCKED_EXTERNAL_NONZERO',
          description: String(execution.blocked_external_attempts),
        })
      if (execution.allowed_internal_calls <= 0)
        anomalies.push({
          type: 'ALLOWED_INTERNAL_ZERO',
          description: 'nenhuma chamada interna permitida registrada',
        })
      try {
        var cbFinal = JSON.parse(execution.counts_before || '{}')
        var caFinal = JSON.parse(execution.counts_after || '{}')
        for (var dk in PORTA2D2B_EXPECTED_FINAL_DELTAS) {
          var actualDelta = (caFinal[dk] || 0) - (cbFinal[dk] || 0)
          if (actualDelta !== PORTA2D2B_EXPECTED_FINAL_DELTAS[dk])
            anomalies.push({
              type: 'FINAL_DELTA_MISMATCH',
              description:
                dk +
                ': esperado +' +
                PORTA2D2B_EXPECTED_FINAL_DELTAS[dk] +
                ' obtido +' +
                actualDelta,
            })
        }
      } catch (_) {
        anomalies.push({ type: 'FINAL_DELTA_PARSE' })
      }
      var decisaoObj = null
      try {
        decisaoObj = JSON.parse(execution.decisao || '{}')
      } catch (_) {}
      if (!decisaoObj || decisaoObj.overall_status !== 'PASS' || decisaoObj.total_calls !== 16)
        anomalies.push({ type: 'DECISAO_INCOERENTE' })
      if (anomalies.length > 0) {
        classification = 'FAIL'
        justification =
          'Divergências (' +
          anomalies.length +
          '): ' +
          anomalies
            .slice(0, 5)
            .map(function (a) {
              return a.type
            })
            .join(', ')
        return {
          pass: false,
          reason: justification,
          anomalies: anomalies,
          classification: classification,
          justification: justification,
          execution: execution,
          steps: steps,
        }
      }
      classification = 'PASS'
      justification =
        '16 etapas A1–D1 canônicas, PASS, contratos estruturais válidos, deltas por etapa/finais, flag_final=false, hashes verificáveis (original+sanitizado), sanitização confirmada, versão ' +
        PORTA2D2B_EXPECTED_VERSION +
        ', counters qualificados (activecampaign=0, blocked_external=0, allowed_internal>0).'
      return {
        pass: true,
        reason: '',
        anomalies: [],
        classification: classification,
        justification: justification,
        execution: execution,
        steps: steps,
      }
    }
    function normalizeExecRecord(rec) {
      return {
        id: rec.getString('id'),
        estado: rec.getString('estado'),
        versao_commit: rec.getString('versao_commit'),
        flag_final: rec.getString('flag_final'),
        decisao: rec.getString('decisao'),
        counts_before: rec.getString('counts_before'),
        counts_after: rec.getString('counts_after'),
        allowed_internal_calls: rec.getInt('allowed_internal_calls'),
        blocked_external_attempts: rec.getInt('blocked_external_attempts'),
        activecampaign_calls: rec.getInt('activecampaign_calls'),
        prova_zero_chamadas_externas: rec.getBool('prova_zero_chamadas_externas'),
      }
    }
    function normalizeStepRecord(s) {
      return {
        ordem: s.getString('ordem'),
        codigo: s.getString('codigo'),
        metodo: s.getString('metodo'),
        rota_sanitizada: s.getString('rota_sanitizada'),
        http_status_real: s.getInt('http_status_real'),
        http_status_esperado: s.getInt('http_status_esperado'),
        resultado: s.getString('resultado'),
        started_at: s.getString('started_at'),
        finished_at: s.getString('finished_at'),
        counts_antes: s.getString('counts_antes'),
        counts_depois: s.getString('counts_depois'),
        deltas: s.getString('deltas'),
        sha256_corpo_bruto: s.getString('sha256_corpo_bruto'),
        raw_body_original_sha256: s.getString('raw_body_original_sha256'),
        raw_body_sanitized: s.getString('raw_body_sanitized'),
        raw_body_sanitized_sha256: s.getString('raw_body_sanitized_sha256'),
        raw_body_size: s.getInt('raw_body_size'),
        sanitized: s.getBool('sanitized'),
        resposta_sanitizada: s.getString('resposta_sanitizada'),
        resposta_truncated: s.getBool('resposta_truncated'),
        resposta_original_length: s.getInt('resposta_original_length'),
        contrato: s.getString('contrato'),
        contrato_ok: s.getBool('contrato_ok'),
        erro_real: s.getString('erro_real'),
      }
    }
    function $porta2d2bValidate(app, execId) {
      var execution = null
      var steps = []
      try {
        var execRec = app.findFirstRecordByData('com_execucoes_porta_2d2b', 'id', execId)
        execution = normalizeExecRecord(execRec)
      } catch (er) {
        return {
          pass: false,
          reason: 'exec not found: ' + String(er).substring(0, 120),
          anomalies: [{ type: 'EXEC_NOT_FOUND' }],
          classification: 'NAO_ENCONTRADA',
          justification: 'Execução não encontrada.',
          execution: null,
          steps: [],
        }
      }
      try {
        var stepRecs = app.findRecordsByFilter(
          'com_etapas_porta_2d2b',
          "execucao_id = '" + execId + "'",
          'ordem',
          200,
          0,
        )
        for (var i = 0; i < stepRecs.length; i++) steps.push(normalizeStepRecord(stepRecs[i]))
      } catch (er) {
        return {
          pass: false,
          reason: 'step read error: ' + String(er).substring(0, 200),
          anomalies: [{ type: 'STEP_READ_ERROR', description: String(er).substring(0, 200) }],
          classification: 'ESTADO_INDETERMINADO',
          justification: 'Erro de leitura impede classificação.',
          execution: execution,
          steps: [],
        }
      }
      return validateCore(execution, steps)
    }
    function $porta2d2bValidateProjection(app, execId, projection, stepRecords) {
      if (!projection)
        return {
          pass: false,
          reason: 'projection missing',
          anomalies: [{ type: 'PROJECTION_MISSING' }],
          classification: 'NAO_ENCONTRADA',
          justification: 'Projeção ausente.',
          execution: null,
          steps: [],
        }
      var execution = {
        id: projection.id || execId,
        estado: projection.estado || '',
        versao_commit: projection.versao_commit || '',
        flag_final: projection.flag_final || '',
        decisao: projection.decisao || '',
        counts_before: projection.counts_before || '',
        counts_after: projection.counts_after || '',
        allowed_internal_calls: projection.allowed_internal_calls || 0,
        blocked_external_attempts: projection.blocked_external_attempts || 0,
        activecampaign_calls: projection.activecampaign_calls || 0,
        prova_zero_chamadas_externas: !!projection.prova_zero_chamadas_externas,
      }
      var steps = []
      if (!stepRecords || stepRecords.length === 0) return validateCore(execution, steps)
      try {
        for (var i = 0; i < stepRecords.length; i++) steps.push(normalizeStepRecord(stepRecords[i]))
      } catch (er) {
        return {
          pass: false,
          reason: 'step read error: ' + String(er).substring(0, 200),
          anomalies: [{ type: 'STEP_READ_ERROR', description: String(er).substring(0, 200) }],
          classification: 'ESTADO_INDETERMINADO',
          justification: 'Erro de leitura impede classificação.',
          execution: execution,
          steps: [],
        }
      }
      return validateCore(execution, steps)
    }
    function $porta2d2bValidateRecords(savedExec, stepRecords) {
      var execution = normalizeExecRecord(savedExec)
      var steps = []
      if (stepRecords && stepRecords.length > 0) {
        for (var i = 0; i < stepRecords.length; i++) steps.push(normalizeStepRecord(stepRecords[i]))
      }
      return validateCore(execution, steps)
    }
    // ─── objeto local validatorCanonical (seis membros) ───
    var validatorCanonical = {
      validate: $porta2d2bValidate,
      validateProjection: $porta2d2bValidateProjection,
      validateRecords: $porta2d2bValidateRecords,
      canonical: PORTA2D2B_CANONICAL,
      canonicalOrders: PORTA2D2B_CANONICAL_ORDERS,
      expectedVersion: PORTA2D2B_EXPECTED_VERSION,
    }

    // ─── catálogos canônicos do snapshot (constantes únicas no runner) ───
    var expectedContracts = {
      A7: { error: 'missing_signature' },
      B2: { duplicate: true },
      B4: { delta_snapshots: 1 },
      B5: { delta_ocorrencias: 1 },
      C1: {
        success: true,
        idempotent: false,
        rolled_back_action: 'restored_from_snapshot',
        rolled_back_collection: 'com_negocios',
        rolled_back_record_id: true,
        rolled_back_length: 1,
      },
      C2: { success: true, idempotent: true, rolled_back_length: 0 },
      D1: { http: 503, flag_final: false },
    }
    var hashDeclaration = {
      raw_body_original_sha256:
        'Hash SHA-256 do raw body ORIGINAL (nao exposto se contiver segredos). Refere-se ao conteudo bruto real recebido pelo runner. NAO pode ser recomputado do conteudo devolvido pois o original pode conter Authorization/token/assinatura/email/telefone sanitizados.',
      raw_body_sanitized_sha256:
        'Hash SHA-256 do raw_body_sanitized (conteudo sanitizado devolvido). PODE ser recomputado do conteudo devolvido no campo raw_body_sanitized. Valida-se o formato (64 hex) e a igualdade com o conteudo sanitizado persistido.',
      raw_body_size: 'Tamanho em bytes do raw body original (antes da sanitizacao).',
      sanitized: 'Indica se o conteudo persistido passou por sanitizacao de segredos.',
      recomputable: 'raw_body_sanitized_sha256',
      refers_to_original: 'raw_body_original_sha256',
    }

    // ─── Construtor do snapshot canônico completo ───
    // G18: snapshot persistido em com_execucoes_porta_2d2b.decisao com
    // todos os campos obrigatórios. Valores derivados de runtime (não
    // placeholders). snapshot_source='validateCore'.
    function buildTerminalSnapshot(o) {
      var v = o.validation
      var snapshot = {
        porta: '2D.2B',
        overall_status: o.overallStatus,
        go_no_go: o.goNoGo,
        stop_reason: o.stopReason || '',
        total_calls: o.totalCalls,
        delta_match: o.deltaMatch,
        persist_failure:
          o.persistFailure === true ||
          (typeof o.persistFailure === 'string' && o.persistFailure.length > 0),
        pass: v.pass,
        classification: v.classification,
        classification_justification: v.justification,
        anomalies: v.anomalies,
        canonical_map: PORTA2D2B_CANONICAL,
        expected_contracts: expectedContracts,
        hash_declaration: hashDeclaration,
        expected_version: PORTA2D2B_EXPECTED_VERSION,
        snapshot_source: 'validateCore',
        snapshot_version: PORTA2D2B_EXPECTED_VERSION,
        snapshot_at: new Date().toISOString(),
      }
      if (o.transactionError) snapshot.transaction_error = o.transactionError
      return snapshot
    }

    // ─── G19 (ponto 2): helper mecânico único para montar/validar a
    //     projeção terminal BLOCKED/FAIL antes do save.
    // NÃO chama validateCore sobre execução ainda running/started. Monta
    // uma projeção em memória com o estado terminal pretendido (blocked
    // ou fail) e os campos finais que serão persistidos, executa
    // validateCore sobre essa projeção, exige pass===false e
    // classification coerente (BLOCKED/FAIL) ANTES do save. Retorna
    // { ok, validation, projection, error }.
    function buildAndValidateTerminalProjection(opts) {
      var termEstado = opts.termEstado // 'blocked' ou 'fail'
      var expectedClass = opts.expectedClass // 'BLOCKED' ou 'FAIL'
      var steps = opts.steps // array já normalizado (etapas persistidas)
      var execId = opts.execId
      var versaoCommit = opts.versaoCommit || PORTA2D2B_EXPECTED_VERSION
      var countsBeforeStr = opts.countsBeforeStr || ''
      var countsAfterStr = opts.countsAfterStr || ''
      var flagFinalStr = opts.flagFinalStr || ''
      var allowedInternalCalls = opts.allowedInternalCalls || 0
      var blockedExternalAttempts = opts.blockedExternalAttempts || 0
      var activecampaignCalls = opts.activecampaignCalls || 0
      var decisaoStr = opts.decisaoStr || ''
      // Projeção terminal em memória com estado terminal pretendido e os
      // campos finais que serão persistidos.
      var projection = {
        id: execId,
        estado: termEstado,
        versao_commit: versaoCommit,
        flag_final: flagFinalStr,
        decisao: decisaoStr,
        counts_before: countsBeforeStr,
        counts_after: countsAfterStr,
        allowed_internal_calls: allowedInternalCalls,
        blocked_external_attempts: blockedExternalAttempts,
        activecampaign_calls: activecampaignCalls,
        prova_zero_chamadas_externas: blockedExternalAttempts === 0,
      }
      // validateCore sobre a projeção terminal (não sobre execução
      // running/started). Mesmo validateCore, sem criar outro.
      var validation = validateCore(projection, steps)
      if (!validation || validation.pass !== false) {
        return {
          ok: false,
          validation: validation,
          projection: projection,
          error:
            'Projeção terminal ' +
            expectedClass +
            ' não produziu pass===false (pass=' +
            (validation && validation.pass) +
            ')',
        }
      }
      if (validation.classification !== expectedClass) {
        return {
          ok: false,
          validation: validation,
          projection: projection,
          error:
            'Projeção terminal classification=' +
            validation.classification +
            ' esperado=' +
            expectedClass,
        }
      }
      return { ok: true, validation: validation, projection: projection, error: null }
    }

    // ─── Confirmação obrigatória do snapshot persistido ───
    // G19 (ponto 3): confirmação integral do snapshot no runner.
    // Exige:
    //   - presença dos 18 campos obrigatórios;
    //   - tipos estritos (strings, booleanos, inteiro não negativo,
    //     array, objetos não nulos e não arrays);
    //   - snapshot_source === 'validateCore';
    //   - expected_version === PORTA2D2B_EXPECTED_VERSION;
    //   - snapshot_version === PORTA2D2B_EXPECTED_VERSION;
    //   - snapshot_at como data ISO válida;
    //   - igualdade literal do conteúdo crítico com PORTA2D2B_CANONICAL,
    //     expectedContracts e hashDeclaration;
    //   - mapa com as 16 chaves, incluindo A8;
    //   - coerência de classification, overall_status, go_no_go e pass
    //     para PASS/BLOCKED/FAIL.
    // Retorna { ok: bool, error: string }.
    function confirmTerminalSnapshot(rec, expectedClassification, app) {
      var snap = null
      try {
        snap = JSON.parse(rec.getString('decisao') || '{}')
      } catch (er) {
        return {
          ok: false,
          error: 'G19_CONFIRMATION_FAILED: parse error: ' + String(er).substring(0, 120),
        }
      }
      if (!snap) return { ok: false, error: 'G19_CONFIRMATION_FAILED: snapshot nulo' }

      // ── presença dos 18 campos obrigatórios ──
      var requiredFields = [
        'porta',
        'overall_status',
        'go_no_go',
        'stop_reason',
        'total_calls',
        'delta_match',
        'persist_failure',
        'pass',
        'classification',
        'classification_justification',
        'anomalies',
        'canonical_map',
        'expected_contracts',
        'hash_declaration',
        'expected_version',
        'snapshot_source',
        'snapshot_version',
        'snapshot_at',
      ]
      for (var ri = 0; ri < requiredFields.length; ri++) {
        if (snap[requiredFields[ri]] === undefined)
          return {
            ok: false,
            error: 'G19_CONFIRMATION_FAILED: campo obrigatório ausente: ' + requiredFields[ri],
          }
      }

      // ── tipos estritos ──
      var stringFields = [
        'porta',
        'overall_status',
        'go_no_go',
        'stop_reason',
        'classification',
        'classification_justification',
        'expected_version',
        'snapshot_source',
        'snapshot_version',
        'snapshot_at',
      ]
      for (var sfi = 0; sfi < stringFields.length; sfi++) {
        if (typeof snap[stringFields[sfi]] !== 'string')
          return {
            ok: false,
            error:
              'G19_CONFIRMATION_FAILED: campo nao é string: ' +
              stringFields[sfi] +
              ' (' +
              typeof snap[stringFields[sfi]] +
              ')',
          }
      }
      if (typeof snap.delta_match !== 'boolean')
        return { ok: false, error: 'G19_CONFIRMATION_FAILED: delta_match nao é boolean' }
      if (typeof snap.persist_failure !== 'boolean')
        return { ok: false, error: 'G19_CONFIRMATION_FAILED: persist_failure nao é boolean' }
      if (typeof snap.pass !== 'boolean')
        return { ok: false, error: 'G19_CONFIRMATION_FAILED: pass nao é boolean' }
      if (
        typeof snap.total_calls !== 'number' ||
        !isFinite(snap.total_calls) ||
        Math.floor(snap.total_calls) !== snap.total_calls ||
        snap.total_calls < 0
      )
        return {
          ok: false,
          error: 'G19_CONFIRMATION_FAILED: total_calls nao é inteiro nao negativo',
        }
      if (!Array.isArray(snap.anomalies))
        return { ok: false, error: 'G19_CONFIRMATION_FAILED: anomalies nao é array' }
      if (
        typeof snap.canonical_map !== 'object' ||
        snap.canonical_map === null ||
        Array.isArray(snap.canonical_map)
      )
        return { ok: false, error: 'G19_CONFIRMATION_FAILED: canonical_map nao é objeto' }
      if (
        typeof snap.expected_contracts !== 'object' ||
        snap.expected_contracts === null ||
        Array.isArray(snap.expected_contracts)
      )
        return { ok: false, error: 'G19_CONFIRMATION_FAILED: expected_contracts nao é objeto' }
      if (
        typeof snap.hash_declaration !== 'object' ||
        snap.hash_declaration === null ||
        Array.isArray(snap.hash_declaration)
      )
        return { ok: false, error: 'G19_CONFIRMATION_FAILED: hash_declaration nao é objeto' }

      // ── snapshot_source === 'validateCore' ──
      if (snap.snapshot_source !== 'validateCore')
        return {
          ok: false,
          error: 'G19_CONFIRMATION_FAILED: snapshot_source=' + snap.snapshot_source,
        }
      // ── expected_version === PORTA2D2B_EXPECTED_VERSION ──
      if (snap.expected_version !== PORTA2D2B_EXPECTED_VERSION)
        return {
          ok: false,
          error: 'G19_CONFIRMATION_FAILED: expected_version=' + snap.expected_version,
        }
      // ── snapshot_version === PORTA2D2B_EXPECTED_VERSION ──
      if (snap.snapshot_version !== PORTA2D2B_EXPECTED_VERSION)
        return {
          ok: false,
          error: 'G19_CONFIRMATION_FAILED: snapshot_version=' + snap.snapshot_version,
        }
      // ── snapshot_at como data ISO válida ──
      var snapAtMs = new Date(snap.snapshot_at).getTime()
      if (isNaN(snapAtMs))
        return { ok: false, error: 'G19_CONFIRMATION_FAILED: snapshot_at ISO inválido' }

      // ── igualdade literal do conteúdo crítico com PORTA2D2B_CANONICAL,
      //    expectedContracts e hashDeclaration ──
      if (JSON.stringify(snap.canonical_map) !== JSON.stringify(PORTA2D2B_CANONICAL))
        return {
          ok: false,
          error: 'G19_CONFIRMATION_FAILED: canonical_map diverge de PORTA2D2B_CANONICAL',
        }
      if (JSON.stringify(snap.expected_contracts) !== JSON.stringify(expectedContracts))
        return {
          ok: false,
          error: 'G19_CONFIRMATION_FAILED: expected_contracts diverge de expectedContracts',
        }
      if (JSON.stringify(snap.hash_declaration) !== JSON.stringify(hashDeclaration))
        return {
          ok: false,
          error: 'G19_CONFIRMATION_FAILED: hash_declaration diverge de hashDeclaration',
        }

      // ── mapa com as 16 chaves, incluindo A8 ──
      var canonicalKeys = [
        'A1',
        'A2',
        'A3',
        'A4',
        'A5',
        'A6',
        'A7',
        'A8',
        'B1',
        'B2',
        'B3',
        'B4',
        'B5',
        'C1',
        'C2',
        'D1',
      ]
      for (var ci = 0; ci < canonicalKeys.length; ci++) {
        if (!snap.canonical_map[canonicalKeys[ci]])
          return {
            ok: false,
            error: 'G19_CONFIRMATION_FAILED: chave canonical_map ausente: ' + canonicalKeys[ci],
          }
      }

      // ── coerência de classification, overall_status, go_no_go e pass
      //    para PASS/BLOCKED/FAIL ──
      if (snap.classification !== expectedClassification)
        return {
          ok: false,
          error:
            'G19_CONFIRMATION_FAILED: classification=' +
            snap.classification +
            ' esperado=' +
            expectedClassification,
        }
      if (expectedClassification === 'PASS') {
        if (snap.pass !== true)
          return {
            ok: false,
            error: 'G19_CONFIRMATION_FAILED: pass=' + snap.pass + ' esperado=true (PASS)',
          }
        if (snap.overall_status !== 'PASS')
          return {
            ok: false,
            error: 'G19_CONFIRMATION_FAILED: overall_status=' + snap.overall_status + ' (PASS)',
          }
        if (snap.go_no_go !== 'GO')
          return {
            ok: false,
            error: 'G19_CONFIRMATION_FAILED: go_no_go=' + snap.go_no_go + ' (esperado GO)',
          }
      } else if (expectedClassification === 'BLOCKED') {
        if (snap.pass !== false)
          return {
            ok: false,
            error: 'G19_CONFIRMATION_FAILED: pass=' + snap.pass + ' esperado=false (BLOCKED)',
          }
        if (snap.overall_status !== 'BLOCKED')
          return {
            ok: false,
            error: 'G19_CONFIRMATION_FAILED: overall_status=' + snap.overall_status + ' (BLOCKED)',
          }
        if (snap.go_no_go !== 'NO-GO')
          return {
            ok: false,
            error: 'G19_CONFIRMATION_FAILED: go_no_go=' + snap.go_no_go + ' (esperado NO-GO)',
          }
      } else if (expectedClassification === 'FAIL') {
        if (snap.pass !== false)
          return {
            ok: false,
            error: 'G19_CONFIRMATION_FAILED: pass=' + snap.pass + ' esperado=false (FAIL)',
          }
        if (snap.overall_status !== 'STOP' && snap.overall_status !== 'FAIL')
          return {
            ok: false,
            error:
              'G19_CONFIRMATION_FAILED: overall_status=' +
              snap.overall_status +
              ' (esperado STOP/FAIL)',
          }
        if (snap.go_no_go !== 'NO-GO')
          return {
            ok: false,
            error: 'G19_CONFIRMATION_FAILED: go_no_go=' + snap.go_no_go + ' (esperado NO-GO)',
          }
      }
      return { ok: true, error: null, snapshot: snap }
    }

    // ─── Auth + superadmin PRIMEIRO ───
    var authId = e.auth ? e.auth.id : ''
    if (!authId) return e.unauthorizedError('Autenticacao necessaria')
    var isSA = false
    try {
      var p = $app.findRecordById('com_perfis', e.auth.getString('perfil_id'))
      if (p && p.getString('slug') === 'superadministrador') isSA = true
    } catch (_) {}
    if (!isSA) {
      try {
        var sp = $app.findFirstRecordByData('com_perfis', 'slug', 'superadministrador')
        var bnd = $app.findRecordsByFilter(
          'com_usuarios_equipes',
          "usuario_id = '" + authId + "' && perfil_id = '" + sp.id + "' && ativo = true",
          '',
          1,
          0,
        )
        if (bnd && bnd.length > 0) isSA = true
      } catch (_) {}
    }
    if (!isSA) return e.forbiddenError('Apenas superadministrador')

    // ─── Secrets ANTES do lock ───
    var baseUrl = ($secrets.get('PB_INSTANCE_URL') || '').replace(/\/$/, '')
    var whSecret = $secrets.get('AC_WEBHOOK_SECRET') || ''
    var authHdr = e.request.header.get('Authorization') || ''
    if (!baseUrl) return e.json(500, { error: 'PB_INSTANCE_URL not configured' })
    if (!whSecret) return e.json(500, { error: 'AC_WEBHOOK_SECRET not configured' })

    // ─── Precondição de evidência ───
    // SEGMENTO G15: versão unificada — usa somente
    // validatorCanonical.expectedVersion (PORTA2D2B_EXPECTED_VERSION).
    var expectedVersion = validatorCanonical.expectedVersion
    var execCol = null
    var evidenceCol = null
    try {
      execCol = $app.findCollectionByNameOrId('com_execucoes_porta_2d2b')
    } catch (_) {}
    try {
      evidenceCol = $app.findCollectionByNameOrId('com_etapas_porta_2d2b')
    } catch (_) {}
    if (!execCol || !evidenceCol) {
      return e.json(200, {
        porta: '2D.2B',
        overall_status: 'BLOCKED',
        go_no_go: 'NO-GO',
        stop_reason:
          'Precondição falhou: coleções com_execucoes_porta_2d2b/com_etapas_porta_2d2b inexistentes',
        activecampaign_calls: 0,
        synthetic_only: true,
        single_execution: true,
        lock_consumed: false,
        flag_changed: false,
      })
    }

    var execId = $security.randomStringWithAlphabet(32, 'abcdefghijklmnopqrstuvwxyz0123456789')
    var runnerVersion = 'R2-RUNNER-2D2B-20260813-V0137-FAILCLOSED'
    var correlationKey = 'TESTE-2D2B'
    var startedAt = new Date().toISOString()
    var execRecord = null
    var terminalSaved = false
    var runningSet = false
    var lockConsumed = false
    var flagChanged = false
    var allowedInternalCalls = 0 // CORREÇÃO 8a: chamadas internas permitidas
    var blockedExternalAttempts = 0 // CORREÇÃO 8b: tentativas fora da allowlist
    var activecampaignCalls = 0 // CORREÇÃO 8c: sempre zero
    var writesPerformedRound = 0

    // ─── Helpers ───
    function readFlag() {
      try {
        var r = $app.findFirstRecordByData('com_parametros', 'chave', 'ac_webhook_enabled')
        return { valor: r.getString('valor'), ativo: r.getBool('ativo'), error: null }
      } catch (er) {
        return { valor: null, ativo: null, error: String(er).substring(0, 200) }
      }
    }
    // CORREÇÃO 1 (v0.0.145) — readFlagWith(app): variante transacional.
    // readFlag() original usa $app diretamente e viola o isolamento quando
    // invocada dentro de $app.runInTransaction((txApp) => { ... }). Esta
    // variante recebe a instância da aplicação como parâmetro (txApp) e usa-a
    // exclusivamente. Fora da transação, readFlag() original permanece.
    function readFlagWith(app) {
      try {
        var r = app.findFirstRecordByData('com_parametros', 'chave', 'ac_webhook_enabled')
        return { valor: r.getString('valor'), ativo: r.getBool('ativo'), error: null }
      } catch (er) {
        return { valor: null, ativo: null, error: String(er).substring(0, 200) }
      }
    }
    function setWH(en) {
      try {
        var pc = $app.findCollectionByNameOrId('com_parametros')
        var fr
        try {
          fr = $app.findFirstRecordByData('com_parametros', 'chave', 'ac_webhook_enabled')
        } catch (_) {
          fr = new Record(pc)
          fr.set('chave', 'ac_webhook_enabled')
          fr.set('versao', 1)
        }
        fr.set('valor', en ? 'true' : 'false')
        fr.set('ativo', en)
        fr.set('descricao', 'Flag server-side webhook AC')
        fr.set('tipo', 'boolean')
        $app.save(fr)
        flagChanged = true
        return { success: true, reRead: readFlag() }
      } catch (er) {
        return { success: false, error: String(er).substring(0, 200), reRead: null }
      }
    }
    function sc(n) {
      try {
        return $app.countRecords(n)
      } catch (_) {
        return -1
      }
    }
    function gc() {
      return {
        contatos: sc('com_contatos'),
        negocios: sc('com_negocios'),
        eventos: sc('com_eventos_integracao'),
        execucoes: sc('com_execucoes_sincronizacao'),
        vinculos: sc('com_vinculos_externos'),
        snapshots: sc('com_snapshots_negocio'),
        ocorrencias: sc('com_ocorrencias_qualidade'),
        auditoria: sc('com_auditoria'),
      }
    }
    function signBody(s) {
      return $security.hs256(s, whSecret)
    }

    // ─── HTTP wrappers com allowlist ───
    var ALLOW_PREFIX = baseUrl + '/backend/v1/integracao/ac/'
    function assertAllowed(url) {
      if (url.indexOf(ALLOW_PREFIX) !== 0) {
        blockedExternalAttempts++
        throw new Error('Destino fora da allowlist bloqueado: ' + url.substring(0, 80))
      }
      allowedInternalCalls++
    }
    function callWH(m, h, b) {
      var url = baseUrl + '/backend/v1/integracao/ac/webhook'
      assertAllowed(url)
      var sAt = new Date().toISOString()
      var raw = ''
      var status = 0
      var j = {}
      try {
        var res = $http.send({ url: url, method: m, headers: h, body: b || '', timeout: 15 })
        status = res.statusCode
        raw = res.raw || ''
        try {
          j = res.json || {}
        } catch (_) {
          try {
            j = raw ? JSON.parse(raw) : {}
          } catch (_) {
            j = {}
          }
        }
      } catch (er) {
        raw = String(er).substring(0, 200)
      }
      var fAt = new Date().toISOString()
      return { status: status, json: j, raw: raw, started_at: sAt, finished_at: fAt }
    }
    function callRB(b, sig) {
      var url = baseUrl + '/backend/v1/integracao/ac/rollback'
      assertAllowed(url)
      var sAt = new Date().toISOString()
      var raw = ''
      var status = 0
      var j = {}
      try {
        var res = $http.send({
          url: url,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: authHdr,
            'X-AC-Signature': sig,
          },
          body: b,
          timeout: 15,
        })
        status = res.statusCode
        raw = res.raw || ''
        try {
          j = res.json || {}
        } catch (_) {
          try {
            j = raw ? JSON.parse(raw) : {}
          } catch (_) {
            j = {}
          }
        }
      } catch (er) {
        raw = String(er).substring(0, 200)
      }
      var fAt = new Date().toISOString()
      return { status: status, json: j, raw: raw, started_at: sAt, finished_at: fAt }
    }

    function rc(id, m, u, exp, act, resp, cb, ca, pass) {
      callResults.push({
        call: id,
        method: m,
        url: u,
        expected_status: exp,
        actual_status: act,
        response: JSON.stringify(resp).substring(0, 500),
        counts_before: cb,
        counts_after: ca,
        passed: pass,
      })
    }
    function truncId(s) {
      return s ? String(s).substring(0, 8) : ''
    }
    function computeDeltas(before, after) {
      var d = {}
      var keys = [
        'contatos',
        'negocios',
        'eventos',
        'execucoes',
        'vinculos',
        'snapshots',
        'ocorrencias',
        'auditoria',
      ]
      for (var i = 0; i < keys.length; i++)
        d[keys[i]] = (after[keys[i]] || 0) - (before[keys[i]] || 0)
      return d
    }

    // ─── Sanitização recursiva ───
    var FORBIDDEN_KEYS = {
      token: true,
      secret: true,
      signature: true,
      authorization: true,
      password: true,
      api_key: true,
      apikey: true,
      privatekey: true,
      email: true,
      'e-mail': true,
      phone: true,
      telefone: true,
      headers: true,
    }
    function normKey(k) {
      return String(k)
        .toLowerCase()
        .replace(/[\s_-]/g, '')
    }
    function isForbiddenKey(k) {
      var nk = normKey(k)
      if (FORBIDDEN_KEYS[nk]) return true
      if (nk.indexOf('token') !== -1) return true
      if (nk.indexOf('secret') !== -1) return true
      if (nk.indexOf('signature') !== -1) return true
      if (nk.indexOf('authoriz') !== -1) return true
      if (nk.indexOf('password') !== -1) return true
      if (nk.indexOf('apikey') !== -1) return true
      if (nk.indexOf('email') !== -1 || nk.indexOf('mail') !== -1) return true
      if (nk.indexOf('phone') !== -1 || nk.indexOf('telefone') !== -1) return true
      if (nk.indexOf('header') !== -1) return true
      return false
    }
    function sanitizeDeep(obj) {
      if (obj === null || obj === undefined) return obj
      if (typeof obj !== 'object') return obj
      if (Array.isArray(obj)) {
        var arr = []
        for (var ai = 0; ai < obj.length; ai++) arr.push(sanitizeDeep(obj[ai]))
        return arr
      }
      var out = {}
      for (var key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          if (isForbiddenKey(key)) continue
          out[key] = sanitizeDeep(obj[key])
        }
      }
      return out
    }

    // ─── CORREÇÃO 7: truncamento com envelope JSON válido ───
    function truncateSanitized(obj) {
      var full = JSON.stringify(obj)
      var origLen = full.length
      if (origLen <= 2000) return { text: full, truncated: false, original_length: origLen }
      // Trunca preservando envelope JSON válido
      var cut = full.substring(0, 1900)
      var envelope = JSON.stringify({
        truncated: true,
        original_length: origLen,
        preview: cut,
      })
      return { text: envelope, truncated: true, original_length: origLen }
    }
    function sanitizeErrorText(s) {
      if (!s) return ''
      var t = String(s)
      t = t.replace(/(Bearer\s+[A-Za-z0-9\._\-]+)/gi, 'Bearer [REDACTED]')
      t = t.replace(/(token=[A-Za-z0-9\._\-]+)/gi, 'token=[REDACTED]')
      return t.substring(0, 500)
    }

    // ─── G26: sanitização de mensagens de erro de persistência.
    //     COBERTURA ESTRUTURAL COMPLETA. Aplica em ordem:
    //       a) URLs http/https (query, user:pass, host interno) → [REDACTED_URL]
    //       b) Authorization: Bearer/Basic <qualquer coisa> → [REDACTED]
    //          (case-insensitive)
    //       c) private_key em formato PEM (BEGIN...END, inclusive RSA/EC)
    //          → [REDACTED]
    //       d) headers como objeto JSON (headers:{...}, "headers":{...},
    //          headers={...}) → objeto inteiro substituído por [REDACTED]
    //       e) Pares chave-valor com valor COMPLETO substituído por
    //          [REDACTED] — "chave":"valor", "chave": "valor",
    //          chave: "valor", chave='valor', chave=valor, chave: valor
    //          (valor com espaços substituído integralmente). Chaves
    //          sensíveis (case-insensitive, - e _ equivalentes):
    //          password, passwd, token, api_key/apikey, access_token,
    //          refresh_token, client_secret, private_key/privatekey,
    //          secret, signature, authorization, x-api-key, cookie.
    //       f) e-mails e telefones (regex, preservados).
    //     Limite de 300 caracteres após toda sanitização. Não expõe
    //     stack bruta, payload, corpo original, credencial ou URL secreta.
    // ─── G27: chave normalizada (case-insensitive, - e _ equivalentes).
    //     `headers` é tratado à parte (passo d) e não entra no padrão de
    //     pares chave-valor para evitar reprocessamento do [REDACTED].
    var SENSITIVE_KEY_PATTERN =
      'password|passwd|token|api[_-]?key|apikey|access[_-]?token|refresh[_-]?token|client[_-]?secret|private[_-]?key|privatekey|secret|signature|authorization|x[_-]?api[_-]?key|cookie'
    // ─── G27: helper determinístico de varredura/balanceamento.
    //     Encontra o fim de um objeto JSON/valor delimitado por chaves a
    //     partir da posição `start` (que aponta para a `{` de abertura),
    //     respeitando chaves aninhadas, strings com aspas simples/duplas e
    //     escapes `\`. Retorna o índice do `}` que fecha o objeto, ou -1 se
    //     desbalanceado (fail-closed: chamador deve tratar removendo o
    //     restante). NÃO usa regex `[^}]*` — varre caractere a caractere.
    function $findBalancedBraceEnd(str, start) {
      var i = start
      var n = str.length
      // `start` deve apontar para '{'.
      if (i >= n || str.charAt(i) !== '{') return -1
      var depth = 0
      var inStr = false
      var strCh = ''
      for (; i < n; i++) {
        var ch = str.charAt(i)
        if (inStr) {
          if (ch === '\\') {
            i++
            continue
          }
          if (ch === strCh) inStr = false
          continue
        }
        if (ch === '"' || ch === "'") {
          inStr = true
          strCh = ch
          continue
        }
        if (ch === '{') depth++
        else if (ch === '}') {
          depth--
          if (depth === 0) return i
        }
      }
      return -1
    }
    // ─── G27: helper determinístico para blocos PEM.
    //     Encontra o fim de um bloco PEM `-----END ... PRIVATE KEY-----`
    //     após `start` (que aponta para o início do `-----BEGIN`). Retorna
    //     o índice logo após o `-----` final do END, ou -1 se não houver
    //     END (fail-closed: chamador deve remover todo o restante). Varre
    //     por substring; NÃO usa regex com captura greedy de `[\s\S]*?`.
    function $findPemBlockEnd(str, start) {
      var beginIdx = str.indexOf('-----BEGIN', start)
      if (beginIdx === -1) return -1
      var endIdx = str.indexOf('-----END', beginIdx)
      if (endIdx === -1) return -1
      var dashEnd = str.indexOf('-----', endIdx + 8)
      if (dashEnd === -1) return -1
      return dashEnd + 5
    }
    function sanitizePersistErrorMessage(s) {
      var t = String(s == null ? '' : s)
      // (a) URLs sensíveis — inclui query strings, user:password embutidos,
      //     hosts internos e qualquer caminho. Aplicado globalmente ANTES
      //     das demais sanitizações.
      t = t.replace(/https?:\/\/[^\s"'<>]+/gi, '[REDACTED_URL]')
      // (b) Authorization: Bearer/Basic <qualquer coisa>
      //     → Authorization: Bearer/Basic [REDACTED] (case-insensitive).
      //     G27: remove o valor COMPLETO até um delimitador estrutural
      //     seguro (aspas, vírgula, ponto-e-vírgula, fecha-chave,
      //     fecha-colchete, fim de linha ou fim da string) — não apenas
      //     até o primeiro espaço, cobrindo valores com espaços.
      t = t.replace(/(Authorization\s*:\s*Bearer\s+)/gi, function (m, p1) {
        return p1 + '[REDACTED]'
      })
      t = t.replace(/(Authorization\s*:\s*Basic\s+)/gi, function (m, p1) {
        return p1 + '[REDACTED]'
      })
      //     Após redactar Bearer/Basic, o `[REDACTED]` ocupa o lugar do
      //     valor. A regex acima consumiu o prefixo; agora consome o
      //     restante do valor (qualquer coisa até delimitador estrutural).
      //     Reaplica para garantir que sufixos com espaços sumam.
      t = t.replace(/(Authorization\s*:\s*Bearer\s+\[REDACTED\])\S*/gi, '$1')
      t = t.replace(/(Authorization\s*:\s*Basic\s+\[REDACTED\])\S*/gi, '$1')
      //     Se o valor Bearer/Basic tinha espaços, o trecho após o
      //     primeiro espaço ainda permanece; remova até delimitador
      //     estrutural (vírgula/fecha-chave/fecha-colchete/fim-de-linha).
      t = t.replace(/(Authorization\s*:\s*Bearer\s+\[REDACTED\])[^,;\]}]*/gi, '$1')
      t = t.replace(/(Authorization\s*:\s*Basic\s+\[REDACTED\])[^,;\]}]*/gi, '$1')
      // (b2) Preserva `Authorization: Bearer/Basic [REDACTED]` para que o
      //      passo (e) (chave: valor) não re-redatada o conteúdo. Marca o
      //      trecho já-sanitizado com placeholders ASCII seguros.
      t = t.replace(/Authorization\s*:\s*Bearer\s+\[REDACTED\]/gi, '\x01AUTH_BEARER_OK\x01')
      t = t.replace(/Authorization\s*:\s*Basic\s+\[REDACTED\]/gi, '\x01AUTH_BASIC_OK\x01')
      // (c) private_key em formato PEM — BEGIN...END (inclusive RSA/EC).
      //     G27: usa helper determinístico de varredura. Se houver BEGIN
      //     sem END, fail-closed: remove todo o restante da mensagem a
      //     partir do BEGIN. Itera para cobrir múltiplos blocos.
      var pemIdx = t.indexOf('-----BEGIN')
      while (pemIdx !== -1) {
        var endPos = $findPemBlockEnd(t, pemIdx)
        if (endPos === -1) {
          // Fail-closed: BEGIN sem END — remove todo o restante.
          t = t.substring(0, pemIdx) + '[REDACTED]'
          break
        }
        t = t.substring(0, pemIdx) + '[REDACTED]' + t.substring(endPos)
        pemIdx = t.indexOf('-----BEGIN', pemIdx + '[REDACTED]'.length)
      }
      // (d) headers como objeto JSON — substitui o objeto INTEIRO por
      //     [REDACTED]. G27: usa helper de balanceamento de chaves
      //     ($findBalancedBraceEnd) em vez de regex `[^}]*`, cobrindo
      //     objetos aninhados e strings escapadas. Cobre headers:{...},
      //     "headers":{...}, "headers": {...}, headers={...}.
      var hdrRe = /("?headers"?)\s*([:=]\s*)\{/gi
      var hdrMatch
      while ((hdrMatch = hdrRe.exec(t)) !== null) {
        var braceStart = hdrMatch.index + hdrMatch[0].length - 1
        var braceEnd = $findBalancedBraceEnd(t, braceStart)
        if (braceEnd === -1) {
          // Fail-closed: objeto desbalanceado — remove o restante.
          t = t.substring(0, hdrMatch.index) + hdrMatch[1] + hdrMatch[2] + '[REDACTED]'
          hdrRe.lastIndex = t.length
          break
        }
        var replacement = hdrMatch[1] + hdrMatch[2] + '[REDACTED]'
        t = t.substring(0, hdrMatch.index) + replacement + t.substring(braceEnd + 1)
        hdrRe.lastIndex = hdrMatch.index + replacement.length
      }
      // (e) Pares chave-valor com valor COMPLETO substituído.
      //     1) "chave":"valor"  e  "chave": "valor"
      t = t.replace(
        new RegExp('("(?:' + SENSITIVE_KEY_PATTERN + ')"\\s*(?::)\\s*)"([^"]*)"', 'gi'),
        '$1"[REDACTED]"',
      )
      //     2) chave: "valor"  (sem aspas na chave)
      t = t.replace(
        new RegExp('\\b((?:' + SENSITIVE_KEY_PATTERN + ')\\s*(?::)\\s*)"([^"]*)"', 'gi'),
        '$1"[REDACTED]"',
      )
      //     3) chave: valor  (sem aspas, valor com espaços — substitui
      //        integralmente até separador de bloco)
      t = t.replace(
        new RegExp('\\b((?:' + SENSITIVE_KEY_PATTERN + ')\\s*(?::)\\s*)[^\\n;,}\\\]]+', 'gi'),
        '$1[REDACTED]',
      )
      //     4) chave='valor'  (aspas simples)
      t = t.replace(
        new RegExp('\\b((?:' + SENSITIVE_KEY_PATTERN + ")\\s*(?:=)\\s*)'([^']*)'", 'gi'),
        "$1'[REDACTED]'",
      )
      //     5) chave=valor  (sem aspas, valor com espaços — substitui
      //        integralmente até separador de bloco)
      t = t.replace(
        new RegExp('\\b((?:' + SENSITIVE_KEY_PATTERN + ')\\s*(?:=)\\s*)[^\\n;,}\\\]]+', 'gi'),
        '$1[REDACTED]',
      )
      // (b2r) Restaura Authorization: Bearer/Basic [REDACTED] preservado.
      t = t.replace(/\x01AUTH_BEARER_OK\x01/g, 'Authorization: Bearer [REDACTED]')
      t = t.replace(/\x01AUTH_BASIC_OK\x01/g, 'Authorization: Basic [REDACTED]')
      // (f) e-mails
      t = t.replace(/[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/gi, '[REDACTED]')
      // (g) telefones (+ opcional, 8-15 digitos com separadores)
      t = t.replace(/\+?\d[\d\s().\-]{6,}\d/g, '[REDACTED]')
      // (h) Limpeza de sufixo residual: nenhum `[REDACTED]` pode deixar
      //     colchete/parêntese residual. Remove duplicações óbvias.
      t = t.replace(/\[REDACTED\]\]/g, '[REDACTED]')
      if (t.length > 300) t = t.substring(0, 300)
      return t
    }

    /* ───────────────────────────────────────────────────────────────
     * G26 — TESTES ESTÁTICOS DA SANITIZADORA (não executados em produção)
     * ───────────────────────────────────────────────────────────────
     * Bloco de auto-teste documental. NÃO é invocado em produção (nenhuma
     * rota, hook, cron ou migration o chama). Existe apenas para registrar
     * os casos exigidos pelo segmento G26 e permitir verificação
     * humana/lint das saídas esperadas. Cada caso afirma que zero valor
     * sensível original permanece após sanitizePersistErrorMessage. Os
     * testes executáveis estão em scripts/test-sanitize-2d2b.cjs (extrai
     * a função real do hook de produção via node:vm, sem cópia).
     *
     * Entradas → Saídas esperadas (literais):
     *
     *  1. 'password=segredo123'
     *     → 'password=[REDACTED]'
     *       (não contém 'segredo123')
     *
     *  2. 'token: abc.def.ghi'
     *     → 'token: [REDACTED]'
     *       (não contém 'abc.def.ghi')
     *
     *  3. 'Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.abc.def'
     *     → 'Authorization: Bearer [REDACTED]'
     *       (não contém 'eyJhbGciOiJIUzI1NiJ9.abc.def')
     *
     *  4. '{"private_key":"CHAVE_PRIVADA_SECRETA"}'
     *     → '{"private_key":"[REDACTED]"}'
     *       (não contém 'CHAVE_PRIVADA_SECRETA')
     *
     *  5. 'client-secret=valor-super-secreto'
     *     → 'client-secret=[REDACTED]'
     *       (não contém 'valor-super-secreto')
     *
     *  6. 'https://usuario:senha@host.interno/caminho?token=abc123'
     *     → '[REDACTED_URL]'
     *       (contém '[REDACTED_URL]'; não contém 'usuario', 'senha',
     *        'abc123')
     *
     *  7. 'email: joao@example.com enviado'
     *     → 'email: [REDACTED] enviado'
     *       (não contém 'joao@example.com')
     *
     *  8. 'tel: +55 11 99999-9999'
     *     → 'tel: [REDACTED]'   (telefone redacted; 'tel' não é chave
     *       sensível, mas o número some pela regex de telefone)
     *       (não contém '+55 11 99999-9999')
     *
     *  9. 'api_key=sk-abc123-def456'
     *     → 'api_key=[REDACTED]'
     *       (não contém 'sk-abc123-def456')
     *
     * 10. 'access_token: xyz.789'
     *     → 'access_token: [REDACTED]'
     *       (não contém 'xyz.789')
     *
     * (Os casos executáveis vivem em scripts/test-sanitize-2d2b.cjs, que
     *  extrai a função real deste hook via node:vm. Nenhuma função de
     *  auto-teste é declarada aqui — zero código de teste no hook de
     *  produção.)
     * Resultado esperado: todos pass:true, zero leaked:true.
     * ─────────────────────────────────────────────────────────────── */

    // ─── G26: composeTerminalReason(original, stage, detail) ───
    //     Preserva a causa original (stopReasonArg) em todos os caminhos
    //     de falha de terminalizeBlockedOrFail. Regras:
    //       - mantém a causa original sanitizada (se vazia/null/undefined,
    //         usa fallback neutro 'persist_step_failure');
    //       - acrescenta ` | <stage>: <detail>`;
    //       - nunca substitui a causa original;
    //       - não duplica o mesmo stage em chamadas sucessivas (se
    //         `original` já contém ` | <stage>:` não re-adiciona);
    //       - limita o resultado final a 500 chars;
    //       - aplica sanitizePersistErrorMessage no resultado final.
    function composeTerminalReason(original, stage, detail) {
      var base = original && String(original).length > 0 ? String(original) : 'persist_step_failure'
      var stagePrefix = ' | ' + stage + ':'
      // Não re-adiciona se o stage já está presente na causa original.
      if (base.indexOf(stagePrefix) !== -1) {
        var composed = base
      } else {
        var detailStr = detail ? String(detail) : ''
        var composed = base + stagePrefix + (detailStr ? ' ' + detailStr : '')
      }
      composed = sanitizePersistErrorMessage(composed)
      if (composed.length > 500) composed = composed.substring(0, 500)
      return composed
    }

    // ─── CORREÇÃO 6: hash verificável (sanitizado + original) ───
    // raw_body_sanitized_sha256: pode ser recomputado do conteúdo devolvido
    // raw_body_original_sha256: refere-se ao raw original (não exposto se
    //   contiver segredos; hash sobre raw bruto real para integridade)
    function hashRawBodies(rawBody, respJson) {
      var rawOrig = rawBody || ''
      var rawOrigHash = $security.sha256(rawOrig)
      var sanitizedForHash = sanitizeDeep(respJson || {})
      var sanitizedText = JSON.stringify(sanitizedForHash)
      var sanitizedHash = $security.sha256(sanitizedText)
      return {
        raw_original_sha256: rawOrigHash,
        raw_sanitized_sha256: sanitizedHash,
        raw_size: rawOrig.length,
        sanitized_size: sanitizedText.length,
        sanitized_text: sanitizedText,
      }
    }

    // ─── CORREÇÃO 5: contrato estrutural por etapa ───
    function buildContract(ordem, respJson, cb, ca) {
      var j = respJson || {}
      var deltas = computeDeltas(cb || {}, ca || {})
      if (ordem === 'A7') {
        return { error: j.error || null, expected_error: 'missing_signature' }
      }
      if (ordem === 'B2') {
        return { duplicate: j.duplicate === true, expected_duplicate: true }
      }
      if (ordem === 'B4') {
        return {
          delta_snapshots: deltas.snapshots,
          expected_delta_snapshots: 1,
        }
      }
      if (ordem === 'B5') {
        return {
          delta_ocorrencias: deltas.ocorrencias,
          expected_delta_ocorrencias: 1,
        }
      }
      if (ordem === 'C1') {
        var rb0 = j.rolled_back && j.rolled_back[0] ? j.rolled_back[0] : {}
        return {
          success: j.success === true,
          idempotent: j.idempotent,
          rolled_back_action: rb0.action || null,
          rolled_back_collection: rb0.collection || null,
          rolled_back_record_id: rb0.record_id ? true : false,
          rolled_back_length: j.rolled_back ? j.rolled_back.length : 0,
        }
      }
      if (ordem === 'C2') {
        return {
          success: j.success === true,
          idempotent: j.idempotent === true,
          rolled_back_length: j.rolled_back ? j.rolled_back.length : 0,
        }
      }
      if (ordem === 'D1') {
        return { http_status: j.http_status || null, flag_final: 'false', expected_http: 503 }
      }
      return { note: 'no_specific_contract' }
    }
    function validateContract(ordem, contrato) {
      if (ordem === 'A7') return contrato.error === 'missing_signature'
      if (ordem === 'B2') return contrato.duplicate === true
      if (ordem === 'B4') return contrato.delta_snapshots === 1
      if (ordem === 'B5') return contrato.delta_ocorrencias === 1
      if (ordem === 'C1') {
        return (
          contrato.success === true &&
          contrato.idempotent === false &&
          contrato.rolled_back_action === 'restored_from_snapshot' &&
          contrato.rolled_back_collection === 'com_negocios' &&
          contrato.rolled_back_record_id === true &&
          contrato.rolled_back_length === 1
        )
      }
      if (ordem === 'C2') {
        return (
          contrato.success === true &&
          contrato.idempotent === true &&
          contrato.rolled_back_length === 0
        )
      }
      if (ordem === 'D1') return true // HTTP 503 já validado no passo
      return true
    }

    // ─── CORREÇÃO 5: persistStep fail-closed com releitura e validação ───
    function persistStep(
      ordem,
      codigo,
      metodo,
      rota,
      sAt,
      fAt,
      httpReal,
      httpEsp,
      pass,
      cb,
      ca,
      respJson,
      rawBody,
      erro,
      idsCorr,
    ) {
      if (!evidenceCol || !execRecord)
        return {
          ok: false,
          error: 'no evidence collection/exec record',
          errorType: 'UNKNOWN_PERSIST_FAILURE',
        }
      try {
        var stepId = execId + '_' + ordem
        var step = new Record(evidenceCol)
        step.set('id', stepId)
        step.set('execucao_id', execId)
        step.set('ordem', ordem)
        step.set('codigo', codigo)
        step.set('metodo', metodo)
        step.set('rota_sanitizada', rota)
        step.set('started_at', sAt)
        step.set('finished_at', fAt)
        step.set('http_status_real', httpReal)
        step.set('http_status_esperado', httpEsp)
        step.set('resultado', pass ? 'PASS' : 'FAIL')
        step.set('counts_antes', JSON.stringify(cb || {}))
        step.set('counts_depois', JSON.stringify(ca || {}))
        step.set('deltas', JSON.stringify(computeDeltas(cb || {}, ca || {})))
        step.set('ids_correlacao_sanitizados', JSON.stringify(idsCorr || []))

        // CORREÇÃO 6: hash verificável
        var hashes = hashRawBodies(rawBody, respJson)
        step.set('sha256_corpo_bruto', hashes.raw_original_sha256)
        step.set('raw_body_original_sha256', hashes.raw_original_sha256)
        step.set('raw_body_sanitized', hashes.sanitized_text)
        step.set('raw_body_sanitized_sha256', hashes.raw_sanitized_sha256)
        step.set('raw_body_size', hashes.raw_size)
        step.set('sanitized', true)

        // CORREÇÃO 7: resposta sanitizada + truncamento
        var sanitizedResp = sanitizeDeep(respJson || {})
        var trunc = truncateSanitized(sanitizedResp)
        step.set('resposta_sanitizada', trunc.text)
        step.set('resposta_truncated', trunc.truncated)
        step.set('resposta_original_length', trunc.original_length)
        step.set('erro_real', sanitizeErrorText(erro || ''))

        // CORREÇÃO 5: contrato estrutural
        var contrato = buildContract(ordem, respJson, cb, ca)
        var contratoOk = validateContract(ordem, contrato)
        step.set('contrato', JSON.stringify(contrato))
        step.set('contrato_ok', contratoOk)

        // CORREÇÃO 4 (G24): persistência com diagnóstico sanitizado.
        // Diferencia 4 tipos de erro — DB_SAVE_EXCEPTION (save lançou),
        // REREAD_NOT_FOUND (reread nula/não encontrada),
        // REREAD_MISMATCH (campo esperado diverge do gravado),
        // UNKNOWN_PERSIST_FAILURE (demais falhas) — sanitiza a mensagem
        // (sem token/secret/signature/authorization/password/api_key/
        // private_key/headers/access_token/refresh_token/client_secret/
        // bearer/basic auth/e-mail/telefone), limita a 300 caracteres e
        // nunca expõe stack bruta, payload, corpo original, credencial ou
        // URL secreta.
        var persistErrorType = 'UNKNOWN_PERSIST_FAILURE'
        var persistErrorMessage = 'Falha desconhecida ao persistir etapa'
        try {
          $app.save(step)
        } catch (saveErr) {
          persistErrorType = 'DB_SAVE_EXCEPTION'
          persistErrorMessage = sanitizePersistErrorMessage(
            'DB_SAVE_EXCEPTION ' + ordem + ': ' + String(saveErr),
          )
          return { ok: false, error: persistErrorMessage, errorType: persistErrorType }
        }
        writesPerformedRound++

        // Releitura e validação de campos críticos
        var reRead = null
        try {
          reRead = $app.findFirstRecordByData('com_etapas_porta_2d2b', 'id', stepId)
        } catch (rrErr) {
          persistErrorType = 'REREAD_NOT_FOUND'
          persistErrorMessage = sanitizePersistErrorMessage(
            'Etapa nao encontrada apos persistencia: ' + String(rrErr),
          )
          return { ok: false, error: persistErrorMessage, errorType: persistErrorType }
        }
        if (!reRead) {
          persistErrorType = 'REREAD_NOT_FOUND'
          persistErrorMessage = sanitizePersistErrorMessage(
            'Etapa nao encontrada apos persistencia',
          )
          return { ok: false, error: persistErrorMessage, errorType: persistErrorType }
        }
        var mismatchField = null
        if (reRead.getString('ordem') !== ordem) mismatchField = 'ordem'
        else if (reRead.getString('codigo') !== codigo) mismatchField = 'codigo'
        else if (reRead.getInt('http_status_real') !== httpReal) mismatchField = 'http_status_real'
        else if (reRead.getString('resultado') !== (pass ? 'PASS' : 'FAIL'))
          mismatchField = 'resultado'
        else if (reRead.getString('sha256_corpo_bruto') !== hashes.raw_original_sha256)
          mismatchField = 'sha256_corpo_bruto'
        else if (reRead.getString('raw_body_sanitized_sha256') !== hashes.raw_sanitized_sha256)
          mismatchField = 'raw_body_sanitized_sha256'
        else if (reRead.getBool('contrato_ok') !== contratoOk) mismatchField = 'contrato_ok'
        else if (reRead.getBool('resposta_truncated') !== trunc.truncated)
          mismatchField = 'resposta_truncated'
        if (mismatchField) {
          persistErrorType = 'REREAD_MISMATCH'
          persistErrorMessage = sanitizePersistErrorMessage(
            'Divergencia na etapa persistida: campo esperado diferente do gravado (' +
              mismatchField +
              ')',
          )
          return { ok: false, error: persistErrorMessage, errorType: persistErrorType }
        }
        return { ok: true, error: null, errorType: null, contrato_ok: contratoOk }
      } catch (er) {
        return {
          ok: false,
          error: sanitizePersistErrorMessage('persistStep error ' + ordem + ': ' + String(er)),
          errorType: 'UNKNOWN_PERSIST_FAILURE',
        }
      }
    }

    // ─── CORREÇÃO 4: safeUpdateExec estruturado com reread ───
    function safeUpdateExec(fields) {
      if (!execRecord) return { saved: false, reread: null, error: 'no exec record' }
      try {
        for (var k in fields) {
          if (Object.prototype.hasOwnProperty.call(fields, k)) execRecord.set(k, fields[k])
        }
        $app.save(execRecord)
        // CORREÇÃO 4: reler e validar campos críticos
        var reRead = null
        try {
          reRead = $app.findFirstRecordByData('com_execucoes_porta_2d2b', 'id', execId)
        } catch (rrErr) {
          return {
            saved: false,
            reread: null,
            error: 'reread failed: ' + String(rrErr).substring(0, 150),
          }
        }
        if (!reRead) return { saved: false, reread: null, error: 'reread null' }
        // validar campos críticos se presentes no update
        if (fields.estado && reRead.getString('estado') !== fields.estado) {
          return { saved: false, reread: reRead, error: 'estado mismatch on reread' }
        }
        return { saved: true, reread: reRead, error: null }
      } catch (er) {
        console.log('evidence safeUpdateExec error: ' + String(er).substring(0, 200))
        return { saved: false, reread: null, error: String(er).substring(0, 200) }
      }
    }

    // ─── G19 (ponto 2): terminalização BLOCKED/FAIL com projeção
    //     validada ANTES do save. Helper único
    //     buildAndValidateTerminalProjection cobre os três caminhos.
    //     Não chama validateCore sobre execução running/started; monta a
    //     projeção terminal em memória, valida, exige pass===false e
    //     classification coerente ANTES do save; após safeUpdateExec
    //     relê e confirma estado e snapshot completos; se
    //     confirmTerminalSnapshot falhar, não reporta o registro terminal
    //     como confirmado (terminalSaved=false).
    function terminalizeBlockedOrFail(opts) {
      var termEstado = opts.termEstado // 'blocked' ou 'fail'
      var expectedClass = opts.expectedClass // 'BLOCKED' ou 'FAIL'
      var overallStat = opts.overallStatus // 'BLOCKED' ou 'STOP'
      var stopReasonArg = opts.stopReason
      var transactionError = opts.transactionError || null

      // Reler etapas persistidas (não a execução running/started).
      var steps = []
      try {
        var stepRecs = $app.findRecordsByFilter(
          'com_etapas_porta_2d2b',
          "execucao_id = '" + execId + "'",
          'ordem',
          200,
          0,
        )
        for (var s = 0; s < stepRecs.length; s++) steps.push(normalizeStepRecord(stepRecs[s]))
      } catch (er) {
        // Erro de leitura impede classificação; não persiste snapshot
        // confirmado. G26: usa composeTerminalReason no caminho stepRead.
        overallStatus = 'BLOCKED'
        stopReason = composeTerminalReason(stopReasonArg, 'stepRead', String(er).substring(0, 150))
        terminalSaved = false
        return
      }
      // Montar e validar a projeção terminal ANTES do save.
      var projectionResult = buildAndValidateTerminalProjection({
        termEstado: termEstado,
        expectedClass: expectedClass,
        steps: steps,
        execId: execId,
        versaoCommit: expectedVersion,
        countsBeforeStr: JSON.stringify(countsBefore),
        countsAfterStr: JSON.stringify(countsAfter || gc()),
        flagFinalStr: JSON.stringify(flagFinal || readFlag()),
        allowedInternalCalls: allowedInternalCalls,
        blockedExternalAttempts: blockedExternalAttempts,
        activecampaignCalls: activecampaignCalls,
        decisaoStr: JSON.stringify({
          overall_status: overallStat,
          total_calls: callResults.length,
        }),
      })
      if (!projectionResult.ok) {
        // A projeção não produziu pass===false/classification coerente:
        // não persistir snapshot terminal confirmado. G26: usa
        // composeTerminalReason no caminho terminalize — preserva a causa
        // original (stopReasonArg) e anexa o erro da terminalização.
        overallStatus = 'BLOCKED'
        stopReason = composeTerminalReason(stopReasonArg, 'terminalize', projectionResult.error)
        terminalSaved = false
        return
      }

      // Construir o snapshot canônico a partir da validação da projeção.
      var fullSnapshot = buildTerminalSnapshot({
        validation: projectionResult.validation,
        overallStatus: overallStat,
        goNoGo: 'NO-GO',
        stopReason: stopReasonArg,
        totalCalls: callResults.length,
        deltaMatch: deltaMatch,
        persistFailure: persistFailure,
        transactionError: transactionError,
      })

      // Persistir via safeUpdateExec.
      var termSave = safeUpdateExec({
        estado: termEstado,
        finished_at: new Date().toISOString(),
        counts_after: JSON.stringify(countsAfter || {}),
        flag_final: JSON.stringify(flagFinal || readFlag()),
        prova_zero_chamadas_externas: blockedExternalAttempts === 0,
        allowed_internal_calls: allowedInternalCalls,
        blocked_external_attempts: blockedExternalAttempts,
        activecampaign_calls: activecampaignCalls,
        decisao: JSON.stringify(fullSnapshot),
      })

      if (termSave.saved && termSave.reread) {
        var tsv = termSave.reread.getString('estado')
        if (tsv === termEstado) {
          // Confirmar estado e snapshot completos por releitura.
          var termConfirm = confirmTerminalSnapshot(termSave.reread, expectedClass, $app)
          if (!termConfirm.ok) {
            // Não reportar registro terminal como confirmado. G26:
            // preserva a causa original (stopReasonArg) via
            // composeTerminalReason no caminho confirmTerminal.
            terminalSaved = false
            overallStatus = 'BLOCKED'
            stopReason = composeTerminalReason(stopReasonArg, 'confirmTerminal', termConfirm.error)
          } else {
            terminalSaved = true
          }
        } else {
          terminalSaved = false
          overallStatus = 'BLOCKED'
          stopReason = composeTerminalReason(
            stopReasonArg,
            'rereadMismatch',
            'Terminal save reread mismatch: estado=' + tsv + ' expected=' + termEstado,
          )
        }
      } else {
        terminalSaved = false
        overallStatus = 'BLOCKED'
        stopReason = composeTerminalReason(
          stopReasonArg,
          'saveFailed',
          'Terminal save failed: ' + (termSave.error || 'unknown'),
        )
      }
    }

    function checkTerminal() {
      if (!execRecord || terminalSaved) return
      if (!runningSet) {
        runningSet = true
        var runRes = safeUpdateExec({ estado: 'running' })
        if (!runRes.saved) {
          overallStatus = 'BLOCKED'
          stopReason = 'Failed to set running state: ' + (runRes.error || '')
        }
      }
      if (overallStatus === 'STOP' || overallStatus === 'BLOCKED') {
        // G19 (ponto 2): BLOCKED/FAIL — montar projeção terminal em
        // memória com estado terminal pretendido, validar com
        // validateCore, exigir pass===false e classification coerente
        // ANTES do save, persistir e confirmar por releitura.
        var termEstado = overallStatus === 'BLOCKED' ? 'blocked' : 'fail'
        var expectedClass = overallStatus === 'BLOCKED' ? 'BLOCKED' : 'FAIL'
        var overallStat = overallStatus === 'BLOCKED' ? 'BLOCKED' : 'STOP'
        terminalizeBlockedOrFail({
          termEstado: termEstado,
          expectedClass: expectedClass,
          overallStatus: overallStat,
          stopReason: stopReason,
          transactionError: null,
        })
      }
    }

    var overallStatus = 'PASS',
      stopReason = null,
      callResults = [],
      evidenceIds = [],
      persistFailure = null
    var flagBefore = readFlag(),
      flagDuring = null,
      flagFinal = null,
      finalProbeStatus = null
    var countsBefore = gc(),
      countsAfter = null

    // ─── Abrir e reler execução ANTES do lock ───
    try {
      execRecord = new Record(execCol)
      execRecord.set('id', execId)
      execRecord.set('runner_version', runnerVersion)
      execRecord.set('correlation_key', correlationKey)
      execRecord.set('estado', 'started')
      execRecord.set('started_at', startedAt)
      execRecord.set('counts_before', JSON.stringify(countsBefore))
      execRecord.set('flag_before', JSON.stringify(flagBefore))
      execRecord.set('prova_zero_chamadas_externas', false)
      execRecord.set('allowed_internal_calls', 0)
      execRecord.set('blocked_external_attempts', 0)
      execRecord.set('activecampaign_calls', 0)
      execRecord.set('versao_commit', expectedVersion)
      $app.save(execRecord)
      var execReRead = $app.findFirstRecordByData('com_execucoes_porta_2d2b', 'id', execId)
      if (!execReRead || execReRead.getString('estado') !== 'started') {
        return e.json(200, {
          porta: '2D.2B',
          overall_status: 'BLOCKED',
          go_no_go: 'NO-GO',
          stop_reason: 'Precondição falhou: execução não pôde ser relida após create',
          activecampaign_calls: 0,
          lock_consumed: false,
          flag_changed: false,
        })
      }
      execRecord = execReRead
    } catch (er) {
      return e.json(200, {
        porta: '2D.2B',
        overall_status: 'BLOCKED',
        go_no_go: 'NO-GO',
        stop_reason: 'Precondição falhou ao abrir/reler execução: ' + String(er).substring(0, 200),
        activecampaign_calls: 0,
        lock_consumed: false,
        flag_changed: false,
      })
    }

    // ─── Lock DEPOIS da execução aberta e relida ───
    var lockKey = 'ac_2d2b_execution_lock'
    try {
      var exLock = $app.findFirstRecordByData('com_parametros', 'chave', lockKey)
      if (exLock && exLock.getString('valor') === 'locked' && exLock.getBool('ativo')) {
        safeUpdateExec({
          estado: 'blocked',
          finished_at: new Date().toISOString(),
          flag_final: JSON.stringify(readFlag()),
          decisao: JSON.stringify({
            porta: '2D.2B',
            overall_status: 'BLOCKED',
            go_no_go: 'NO-GO',
            stop_reason: 'Single-execution lock already armed',
            total_calls: 0,
          }),
        })
        return e.json(200, {
          executed: true,
          locked: true,
          porta: '2D.2B',
          overall_status: 'BLOCKED',
          go_no_go: 'NO-GO',
          message: '2D.2B already executed — single-execution lock prevents re-execution',
          activecampaign_calls: 0,
          lock_consumed: false,
          flag_changed: false,
        })
      }
    } catch (_) {}
    try {
      var pc0 = $app.findCollectionByNameOrId('com_parametros')
      var lkRec
      try {
        lkRec = $app.findFirstRecordByData('com_parametros', 'chave', lockKey)
      } catch (_) {
        lkRec = new Record(pc0)
        lkRec.set('chave', lockKey)
        lkRec.set('versao', 1)
      }
      lkRec.set('valor', 'locked')
      lkRec.set('ativo', true)
      lkRec.set('descricao', 'Single-execution lock for Porta 2D.2B')
      lkRec.set('tipo', 'lock')
      $app.save(lkRec)
      lockConsumed = true
    } catch (lockErr) {
      safeUpdateExec({
        estado: 'blocked',
        finished_at: new Date().toISOString(),
        flag_final: JSON.stringify(readFlag()),
        decisao: JSON.stringify({
          porta: '2D.2B',
          overall_status: 'BLOCKED',
          go_no_go: 'NO-GO',
          stop_reason: 'Lock creation failed: ' + String(lockErr).substring(0, 150),
          total_calls: 0,
        }),
      })
      return e.json(200, {
        porta: '2D.2B',
        overall_status: 'BLOCKED',
        go_no_go: 'NO-GO',
        stop_reason: 'Lock creation failed — round aborted before first call',
        activecampaign_calls: 0,
        lock_consumed: false,
        flag_changed: false,
      })
    }

    // ─── Execução do round ───
    try {
      var disRes = setWH(false)
      if (!disRes.success) {
        overallStatus = 'BLOCKED'
        stopReason = 'Failed to disable flag initially: ' + disRes.error
      }

      if (overallStatus === 'PASS') {
        var cb1 = gc()
        var r1 = callWH('POST', { 'Content-Type': 'application/json' }, '{}')
        var ca1 = gc()
        var a1p = r1.status === 503
        rc('A1', 'POST', '/webhook', 503, r1.status, r1.json, cb1, ca1, a1p)
        if (!a1p) {
          overallStatus = 'STOP'
          stopReason = 'A1: expected 503 got ' + r1.status
        }
        var pA1 = persistStep(
          'A1',
          'A1',
          'POST',
          '/backend/v1/integracao/ac/webhook',
          r1.started_at,
          r1.finished_at,
          r1.status,
          503,
          a1p,
          cb1,
          ca1,
          r1.json,
          r1.raw,
          a1p ? '' : 'Expected 503 got ' + r1.status,
          [],
        )
        if (!pA1.ok) {
          overallStatus = 'BLOCKED'
          stopReason = pA1.error
          persistFailure = pA1.error
        }
        checkTerminal()
      }
      if (overallStatus === 'PASS') {
        var enRes = setWH(true)
        if (!enRes.success) {
          overallStatus = 'BLOCKED'
          stopReason = 'Failed to enable flag: ' + enRes.error
        }
        flagDuring = readFlag()
        checkTerminal()
      }
      if (overallStatus === 'PASS') {
        var cb2 = gc()
        var r2 = callWH('GET', {}, '')
        var ca2 = gc()
        var a2p = r2.status === 405
        rc('A2', 'GET', '/webhook', 405, r2.status, r2.json, cb2, ca2, a2p)
        if (!a2p) {
          overallStatus = 'STOP'
          stopReason = 'A2: expected 405 got ' + r2.status
        }
        var pA2 = persistStep(
          'A2',
          'A2',
          'GET',
          '/backend/v1/integracao/ac/webhook',
          r2.started_at,
          r2.finished_at,
          r2.status,
          405,
          a2p,
          cb2,
          ca2,
          r2.json,
          r2.raw,
          a2p ? '' : 'Expected 405 got ' + r2.status,
          [],
        )
        if (!pA2.ok) {
          overallStatus = 'BLOCKED'
          stopReason = pA2.error
          persistFailure = pA2.error
        }
        checkTerminal()
      }
      if (overallStatus === 'PASS') {
        var cb3 = gc()
        var r3 = callWH('POST', { 'Content-Type': 'text/plain' }, '{}')
        var ca3 = gc()
        var a3p = r3.status === 400
        rc('A3', 'POST', '/webhook', 400, r3.status, r3.json, cb3, ca3, a3p)
        if (!a3p) {
          overallStatus = 'STOP'
          stopReason = 'A3: expected 400 got ' + r3.status
        }
        var pA3 = persistStep(
          'A3',
          'A3',
          'POST',
          '/backend/v1/integracao/ac/webhook',
          r3.started_at,
          r3.finished_at,
          r3.status,
          400,
          a3p,
          cb3,
          ca3,
          r3.json,
          r3.raw,
          a3p ? '' : 'Expected 400 got ' + r3.status,
          [],
        )
        if (!pA3.ok) {
          overallStatus = 'BLOCKED'
          stopReason = pA3.error
          persistFailure = pA3.error
        }
        checkTerminal()
      }
      if (overallStatus === 'PASS') {
        var a4b = JSON.stringify({ timestamp: new Date().toISOString() })
        var a4s = signBody(a4b)
        var cb4 = gc()
        var r4 = callWH('POST', { 'Content-Type': 'application/json', 'X-AC-Signature': a4s }, a4b)
        var ca4 = gc()
        var a4p = r4.status === 400
        rc('A4', 'POST', '/webhook', 400, r4.status, r4.json, cb4, ca4, a4p)
        if (!a4p) {
          overallStatus = 'STOP'
          stopReason = 'A4: expected 400 got ' + r4.status
        }
        var pA4 = persistStep(
          'A4',
          'A4',
          'POST',
          '/backend/v1/integracao/ac/webhook',
          r4.started_at,
          r4.finished_at,
          r4.status,
          400,
          a4p,
          cb4,
          ca4,
          r4.json,
          r4.raw,
          a4p ? '' : 'Expected 400 got ' + r4.status,
          [],
        )
        if (!pA4.ok) {
          overallStatus = 'BLOCKED'
          stopReason = pA4.error
          persistFailure = pA4.error
        }
        checkTerminal()
      }
      if (overallStatus === 'PASS') {
        var a5b = 'not-json{'
        var a5s = signBody(a5b)
        var cb5 = gc()
        var r5 = callWH('POST', { 'Content-Type': 'application/json', 'X-AC-Signature': a5s }, a5b)
        var ca5 = gc()
        var a5p = r5.status === 400
        rc('A5', 'POST', '/webhook', 400, r5.status, r5.json, cb5, ca5, a5p)
        if (!a5p) {
          overallStatus = 'STOP'
          stopReason = 'A5: expected 400 got ' + r5.status
        }
        var pA5 = persistStep(
          'A5',
          'A5',
          'POST',
          '/backend/v1/integracao/ac/webhook',
          r5.started_at,
          r5.finished_at,
          r5.status,
          400,
          a5p,
          cb5,
          ca5,
          r5.json,
          r5.raw,
          a5p ? '' : 'Expected 400 got ' + r5.status,
          [],
        )
        if (!pA5.ok) {
          overallStatus = 'BLOCKED'
          stopReason = pA5.error
          persistFailure = pA5.error
        }
        checkTerminal()
      }
      if (overallStatus === 'PASS') {
        var a6p_ = { timestamp: new Date().toISOString(), data: new Array(300000).join('x') }
        var a6b = JSON.stringify(a6p_)
        var a6s = signBody(a6b)
        var cb6 = gc()
        var r6 = callWH('POST', { 'Content-Type': 'application/json', 'X-AC-Signature': a6s }, a6b)
        var ca6 = gc()
        var a6p = r6.status === 400
        rc('A6', 'POST', '/webhook', 400, r6.status, r6.json, cb6, ca6, a6p)
        if (!a6p) {
          overallStatus = 'STOP'
          stopReason = 'A6: expected 400 got ' + r6.status
        }
        var pA6 = persistStep(
          'A6',
          'A6',
          'POST',
          '/backend/v1/integracao/ac/webhook',
          r6.started_at,
          r6.finished_at,
          r6.status,
          400,
          a6p,
          cb6,
          ca6,
          r6.json,
          r6.raw,
          a6p ? '' : 'Expected 400 got ' + r6.status,
          [],
        )
        if (!pA6.ok) {
          overallStatus = 'BLOCKED'
          stopReason = pA6.error
          persistFailure = pA6.error
        }
        checkTerminal()
      }
      if (overallStatus === 'PASS') {
        var a7p_ = {
          type: 'contact_create',
          timestamp: new Date().toISOString(),
          contact: {
            id: 'TESTE-2D2B-A7-C1',
            firstName: '[TESTE]',
            lastName: '2D2B NoSig',
            email: 'teste-2d2b-a7@teste.local',
            phone: '+5511999999999',
          },
        }
        var a7b = JSON.stringify(a7p_)
        var cb7 = gc()
        var r7 = callWH('POST', { 'Content-Type': 'application/json' }, a7b)
        var ca7 = gc()
        var a7p = r7.status === 401 && r7.json.error === 'missing_signature'
        rc('A7', 'POST', '/webhook', 401, r7.status, r7.json, cb7, ca7, a7p)
        if (!a7p) {
          overallStatus = 'STOP'
          stopReason = 'A7: expected 401 missing_signature got ' + r7.status
        }
        var pA7 = persistStep(
          'A7',
          'A7',
          'POST',
          '/backend/v1/integracao/ac/webhook',
          r7.started_at,
          r7.finished_at,
          r7.status,
          401,
          a7p,
          cb7,
          ca7,
          r7.json,
          r7.raw,
          a7p ? '' : 'Expected 401 missing_signature got ' + r7.status,
          [],
        )
        if (!pA7.ok) {
          overallStatus = 'BLOCKED'
          stopReason = pA7.error
          persistFailure = pA7.error
        }
        checkTerminal()
      }
      if (overallStatus === 'PASS') {
        var a8p_ = {
          type: 'contact_create',
          timestamp: new Date().toISOString(),
          contact: {
            id: 'TESTE-2D2B-A8-C1',
            firstName: '[TESTE]',
            lastName: '2D2B BadSig',
            email: 'teste-2d2b-a8@teste.local',
            phone: '+5511999999999',
          },
        }
        var a8b = JSON.stringify(a8p_)
        var cb8 = gc()
        var r8 = callWH(
          'POST',
          { 'Content-Type': 'application/json', 'X-AC-Signature': 'invalido' },
          a8b,
        )
        var ca8 = gc()
        var a8p = r8.status === 401
        rc('A8', 'POST', '/webhook', 401, r8.status, r8.json, cb8, ca8, a8p)
        if (!a8p) {
          overallStatus = 'STOP'
          stopReason = 'A8: expected 401 got ' + r8.status
        }
        var pA8 = persistStep(
          'A8',
          'A8',
          'POST',
          '/backend/v1/integracao/ac/webhook',
          r8.started_at,
          r8.finished_at,
          r8.status,
          401,
          a8p,
          cb8,
          ca8,
          r8.json,
          r8.raw,
          a8p ? '' : 'Expected 401 got ' + r8.status,
          [],
        )
        if (!pA8.ok) {
          overallStatus = 'BLOCKED'
          stopReason = pA8.error
          persistFailure = pA8.error
        }
        checkTerminal()
      }

      var b1Body = '',
        b1Sig = ''
      if (overallStatus === 'PASS') {
        var b1p_ = {
          type: 'contact_create',
          timestamp: new Date().toISOString(),
          contact: {
            id: 'TESTE-2D2B-FN-C1',
            firstName: '[TESTE]',
            lastName: '2D2B Contact',
            email: 'teste-2d2b@teste.local',
            phone: '+5511999999999',
          },
        }
        b1Body = JSON.stringify(b1p_)
        b1Sig = signBody(b1Body)
        var cbB1 = gc()
        var rB1 = callWH(
          'POST',
          { 'Content-Type': 'application/json', 'X-AC-Signature': b1Sig },
          b1Body,
        )
        var caB1 = gc()
        var b1p = rB1.status === 200
        rc('B1', 'POST', '/webhook', 200, rB1.status, rB1.json, cbB1, caB1, b1p)
        if (rB1.status === 200 && rB1.json.event_id)
          evidenceIds.push({
            collection: 'com_eventos_integracao',
            id: String(rB1.json.event_id).substring(0, 8),
          })
        if (!b1p) {
          overallStatus = 'STOP'
          stopReason = 'B1: expected 200 got ' + rB1.status
        }
        var pB1 = persistStep(
          'B1',
          'B1_contato_criado',
          'POST',
          '/backend/v1/integracao/ac/webhook',
          rB1.started_at,
          rB1.finished_at,
          rB1.status,
          200,
          b1p,
          cbB1,
          caB1,
          rB1.json,
          rB1.raw,
          b1p ? '' : 'Expected 200 got ' + rB1.status,
          rB1.json && rB1.json.event_id ? [truncId(String(rB1.json.event_id))] : [],
        )
        if (!pB1.ok) {
          overallStatus = 'BLOCKED'
          stopReason = pB1.error
          persistFailure = pB1.error
        }
        checkTerminal()
      }
      if (overallStatus === 'PASS') {
        var cbB2 = gc()
        var rB2 = callWH(
          'POST',
          { 'Content-Type': 'application/json', 'X-AC-Signature': b1Sig },
          b1Body,
        )
        var caB2 = gc()
        var b2p = rB2.status === 409 && rB2.json.duplicate === true
        rc('B2', 'POST', '/webhook', 409, rB2.status, rB2.json, cbB2, caB2, b2p)
        if (!b2p) {
          overallStatus = 'STOP'
          stopReason = 'B2: expected 409 duplicate got ' + rB2.status
        }
        var pB2 = persistStep(
          'B2',
          'B2_duplicidade_sem_efeito',
          'POST',
          '/backend/v1/integracao/ac/webhook',
          rB2.started_at,
          rB2.finished_at,
          rB2.status,
          409,
          b2p,
          cbB2,
          caB2,
          rB2.json,
          rB2.raw,
          b2p ? '' : 'Expected 409 duplicate got ' + rB2.status,
          [],
        )
        if (!pB2.ok) {
          overallStatus = 'BLOCKED'
          stopReason = pB2.error
          persistFailure = pB2.error
        }
        checkTerminal()
      }
      var b3Body = '',
        b3Sig = ''
      if (overallStatus === 'PASS') {
        var b3p_ = {
          type: 'deal_create',
          timestamp: new Date().toISOString(),
          deal: {
            id: 'TESTE-2D2B-FN-D1',
            title: '[TESTE] 2D2B Negocio',
            value: 10000,
            stage: 'prospects',
          },
        }
        b3Body = JSON.stringify(b3p_)
        b3Sig = signBody(b3Body)
        var cbB3 = gc()
        var rB3 = callWH(
          'POST',
          { 'Content-Type': 'application/json', 'X-AC-Signature': b3Sig },
          b3Body,
        )
        var caB3 = gc()
        var b3p = rB3.status === 200
        rc('B3', 'POST', '/webhook', 200, rB3.status, rB3.json, cbB3, caB3, b3p)
        if (rB3.status === 200 && rB3.json.event_id)
          evidenceIds.push({
            collection: 'com_eventos_integracao',
            id: String(rB3.json.event_id).substring(0, 8),
          })
        if (!b3p) {
          overallStatus = 'STOP'
          stopReason = 'B3: expected 200 got ' + rB3.status
        }
        var pB3 = persistStep(
          'B3',
          'B3_negocio_criado',
          'POST',
          '/backend/v1/integracao/ac/webhook',
          rB3.started_at,
          rB3.finished_at,
          rB3.status,
          200,
          b3p,
          cbB3,
          caB3,
          rB3.json,
          rB3.raw,
          b3p ? '' : 'Expected 200 got ' + rB3.status,
          rB3.json && rB3.json.event_id ? [truncId(String(rB3.json.event_id))] : [],
        )
        if (!pB3.ok) {
          overallStatus = 'BLOCKED'
          stopReason = pB3.error
          persistFailure = pB3.error
        }
        checkTerminal()
      }
      if (overallStatus === 'PASS') {
        var b4p_ = {
          type: 'deal_update',
          timestamp: new Date().toISOString(),
          deal: {
            id: 'TESTE-2D2B-FN-D1',
            title: '[TESTE] 2D2B Negocio Atualizado',
            value: 15000,
            stage: 'producao_proposta',
          },
        }
        var b4b = JSON.stringify(b4p_)
        var b4s = signBody(b4b)
        var cbB4 = gc()
        var rB4 = callWH('POST', { 'Content-Type': 'application/json', 'X-AC-Signature': b4s }, b4b)
        var caB4 = gc()
        var b4p = rB4.status === 200 && caB4.snapshots - cbB4.snapshots > 0
        rc('B4', 'POST', '/webhook', 200, rB4.status, rB4.json, cbB4, caB4, b4p)
        if (rB4.status === 200 && rB4.json.event_id)
          evidenceIds.push({
            collection: 'com_eventos_integracao',
            id: String(rB4.json.event_id).substring(0, 8),
          })
        if (!b4p) {
          overallStatus = 'STOP'
          stopReason = 'B4: expected 200 with snapshot got ' + rB4.status
        }
        var pB4 = persistStep(
          'B4',
          'B4_snapshot_e_atualizacao',
          'POST',
          '/backend/v1/integracao/ac/webhook',
          rB4.started_at,
          rB4.finished_at,
          rB4.status,
          200,
          b4p,
          cbB4,
          caB4,
          rB4.json,
          rB4.raw,
          b4p ? '' : 'Expected 200 with snapshot got ' + rB4.status,
          rB4.json && rB4.json.event_id ? [truncId(String(rB4.json.event_id))] : [],
        )
        if (!pB4.ok) {
          overallStatus = 'BLOCKED'
          stopReason = pB4.error
          persistFailure = pB4.error
        }
        checkTerminal()
      }
      if (overallStatus === 'PASS') {
        var b5p_ = {
          type: 'deal_create',
          timestamp: new Date().toISOString(),
          deal: {
            id: 'TESTE-2D2B-FN-D2',
            title: '[TESTE] 2D2B Sem Map',
            value: 5000,
            stage: 'unmapped_stage_xyz',
          },
        }
        var b5b = JSON.stringify(b5p_)
        var b5s = signBody(b5b)
        var cbB5 = gc()
        var rB5 = callWH('POST', { 'Content-Type': 'application/json', 'X-AC-Signature': b5s }, b5b)
        var caB5 = gc()
        var b5p = rB5.status === 200 && caB5.ocorrencias - cbB5.ocorrencias > 0
        rc('B5', 'POST', '/webhook', 200, rB5.status, rB5.json, cbB5, caB5, b5p)
        if (rB5.status === 200 && rB5.json.event_id)
          evidenceIds.push({
            collection: 'com_eventos_integracao',
            id: String(rB5.json.event_id).substring(0, 8),
          })
        if (!b5p) {
          overallStatus = 'STOP'
          stopReason = 'B5: expected 200 with quality occurrence got ' + rB5.status
        }
        var pB5 = persistStep(
          'B5',
          'B5_negocio_e_ocorrencia_qualidade',
          'POST',
          '/backend/v1/integracao/ac/webhook',
          rB5.started_at,
          rB5.finished_at,
          rB5.status,
          200,
          b5p,
          cbB5,
          caB5,
          rB5.json,
          rB5.raw,
          b5p ? '' : 'Expected 200 with quality occurrence got ' + rB5.status,
          rB5.json && rB5.json.event_id ? [truncId(String(rB5.json.event_id))] : [],
        )
        if (!pB5.ok) {
          overallStatus = 'BLOCKED'
          stopReason = pB5.error
          persistFailure = pB5.error
        }
        checkTerminal()
      }

      var c1Body = '',
        c1Sig = ''
      if (overallStatus === 'PASS') {
        var c1p_ = {
          entity_type: 'business',
          external_id: 'TESTE-2D2B-FN-D1',
          timestamp: new Date().toISOString(),
        }
        c1Body = JSON.stringify(c1p_)
        c1Sig = signBody(c1Body)
        var cbC1 = gc()
        var rC1 = callRB(c1Body, c1Sig)
        var caC1 = gc()
        var c1p =
          rC1.status === 200 &&
          rC1.json.success === true &&
          rC1.json.idempotent === false &&
          rC1.json.rolled_back &&
          rC1.json.rolled_back.length === 1 &&
          rC1.json.rolled_back[0].action === 'restored_from_snapshot' &&
          rC1.json.rolled_back[0].collection === 'com_negocios' &&
          rC1.json.rolled_back[0].record_id
        rc('C1', 'POST', '/rollback', 200, rC1.status, rC1.json, cbC1, caC1, c1p)
        if (!c1p) {
          overallStatus = 'STOP'
          stopReason =
            'C1: contract violation — status=' +
            rC1.status +
            ' body=' +
            JSON.stringify(rC1.json).substring(0, 200)
        }
        var pC1 = persistStep(
          'C1',
          'C1_rollback',
          'POST',
          '/backend/v1/integracao/ac/rollback',
          rC1.started_at,
          rC1.finished_at,
          rC1.status,
          200,
          c1p,
          cbC1,
          caC1,
          rC1.json,
          rC1.raw,
          c1p ? '' : 'C1: contract violation — status=' + rC1.status,
          [],
        )
        if (!pC1.ok) {
          overallStatus = 'BLOCKED'
          stopReason = pC1.error
          persistFailure = pC1.error
        }
        checkTerminal()
      }
      if (overallStatus === 'PASS') {
        var cbC2 = gc()
        var rC2 = callRB(c1Body, c1Sig)
        var caC2 = gc()
        var c2p =
          rC2.status === 200 &&
          rC2.json.success === true &&
          rC2.json.idempotent === true &&
          rC2.json.rolled_back &&
          rC2.json.rolled_back.length === 0
        rc('C2', 'POST', '/rollback', 200, rC2.status, rC2.json, cbC2, caC2, c2p)
        if (!c2p) {
          overallStatus = 'STOP'
          stopReason =
            'C2: contract violation — status=' +
            rC2.status +
            ' body=' +
            JSON.stringify(rC2.json).substring(0, 200)
        }
        var pC2 = persistStep(
          'C2',
          'C2_repeticao_idempotente',
          'POST',
          '/backend/v1/integracao/ac/rollback',
          rC2.started_at,
          rC2.finished_at,
          rC2.status,
          200,
          c2p,
          cbC2,
          caC2,
          rC2.json,
          rC2.raw,
          c2p ? '' : 'C2: contract violation — status=' + rC2.status,
          [],
        )
        if (!pC2.ok) {
          overallStatus = 'BLOCKED'
          stopReason = pC2.error
          persistFailure = pC2.error
        }
        checkTerminal()
      }

      // ─── Restauração da flag + D1 ───
      if (overallStatus === 'PASS') {
        var restoreRes = setWH(false)
        flagFinal = readFlag()
        if (!restoreRes.success) {
          overallStatus = 'BLOCKED'
          stopReason = 'Failed to restore flag: ' + restoreRes.error
        }
        if (flagFinal.valor !== 'false' && overallStatus === 'PASS') {
          overallStatus = 'BLOCKED'
          stopReason = 'Flag not restored to false'
        }
        checkTerminal()
      }
      if (overallStatus === 'PASS') {
        var cbD1 = gc()
        var rD1 = callWH('POST', { 'Content-Type': 'application/json' }, '{}')
        finalProbeStatus = rD1.status
        var d1p = rD1.status === 503
        var caD1 = gc()
        rc('D1', 'POST', '/webhook', 503, rD1.status, rD1.json, cbD1, caD1, d1p)
        if (!d1p) {
          overallStatus = 'STOP'
          stopReason = 'D1: expected 503 got ' + rD1.status
        }
        var pD1 = persistStep(
          'D1',
          'D1',
          'POST',
          '/backend/v1/integracao/ac/webhook',
          rD1.started_at,
          rD1.finished_at,
          rD1.status,
          503,
          d1p,
          cbD1,
          caD1,
          rD1.json,
          rD1.raw,
          d1p ? '' : 'Expected 503 got ' + rD1.status,
          [],
        )
        if (!pD1.ok) {
          overallStatus = 'BLOCKED'
          stopReason = pD1.error
          persistFailure = pD1.error
        }
        checkTerminal()
      }

      // ─── Deltas finais ───
      countsAfter = gc()
      var deltas = {},
        expectedDeltas = {
          contatos: 1,
          negocios: 2,
          eventos: 5,
          execucoes: 4,
          vinculos: 3,
          snapshots: 1,
          ocorrencias: 1,
          auditoria: 0,
        }
      var deltaMatch = true,
        deltaMismatches = []
      for (var dk in expectedDeltas) {
        deltas[dk] = countsAfter[dk] - countsBefore[dk]
        if (deltas[dk] !== expectedDeltas[dk]) {
          deltaMatch = false
          deltaMismatches.push(dk + ': expected +' + expectedDeltas[dk] + ' got +' + deltas[dk])
        }
      }
      if (!deltaMatch && overallStatus === 'PASS') {
        overallStatus = 'STOP'
        stopReason = 'Delta mismatch: ' + deltaMismatches.join(', ')
      }

      // ─── 16 calls ───
      if (overallStatus === 'PASS') {
        if (callResults.length !== 16) {
          overallStatus = 'STOP'
          stopReason = 'Expected 16 calls, got ' + callResults.length
        }
      }

      // ══════════════════════════════════════════════════════════════════
      // v0.0.143 — TERMINALIZAÇÃO ATÔMICA (SEGMENTO 2A — FALHA 1)
      // ══════════════════════════════════════════════════════════════════
      // FALHA 1 (0.0.142): a terminalização pass validava a projeção em
      // memória e só DEPOIS persistia via safeUpdateExec (sem atomicidade).
      // Uma falha entre a validação e o save (ou uma releitura divergente)
      // podia deixar pass inconsistente — e o hook de imutabilidade
      // bloqueava qualquer correção pós-terminal.
      //
      // Nova ordem (transação atômica):
      //   - Se terminalEstado === 'pass': tudo acontece dentro de
      //     $app.runInTransaction((txApp) => { ... }). Dentro dela
      //     TODA leitura/escrita usa txApp (NUNCA $app). O callback:
      //       (1) relê execução com txApp e confirma estado=running/started;
      //       (2) relê exatamente as 16 etapas com txApp;
      //       (3) monta projeção em memória com TODOS os campos finais;
      //       (4) executa validação canônica (validateCore via
      //           validatorCanonical.validateProjection) sobre projeção +
      //           etapas relidas; se falhar, throw → rollback integral;
      //       (5) aplica campos finais e transição running → pass no
      //           registro transacional;
      //       (6) salva com txApp;
      //       (7) relê o registro salvo usando txApp;
      //       (8) confirma estado=pass e campos críticos; divergência
      //           → throw → rollback integral.
      //     Se a transação conclui sem throw, transactionSucceeded=true e
      //     terminalSaved=true (GO). Qualquer erro/divergência/falha de
      //     validação provoca rollback integral do pass — a execução
      //     permanece não-terminal (running) — e então fazemos UMA ÚNICA
      //     transição running → blocked fora da transação.
      //   - Se terminalEstado !== 'pass' (fail/blocked): G19 usa o helper
      //     mecânico único buildAndValidateTerminalProjection (via
      //     terminalizeBlockedOrFail) — monta a projeção terminal em
      //     memória, valida com validateCore, exige pass===false e
      //     classification coerente ANTES do save.
      //   - Nenhum caminho altera registro depois de terminalizado.
      //   - terminalSaved=true e GO SOMENTE após a transação de pass
      //     concluir com sucesso.
      //   - validatorCanonical.validateProjection NÃO usa `app` internamente
      //     (o parâmetro é recebido mas nunca referenciado no corpo), então
      //     passar txApp é seguro e não causa deadlock.
      // ══════════════════════════════════════════════════════════════════

      if (execRecord && !terminalSaved) {
        // Determinar estado terminal pretendido conforme contrato vigente.
        var terminalEstado = 'pass'
        if (overallStatus === 'STOP') terminalEstado = 'fail'
        else if (overallStatus === 'BLOCKED') terminalEstado = 'blocked'

        if (terminalEstado === 'pass') {
          // ─── CAMINHO PASS: transação atômica ───
          // G18 (2b/2c): após validateProjection (pré-save) e
          // validateRecords (pós-save) aprovados, constrói o snapshot
          // canônico completo (formato 2a), persiste em `decisao` e faz a
          // releitura confirmatória DENTRO da transação. Somente após a
          // confirmação transactionSucceeded=true.
          // G19 (ponto 3): confirmTerminalSnapshot integral.
          var transactionSucceeded = false
          var transactionError = ''
          var passPostSaveResult = null

          try {
            $app.runInTransaction(function (txApp) {
              // (1) RELER execução com txApp e confirmar estado=running
              var txExec = txApp.findFirstRecordByData('com_execucoes_porta_2d2b', 'id', execId)
              var txEstado = txExec.getString('estado')
              if (
                txEstado === 'pass' ||
                txEstado === 'fail' ||
                txEstado === 'blocked' ||
                txEstado === 'aborted'
              ) {
                throw new Error(
                  'Execução já terminal (' + txEstado + ') ao iniciar transação de pass',
                )
              }
              if (txEstado !== 'running' && txEstado !== 'started') {
                throw new Error('Execução em estado inesperado: ' + txEstado)
              }

              // (2) RELER exatamente as 16 etapas com txApp
              var txSteps = txApp.findRecordsByFilter(
                'com_etapas_porta_2d2b',
                "execucao_id = '" + execId + "'",
                'ordem',
                200,
                0,
              )
              if (txSteps.length !== 16)
                throw new Error('Esperadas 16 etapas na transação, obtidas ' + txSteps.length)

              // (3) MONTAR projeção em memória com TODOS os campos finais.
              //     O campo decisao ainda é provisório aqui (snapshot é
              //     persistido no passo 5b, após o pós-save). validateCore
              //     exige decisao.overall_status='PASS' && total_calls=16
              //     quando estado='pass', então preenchemos com um stub
              //     coerente que será substituído pelo snapshot completo.
              var projection = {
                id: execId,
                estado: 'pass',
                versao_commit: expectedVersion,
                flag_final: JSON.stringify(flagFinal || readFlagWith(txApp)),
                decisao: JSON.stringify({ overall_status: 'PASS', total_calls: 16 }),
                counts_before: JSON.stringify(countsBefore),
                counts_after: JSON.stringify(countsAfter || {}),
                allowed_internal_calls: allowedInternalCalls,
                blocked_external_attempts: blockedExternalAttempts,
                activecampaign_calls: activecampaignCalls,
                prova_zero_chamadas_externas: blockedExternalAttempts === 0,
              }

              // (4) EXECUTAR validação canônica completa sobre projeção + etapas relidas
              var valResult = validatorCanonical.validateProjection(
                txApp,
                execId,
                projection,
                txSteps,
              )
              if (!valResult || valResult.pass !== true) {
                var preReason = valResult && valResult.reason ? valResult.reason : 'unknown'
                throw new Error('Pre-GO canonical validation failed: ' + preReason)
              }

              // (5) APLICAR campos finais e transição running → pass no registro transacional
              txExec.set('estado', 'pass')
              txExec.set('finished_at', new Date().toISOString())
              txExec.set('counts_after', JSON.stringify(countsAfter || {}))
              txExec.set('flag_final', JSON.stringify(flagFinal || readFlagWith(txApp)))
              txExec.set('prova_zero_chamadas_externas', blockedExternalAttempts === 0)
              txExec.set('allowed_internal_calls', allowedInternalCalls)
              txExec.set('blocked_external_attempts', blockedExternalAttempts)
              txExec.set('activecampaign_calls', activecampaignCalls)
              // decisao provisória coerente (overall_status=PASS,
              // total_calls=16) para que validateRecords (pós-save) approve.
              // O snapshot canônico completo é persistido no passo (5b).
              txExec.set('decisao', projection.decisao)
              txApp.save(txExec)

              // (6) RELER o registro salvo usando a instância transacional
              var savedExec = txApp.findFirstRecordByData('com_execucoes_porta_2d2b', 'id', execId)
              if (!savedExec) throw new Error('Registro não encontrado após save transacional')

              // (7) CONFIRMAR estado e campos críticos
              if (savedExec.getString('estado') !== 'pass')
                throw new Error(
                  'Estado pós-save: ' + savedExec.getString('estado') + ' (esperado pass)',
                )
              if (savedExec.getInt('activecampaign_calls') !== 0)
                throw new Error(
                  'activecampaign_calls=' +
                    savedExec.getInt('activecampaign_calls') +
                    ' (esperado 0)',
                )
              if (savedExec.getInt('blocked_external_attempts') !== 0)
                throw new Error(
                  'blocked_external_attempts=' +
                    savedExec.getInt('blocked_external_attempts') +
                    ' (esperado 0)',
                )
              if (savedExec.getInt('allowed_internal_calls') <= 0)
                throw new Error(
                  'allowed_internal_calls=' +
                    savedExec.getInt('allowed_internal_calls') +
                    ' (esperado >0)',
                )

              var savedCountsAfter = null
              try {
                savedCountsAfter = JSON.parse(savedExec.getString('counts_after') || '{}')
              } catch (_) {}
              if (!savedCountsAfter || Object.keys(savedCountsAfter).length === 0)
                throw new Error('counts_after vazio após save')

              var savedFlagFinal = null
              try {
                savedFlagFinal = JSON.parse(savedExec.getString('flag_final') || '{}')
              } catch (_) {}
              if (!savedFlagFinal || savedFlagFinal.valor !== 'false')
                throw new Error('flag_final não é false após save')

              // (8) VALIDAÇÃO CANÔNICA COMPLETA PÓS-SAVE (validateRecords).
              //     Após txApp.save(txExec) e a releitura de savedExec,
              //     normaliza o registro relido e as 16 txSteps e chama o
              //     MESMO núcleo validateCore usado na validação pré-save
              //     (via validatorCanonical.validateRecords). Se falhar,
              //     throw → rollback integral da transação.
              var postSaveResult = validatorCanonical.validateRecords(savedExec, txSteps)
              if (!postSaveResult || postSaveResult.pass !== true) {
                var postReason =
                  postSaveResult && postSaveResult.reason ? postSaveResult.reason : 'unknown'
                throw new Error('Post-save canonical validation failed: ' + postReason)
              }
              passPostSaveResult = postSaveResult

              // ── G18 (2b): persistência do snapshot canônico para PASS ──
              // Após postSaveResult aprovado e ANTES de
              // transactionSucceeded = true: construir fullSnapshot,
              // txExec.set('decisao', JSON.stringify(fullSnapshot)) e
              // txApp.save(txExec).
              var fullSnapshot = buildTerminalSnapshot({
                validation: postSaveResult,
                overallStatus: 'PASS',
                goNoGo: 'GO',
                stopReason: '',
                totalCalls: 16,
                deltaMatch: deltaMatch,
                persistFailure: persistFailure,
              })
              txExec.set('decisao', JSON.stringify(fullSnapshot))
              txApp.save(txExec)

              // ── G19 (ponto 3): confirmação integral do PASS ──
              // Releitura dentro de txApp, parse e validação de TODOS os
              // campos obrigatórios (18), tipos estritos, versões,
              // igualdade literal do conteúdo crítico e coerência. Qualquer
              // divergência → throw → rollback.
              var confirmExec = txApp.findRecordById('com_execucoes_porta_2d2b', txExec.id)
              var passConfirm = confirmTerminalSnapshot(confirmExec, 'PASS', txApp)
              if (!passConfirm.ok) {
                throw new Error(passConfirm.error)
              }

              // (9) Somente após a confirmação: transação comita com sucesso
              transactionSucceeded = true
            })
          } catch (txErr) {
            transactionError = String(txErr).substring(0, 300)
            transactionSucceeded = false
          }

          if (transactionSucceeded) {
            // GO somente após transação confirmar pass + snapshot
            terminalSaved = true
            // overallStatus permanece 'PASS'
          } else {
            // (10) Qualquer erro/divergência/ambiguidade/falha de validação
            //      provocou rollback integral do pass. Execução continua
            //      não-terminal (running). Agora faz UMA ÚNICA transição
            //      running → blocked com snapshot canônico BLOCKED.
            overallStatus = 'BLOCKED'
            stopReason = 'Transação de pass falhou (rollback): ' + transactionError

            // G19 (ponto 2): terminalizar blocked com projeção validada
            // ANTES do save (helper único
            // buildAndValidateTerminalProjection via
            // terminalizeBlockedOrFail).
            terminalizeBlockedOrFail({
              termEstado: 'blocked',
              expectedClass: 'BLOCKED',
              overallStatus: 'BLOCKED',
              stopReason: stopReason,
              transactionError: transactionError,
            })
          }

          // GO só quando pass confirmado após transação. Se a transação
          // falhou, overallStatus já é BLOCKED e terminalSaved reflete o
          // blocked (ou false). Nenhum caminho emite GO aqui sem pass.
          if (overallStatus === 'PASS' && !terminalSaved) {
            overallStatus = 'BLOCKED'
            if (!stopReason) stopReason = 'Terminal state not persisted — cannot return GO'
          }
        } else {
          // ─── CAMINHO FAIL/BLOCKED: sem transação, mantém safeUpdateExec ──
          // G19 (ponto 2): terminalizar fail/blocked com projeção validada
          // ANTES do save (helper único
          // buildAndValidateTerminalProjection via
          // terminalizeBlockedOrFail).
          var finalTerminalEstado = terminalEstado
          var terminalExpectedClass = finalTerminalEstado === 'blocked' ? 'BLOCKED' : 'FAIL'
          var overallStatTerm = finalTerminalEstado === 'blocked' ? 'BLOCKED' : 'STOP'
          terminalizeBlockedOrFail({
            termEstado: finalTerminalEstado,
            expectedClass: terminalExpectedClass,
            overallStatus: overallStatTerm,
            stopReason: stopReason,
            transactionError: null,
          })

          if (terminalSaved && finalTerminalEstado !== 'pass') {
            // fail/blocked terminalizado com sucesso, mas não é GO.
            // terminalSaved=true apenas indica que o estado terminal foi
            // persistido; overallStatus já é STOP/BLOCKED (NO-GO).
          }
          if (overallStatus === 'PASS' && !terminalSaved) {
            overallStatus = 'BLOCKED'
            if (!stopReason) stopReason = 'Terminal state not persisted — cannot return GO'
          }
        }
      }
    } finally {
      try {
        var finFlag = readFlag()
        if (finFlag.valor !== 'false') {
          setWH(false)
          flagFinal = readFlag()
        }
      } catch (_) {}
    }

    return e.json(200, {
      porta: '2D.2B',
      correlation_key: correlationKey,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      overall_status: overallStatus,
      go_no_go: overallStatus === 'PASS' && terminalSaved ? 'GO' : 'NO-GO',
      stop_reason: stopReason,
      terminal_saved: terminalSaved,
      calls: callResults,
      counts_before: countsBefore,
      counts_after: countsAfter,
      deltas: deltas,
      expected_deltas: expectedDeltas,
      delta_match: deltaMatch,
      flag_before: flagBefore,
      flag_during: flagDuring,
      flag_final: flagFinal,
      final_probe_status: finalProbeStatus,
      evidence_ids: evidenceIds,
      activecampaign_calls: activecampaignCalls,
      allowed_internal_calls: allowedInternalCalls,
      blocked_external_attempts: blockedExternalAttempts,
      external_calls_blocked: blockedExternalAttempts,
      writes_performed_round: writesPerformedRound,
      prova_zero_chamadas_externas: blockedExternalAttempts === 0,
      prova_zero_derived_from_counter: true,
      synthetic_only: true,
      records_removed: false,
      single_execution: true,
      lock_consumed: lockConsumed,
      flag_changed: flagChanged,
      schema_version: expectedVersion,
      total_calls: callResults.length,
    })
  },
  $apis.requireAuth(),
)
