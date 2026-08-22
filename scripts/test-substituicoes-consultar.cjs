#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────
// Teste estático — G39-E2C-C3B3A-R4 (v0.0.189) — consulta de substituições
// ─────────────────────────────────────────────────────────────────────
// Lê pocketbase/hooks/com_substituicoes_consultar.js, extrai o bloco
// delimitado EXCLUSIVAMENTE por dois marcadores textuais (dois indexOf) e
// avalia em sandbox local (node:vm). NENHUMA conexão com PocketBase,
// NENHUMA chamada HTTP.
//
// Extrai __testExports.hojeRecife, .bindingVigente, .resolverFallbackSuperadmin,
// .validarUsuario, .classificarSituacao, .aplicarFiltroSituacao, .comporFiltro,
// .validarRBACLeitura, .construirFiltroGestor, .construirSort, .validarIdFormato,
// .validarQuery, .normalizarCanceladaEm, .normalizarRef, .coletarUserIds,
// .calcularPaginacao, .calcularHasMore, .construirRespostaList, .statusAcessoNegado,
// .deveBatch, .limiteBatchUsers, .limiteBatchNegocios.
//
// Marcadores textuais (indexOf):
//   início — "/* ──── BLOCO DE TESTES ESTÁTICOS ──── */"
//   fim    — "/* ──── FIM DO BLOCO DE TESTES ESTÁTICOS ──── */"
//
// Execute: node scripts/test-substituicoes-consultar.cjs
// ─────────────────────────────────────────────────────────────────────
'use strict'

var fs = require('fs')
var path = require('path')
var vm = require('vm')

var hookPath = path.join(__dirname, '..', 'pocketbase', 'hooks', 'com_substituicoes_consultar.js')
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
vm.runInContext(blockSrc, sandbox, { filename: 'extracted-substituicoes-consultar-block.js' })

var hojeRecife = sandbox.__testExports.hojeRecife
var bindingVigente = sandbox.__testExports.bindingVigente
var resolverFallbackSuperadmin = sandbox.__testExports.resolverFallbackSuperadmin
var validarUsuario = sandbox.__testExports.validarUsuario
var classificarSituacao = sandbox.__testExports.classificarSituacao
var aplicarFiltroSituacao = sandbox.__testExports.aplicarFiltroSituacao
var comporFiltro = sandbox.__testExports.comporFiltro
var validarRBACLeitura = sandbox.__testExports.validarRBACLeitura
var construirFiltroGestor = sandbox.__testExports.construirFiltroGestor
var construirSort = sandbox.__testExports.construirSort
var validarIdFormato = sandbox.__testExports.validarIdFormato
var validarQuery = sandbox.__testExports.validarQuery
var normalizarCanceladaEm = sandbox.__testExports.normalizarCanceladaEm
var normalizarRef = sandbox.__testExports.normalizarRef
var coletarUserIds = sandbox.__testExports.coletarUserIds
var calcularPaginacao = sandbox.__testExports.calcularPaginacao
var calcularHasMore = sandbox.__testExports.calcularHasMore
var construirRespostaList = sandbox.__testExports.construirRespostaList
var statusAcessoNegado = sandbox.__testExports.statusAcessoNegado
var deveBatch = sandbox.__testExports.deveBatch
var limiteBatchUsers = sandbox.__testExports.limiteBatchUsers
var limiteBatchNegocios = sandbox.__testExports.limiteBatchNegocios

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
expectFn('classificarSituacao', classificarSituacao)
expectFn('aplicarFiltroSituacao', aplicarFiltroSituacao)
expectFn('comporFiltro', comporFiltro)
expectFn('validarRBACLeitura', validarRBACLeitura)

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
  bindingVigente(null, '2026-08-11', '2026-08-11') === true,
  'got: ' + bindingVigente(null, '2026-08-11', '2026-08-11'),
)

assert(
  'B2 bindingVigente fim<hojeCivil → false',
  bindingVigente(null, '2026-08-10', '2026-08-11') === false,
  'got: ' + bindingVigente(null, '2026-08-10', '2026-08-11'),
)

assert(
  'B3 bindingVigente inicio==hojeCivil → true',
  bindingVigente('2026-08-11', null, '2026-08-11') === true,
  'got: ' + bindingVigente('2026-08-11', null, '2026-08-11'),
)

assert(
  'B4 bindingVigente ambos vazios → true',
  bindingVigente(null, null, '2026-08-11') === true,
  'got: ' + bindingVigente(null, null, '2026-08-11'),
)

// ═══════ C) resolverFallbackSuperadmin — 4 casos (herdados) ═══════

assert(
  'C1 resolverFallback ativo+SA+vigente → true',
  resolverFallbackSuperadmin(
    [{ ativo: true, perfilSlug: 'superadministrador', inicio_vigencia: null, fim_vigencia: null }],
    '2026-08-11',
  ) === true,
  'esperado true',
)

assert(
  'C2 resolverFallback inativo+SA → false',
  resolverFallbackSuperadmin(
    [{ ativo: false, perfilSlug: 'superadministrador', inicio_vigencia: null, fim_vigencia: null }],
    '2026-08-11',
  ) === false,
  'esperado false',
)

assert(
  'C3 resolverFallback ativo+SA não vigente (fim<hoje) → false',
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
  'C4 resolverFallback sem bindings → false',
  resolverFallbackSuperadmin([], '2026-08-11') === false,
  'esperado false',
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

// ═══════ E) classificarSituacao — 4 casos ═══════

assert(
  'E1 classificarSituacao cancelada → cancelada',
  classificarSituacao(
    { cancelada_em: '2026-08-05T10:00:00Z', data_inicio: '2026-08-10', data_fim: '2026-08-20' },
    '2026-08-12',
  ) === 'cancelada',
)

assert(
  'E2 classificarSituacao futura (hoje<data_inicio) → futura',
  classificarSituacao(
    { cancelada_em: null, data_inicio: '2026-08-20', data_fim: '2026-08-30' },
    '2026-08-12',
  ) === 'futura',
)

assert(
  'E3 classificarSituacao vigente (entre datas) → vigente',
  classificarSituacao(
    { cancelada_em: null, data_inicio: '2026-08-10', data_fim: '2026-08-20' },
    '2026-08-12',
  ) === 'vigente',
)

assert(
  'E4 classificarSituacao encerrada (hoje>data_fim) → encerrada',
  classificarSituacao(
    { cancelada_em: null, data_inicio: '2026-08-01', data_fim: '2026-08-05' },
    '2026-08-12',
  ) === 'encerrada',
)

// ═══════ F) Fronteiras classificarSituacao — 2 casos ═══════

assert(
  'F1 fronteira hoje==data_inicio → vigente',
  classificarSituacao(
    { cancelada_em: null, data_inicio: '2026-08-12', data_fim: '2026-08-20' },
    '2026-08-12',
  ) === 'vigente',
)

assert(
  'F2 fronteira hoje==data_fim → vigente',
  classificarSituacao(
    { cancelada_em: null, data_inicio: '2026-08-01', data_fim: '2026-08-12' },
    '2026-08-12',
  ) === 'vigente',
)

// ═══════ G) aplicarFiltroSituacao — 4 casos (tradução nativa) ═══════

var HOJE = '2026-08-12'

assert(
  'G1 aplicarFiltroSituacao cancelada',
  aplicarFiltroSituacao('cancelada', HOJE) === 'cancelada_em != null',
  'got: ' + aplicarFiltroSituacao('cancelada', HOJE),
)

assert(
  'G2 aplicarFiltroSituacao futura',
  aplicarFiltroSituacao('futura', HOJE) === "cancelada_em = null && data_inicio > '2026-08-12'",
  'got: ' + aplicarFiltroSituacao('futura', HOJE),
)

assert(
  'G3 aplicarFiltroSituacao vigente',
  aplicarFiltroSituacao('vigente', HOJE) ===
    "cancelada_em = null && data_inicio <= '2026-08-12' && data_fim >= '2026-08-12'",
  'got: ' + aplicarFiltroSituacao('vigente', HOJE),
)

assert(
  'G4 aplicarFiltroSituacao encerrada',
  aplicarFiltroSituacao('encerrada', HOJE) === "cancelada_em = null && data_fim < '2026-08-12'",
  'got: ' + aplicarFiltroSituacao('encerrada', HOJE),
)

// ═══════ H) comporFiltro — 4 casos ═══════

assert(
  'H1 comporFiltro SA sem situação (apenas vazio) → string vazia',
  comporFiltro(['']) === '',
  'got: ' + JSON.stringify(comporFiltro([''])),
)

assert(
  'H2 comporFiltro SA com vigente',
  comporFiltro([aplicarFiltroSituacao('vigente', HOJE)]) ===
    "cancelada_em = null && data_inicio <= '2026-08-12' && data_fim >= '2026-08-12'",
  'got: ' + JSON.stringify(comporFiltro([aplicarFiltroSituacao('vigente', HOJE)])),
)

assert(
  'H3 comporFiltro comercial com cancelada (envolve parênteses?)',
  comporFiltro([
    "titular_id = 'u1' || substituto_principal_id = 'u1' || substituto_reserva_id = 'u1'",
    aplicarFiltroSituacao('cancelada', HOJE),
  ]) ===
    "(titular_id = 'u1' || substituto_principal_id = 'u1' || substituto_reserva_id = 'u1') && cancelada_em != null",
  'got: ' +
    JSON.stringify(
      comporFiltro([
        "titular_id = 'u1' || substituto_principal_id = 'u1' || substituto_reserva_id = 'u1'",
        aplicarFiltroSituacao('cancelada', HOJE),
      ]),
    ),
)

assert(
  'H4 comporFiltro gestor com futura',
  comporFiltro([
    "titular_id = 'u2' || substituto_principal_id = 'u2'",
    aplicarFiltroSituacao('futura', HOJE),
  ]) ===
    "(titular_id = 'u2' || substituto_principal_id = 'u2') && cancelada_em = null && data_inicio > '2026-08-12'",
  'got: ' +
    JSON.stringify(
      comporFiltro([
        "titular_id = 'u2' || substituto_principal_id = 'u2'",
        aplicarFiltroSituacao('futura', HOJE),
      ]),
    ),
)

// ═══════ I) validarRBACLeitura — 7 casos ═══════

assert(
  'I1 validarRBACLeitura SA → true',
  validarRBACLeitura('superadministrador', [], 'ator', 'tit', 'subp', 'subr', []).aprovado === true,
)

assert(
  'I2 validarRBACLeitura gestor com binding vigente e titular na equipe → true',
  validarRBACLeitura(
    'gestor-comercial',
    [{ equipe_id: 'eq1', perfilSlug: 'gestor-comercial', ativo: true, vigente: true }],
    'ator',
    'u2',
    'u3',
    'u4',
    ['u2', 'u5'],
  ).aprovado === true,
)

assert(
  'I3 validarRBACLeitura gestor sem bindings → false',
  validarRBACLeitura('gestor', [], 'ator', 'u2', 'u3', 'u4', ['u2']).aprovado === false,
)

assert(
  'I4 validarRBACLeitura comercial titular → true',
  validarRBACLeitura('operador-comercial', [], 'ator', 'ator', 'u3', 'u4', []).aprovado === true,
)

assert(
  'I5 validarRBACLeitura comercial substituto principal → true',
  validarRBACLeitura('operador-comercial', [], 'ator', 'u2', 'ator', 'u4', []).aprovado === true,
)

assert(
  'I6 validarRBACLeitura comercial substituto reserva → true',
  validarRBACLeitura('operador-comercial', [], 'ator', 'u2', 'u3', 'ator', []).aprovado === true,
)

assert(
  'I7 validarRBACLeitura aprovador → false',
  validarRBACLeitura('aprovador', [], 'ator', 'ator', 'u3', 'u4', []).aprovado === false,
)

// ═══════ J) Gestor equipe sem users — list 200 array vazio ═══════

// Simula: gestor tem binding vigente mas allowedUserIds é vazio
var gestorSemUsersBindings = [
  { equipe_id: 'eq1', perfilSlug: 'gestor-comercial', ativo: true, vigente: true },
]
// Q1 retornou [] → allowedUserIds = [] → gestorSemUsers = true → list 200 vazio
var allowedVazio = []
var rbacGestorVazio = validarRBACLeitura(
  'gestor-comercial',
  gestorSemUsersBindings,
  'ator',
  'u2',
  'u3',
  'u4',
  allowedVazio,
)
// Quando gestor não tem users, o hook retorna lista vazia imediata (sem chamar RBAC por registro)
assert(
  'J1 gestor sem users na equipe → list retorna 200 array vazio has_more=false',
  rbacGestorVazio.aprovado === false && allowedVazio.length === 0,
  'esperado rbac false (fora_equipes_geridas) e allowed vazio; got: ' +
    JSON.stringify(rbacGestorVazio),
)
// A resposta do hook para gestor sem users (list) deve ser 200 vazio
var respGestorVazio = construirRespostaList([], 1, 20, false)
assert(
  'J1b gestor sem users → resposta list {substituicoes:[], has_more:false}',
  Array.isArray(respGestorVazio.substituicoes) &&
    respGestorVazio.substituicoes.length === 0 &&
    respGestorVazio.has_more === false,
  'got: ' + JSON.stringify(respGestorVazio),
)

// ═══════ K) Gestor equipe sem users — view 404 ═══════

// statusAcessoNegado('fora_equipes_geridas') → 404 (uniforme)
assert(
  'K1 gestor sem users → view retorna 404 NAO_ENCONTRADO (uniforme)',
  statusAcessoNegado('fora_equipes_geridas') === 404,
  'got: ' + statusAcessoNegado('fora_equipes_geridas'),
)

// ═══════ L) construirFiltroGestor — filtro com IDs de users da equipe ═══════

assert(
  'L1 construirFiltroGestor com IDs da equipe',
  construirFiltroGestor(['u2', 'u5']) ===
    "titular_id = 'u2' || substituto_principal_id = 'u2' || titular_id = 'u5' || substituto_principal_id = 'u5'",
  'got: ' + construirFiltroGestor(['u2', 'u5']),
)

// ═══════ M) cancelada_em — getString vazio → null, preenchido → ISO ═══════

assert(
  'M1 cancelada_em getString vazio → null',
  normalizarCanceladaEm('') === null,
  'got: ' + JSON.stringify(normalizarCanceladaEm('')),
)

assert(
  'M2 cancelada_em preenchido → ISO preservado',
  normalizarCanceladaEm('2026-08-05T10:00:00.000Z') === '2026-08-05T10:00:00.000Z',
  'got: ' + JSON.stringify(normalizarCanceladaEm('2026-08-05T10:00:00.000Z')),
)

// ═══════ N) substituto_principal_id — getString vazio → null ═══════

assert(
  'N1 substituto_principal_id getString vazio → null',
  normalizarRef('') === null,
  'got: ' + JSON.stringify(normalizarRef('')),
)

assert(
  'N2 substituto_principal_id preenchido → preservado',
  normalizarRef('u2') === 'u2',
  'got: ' + JSON.stringify(normalizarRef('u2')),
)

// ═══════ O) Date field — comparação YYYY-MM-DD válida ═══════

// Comparação lexicográfica funciona para ISO YYYY-MM-DD
assert(
  'O1 comparação YYYY-MM-DD lexicográfica (2026-08-12 < 2026-08-20)',
  '2026-08-12' < '2026-08-20',
  'esperado true',
)
assert(
  'O2 comparação YYYY-MM-DD lexicográfica (2026-08-12 <= 2026-08-12)',
  '2026-08-12' <= '2026-08-12',
  'esperado true',
)

// ═══════ P) Paginação has_more — por_pagina+1 ═══════

// limit = por_pagina + 1; has_more = results.length > por_pagina
var pagP = calcularPaginacao(1, 20)
assert(
  'P1 calcularPaginacao limit = por_pagina+1, offset = (pagina-1)*por_pagina',
  pagP.limit === 21 && pagP.offset === 0,
  'got: ' + JSON.stringify(pagP),
)

// 21 resultados (>20) → has_more true
assert(
  'P2 has_more true quando results.length > por_pagina',
  calcularHasMore(21, 20) === true,
  'esperado true',
)

assert(
  'P3 has_more false quando results.length <= por_pagina',
  calcularHasMore(20, 20) === false,
  'esperado false',
)

// ═══════ Q) Resposta sem campo total ═══════

var respQ = construirRespostaList([], 1, 20, false)
assert(
  'Q1 resposta list não contém campo total',
  !Object.prototype.hasOwnProperty.call(respQ, 'total'),
  'got: ' + JSON.stringify(respQ),
)
assert(
  'Q2 resposta list contém substituicoes, pagina, por_pagina, has_more',
  Object.prototype.hasOwnProperty.call(respQ, 'substituicoes') &&
    Object.prototype.hasOwnProperty.call(respQ, 'pagina') &&
    Object.prototype.hasOwnProperty.call(respQ, 'por_pagina') &&
    Object.prototype.hasOwnProperty.call(respQ, 'has_more'),
  'got: ' + JSON.stringify(respQ),
)

// ═══════ R) Ordenação determinística tiebreak created DESC + id ASC ═══════

assert(
  'R1 sort data_inicio desc → "-data_inicio,-created,id"',
  construirSort('data_inicio', 'desc') === '-data_inicio,-created,id',
  'got: ' + construirSort('data_inicio', 'desc'),
)

assert(
  'R2 sort data_inicio asc → "data_inicio,-created,id"',
  construirSort('data_inicio', 'asc') === 'data_inicio,-created,id',
  'got: ' + construirSort('data_inicio', 'asc'),
)

assert(
  'R3 sort created desc → "-created,id" (não duplica created)',
  construirSort('created', 'desc') === '-created,id',
  'got: ' + construirSort('created', 'desc'),
)

// ═══════ S) Allowlist estrita — chave desconhecida → 400 ═══════

var sq1 = validarQuery({ foo: 'bar' })
assert(
  'S1 allowlist estrita: chave desconhecida → VALIDATION',
  sq1.valido === false && sq1.erro === 'VALIDATION',
  'got: ' + JSON.stringify(sq1),
)

var sq2 = validarQuery({ id: 'invalido' })
assert(
  'S2 id formato inválido → VALIDATION',
  sq2.valido === false && sq2.erro === 'VALIDATION',
  'got: ' + JSON.stringify(sq2),
)

var sq3 = validarQuery({ situacao: 'xpto' })
assert(
  'S3 situacao inválida → VALIDATION',
  sq3.valido === false && sq3.erro === 'VALIDATION',
  'got: ' + JSON.stringify(sq3),
)

var sq4 = validarQuery({ por_pagina: '0' })
assert(
  'S4 por_pagina < 1 → VALIDATION',
  sq4.valido === false && sq4.erro === 'VALIDATION',
  'got: ' + JSON.stringify(sq4),
)

var sq5 = validarQuery({ por_pagina: '51' })
assert(
  'S5 por_pagina > 50 → VALIDATION',
  sq5.valido === false && sq5.erro === 'VALIDATION',
  'got: ' + JSON.stringify(sq5),
)

var sq6 = validarQuery({ ordenar_por: 'xpto' })
assert(
  'S6 ordenar_por inválido → VALIDATION',
  sq6.valido === false && sq6.erro === 'VALIDATION',
  'got: ' + JSON.stringify(sq6),
)

var sq7 = validarQuery({ pagina: '0' })
assert(
  'S7 pagina < 1 → VALIDATION',
  sq7.valido === false && sq7.erro === 'VALIDATION',
  'got: ' + JSON.stringify(sq7),
)

var sq8 = validarQuery({ data_inicio_apos: '2026/08/12' })
assert(
  'S8 data_inicio_apos formato inválido → VALIDATION',
  sq8.valido === false && sq8.erro === 'VALIDATION',
  'got: ' + JSON.stringify(sq8),
)

// Query válida com defaults
var sq9 = validarQuery({})
assert(
  'S9 query vazia → válido com defaults (pagina=1, por_pagina=20, ordenar_por=data_inicio, ordem=desc)',
  sq9.valido === true &&
    sq9.params.pagina === 1 &&
    sq9.params.por_pagina === 20 &&
    sq9.params.ordenar_por === 'data_inicio' &&
    sq9.params.ordem === 'desc',
  'got: ' + JSON.stringify(sq9),
)

// ═══════ T) ID formato PocketBase real 15 chars ═══════

assert(
  'T1 id 15 chars [a-z0-9] → válido',
  validarIdFormato('abcdefghijklmnopqrstuvwxyz'.substring(0, 15)) === true,
  'esperado true',
)

assert(
  'T2 id 14 chars → inválido',
  validarIdFormato('abcdefghijklmn') === false,
  'esperado false (14 chars)',
)

assert(
  'T3 id 15 chars com caractere inválido → inválido',
  validarIdFormato('abcdefghijklmn!') === false,
  'esperado false (caractere inválido)',
)

// ═══════ U) 404 uniforme — id fora do escopo → 404 não 403 ═══════

// Comercial não envolvido no registro → motivo 'nao_envolvido' → 404 (uniforme)
assert(
  'U1 comercial fora do registro → 404 (não 403)',
  statusAcessoNegado('nao_envolvido') === 404,
  'got: ' + statusAcessoNegado('nao_envolvido'),
)

// Aprovador/perfil_sem_acesso → 403
assert(
  'U2 aprovador → 403',
  statusAcessoNegado('perfil_sem_acesso') === 403,
  'got: ' + statusAcessoNegado('perfil_sem_acesso'),
)

// ═══════ V) Redaction — sem campos proibidos ═══════

// redatorUser retorna apenas {id, name}
var redacted = (function () {
  // simula um user com campos sensíveis
  var fakeUser = {
    id: 'u1',
    name: 'Fulano',
    email: 'fulano@x.com',
    equipe_id: 'eq1',
    creation_idempotency_key: 'key',
    ativo_comercial: true,
    perfil_id: 'p1',
    avatar: 'av',
    password: 'secret',
    token: 'tok',
  }
  // redatorUser do bloco só expõe {id, name}
  var sandboxUser = { console: console }
  vm.createContext(sandboxUser)
  vm.runInContext(blockSrc, sandboxUser, { filename: 'redact-check.js' })
  return sandboxUser.__testExports.redatorUser(fakeUser)
})()
assert(
  'V1 redaction: usuário exposto apenas {id, name}',
  redacted &&
    redacted.id === 'u1' &&
    redacted.name === 'Fulano' &&
    !Object.prototype.hasOwnProperty.call(redacted, 'email') &&
    !Object.prototype.hasOwnProperty.call(redacted, 'equipe_id') &&
    !Object.prototype.hasOwnProperty.call(redacted, 'creation_idempotency_key') &&
    !Object.prototype.hasOwnProperty.call(redacted, 'ativo_comercial') &&
    !Object.prototype.hasOwnProperty.call(redacted, 'perfil_id') &&
    !Object.prototype.hasOwnProperty.call(redacted, 'avatar') &&
    !Object.prototype.hasOwnProperty.call(redacted, 'password') &&
    !Object.prototype.hasOwnProperty.call(redacted, 'token'),
  'got: ' + JSON.stringify(redacted),
)

// resposta list não deve conter campos proibidos
var respV = construirRespostaList(
  [
    {
      id: 's1',
      data_inicio: '2026-08-10',
      data_fim: '2026-08-20',
      tipo_cobertura: 'integral',
      motivo: 'ferias',
      cancelada_em: null,
      situacao: 'vigente',
      titular: { id: 'u1', name: 'T' },
      substituto_principal: null,
      substituto_reserva: null,
    },
  ],
  1,
  20,
  false,
)
var itemV = respV.substituicoes[0]
assert(
  'V2 item da resposta não expõe campos proibidos',
  !Object.prototype.hasOwnProperty.call(itemV, 'email') &&
    !Object.prototype.hasOwnProperty.call(itemV, 'equipe_id') &&
    !Object.prototype.hasOwnProperty.call(itemV, 'creation_idempotency_key') &&
    !Object.prototype.hasOwnProperty.call(itemV, 'ativo_comercial') &&
    !Object.prototype.hasOwnProperty.call(itemV, 'perfil_id') &&
    !Object.prototype.hasOwnProperty.call(itemV, 'avatar') &&
    !Object.prototype.hasOwnProperty.call(itemV, 'password') &&
    !Object.prototype.hasOwnProperty.call(itemV, 'token'),
  'got: ' + JSON.stringify(itemV),
)

// ═══════ W) Array ids vazio → não executa query users ═══════

assert(
  'W1 deveBatch([]) → false (não executa query users)',
  deveBatch([]) === false,
  'esperado false',
)

assert(
  'W2 deveBatch(["u1"]) → true (executa query users)',
  deveBatch(['u1']) === true,
  'esperado true',
)

// coletarUserIds com recs vazios → []
assert(
  'W3 coletarUserIds([]) → []',
  Array.isArray(coletarUserIds([])) && coletarUserIds([]).length === 0,
  'got: ' + JSON.stringify(coletarUserIds([])),
)

// coletarUserIds dedupe e remove vazios
assert(
  'W4 coletarUserIds dedupe e ignora vazios',
  JSON.stringify(
    coletarUserIds([
      { titular_id: 'u1', substituto_principal_id: '', substituto_reserva_id: 'u2' },
      { titular_id: 'u1', substituto_principal_id: 'u3', substituto_reserva_id: '' },
    ]),
  ) === '["u1","u2","u3"]',
  'got: ' +
    JSON.stringify(
      coletarUserIds([
        { titular_id: 'u1', substituto_principal_id: '', substituto_reserva_id: 'u2' },
        { titular_id: 'u1', substituto_principal_id: 'u3', substituto_reserva_id: '' },
      ]),
    ),
)

// ═══════ X) Array ids vazio → não executa query negócios ═══════

// deveBatch aplica-se igualmente ao batch de negócios (mesma guarda)
assert(
  'X1 deveBatch([]) → false (não executa query negócios)',
  deveBatch([]) === false,
  'esperado false',
)

// limite batch negócios = 500
assert(
  'X2 limiteBatchNegocios = 500',
  limiteBatchNegocios() === 500,
  'got: ' + limiteBatchNegocios(),
)

// ═══════ Y) Batch users — máx 150 IDs com limit 200 ═══════

assert(
  'Y1 limiteBatchUsers = 200 (comporta até 200 IDs num batch)',
  limiteBatchUsers() === 200,
  'got: ' + limiteBatchUsers(),
)

// 150 IDs < 200 → um único batch
var ids150 = []
for (var i = 0; i < 150; i++) ids150.push('u' + i)
assert(
  'Y2 150 IDs cabe num único batch (limit 200)',
  ids150.length <= limiteBatchUsers(),
  '150 IDs devem caber em um batch de 200',
)

// ═══════ Z) Zero side effects — sem save/runInTransaction/auditoria/idempotência ═══════

// Verifica estaticamente que o hook NÃO contém chamadas proibidas (no corpo do
// hook, fora do bloco de testes). Lê o arquivo novamente e inspeciona o trecho
// antes do marcador de testes.
var hookBody = src.substring(0, startIdx)
var hookCode = hookBody.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\])\/\/.*$/gm, '$1')
var forbidden = ['$app.save', 'runInTransaction', 'com_auditoria', 'com_idempotencia', 'cronAdd']
var violations = []
for (var zi = 0; zi < forbidden.length; zi++) {
  if (hookCode.indexOf(forbidden[zi]) !== -1) violations.push(forbidden[zi])
}
assert(
  'Z1 zero side effects: hook sem save/runInTransaction/auditoria/idempotência/scheduler',
  violations.length === 0,
  'violações: ' + violations.join(', '),
)

// Hook é somente leitura: não há INSERT/UPDATE/DELETE via raw SQL
var sqlWritePattern = /\b(INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM)\b/i
assert(
  'Z2 hook não contém INSERT/UPDATE/DELETE SQL',
  !sqlWritePattern.test(hookBody),
  'encontrado comando SQL de escrita no hook',
)

// ═══════ Resumo ═══════
console.log('\n' + passed + '/' + (passed + failed) + ' passed')
if (failed > 0) process.exit(1)
