// ════════════════════════════════════════════════════════════════════
// CORREÇÃO 2 — Imutabilidade server-side REAL (v0.0.137)
// ════════════════════════════════════════════════════════════════════
// Substitui os hooks de REQUEST (onRecordUpdateRequest/onRecordDeleteRequest)
// por hooks de MODELO (onRecordUpdate/onRecordDelete) que interceptam
// TODA mutação — inclusive $app.save() e $app.delete() feitos por outros
// hooks server-side, cron jobs ou console commands. Os hooks de request
// apenas interceptavam a API REST pública e não cobriam mutações
// server-side diretas.
//
// Estado terminal (pass, fail, blocked, aborted) → update/delete BLOQUEADO
// por qualquer caminho. Durante o round, apenas transições válidas
// (started→running→pass/fail/blocked/aborted) são permitidas. Etapas são
// append-only (update sempre bloqueado; create permitido somente se a
// execução pai não estiver terminal).
//
// O runner é distinguido de outros hooks server-side pelo fato de que
// SÓ realiza transições de estado válidas da máquina de estados. Não há
// request context nos hooks de modelo, então a distinção é feita pela
// validação da transição de estado — qualquer código que tente uma
// transição inválida ou mutar registro terminal é bloqueado.
// ════════════════════════════════════════════════════════════════════

// ─── onRecordUpdate: intercepta $app.save() em registro existente ───
onRecordUpdate(
  function (e) {
    var name = e.record.collection().name
    if (name === 'com_execucoes_porta_2d2b') {
      var original = e.record.original()
      var prevEstado = ''
      try {
        prevEstado = original.getString('estado')
      } catch (_) {}
      var TERMINAL = { pass: 1, fail: 1, blocked: 1, aborted: 1 }
      if (TERMINAL[prevEstado]) {
        throw new BadRequestError(
          'Evidência terminal (estado=' +
            prevEstado +
            ') é imutável — update bloqueado (model hook).',
        )
      }
      var nextEstado = ''
      try {
        nextEstado = e.record.getString('estado')
      } catch (_) {}
      var VALID = {
        started: 1,
        running: 1,
        pass: 1,
        fail: 1,
        blocked: 1,
        aborted: 1,
      }
      if (nextEstado && !VALID[nextEstado]) {
        throw new BadRequestError('Transição de estado inválida: ' + nextEstado)
      }
      var TRANSITIONS = {
        started: { running: 1, blocked: 1, aborted: 1 },
        running: { pass: 1, fail: 1, blocked: 1, aborted: 1 },
        '': { started: 1, running: 1, pass: 1, fail: 1, blocked: 1, aborted: 1 },
      }
      if (nextEstado && prevEstado !== nextEstado) {
        var allowed = TRANSITIONS[prevEstado]
        if (!allowed || !allowed[nextEstado]) {
          throw new BadRequestError('Transição não permitida: ' + prevEstado + ' → ' + nextEstado)
        }
      }
    }
    if (name === 'com_etapas_porta_2d2b') {
      throw new BadRequestError(
        'Etapas da evidência 2D.2B são append-only — update bloqueado (model hook).',
      )
    }
    e.next()
  },
  'com_execucoes_porta_2d2b',
  'com_etapas_porta_2d2b',
)

// ─── onRecordDelete: intercepta $app.delete() ───
onRecordDelete(
  function (e) {
    var name = e.record.collection().name
    if (name === 'com_execucoes_porta_2d2b') {
      var estado = ''
      try {
        estado = e.record.getString('estado')
      } catch (_) {}
      var TERMINAL = { pass: 1, fail: 1, blocked: 1, aborted: 1 }
      if (TERMINAL[estado]) {
        throw new BadRequestError(
          'Evidência terminal (estado=' +
            estado +
            ') não pode ser apagada — delete bloqueado (model hook).',
        )
      }
      // Não-terminal também bloqueado: cascadeDelete agora é false, mas
      // deletar a execução criaria etapas órfãs. O runner nunca deleta
      // execuções — todo delete é não autorizado.
      throw new BadRequestError(
        'Delete de execução 2D.2B bloqueado (model hook) — evidência protegida.',
      )
    }
    if (name === 'com_etapas_porta_2d2b') {
      throw new BadRequestError(
        'Delete de etapa 2D.2B bloqueado (model hook) — evidência append-only.',
      )
    }
    e.next()
  },
  'com_execucoes_porta_2d2b',
  'com_etapas_porta_2d2b',
)

// ─── onRecordCreate (etapas): append somente em execução não-terminal ───
onRecordCreate(function (e) {
  var name = e.record.collection().name
  if (name === 'com_etapas_porta_2d2b') {
    var execId = e.record.getString('execucao_id')
    if (execId) {
      try {
        var exec = $app.findFirstRecordByData('com_execucoes_porta_2d2b', 'id', execId)
        if (exec) {
          var est = exec.getString('estado')
          var TERMINAL = { pass: 1, fail: 1, blocked: 1, aborted: 1 }
          if (TERMINAL[est]) {
            throw new BadRequestError(
              'Append de etapa bloqueado: execução ' + execId + ' está terminal (' + est + ').',
            )
          }
        }
      } catch (lookupErr) {
        if (String(lookupErr).indexOf('Append de etapa') !== -1) throw lookupErr
        // exec não encontrada — permite (FK constraint rejeitará se inválida)
      }
    }
  }
  e.next()
}, 'com_etapas_porta_2d2b')
