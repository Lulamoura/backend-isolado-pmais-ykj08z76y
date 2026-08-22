#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────
// Teste estático — G39-E2C-C3B2A-R1 (v0.0.186) — comando ajustar_ausencia_ou_substituicao
// ─────────────────────────────────────────────────────────────────────
// Lê pocketbase/hooks/com_substituicoes_ajustar.js, extrai o bloco delimitado
// EXCLUSIVAMENTE por dois marcadores textuais (dois indexOf) e avalia em
// sandbox local (node:vm). NENHUMA conexão com PocketBase, NENHUMA chamada
// HTTP. Extrai __testExports.canonicalize, .validarInvariantes, .validarRBAC,
// .hojeRecife, .mergePayload.
//
// Marcadores textuais (indexOf):
//   início — "/* ──── BLOCO DE TESTES ESTÁTICOS ──── */"
//   fim    — "/* ──── FIM DO BLOCO DE TESTES ESTÁTICOS ──── */"
//
// Execute: node scripts/test-substituicoes-ajustar.cjs
// ─────────────────────────────────────────────────────────────────────
'use strict'

var fs = require('fs')
var path = require('path')
var vm = require('vm')

var hookPath = path.join(__dirname, '..', 'pocketbase', 'hooks', 'com_substituicoes_ajustar.js')
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
vm.runInContext(blockSrc, sandbox, { filename: 'extracted-substituicoes-ajustar-block.js' })

var canonicalize = sandbox.__testExports.canonicalize
var validarInvariantes = sandbox.__testExports.validarInvariantes
var validarRBAC = sandbox.__testExports.validarRBAC
var hojeRecife = sandbox.__testExports.hojeRecife
var mergePayload = sandbox.__testExports.mergePayload
var bindingVigente = sandbox.__testExports.bindingVigente
var validarUsuario = sandbox.__testExports.validarUsuario
var resolverFallbackSuperadmin = sandbox.__testExports.resolverFallbackSuperadmin

function expectFn(name, fn) {
  if (typeof fn !== 'function') {
    console.error('FAIL: __testExports.' + name + ' não é função após eval do bloco')
    process.exit(1)
  }
}
expectFn('canonicalize', canonicalize)
expectFn('validarInvariantes', validarInvariantes)
expectFn('validarRBAC', validarRBAC)
expectFn('hojeRecife', hojeRecife)
expectFn('mergePayload', mergePayload)
expectFn('bindingVigente', bindingVigente)
expectFn('validarUsuario', validarUsuario)
expectFn('resolverFallbackSuperadmin', resolverFallbackSuperadmin)

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
  'B2 hojeRecife virada UTC positiva (02:30 UTC → 2026-08-11)',
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

// ═══════ C) validarInvariantes — 13 casos (5 válidos + 8 inválidos) ═══════

function makePayload(overrides) {
  var base = {
    titular_id: 'u1',
    substituto_principal_id: null,
    substituto_reserva_id: null,
    data_inicio: '2026-01-01',
    data_fim: '2026-12-31',
    tipo_cobertura: 'integral',
    negocios_cobertos: [],
    motivo: 'ferias',
  }
  for (var k in overrides) base[k] = overrides[k]
  return base
}

// VÁLIDOS (5)
var c1 = validarInvariantes(
  makePayload({
    substituto_principal_id: null,
    substituto_reserva_id: null,
    negocios_cobertos: [],
  }),
)
assert(
  'C1 válido — ausência sem cobertura',
  c1.valido === true,
  'erros: ' + JSON.stringify(c1.erros),
)

var c2 = validarInvariantes(
  makePayload({
    substituto_principal_id: 'u2',
    substituto_reserva_id: null,
    negocios_cobertos: [],
  }),
)
assert(
  'C2 válido — integral com principal',
  c2.valido === true,
  'erros: ' + JSON.stringify(c2.erros),
)

var c3 = validarInvariantes(
  makePayload({
    substituto_principal_id: 'u2',
    substituto_reserva_id: 'u3',
    negocios_cobertos: [],
  }),
)
assert(
  'C3 válido — integral com principal+reserva',
  c3.valido === true,
  'erros: ' + JSON.stringify(c3.erros),
)

var c4 = validarInvariantes(
  makePayload({
    substituto_principal_id: 'u2',
    substituto_reserva_id: null,
    tipo_cobertura: 'por_negocios',
    negocios_cobertos: ['n1'],
  }),
)
assert(
  'C4 válido — por_negocios com principal',
  c4.valido === true,
  'erros: ' + JSON.stringify(c4.erros),
)

var c5 = validarInvariantes(
  makePayload({
    substituto_principal_id: 'u2',
    substituto_reserva_id: 'u3',
    tipo_cobertura: 'por_negocios',
    negocios_cobertos: ['n1', 'n2'],
  }),
)
assert(
  'C5 válido — por_negocios com principal+reserva',
  c5.valido === true,
  'erros: ' + JSON.stringify(c5.erros),
)

// INVÁLIDOS (8)
var c6 = validarInvariantes(makePayload({ data_inicio: '2026-12-31', data_fim: '2026-01-01' }))
assert(
  'C6 inválido — I2 data_fim anterior',
  c6.valido === false && c6.erros.indexOf('I2') !== -1,
  'erros: ' + JSON.stringify(c6.erros),
)

var c7 = validarInvariantes(
  makePayload({
    substituto_principal_id: null,
    substituto_reserva_id: 'u3',
    negocios_cobertos: [],
  }),
)
assert(
  'C7 inválido — I3 reserva sem principal',
  c7.valido === false && c7.erros.indexOf('I3') !== -1,
  'erros: ' + JSON.stringify(c7.erros),
)

var c8 = validarInvariantes(
  makePayload({
    substituto_principal_id: null,
    substituto_reserva_id: null,
    tipo_cobertura: 'por_negocios',
    negocios_cobertos: ['n1'],
  }),
)
assert(
  'C8 inválido — I4 por_negocios sem principal',
  c8.valido === false && c8.erros.indexOf('I4') !== -1,
  'erros: ' + JSON.stringify(c8.erros),
)

var c9 = validarInvariantes(
  makePayload({
    substituto_principal_id: 'u2',
    substituto_reserva_id: null,
    tipo_cobertura: 'por_negocios',
    negocios_cobertos: [],
  }),
)
assert(
  'C9 inválido — I4 negocios vazios',
  c9.valido === false && c9.erros.indexOf('I4') !== -1,
  'erros: ' + JSON.stringify(c9.erros),
)

var c10 = validarInvariantes(
  makePayload({
    substituto_principal_id: 'u2',
    substituto_reserva_id: null,
    tipo_cobertura: 'integral',
    negocios_cobertos: ['n1'],
  }),
)
assert(
  'C10 inválido — I5 integral com negocios',
  c10.valido === false && c10.erros.indexOf('I5') !== -1,
  'erros: ' + JSON.stringify(c10.erros),
)

var c11 = validarInvariantes(
  makePayload({
    substituto_principal_id: null,
    substituto_reserva_id: 'u3',
    tipo_cobertura: 'integral',
    negocios_cobertos: [],
  }),
)
assert(
  'C11 inválido — I6 principal vazio com reserva',
  c11.valido === false && c11.erros.indexOf('I6') !== -1,
  'erros: ' + JSON.stringify(c11.erros),
)

var c12 = validarInvariantes(
  makePayload({
    substituto_principal_id: 'u1',
    substituto_reserva_id: null,
    negocios_cobertos: [],
  }),
)
assert(
  'C12 inválido — I7 titular=principal',
  c12.valido === false && c12.erros.indexOf('I7') !== -1,
  'erros: ' + JSON.stringify(c12.erros),
)

var c13 = validarInvariantes(
  makePayload({
    substituto_principal_id: 'u2',
    substituto_reserva_id: 'u2',
    negocios_cobertos: [],
  }),
)
assert(
  'C13 inválido — I8 principal=reserva',
  c13.valido === false && c13.erros.indexOf('I8') !== -1,
  'erros: ' + JSON.stringify(c13.erros),
)

// ═══════ D) validarRBAC — 5 casos ═══════

var d1 = validarRBAC('superadministrador', [], 'eq1')
assert('D1 superadmin → aprovado', d1.aprovado === true, 'motivo: ' + d1.motivo)

var d2 = validarRBAC(
  'gestor',
  [{ equipe_id: 'eq1', perfilSlug: 'gestor', ativo: true, vigente: true }],
  'eq1',
)
assert('D2 gestor da equipe correta → aprovado', d2.aprovado === true, 'motivo: ' + d2.motivo)

var d3 = validarRBAC(
  'gestor',
  [{ equipe_id: 'eq2', perfilSlug: 'gestor', ativo: true, vigente: true }],
  'eq1',
)
assert('D3 gestor de outra equipe → rejeitado', d3.aprovado === false, 'motivo: ' + d3.motivo)

var d4 = validarRBAC(
  'comercial',
  [{ equipe_id: 'eq1', perfilSlug: 'comercial', ativo: true, vigente: true }],
  'eq1',
)
assert('D4 comercial → rejeitado', d4.aprovado === false, 'motivo: ' + d4.motivo)

var d5 = validarRBAC(
  'gestor',
  [{ equipe_id: 'eq1', perfilSlug: 'gestor', ativo: true, vigente: true }],
  null,
)
assert(
  'D5 titular sem equipe (só superadmin) → rejeitado',
  d5.aprovado === false,
  'motivo: ' + d5.motivo,
)

// ═══════ E) mergePayload — 5 casos ═══════

// E1: merge com null nos opcionais
var reg1 = {
  titular_id: 'u1',
  substituto_principal_id: 'u2',
  substituto_reserva_id: 'u3',
  data_inicio: '2026-01-01',
  data_fim: '2026-12-31',
  tipo_cobertura: 'integral',
  negocios_cobertos: [],
  motivo: 'ferias',
  observacao: 'obs antiga',
}
var m1 = mergePayload(reg1, {
  substituto_principal_id: null,
  substituto_reserva_id: null,
})
assert(
  'E1 merge com null nos opcionais',
  m1.substituto_principal_id === null &&
    m1.substituto_reserva_id === null &&
    m1.observacao === 'obs antiga',
  'got: ' + JSON.stringify(m1),
)

// E2: merge com array negocios_cobertos
var m2 = mergePayload(reg1, {
  negocios_cobertos: ['n1', 'n2'],
  tipo_cobertura: 'por_negocios',
})
assert(
  'E2 merge com array negocios_cobertos (tipo_cobertura não mutável, preservado)',
  JSON.stringify(m2.negocios_cobertos) === '["n1","n2"]' && m2.tipo_cobertura === 'integral',
  'got: ' + JSON.stringify(m2),
)

// E3: merge com data
var m3 = mergePayload(reg1, { data_inicio: '2026-02-01', data_fim: '2026-11-30' })
assert(
  'E3 merge com data',
  m3.data_inicio === '2026-02-01' && m3.data_fim === '2026-11-30',
  'got: ' + JSON.stringify({ di: m3.data_inicio, df: m3.data_fim }),
)

// E4: merge parcial (só observacao)
var m4 = mergePayload(reg1, { observacao: 'nova obs' })
assert(
  'E4 merge parcial (só observacao)',
  m4.observacao === 'nova obs' &&
    m4.substituto_principal_id === 'u2' &&
    m4.data_inicio === '2026-01-01',
  'got: ' + JSON.stringify(m4),
)

// E5: merge onde campo mutável não veio no body (preserva valor existente)
var m5 = mergePayload(reg1, { data_inicio: '2026-03-01', data_fim: '2026-10-31' })
assert(
  'E5 merge preserva campos mutáveis não enviados',
  m5.substituto_principal_id === 'u2' &&
    m5.substituto_reserva_id === 'u3' &&
    m5.negocios_cobertos.length === 0 &&
    m5.observacao === 'obs antiga' &&
    m5.data_inicio === '2026-03-01',
  'got: ' + JSON.stringify(m5),
)

// ═══════ F) bindingVigente — 4 casos ═══════

assert(
  'F1 bindingVigente fim==hojeCivil → true',
  bindingVigente(null, '2026-08-11', '2026-08-11') === true,
  'got: ' + bindingVigente(null, '2026-08-11', '2026-08-11'),
)

assert(
  'F2 bindingVigente fim<hojeCivil → false',
  bindingVigente(null, '2026-08-10', '2026-08-11') === false,
  'got: ' + bindingVigente(null, '2026-08-10', '2026-08-11'),
)

assert(
  'F3 bindingVigente inicio==hojeCivil → true',
  bindingVigente('2026-08-11', null, '2026-08-11') === true,
  'got: ' + bindingVigente('2026-08-11', null, '2026-08-11'),
)

assert(
  'F4 bindingVigente ambos vazios → true',
  bindingVigente(null, null, '2026-08-11') === true,
  'got: ' + bindingVigente(null, null, '2026-08-11'),
)

// ═══════ G) validarUsuario — 2 casos ═══════

var g1 = validarUsuario({ ativo_comercial: true })
assert(
  'G1 validarUsuario ativo_comercial=true → ok',
  g1.aprovado === true && g1.motivo === 'ok',
  'got: ' + JSON.stringify(g1),
)

var g2 = validarUsuario({ ativo_comercial: false })
assert(
  'G2 validarUsuario ativo_comercial=false → comercial_inativo',
  g2.aprovado === false && g2.motivo === 'comercial_inativo',
  'got: ' + JSON.stringify(g2),
)

// ═══════ H) resolverFallbackSuperadmin — 4 casos ═══════

assert(
  'H1 resolverFallback ativo+SA+vigente → true',
  resolverFallbackSuperadmin(
    [{ ativo: true, perfilSlug: 'superadministrador', inicio_vigencia: null, fim_vigencia: null }],
    '2026-08-11',
  ) === true,
  'esperado true',
)

assert(
  'H2 resolverFallback ativo+SA+expirado → false',
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
  'H3 resolverFallback inativo+SA → false',
  resolverFallbackSuperadmin(
    [{ ativo: false, perfilSlug: 'superadministrador', inicio_vigencia: null, fim_vigencia: null }],
    '2026-08-11',
  ) === false,
  'esperado false',
)

assert(
  'H4 resolverFallback ativo+não-SA → false',
  resolverFallbackSuperadmin(
    [{ ativo: true, perfilSlug: 'gestor', inicio_vigencia: null, fim_vigencia: null }],
    '2026-08-11',
  ) === false,
  'esperado false',
)

// ═══════ I) RBAC revogado — bindings pré aprovam, pós rejeitam ═══════

var bindingsPreI = [{ equipe_id: 'eq1', perfilSlug: 'gestor', ativo: true, vigente: true }]
var bindingsPosI = [{ equipe_id: 'eq1', perfilSlug: 'gestor', ativo: true, vigente: false }]
var i1pre = validarRBAC('gestor', bindingsPreI, 'eq1')
var i1pos = validarRBAC('gestor', bindingsPosI, 'eq1')
assert(
  'I1 RBAC revogado — pré vigente aprovado, pós expirado rejeitado',
  i1pre.aprovado === true && i1pos.aprovado === false,
  'pre=' + JSON.stringify(i1pre) + ' pos=' + JSON.stringify(i1pos),
)

// ═══════ Resumo ═══════
console.log('\n' + passed + '/' + (passed + failed) + ' passed')
if (failed > 0) process.exit(1)
