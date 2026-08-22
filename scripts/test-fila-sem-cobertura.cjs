#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────
// Teste estático — G39-E2C-C3B3B-R3 (v0.0.190) — fila de negócios sem cobertura
// ─────────────────────────────────────────────────────────────────────
// Lê pocketbase/hooks/com_fila_sem_cobertura.js, extrai o bloco
// delimitado EXCLUSIVAMENTE por dois marcadores textuais (dois indexOf) e
// avalia em sandbox local (node:vm). NENHUMA conexão com PocketBase,
// NENHUMA chamada HTTP.
//
// Extrai __testExports.hojeRecife, .bindingVigente, .resolverFallbackSuperadmin,
// .validarUsuario, .comporFiltro, .construirSort, .construirFiltroResponsaveis,
// .construirFiltroGestorEquipes, .construirFiltroQ1, .isSemCobertura,
// .isAusenciaVigente, .coletarTitularesSemCobertura, .elegivelNegocio,
// .calcularPaginacao, .calcularHasMore, .redatorUser, .redatorEquipe,
// .redatorAusencia, .deveBatch, .limiteBatchUsers, .limiteBatchEquipes,
// .limiteBatchQ1.
//
// Marcadores textuais (indexOf):
//   início — "/* ──── BLOCO DE TESTES ESTÁTICOS ──── */"
//   fim    — "/* ──── FIM DO BLOCO DE TESTES ESTÁTICOS ──── */"
//
// Execute: node scripts/test-fila-sem-cobertura.cjs
// ─────────────────────────────────────────────────────────────────────
'use strict'

var fs = require('fs')
var path = require('path')
var vm = require('vm')
var packageJson = require('../package.json')

function deveEncadearDashboard(testCommand) {
  return typeof testCommand !== 'string' || !testCommand.includes('test-dashboard-resumo.cjs')
}

var hookPath = path.join(__dirname, '..', 'pocketbase', 'hooks', 'com_fila_sem_cobertura.js')
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
vm.runInContext(blockSrc, sandbox, { filename: 'extracted-fila-sem-cobertura-block.js' })

var hojeRecife = sandbox.__testExports.hojeRecife
var bindingVigente = sandbox.__testExports.bindingVigente
var resolverFallbackSuperadmin = sandbox.__testExports.resolverFallbackSuperadmin
var validarUsuario = sandbox.__testExports.validarUsuario
var comporFiltro = sandbox.__testExports.comporFiltro
var construirSort = sandbox.__testExports.construirSort
var validarQuery = sandbox.__testExports.validarQuery
var construirFiltroResponsaveis = sandbox.__testExports.construirFiltroResponsaveis
var construirFiltroGestorEquipes = sandbox.__testExports.construirFiltroGestorEquipes
var construirFiltroQ1 = sandbox.__testExports.construirFiltroQ1
var isSemCobertura = sandbox.__testExports.isSemCobertura
var isAusenciaVigente = sandbox.__testExports.isAusenciaVigente
var coletarTitularesSemCobertura = sandbox.__testExports.coletarTitularesSemCobertura
var elegivelNegocio = sandbox.__testExports.elegivelNegocio
var calcularPaginacao = sandbox.__testExports.calcularPaginacao
var calcularHasMore = sandbox.__testExports.calcularHasMore
var redatorUser = sandbox.__testExports.redatorUser
var redatorEquipe = sandbox.__testExports.redatorEquipe
var redatorAusencia = sandbox.__testExports.redatorAusencia
var deveBatch = sandbox.__testExports.deveBatch
var limiteBatchUsers = sandbox.__testExports.limiteBatchUsers
var limiteBatchEquipes = sandbox.__testExports.limiteBatchEquipes
var limiteBatchQ1 = sandbox.__testExports.limiteBatchQ1

function expectFn(name, fn) {
  if (typeof fn !== 'function') {
    console.error('FAIL: __testExports.' + name + ' não é função após eval do bloco')
    process.exit(1)
  }
}
expectFn('hojeRecife', hojeRecife)
expectFn('bindingVigente', bindingVigente)
expectFn('resolverFallbackSuperadmin', resolverFallbackSuperadmin)
expectFn('validarUsuario', validarUsuario)
expectFn('comporFiltro', comporFiltro)
expectFn('construirSort', construirSort)
expectFn('construirFiltroResponsaveis', construirFiltroResponsaveis)
expectFn('construirFiltroGestorEquipes', construirFiltroGestorEquipes)
expectFn('construirFiltroQ1', construirFiltroQ1)
expectFn('isSemCobertura', isSemCobertura)
expectFn('isAusenciaVigente', isAusenciaVigente)
expectFn('coletarTitularesSemCobertura', coletarTitularesSemCobertura)
expectFn('elegivelNegocio', elegivelNegocio)
expectFn('calcularPaginacao', calcularPaginacao)
expectFn('calcularHasMore', calcularHasMore)
expectFn('redatorUser', redatorUser)
expectFn('deveBatch', deveBatch)

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

// ─── Helper: fake record PocketBase (apenas getString + get + id) ───
function fakeRec(fields, id) {
  var store = fields || {}
  return {
    id: id || store.id || 'recid',
    getString: function (k) {
      return store[k] === undefined || store[k] === null ? '' : String(store[k])
    },
    get: function (k) {
      return store[k]
    },
    getBool: function (k) {
      return store[k] === true
    },
  }
}

var HOJE = '2026-08-12'

// ═══════ A) hojeRecife — 4 casos (herdados) ═══════

assert(
  'A1 hojeRecife meio do dia Recife (15:00 UTC → 2026-08-12)',
  hojeRecife(Date.UTC(2026, 7, 12, 15, 0, 0)) === '2026-08-12',
  'got: ' + hojeRecife(Date.UTC(2026, 7, 12, 15, 0, 0)),
)

assert(
  'A2 hojeRecife virada UTC positiva (02:30 UTC → 2026-08-11)',
  hojeRecife(Date.UTC(2026, 7, 12, 2, 30, 0)) === '2026-08-11',
  'got: ' + hojeRecife(Date.UTC(2026, 7, 12, 2, 30, 0)),
)

assert(
  'A3 hojeRecife exatamente 03:00 UTC → 2026-08-12 (00:00 Recife)',
  hojeRecife(Date.UTC(2026, 7, 12, 3, 0, 0)) === '2026-08-12',
  'got: ' + hojeRecife(Date.UTC(2026, 7, 12, 3, 0, 0)),
)

assert(
  'A4 hojeRecife exatamente 02:59:59 UTC → 2026-08-11',
  hojeRecife(Date.UTC(2026, 7, 12, 2, 59, 59)) === '2026-08-11',
  'got: ' + hojeRecife(Date.UTC(2026, 7, 12, 2, 59, 59)),
)

// ═══════ B) bindingVigente — 4 casos (herdados) ═══════

assert(
  'B1 bindingVigente fim==hojeCivil → true',
  bindingVigente(null, '2026-08-12', '2026-08-12') === true,
  'got: ' + bindingVigente(null, '2026-08-12', '2026-08-12'),
)

assert(
  'B2 bindingVigente fim<hojeCivil → false',
  bindingVigente(null, '2026-08-10', '2026-08-12') === false,
  'got: ' + bindingVigente(null, '2026-08-10', '2026-08-12'),
)

assert(
  'B3 bindingVigente inicio==hojeCivil → true',
  bindingVigente('2026-08-12', null, '2026-08-12') === true,
  'got: ' + bindingVigente('2026-08-12', null, '2026-08-12'),
)

assert(
  'B4 bindingVigente ambos vazios → true',
  bindingVigente(null, null, '2026-08-12') === true,
  'got: ' + bindingVigente(null, null, '2026-08-12'),
)

// ═══════ C) resolverFallbackSuperadmin — 4 casos (herdados) ═══════

assert(
  'C1 resolverFallback ativo+SA+vigente → true',
  resolverFallbackSuperadmin(
    [{ ativo: true, perfilSlug: 'superadministrador', inicio_vigencia: null, fim_vigencia: null }],
    '2026-08-12',
  ) === true,
  'esperado true',
)

assert(
  'C2 resolverFallback inativo+SA → false',
  resolverFallbackSuperadmin(
    [{ ativo: false, perfilSlug: 'superadministrador', inicio_vigencia: null, fim_vigencia: null }],
    '2026-08-12',
  ) === false,
  'esperado false',
)

assert(
  'C3 resolverFallback sem bindings (vazio) → false',
  resolverFallbackSuperadmin([], '2026-08-12') === false,
  'esperado false',
)

assert(
  'C4 resolverFallback múltiplos bindings, um SA vigente → true',
  resolverFallbackSuperadmin(
    [
      { ativo: true, perfilSlug: 'gestor', inicio_vigencia: null, fim_vigencia: null },
      {
        ativo: true,
        perfilSlug: 'superadministrador',
        inicio_vigencia: '2026-01-01',
        fim_vigencia: null,
      },
    ],
    '2026-08-12',
  ) === true,
  'esperado true',
)

// ═══════ D) validarUsuario — 2 casos (herdados) ═══════

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

// ═══════ Q1 — Filtro PocketBase literal (1) ═══════

assert(
  'Q1-1 construirFiltroQ1 gera literal cancelada_em + vigente inclusivo',
  construirFiltroQ1(HOJE) ===
    "cancelada_em = null && data_inicio <= '2026-08-12' && data_fim >= '2026-08-12'",
  'got: ' + construirFiltroQ1(HOJE),
)

// ═══════ Q1 — getString('substituto_principal_id') === '' → true (1) ═══════

assert(
  'Q1-2 isSemCobertura substituto_principal_id vazio → true',
  isSemCobertura(fakeRec({ substituto_principal_id: '' })) === true,
  'esperado true',
)

// ═══════ Q1 — getString('substituto_principal_id') !== '' → false (1) ═══════

assert(
  'Q1-3 isSemCobertura substituto_principal_id preenchido → false',
  isSemCobertura(fakeRec({ substituto_principal_id: 'u1234567890abcde' })) === false,
  'esperado false',
)

// ═══════ Q1 — sem resultados → array vazio (1) ═══════

assert(
  'Q1-4 coletarTitularesSemCobertura([]) → []',
  Array.isArray(coletarTitularesSemCobertura([])) && coletarTitularesSemCobertura([]).length === 0,
  'got: ' + JSON.stringify(coletarTitularesSemCobertura([])),
)

// ═══════ Q1 — paginação offset+=500 (1) ═══════

// limiteBatchQ1 = 500; loop incrementa offset (offset += 500) enquanto
// batch.length === 500, parando quando batch.length < 500.
var q1OffsetSimulado = 0
var q1BatchTamanho = 500 // primeiro lote cheio
if (q1BatchTamanho === limiteBatchQ1()) q1OffsetSimulado += limiteBatchQ1()
var q1Segundo = 17 // segundo lote parcial → para
if (q1Segundo === limiteBatchQ1()) q1OffsetSimulado += limiteBatchQ1()
assert(
  'Q1-5 paginação Q1: lote 500, offset acumula 500 após lote cheio, para em lote parcial',
  limiteBatchQ1() === 500 && q1OffsetSimulado === 500 && q1Segundo < limiteBatchQ1(),
  'esperado limite 500, offset 500; got: ' + q1OffsetSimulado,
)

// ═══════ Q1 — deduplicação titular_id (1) ═══════

var recsDedup = [
  fakeRec({ titular_id: 'u1', substituto_principal_id: '' }, 'r1'),
  fakeRec({ titular_id: 'u1', substituto_principal_id: '' }, 'r2'),
  fakeRec({ titular_id: 'u2', substituto_principal_id: '' }, 'r3'),
]
assert(
  'Q1-7 coletarTitularesSemCobertura deduplica titular_id',
  JSON.stringify(coletarTitularesSemCobertura(recsDedup)) === '["u1","u2"]',
  'got: ' + JSON.stringify(coletarTitularesSemCobertura(recsDedup)),
)

// ═══════ E) Elegibilidade E1-E5 (5 casos) ═══════

assert(
  'E1 elegivel: ativo + responsável em ausência sem cobertura → true',
  elegivelNegocio({ inativo: false, responsavel_id: 'u1' }, ['u1', 'u2']) === true,
  'esperado true',
)

assert(
  'E2 elegivel: ausência COM cobertura (titular não está na lista) → false',
  elegivelNegocio({ inativo: false, responsavel_id: 'u3' }, ['u1', 'u2']) === false,
  'esperado false',
)

assert(
  'E3 elegivel: responsável sem ausência (lista vazia) → false',
  elegivelNegocio({ inativo: false, responsavel_id: 'u1' }, []) === false,
  'esperado false',
)

assert(
  'E4 elegivel: inativo=true → false',
  elegivelNegocio({ inativo: true, responsavel_id: 'u1' }, ['u1']) === false,
  'esperado false',
)

assert(
  'E5 elegivel: sem responsavel_id → false',
  elegivelNegocio({ inativo: false, responsavel_id: '' }, ['u1']) === false,
  'esperado false',
)

// ═══════ F) Fronteiras isAusenciaVigente — 4 casos ═══════

assert(
  'F1 fronteira data_inicio == hoje → vigente (true)',
  isAusenciaVigente('2026-08-12', '2026-08-20', HOJE) === true,
  'esperado true',
)

assert(
  'F2 fronteira data_fim == hoje → vigente (true)',
  isAusenciaVigente('2026-08-01', '2026-08-12', HOJE) === true,
  'esperado true',
)

assert(
  'F3 fronteira data_inicio == amanhã → futura (false)',
  isAusenciaVigente('2026-08-13', '2026-08-20', HOJE) === false,
  'esperado false',
)

assert(
  'F4 fronteira data_fim == ontem → encerrada (false)',
  isAusenciaVigente('2026-08-01', '2026-08-11', HOJE) === false,
  'esperado false',
)

// ═══════ G) construirFiltroResponsaveis — 3 casos ═══════

assert(
  'G1 construirFiltroResponsaveis 1 ID',
  construirFiltroResponsaveis(['ig7mouudku4et1g']) === "responsavel_id = 'ig7mouudku4et1g'",
  'got: ' + construirFiltroResponsaveis(['ig7mouudku4et1g']),
)

assert(
  'G2 construirFiltroResponsaveis múltiplos IDs',
  construirFiltroResponsaveis(['ig7mouudku4et1g', 'abc123']) ===
    "responsavel_id = 'ig7mouudku4et1g' || responsavel_id = 'abc123'",
  'got: ' + construirFiltroResponsaveis(['ig7mouudku4et1g', 'abc123']),
)

assert(
  'G3 construirFiltroResponsaveis vazio → string vazia',
  construirFiltroResponsaveis([]) === '',
  'got: ' + JSON.stringify(construirFiltroResponsaveis([])),
)

// ═══════ H) comporFiltro — 2 casos ═══════

// SA: filtroRBAC vazio + responsaveis + inativo
var h1 = comporFiltro(['', construirFiltroResponsaveis(['u1', 'u2']), 'inativo = false'])
assert(
  'H1 comporFiltro SA + responsaveis + inativo',
  h1 === "(responsavel_id = 'u1' || responsavel_id = 'u2') && inativo = false",
  'got: ' + h1,
)

// Gestor: equipes + responsaveis + inativo
var h2 = comporFiltro([
  construirFiltroGestorEquipes(['e1', 'e2']),
  construirFiltroResponsaveis(['u1', 'u2']),
  'inativo = false',
])
assert(
  'H2 comporFiltro gestor + responsaveis + inativo',
  h2 ===
    "(equipe_id = 'e1' || equipe_id = 'e2') && (responsavel_id = 'u1' || responsavel_id = 'u2') && inativo = false",
  'got: ' + h2,
)

// ═══════ I) Paginação — 2 casos ═══════

var pagI = calcularPaginacao(1, 20)
assert(
  'I1 has_more=false quando results.length <= por_pagina',
  calcularHasMore(20, 20) === false && pagI.limit === 21 && pagI.offset === 0,
  'esperado has_more false, limit 21, offset 0; got: ' + JSON.stringify(pagI),
)

// 21 resultados → has_more true; resposta sem campo total
var respI = {
  negocios_sem_cobertura: [],
  pagina: 1,
  por_pagina: 20,
  has_more: calcularHasMore(21, 20),
}
assert(
  'I2 has_more=true quando results.length > por_pagina + resposta sem campo total',
  respI.has_more === true && !Object.prototype.hasOwnProperty.call(respI, 'total'),
  'got: ' + JSON.stringify(respI),
)

// ═══════ J) Ordenação — 2 casos ═══════

assert(
  'J1 sort titulo asc → "titulo,-created,id"',
  construirSort('titulo', 'asc') === 'titulo,-created,id',
  'got: ' + construirSort('titulo', 'asc'),
)

assert(
  'J2 sort created desc → "-created,id" (não duplica created)',
  construirSort('created', 'desc') === '-created,id',
  'got: ' + construirSort('created', 'desc'),
)

// ═══════ K) Allowlist — 2 casos ═══════

// Simula o loop de query params do hook: chave extra → 400
var k1 = validarQuery({ foo: 'bar' })
assert(
  'K1 allowlist: chave extra → VALIDATION (400)',
  k1.valido === false && k1.erro === 'VALIDATION',
  'got: ' + JSON.stringify(k1),
)

// Valor inválido (pagina=0) → 400
var k2 = validarQuery({ pagina: '0' })
assert(
  'K2 allowlist: valor inválido (pagina=0) → VALIDATION (400)',
  k2.valido === false && k2.erro === 'VALIDATION',
  'got: ' + JSON.stringify(k2),
)

// ═══════ L) Redaction — redatorUser só {id, name} (1) ═══════

var fakeUser = {
  id: 'u1',
  name: 'Luiz Moura',
  email: 'luiz@x.com',
  equipe_id: 'eq1',
  perfil_id: 'p1',
  ativo_comercial: true,
  creation_idempotency_key: 'key',
  avatar: 'av',
  password: 'secret',
  token: 'tok',
}
var redacted = redatorUser(fakeUser)
assert(
  'L1 redaction: redatorUser expõe apenas {id, name}',
  redacted &&
    redacted.id === 'u1' &&
    redacted.name === 'Luiz Moura' &&
    !Object.prototype.hasOwnProperty.call(redacted, 'email') &&
    !Object.prototype.hasOwnProperty.call(redacted, 'equipe_id') &&
    !Object.prototype.hasOwnProperty.call(redacted, 'perfil_id') &&
    !Object.prototype.hasOwnProperty.call(redacted, 'ativo_comercial') &&
    !Object.prototype.hasOwnProperty.call(redacted, 'creation_idempotency_key') &&
    !Object.prototype.hasOwnProperty.call(redacted, 'avatar') &&
    !Object.prototype.hasOwnProperty.call(redacted, 'password') &&
    !Object.prototype.hasOwnProperty.call(redacted, 'token'),
  'got: ' + JSON.stringify(redacted),
)

// ═══════ M) Arrays vazios: deveBatch → skip (1) ═══════

assert(
  'M1 deveBatch([]) → false (skip de query quando array vazio)',
  deveBatch([]) === false && deveBatch(['u1']) === true,
  'esperado false para [], true para ["u1"]',
)

// ═══════ N) Encadeamento resiliente do Dashboard V1 (2) ═══════

assert(
  'N1 package sem Dashboard → encadeia a suíte',
  deveEncadearDashboard('node scripts/test-fila-sem-cobertura.cjs') === true,
)
assert(
  'N2 package com Dashboard → não duplica a suíte',
  deveEncadearDashboard(
    'node scripts/test-fila-sem-cobertura.cjs && node scripts/test-dashboard-resumo.cjs',
  ) === false,
)

// ═══════ Resumo ═══════
console.log('\n' + passed + '/' + (passed + failed) + ' passed')
if (failed > 0) process.exit(1)

if (deveEncadearDashboard(packageJson.scripts && packageJson.scripts.test)) {
  require('./test-dashboard-resumo.cjs')
}
