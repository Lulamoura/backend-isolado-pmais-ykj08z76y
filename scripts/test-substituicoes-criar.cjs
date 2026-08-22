#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────
// Teste estático — G39-E2C-C3B1 (v0.0.185) — comando criar_ausencia_ou_substituicao
// ─────────────────────────────────────────────────────────────────────
// Lê pocketbase/hooks/com_substituicoes_criar.js, extrai o bloco delimitado
// EXCLUSIVAMENTE por dois marcadores textuais (dois indexOf) e avalia em
// sandbox local (node:vm). NENHUMA conexão com PocketBase, NENHUMA chamada
// HTTP. Extrai __testExports.canonicalize, .validarInvariantes, .validarRBAC,
// .hojeRecife, .bindingVigente, .validarUsuario, .resolverFallbackSuperadmin.
//
// Marcadores textuais (indexOf):
//   início — "/* ──── BLOCO DE TESTES ESTÁTICOS ──── */"
//   fim    — "/* ──── FIM DO BLOCO DE TESTES ESTÁTICOS ──── */"
//
// Execute: node scripts/test-substituicoes-criar.cjs
// ─────────────────────────────────────────────────────────────────────
'use strict'

var fs = require('fs')
var path = require('path')
var vm = require('vm')

var hookPath = path.join(__dirname, '..', 'pocketbase', 'hooks', 'com_substituicoes_criar.js')
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

// Inclui o marcador final no bloco para que a IIFE feche corretamente.
var blockSrc = src.substring(startIdx, endIdx + endMarker.length)

if (!(endIdx > startIdx)) {
  console.error('FAIL: endIdx não é maior que startIdx (bloco vazio ou invertido)')
  process.exit(1)
}

// ─── Sandbox: avalia o bloco extraído do hook ───
var sandbox = { console: console }
vm.createContext(sandbox)
vm.runInContext(blockSrc, sandbox, { filename: 'extracted-substituicoes-block.js' })

var canonicalize = sandbox.__testExports.canonicalize
var validarInvariantes = sandbox.__testExports.validarInvariantes
var validarRBAC = sandbox.__testExports.validarRBAC
var hojeRecife = sandbox.__testExports.hojeRecife
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

// ═══════ B) validarInvariantes — matriz (13 casos) ═══════

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

// Casos VÁLIDOS
var v1 = validarInvariantes(
  makePayload({
    substituto_principal_id: null,
    substituto_reserva_id: null,
    tipo_cobertura: 'integral',
    negocios_cobertos: [],
  }),
)
assert(
  'B1 válido — ausência sem cobertura',
  v1.valido === true,
  'erros: ' + JSON.stringify(v1.erros),
)

var v2 = validarInvariantes(
  makePayload({
    substituto_principal_id: 'u2',
    substituto_reserva_id: null,
    tipo_cobertura: 'integral',
    negocios_cobertos: [],
  }),
)
assert(
  'B2 válido — integral com principal',
  v2.valido === true,
  'erros: ' + JSON.stringify(v2.erros),
)

var v3 = validarInvariantes(
  makePayload({
    substituto_principal_id: 'u2',
    substituto_reserva_id: 'u3',
    tipo_cobertura: 'integral',
    negocios_cobertos: [],
  }),
)
assert(
  'B3 válido — integral com principal+reserva',
  v3.valido === true,
  'erros: ' + JSON.stringify(v3.erros),
)

var v4 = validarInvariantes(
  makePayload({
    substituto_principal_id: 'u2',
    substituto_reserva_id: null,
    tipo_cobertura: 'por_negocios',
    negocios_cobertos: ['n1'],
  }),
)
assert(
  'B4 válido — por_negocios com principal',
  v4.valido === true,
  'erros: ' + JSON.stringify(v4.erros),
)

var v5 = validarInvariantes(
  makePayload({
    substituto_principal_id: 'u2',
    substituto_reserva_id: 'u3',
    tipo_cobertura: 'por_negocios',
    negocios_cobertos: ['n1', 'n2'],
  }),
)
assert(
  'B5 válido — por_negocios com principal+reserva',
  v5.valido === true,
  'erros: ' + JSON.stringify(v5.erros),
)

// Casos INVÁLIDOS
var iv6 = validarInvariantes(
  makePayload({
    substituto_principal_id: null,
    substituto_reserva_id: 'u3',
    tipo_cobertura: 'integral',
    negocios_cobertos: [],
  }),
)
assert(
  'B6 inválido — reserva sem principal (I3)',
  iv6.valido === false && iv6.erros.indexOf('I3') !== -1,
  'erros: ' + JSON.stringify(iv6.erros),
)

var iv7 = validarInvariantes(
  makePayload({
    substituto_principal_id: null,
    substituto_reserva_id: null,
    tipo_cobertura: 'por_negocios',
    negocios_cobertos: ['n1'],
  }),
)
assert(
  'B7 inválido — por_negocios sem principal (I4)',
  iv7.valido === false && iv7.erros.indexOf('I4') !== -1,
  'erros: ' + JSON.stringify(iv7.erros),
)

var iv8 = validarInvariantes(
  makePayload({
    substituto_principal_id: 'u2',
    substituto_reserva_id: null,
    tipo_cobertura: 'integral',
    negocios_cobertos: ['n1'],
  }),
)
assert(
  'B8 inválido — integral com negocios (I5)',
  iv8.valido === false && iv8.erros.indexOf('I5') !== -1,
  'erros: ' + JSON.stringify(iv8.erros),
)

var iv9 = validarInvariantes(
  makePayload({
    substituto_principal_id: null,
    substituto_reserva_id: null,
    tipo_cobertura: 'integral',
    negocios_cobertos: ['n1'],
  }),
)
assert(
  'B9 inválido — ausência com negocios (I6)',
  iv9.valido === false && iv9.erros.indexOf('I6') !== -1,
  'erros: ' + JSON.stringify(iv9.erros),
)

var iv10 = validarInvariantes(
  makePayload({
    substituto_principal_id: null,
    substituto_reserva_id: 'u3',
    tipo_cobertura: 'integral',
    negocios_cobertos: [],
  }),
)
assert(
  'B10 inválido — ausência com reserva (I6/I3)',
  iv10.valido === false,
  'erros: ' + JSON.stringify(iv10.erros),
)

var iv11 = validarInvariantes(
  makePayload({
    titular_id: 'u1',
    substituto_principal_id: 'u1',
    substituto_reserva_id: null,
    tipo_cobertura: 'integral',
    negocios_cobertos: [],
  }),
)
assert(
  'B11 inválido — titular=principal (I7)',
  iv11.valido === false && iv11.erros.indexOf('I7') !== -1,
  'erros: ' + JSON.stringify(iv11.erros),
)

var iv12 = validarInvariantes(
  makePayload({
    substituto_principal_id: 'u2',
    substituto_reserva_id: 'u2',
    tipo_cobertura: 'integral',
    negocios_cobertos: [],
  }),
)
assert(
  'B12 inválido — principal=reserva (I8)',
  iv12.valido === false && iv12.erros.indexOf('I8') !== -1,
  'erros: ' + JSON.stringify(iv12.erros),
)

var iv13 = validarInvariantes(makePayload({ data_inicio: '2026-12-31', data_fim: '2026-01-01' }))
assert(
  'B13 inválido — data_fim < data_inicio (I2)',
  iv13.valido === false && iv13.erros.indexOf('I2') !== -1,
  'erros: ' + JSON.stringify(iv13.erros),
)

// ═══════ C) validarRBAC — 5 casos ═══════

var r1 = validarRBAC('superadministrador', [], 'eq1')
assert('C1 superadmin → aprovado', r1.aprovado === true, 'motivo: ' + r1.motivo)

var r2 = validarRBAC(
  'gestor',
  [{ equipe_id: 'eq1', perfilSlug: 'gestor', ativo: true, vigente: true }],
  'eq1',
)
assert('C2 gestor da equipe correta → aprovado', r2.aprovado === true, 'motivo: ' + r2.motivo)

var r3 = validarRBAC(
  'gestor',
  [{ equipe_id: 'eq2', perfilSlug: 'gestor', ativo: true, vigente: true }],
  'eq1',
)
assert('C3 gestor de outra equipe → rejeitado', r3.aprovado === false, 'motivo: ' + r3.motivo)

var r4 = validarRBAC(
  'comercial',
  [{ equipe_id: 'eq1', perfilSlug: 'comercial', ativo: true, vigente: true }],
  'eq1',
)
assert('C4 comercial → rejeitado', r4.aprovado === false, 'motivo: ' + r4.motivo)

var r5 = validarRBAC(
  'gestor',
  [{ equipe_id: 'eq1', perfilSlug: 'gestor', ativo: true, vigente: true }],
  null,
)
assert('C5 titular sem equipe (gestor) → rejeitado', r5.aprovado === false, 'motivo: ' + r5.motivo)

// ═══════ D) hojeRecife — 4 casos ═══════

assert(
  'D1 hojeRecife meio do dia Recife (15:00 UTC → 2026-08-12)',
  hojeRecife(Date.UTC(2026, 7, 12, 15, 0, 0)) === '2026-08-12',
  'got: ' + hojeRecife(Date.UTC(2026, 7, 12, 15, 0, 0)),
)

assert(
  'D2 hojeRecife virada UTC positiva (02:30 UTC → 2026-08-11)',
  hojeRecife(Date.UTC(2026, 7, 12, 2, 30, 0)) === '2026-08-11',
  'got: ' + hojeRecife(Date.UTC(2026, 7, 12, 2, 30, 0)),
)

assert(
  'D3 hojeRecife exatamente 03:00 UTC → 2026-08-12 (00:00 Recife)',
  hojeRecife(Date.UTC(2026, 7, 12, 3, 0, 0)) === '2026-08-12',
  'got: ' + hojeRecife(Date.UTC(2026, 7, 12, 3, 0, 0)),
)

assert(
  'D4 hojeRecife exatamente 02:59:59 UTC → 2026-08-11',
  hojeRecife(Date.UTC(2026, 7, 12, 2, 59, 59)) === '2026-08-11',
  'got: ' + hojeRecife(Date.UTC(2026, 7, 12, 2, 59, 59)),
)

// ═══════ E) bindingVigente — 4 casos ═══════

assert(
  'E1 bindingVigente fim==hojeCivil → true',
  bindingVigente(null, '2026-08-11', '2026-08-11') === true,
  'got: ' + bindingVigente(null, '2026-08-11', '2026-08-11'),
)

assert(
  'E2 bindingVigente fim<hojeCivil → false',
  bindingVigente(null, '2026-08-10', '2026-08-11') === false,
  'got: ' + bindingVigente(null, '2026-08-10', '2026-08-11'),
)

assert(
  'E3 bindingVigente inicio==hojeCivil → true',
  bindingVigente('2026-08-11', null, '2026-08-11') === true,
  'got: ' + bindingVigente('2026-08-11', null, '2026-08-11'),
)

assert(
  'E4 bindingVigente ambos vazios → true',
  bindingVigente(null, null, '2026-08-11') === true,
  'got: ' + bindingVigente(null, null, '2026-08-11'),
)

// ═══════ F) validarUsuario — 2 casos ═══════

var f1 = validarUsuario({ ativo_comercial: true })
assert(
  'F1 validarUsuario ativo_comercial=true → ok',
  f1.aprovado === true && f1.motivo === 'ok',
  'got: ' + JSON.stringify(f1),
)

var f2 = validarUsuario({ ativo_comercial: false })
assert(
  'F2 validarUsuario ativo_comercial=false → comercial_inativo',
  f2.aprovado === false && f2.motivo === 'comercial_inativo',
  'got: ' + JSON.stringify(f2),
)

// ═══════ G) resolverFallbackSuperadmin — 4 casos ═══════

assert(
  'G1 resolverFallback ativo+SA+vigente → true',
  resolverFallbackSuperadmin(
    [{ ativo: true, perfilSlug: 'superadministrador', inicio_vigencia: null, fim_vigencia: null }],
    '2026-08-11',
  ) === true,
  'esperado true',
)

assert(
  'G2 resolverFallback ativo+SA+expirado → false',
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
  'G3 resolverFallback inativo+SA → false',
  resolverFallbackSuperadmin(
    [{ ativo: false, perfilSlug: 'superadministrador', inicio_vigencia: null, fim_vigencia: null }],
    '2026-08-11',
  ) === false,
  'esperado false',
)

assert(
  'G4 resolverFallback ativo+não-SA → false',
  resolverFallbackSuperadmin(
    [{ ativo: true, perfilSlug: 'gestor', inicio_vigencia: null, fim_vigencia: null }],
    '2026-08-11',
  ) === false,
  'esperado false',
)

// ═══════ H) RBAC revogado — bindings pré aprovam, pós rejeitam ═══════

var bindingsPre = [{ equipe_id: 'eq1', perfilSlug: 'gestor', ativo: true, vigente: true }]
var bindingsPos = [{ equipe_id: 'eq1', perfilSlug: 'gestor', ativo: true, vigente: false }]
var h1pre = validarRBAC('gestor', bindingsPre, 'eq1')
var h1pos = validarRBAC('gestor', bindingsPos, 'eq1')
assert(
  'H1 RBAC revogado — pré vigente aprovado, pós expirado rejeitado',
  h1pre.aprovado === true && h1pos.aprovado === false,
  'pre=' + JSON.stringify(h1pre) + ' pos=' + JSON.stringify(h1pos),
)

// ═══════ Resumo ═══════
console.log('\n' + passed + '/' + (passed + failed) + ' passed')
if (failed > 0) process.exit(1)
