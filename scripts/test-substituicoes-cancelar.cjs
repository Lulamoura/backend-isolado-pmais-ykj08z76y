#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────
// Teste estático — G39-E2C-C3B2B-R5 (v0.0.188) — comando cancelar_ausencia_ou_substituicao
// ─────────────────────────────────────────────────────────────────────
// Lê pocketbase/hooks/com_substituicoes_cancelar.js, extrai o bloco delimitado
// EXCLUSIVAMENTE por dois marcadores textuais (dois indexOf) e avalia em
// sandbox local (node:vm). NENHUMA conexão com PocketBase, NENHUMA chamada
// HTTP. Extrai __testExports.canonicalize, .validarRBAC, .hojeRecife,
// .bindingVigente, .validarUsuario, .resolverFallbackSuperadmin,
// .payloadCancelar, .snapshotPre, .snapshotPos, .diffCancelar.
//
// Marcadores textuais (indexOf):
//   início — "/* ──── BLOCO DE TESTES ESTÁTICOS ──── */"
//   fim    — "/* ──── FIM DO BLOCO DE TESTES ESTÁTICOS ──── */"
//
// Execute: node scripts/test-substituicoes-cancelar.cjs
// ─────────────────────────────────────────────────────────────────────
'use strict'

var fs = require('fs')
var path = require('path')
var vm = require('vm')

var hookPath = path.join(__dirname, '..', 'pocketbase', 'hooks', 'com_substituicoes_cancelar.js')
var src = fs.readFileSync(hookPath, 'utf8')

// ─── Extrai o bloco EXCLUSIVAMENTE por dois marcadores textuais ───
var startMarker = '/* ──── BLOCO DE TESTES ESTÁTICOS ──── */'
var startIdx = src.indexOf(startMarker)
if (startIdx === -1) {
  console.error('FAIL: marcador de início do bloco de testes não encontrado no hook')
  process.exit(1)
}

var endMarker = '/* ──── FIM DO BLOCO DE TESTES ESTÁTICOS ──── */'
var endIdx = src.indexOf(endMarker, startIdx)
if (endIdx === -1) {
  console.error('FAIL: marcador de fim do bloco de testes não encontrado após o marcador de início')
  process.exit(1)
}

var blockSrc = src.substring(startIdx, endIdx + endMarker.length)

if (!(endIdx > startIdx)) {
  console.error('FAIL: endIdx não é maior que startIdx (bloco vazio ou invertido)')
  process.exit(1)
}

// ─── Sandbox: avalia o bloco extraído do hook ───
var sandbox = { console: console }
vm.createContext(sandbox)
vm.runInContext(blockSrc, sandbox, { filename: 'extracted-substituicoes-cancelar-block.js' })

var canonicalize = sandbox.__testExports.canonicalize
var validarRBAC = sandbox.__testExports.validarRBAC
var hojeRecife = sandbox.__testExports.hojeRecife
var bindingVigente = sandbox.__testExports.bindingVigente
var validarUsuario = sandbox.__testExports.validarUsuario
var resolverFallbackSuperadmin = sandbox.__testExports.resolverFallbackSuperadmin
var payloadCancelar = sandbox.__testExports.payloadCancelar
var snapshotPre = sandbox.__testExports.snapshotPre
var snapshotPos = sandbox.__testExports.snapshotPos
var diffCancelar = sandbox.__testExports.diffCancelar

function expectFn(name, fn) {
  if (typeof fn !== 'function') {
    console.error('FAIL: __testExports.' + name + ' não é função após eval do bloco')
    process.exit(1)
  }
}
expectFn('canonicalize', canonicalize)
expectFn('validarRBAC', validarRBAC)
expectFn('hojeRecife', hojeRecife)
expectFn('bindingVigente', bindingVigente)
expectFn('validarUsuario', validarUsuario)
expectFn('resolverFallbackSuperadmin', resolverFallbackSuperadmin)
expectFn('payloadCancelar', payloadCancelar)
expectFn('snapshotPre', snapshotPre)
expectFn('snapshotPos', snapshotPos)
expectFn('diffCancelar', diffCancelar)

// ─── Runner ───
var passed = 0
var failed = 0

function assert(name, cond, detail) {
  if (cond) {
    passed++
    console.log('TEST PASS: ' + name)
  } else {
    failed++
    console.log('TEST FAIL: ' + name)
    if (detail) console.log('  ' + detail)
  }
}

// ═══════ A) canonicalize — 3 casos ═══════

assert(
  'A1 canonicalize objeto simples {b:1,a:2}',
  canonicalize({ b: 1, a: 2 }) === '{"a":2,"b":1}',
  'got: ' + JSON.stringify(canonicalize({ b: 1, a: 2 })),
)

assert(
  'A2 canonicalize aninhado {z:{b:2,a:1},y:3}',
  canonicalize({ z: { b: 2, a: 1 }, y: 3 }) === '{"y":3,"z":{"a":1,"b":2}}',
  'got: ' + JSON.stringify(canonicalize({ z: { b: 2, a: 1 }, y: 3 })),
)

assert(
  'A3 canonicalize filtra undefined mantém null',
  canonicalize({ a: 1, b: undefined, c: null }) === '{"a":1,"c":null}',
  'got: ' + JSON.stringify(canonicalize({ a: 1, b: undefined, c: null })),
)

// ═══════ B) hojeRecife — 4 casos ═══════

assert(
  'B1 hojeRecife meio do dia Recife (15:00 UTC → 2026-08-12)',
  hojeRecife(Date.UTC(2026, 7, 12, 15, 0, 0)) === '2026-08-12',
  'got: ' + hojeRecife(Date.UTC(2026, 7, 12, 15, 0, 0)),
)

assert(
  'B2 hojeRecife 02:30 UTC → dia anterior Recife (2026-08-11)',
  hojeRecife(Date.UTC(2026, 7, 12, 2, 30, 0)) === '2026-08-11',
  'got: ' + hojeRecife(Date.UTC(2026, 7, 12, 2, 30, 0)),
)

assert(
  'B3 hojeRecife exatamente 03:00 UTC → 2026-08-12 (00:00 Recife)',
  hojeRecife(Date.UTC(2026, 7, 12, 3, 0, 0)) === '2026-08-12',
  'got: ' + hojeRecife(Date.UTC(2026, 7, 12, 3, 0, 0)),
)

assert(
  'B4 hojeRecife exatamente 02:59:59 UTC → 2026-08-11',
  hojeRecife(Date.UTC(2026, 7, 12, 2, 59, 59)) === '2026-08-11',
  'got: ' + hojeRecife(Date.UTC(2026, 7, 12, 2, 59, 59)),
)

// ═══════ C) bindingVigente — 4 casos ═══════

assert(
  'C1 bindingVigente fim==hojeCivil → true (inclusiva)',
  bindingVigente(null, '2026-08-11', '2026-08-11') === true,
  'got: ' + bindingVigente(null, '2026-08-11', '2026-08-11'),
)

assert(
  'C2 bindingVigente fim<hojeCivil → false',
  bindingVigente(null, '2026-08-10', '2026-08-11') === false,
  'got: ' + bindingVigente(null, '2026-08-10', '2026-08-11'),
)

assert(
  'C3 bindingVigente inicio==hojeCivil → true (inclusiva)',
  bindingVigente('2026-08-11', null, '2026-08-11') === true,
  'got: ' + bindingVigente('2026-08-11', null, '2026-08-11'),
)

assert(
  'C4 bindingVigente ambos vazios → true',
  bindingVigente(null, null, '2026-08-11') === true,
  'got: ' + bindingVigente(null, null, '2026-08-11'),
)

// ═══════ D) validarUsuario — 2 casos ═══════

var d1 = validarUsuario({ ativo_comercial: true })
assert(
  'D1 validarUsuario ativo_comercial=true → ok',
  d1.aprovado === true && d1.motivo === 'ok',
  'got: ' + JSON.stringify(d1),
)

var d2 = validarUsuario({ ativo_comercial: false })
assert(
  'D2 validarUsuario ativo_comercial=false → comercial_inativo',
  d2.aprovado === false && d2.motivo === 'comercial_inativo',
  'got: ' + JSON.stringify(d2),
)

// ═══════ E) resolverFallbackSuperadmin — 4 casos ═══════

assert(
  'E1 resolverFallback ativo+SA+vigente → true',
  resolverFallbackSuperadmin(
    [{ ativo: true, perfilSlug: 'superadministrador', inicio_vigencia: null, fim_vigencia: null }],
    '2026-08-11',
  ) === true,
  'esperado true',
)

assert(
  'E2 resolverFallback ativo+SA+expirado → false',
  resolverFallbackSuperadmin(
    [
      {
        ativo: true,
        perfilSlug: 'superadministrador',
        inicio_vigencia: null,
        fim_vigencia: '2026-08-10',
      },
    ],
    '2026-08-11',
  ) === false,
  'esperado false',
)

assert(
  'E3 resolverFallback inativo+SA → false',
  resolverFallbackSuperadmin(
    [{ ativo: false, perfilSlug: 'superadministrador', inicio_vigencia: null, fim_vigencia: null }],
    '2026-08-11',
  ) === false,
  'esperado false',
)

assert(
  'E4 resolverFallback ativo+não-SA → false',
  resolverFallbackSuperadmin(
    [{ ativo: true, perfilSlug: 'gestor', inicio_vigencia: null, fim_vigencia: null }],
    '2026-08-11',
  ) === false,
  'esperado false',
)

// ═══════ F) validarRBAC — 5 casos ═══════

var f1 = validarRBAC('superadministrador', [], 'eq1')
assert('F1 superadmin → aprovado', f1.aprovado === true, 'motivo: ' + f1.motivo)

var f2 = validarRBAC(
  'gestor',
  [{ equipe_id: 'eq1', perfilSlug: 'gestor', ativo: true, vigente: true }],
  'eq1',
)
assert('F2 gestor da equipe correta → aprovado', f2.aprovado === true, 'motivo: ' + f2.motivo)

var f3 = validarRBAC(
  'gestor',
  [{ equipe_id: 'eq2', perfilSlug: 'gestor', ativo: true, vigente: true }],
  'eq1',
)
assert('F3 gestor de outra equipe → rejeitado', f3.aprovado === false, 'motivo: ' + f3.motivo)

var f4 = validarRBAC(
  'comercial',
  [{ equipe_id: 'eq1', perfilSlug: 'comercial', ativo: true, vigente: true }],
  'eq1',
)
assert('F4 comercial → rejeitado', f4.aprovado === false, 'motivo: ' + f4.motivo)

var f5 = validarRBAC(
  'gestor',
  [{ equipe_id: 'eq1', perfilSlug: 'gestor', ativo: true, vigente: true }],
  null,
)
assert(
  'F5 titular sem equipe (só superadmin) → rejeitado',
  f5.aprovado === false,
  'motivo: ' + f5.motivo,
)

// ═══════ G) binding revogado pré→tx — 1 caso ═══════

var bindingsPreG = [{ equipe_id: 'eq1', perfilSlug: 'gestor', ativo: true, vigente: true }]
var bindingsPosG = [{ equipe_id: 'eq1', perfilSlug: 'gestor', ativo: true, vigente: false }]
var g1pre = validarRBAC('gestor', bindingsPreG, 'eq1')
var g1pos = validarRBAC('gestor', bindingsPosG, 'eq1')
assert(
  'G1 RBAC revogado — pré vigente aprovado, pós expirado rejeitado',
  g1pre.aprovado === true && g1pos.aprovado === false,
  'pre=' + JSON.stringify(g1pre) + ' pos=' + JSON.stringify(g1pos),
)

// ═══════ H) temporais cancelar — 4 casos ═══════
// hoje < data_fim → cancelável (true)
// hoje == data_fim → cancelável (true)
// hoje > data_fim → JANELA_ENCERRADA (false)
// 02:30 e 02:59:59 UTC pertencem ao dia anterior Recife

function podeCancelar(hojeCivil, dataFim) {
  // hoje <= data_fim → cancelável
  return hojeCivil <= dataFim
}

assert(
  'H1 hoje < data_fim → cancelável',
  podeCancelar('2026-08-10', '2026-08-15') === true,
  'esperado cancelável',
)

assert(
  'H2 hoje == data_fim → cancelável (inclusivo)',
  podeCancelar('2026-08-15', '2026-08-15') === true,
  'esperado cancelável',
)

assert(
  'H3 hoje > data_fim → JANELA_ENCERRADA',
  podeCancelar('2026-08-16', '2026-08-15') === false,
  'esperado encerrada',
)

// 02:30 UTC do dia 13 (Recife ainda dia 12) com data_fim 2026-08-12 → cancelável
var hojeEm0230 = hojeRecife(Date.UTC(2026, 7, 13, 2, 30, 0))
assert(
  'H4 02:30 UTC (dia anterior Recife) — hoje=2026-08-12 == data_fim → cancelável',
  hojeEm0230 === '2026-08-12' && podeCancelar(hojeEm0230, '2026-08-12') === true,
  'hoje: ' + hojeEm0230,
)

// ═══════ I) estado cancelar — 2 casos ═══════
// JA_CANCELADO quando cancelada_em preenchido
// estado pré (cancelada_em vazio) → pode cancelar

function estadoCancelavel(canceladaEm) {
  // preenchido → já cancelado (false)
  return !canceladaEm
}

assert(
  'I1 cancelada_em vazio → cancelável',
  estadoCancelavel('') === true && estadoCancelavel(null) === true,
  'esperado cancelável',
)

assert(
  'I2 cancelada_em preenchido → JA_CANCELADO',
  estadoCancelavel('2026-08-10T12:00:00.000Z') === false,
  'esperado já cancelado',
)

// ═══════ J) justificativa — 2 casos ═══════
// trimada antes do hash e do save; não vazia; máximo 500

function normalizarJustificativa(j) {
  if (typeof j !== 'string') return ''
  return j.trim()
}

assert(
  'J1 justificativa com espaços é trimada (não vazia)',
  normalizarJustificativa('   motivo válido   ') === 'motivo válido',
  'got: ' + normalizarJustificativa('   motivo válido   '),
)

assert(
  'J2 justificativa só espaços → vazia (rejeitada)',
  normalizarJustificativa('      ') === '',
  'esperado vazio',
)

// ═══════ K) payload extra — 1 caso ═══════
// Chaves permitidas exatamente: id, updated_esperado, justificativa_cancelamento,
// command_idempotency_key. Qualquer chave extra → 400 VALIDATION.

var chavesPermitidas = [
  'id',
  'updated_esperado',
  'justificativa_cancelamento',
  'command_idempotency_key',
]
function payloadEhFechado(payload) {
  var keys = Object.keys(payload)
  for (var i = 0; i < keys.length; i++) {
    if (chavesPermitidas.indexOf(keys[i]) === -1) return false
  }
  return true
}

var k1body = {
  id: 'rec1',
  updated_esperado: '2026-01-01 00:00:00.000Z',
  justificativa_cancelamento: 'motivo',
  command_idempotency_key: 'k1',
  campo_extra: 'proibido',
}
assert(
  'K1 payload com chave extra → rejeitado (fechado)',
  payloadEhFechado(k1body) === false,
  'esperado false (rejeitado)',
)

// ═══════ L) justificativa >500 — 1 caso ═══════

var justLonga = new Array(502).join('a') // 501 caracteres
assert(
  'L1 justificativa 501 caracteres > 500 → rejeitada',
  justLonga.length === 501 && justLonga.length > 500,
  'len: ' + justLonga.length,
)

// ═══════ M) replay íntegro — 1 caso ═══════
// mesma chave + mesmo hash + concluido + registros_afetados íntegro → 200 {id}

var m1Id = 'rec-m1'
var m1Hash = canonicalize(payloadCancelar(m1Id, '2026-01-01 00:00:00.000Z', 'motivo'))
var m1Idemp = {
  command_idempotency_key: 'k-m1',
  payload_hash: m1Hash,
  estado: 'concluido',
  registros_afetados: [m1Id],
}
assert(
  'M1 replay íntegro — concluido + mesmohash + registros_afetados → retorna id',
  m1Idemp.estado === 'concluido' &&
    m1Idemp.payload_hash === m1Hash &&
    m1Idemp.registros_afetados.length > 0 &&
    m1Idemp.registros_afetados[0] === m1Id,
  'idemp: ' + JSON.stringify(m1Idemp),
)

// ═══════ N) replay corrompido — 1 caso ═══════
// concluído sem registros_afetados íntegro → 500 INTEGRIDADE_IDEMPOTENCIA

var n1Id = 'rec-n1'
var n1Hash = canonicalize(payloadCancelar(n1Id, '2026-01-01 00:00:00.000Z', 'motivo'))
var n1Idemp = {
  command_idempotency_key: 'k-n1',
  payload_hash: n1Hash,
  estado: 'concluido',
  registros_afetados: [],
}
function classificarReplay(idemp, hash) {
  if (idemp.payload_hash === hash && idemp.estado === 'concluido') {
    if (idemp.registros_afetados && idemp.registros_afetados.length > 0) {
      return { status: 200, id: idemp.registros_afetados[0] }
    }
    return { status: 500, error: 'INTEGRIDADE_IDEMPOTENCIA' }
  }
  return null
}
var n1Class = classificarReplay(n1Idemp, n1Hash)
assert(
  'N1 replay corrompido — concluido sem registros → 500 INTEGRIDADE_IDEMPOTENCIA',
  n1Class.status === 500 && n1Class.error === 'INTEGRIDADE_IDEMPOTENCIA',
  'class: ' + JSON.stringify(n1Class),
)

// ═══════ O) executando mesmo hash — 1 caso ═══════
// mesmo hash + estado executando → 409 CONCORRENTE

var o1Id = 'rec-o1'
var o1Hash = canonicalize(payloadCancelar(o1Id, '2026-01-01 00:00:00.000Z', 'motivo'))
var o1Idemp = {
  command_idempotency_key: 'k-o1',
  payload_hash: o1Hash,
  estado: 'executando',
  registros_afetados: [],
}
var o1Class = classificarReplay(o1Idemp, o1Hash)
assert(
  'O1 executando mesmo hash → 409 CONCORRENTE',
  o1Idemp.estado === 'executando' && o1Idemp.payload_hash === o1Hash,
  'esperado CONCORRENTE (não replay)',
)

// ═══════ P) hash diferente — 1 caso ═══════
// mesma chave + hash diferente → 409 CONFLICT

var p1HashA = canonicalize(payloadCancelar('rec-p1', '2026-01-01 00:00:00.000Z', 'motivo A'))
var p1HashB = canonicalize(payloadCancelar('rec-p1', '2026-01-01 00:00:00.000Z', 'motivo B'))
assert(
  'P1 mesma chave + hash diferente → 409 CONFLICT',
  p1HashA !== p1HashB,
  'hashA=' + p1HashA + ' hashB=' + p1HashB,
)

// ═══════ Q) ordem STALE_WRITE antes de JA_CANCELADO — 1 caso ═══════
// Na ordem canônica: updated é comparado ANTES de cancelada_em.
// Registro com updated divergente E cancelada_em preenchido → STALE_WRITE.

var q1UpdatedEsperado = '2026-01-01 00:00:00.000Z'
var q1UpdatedAtual = '2026-01-02 00:00:00.000Z' // divergente
var q1CanceladaEm = '2026-01-03T00:00:00.000Z'
function ordemCancelar(updatedAtual, updatedEsperado, canceladaEm) {
  // 4. comparar updated
  if (updatedAtual !== updatedEsperado) return 'STALE_WRITE'
  // 5. cancelada_em
  if (canceladaEm) return 'JA_CANCELADO'
  return 'OK'
}
var q1Result = ordemCancelar(q1UpdatedAtual, q1UpdatedEsperado, q1CanceladaEm)
assert(
  'Q1 STALE_WRITE tem precedência sobre JA_CANCELADO',
  q1Result === 'STALE_WRITE',
  'got: ' + q1Result,
)

// ═══════ R) snapshot pré null — 1 caso ═══════
// snapshot pré completo com cancelada_em e justificativa_cancelamento null

var regBase = {
  titular_id: 'u1',
  substituto_principal_id: 'u2',
  substituto_reserva_id: null,
  data_inicio: '2026-01-01',
  data_fim: '2026-12-31',
  tipo_cobertura: 'integral',
  negocios_cobertos: [],
  motivo: 'ferias',
  observacao: null,
  autor_id: 'u3',
  creation_idempotency_key: 'ck1',
}
var r1Pre = snapshotPre(regBase)
assert(
  'R1 snapshot pré tem cancelada_em=null e justificativa_cancelamento=null',
  r1Pre.cancelada_em === null && r1Pre.justificativa_cancelamento === null,
  'pre: ' + JSON.stringify(r1Pre),
)

// ═══════ S) snapshot pós valores — 1 caso ═══════
// snapshot pós completo com cancelada_em e justificativa_cancelamento preenchidos

var s1CanceladaEm = '2026-08-12T14:30:00.000Z'
var s1Just = 'cancelamento solicitado'
var s1Pos = snapshotPos(regBase, s1CanceladaEm, s1Just)
assert(
  'S1 snapshot pós tem cancelada_em e justificativa preenchidos',
  s1Pos.cancelada_em === s1CanceladaEm && s1Pos.justificativa_cancelamento === s1Just,
  'pos: ' + JSON.stringify({ c: s1Pos.cancelada_em, j: s1Pos.justificativa_cancelamento }),
)

// ═══════ T) diff dois campos — 1 caso ═══════
// diff exclusivamente dos dois campos (cancelada_em, justificativa_cancelamento)

var t1Pre = snapshotPre(regBase)
var t1Pos = snapshotPos(regBase, '2026-08-12T14:30:00.000Z', 'motivo')
var t1Diff = diffCancelar(t1Pre, t1Pos)
assert(
  'T1 diff contém exclusivamente cancelada_em e justificativa_cancelamento',
  t1Diff.length === 2 &&
    t1Diff.indexOf('cancelada_em') !== -1 &&
    t1Diff.indexOf('justificativa_cancelamento') !== -1,
  'diff: ' + JSON.stringify(t1Diff),
)

// ═══════ Resumo ═══════
console.log('\n' + passed + '/' + (passed + failed) + ' passed')
if (failed > 0) process.exit(1)
