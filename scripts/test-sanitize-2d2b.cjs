#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────
// Teste da sanitizadora — Porta 2D.2B — G30 (v0.0.170)
// ─────────────────────────────────────────────────────────────────────
// Lê pocketbase/hooks/ac_run_round_2d2b.js, extrai o bloco REAL de
// produção delimitado EXCLUSIVAMENTE por dois marcadores textuais
// (dois indexOf) e avalia o bloco completo em sandbox local (node:vm).
// NÃO interpreta a função caractere a caractere (zero fnDecl, fnIdx,
// braceIdx, depth, inStr, strCh, fnEnd e zero loop de análise
// estrutural do fonte). NÃO copia nenhuma função —
// SENSITIVE_KEY_PATTERN, $findBalancedBraceEnd, $findPemBlockEnd e
// sanitizePersistErrorMessage são avaliados a partir do fonte de
// produção extraído textualmente.
//
// Marcadores textuais (indexOf):
//   início — primeira ocorrência de `var SENSITIVE_KEY_PATTERN`;
//   fim    — ocorrência, após startIdx, do marcador textual único
//            formado pelo comentário separador `/* ────...` seguido do
//            título `G26 — TESTES ESTÁTICOS DA SANITIZADORA`.
//
// Execute: node scripts/test-sanitize-2d2b.cjs
// ─────────────────────────────────────────────────────────────────────
'use strict'

var fs = require('fs')
var path = require('path')
var vm = require('vm')

var hookPath = path.join(__dirname, '..', 'pocketbase', 'hooks', 'ac_run_round_2d2b.js')
var src = fs.readFileSync(hookPath, 'utf8')

// ─── Extrai o bloco REAL de produção EXCLUSIVAMENTE por dois
//     marcadores textuais (dois indexOf). Não procura declaração,
//     abre-chaves ou fecha-chaves de nenhuma função. ───
// Início: primeira ocorrência de `var SENSITIVE_KEY_PATTERN`.
var startMarker = 'var SENSITIVE_KEY_PATTERN'
var startIdx = src.indexOf(startMarker)
if (startIdx === -1) {
  console.error(
    'FAIL: marcador de início `var SENSITIVE_KEY_PATTERN` não encontrado no hook de produção',
  )
  process.exit(1)
}
// Fim: marcador textual único formado pelo comentário separador
// `/* ────...` seguido da linha do título
// `G26 — TESTES ESTÁTICOS DA SANITIZADORA` — inequívoco e estável.
// Calculado diretamente com src.indexOf(endMarker, startIdx).
// O comentário real possui 63 caracteres `─`; construído com .repeat(63)
// para impedir nova contagem visual incorreta do literal.
var endMarker = '/* ' + '─'.repeat(63) + '\n     * G26 — TESTES ESTÁTICOS DA SANITIZADORA'
var endIdx = src.indexOf(endMarker, startIdx)
if (endIdx === -1) {
  console.error(
    'FAIL: marcador de fim `/* ───... G26 — TESTES ESTÁTICOS DA SANITIZADORA` não encontrado após o marcador de início',
  )
  process.exit(1)
}

// Bloco textual completo entre os marcadores: contém SENSITIVE_KEY_PATTERN,
// $findBalancedBraceEnd, $findPemBlockEnd e sanitizePersistErrorMessage.
var blockSrc = src.substring(startIdx, endIdx)

// ─── Verificações fail-closed antes de avaliar o bloco ───
// Garantem que o trecho extraído contém as três funções esperadas e que
// endIdx > startIdx. Zero parser estrutural, zero loop sobre o fonte.
if (!(endIdx > startIdx)) {
  console.error('FAIL: endIdx não é maior que startIdx (bloco vazio ou invertido)')
  process.exit(1)
}
if (blockSrc.indexOf('function $findBalancedBraceEnd') === -1) {
  console.error('FAIL: blockSrc não contém `function $findBalancedBraceEnd`')
  process.exit(1)
}
if (blockSrc.indexOf('function $findPemBlockEnd') === -1) {
  console.error('FAIL: blockSrc não contém `function $findPemBlockEnd`')
  process.exit(1)
}
if (blockSrc.indexOf('function sanitizePersistErrorMessage') === -1) {
  console.error('FAIL: blockSrc não contém `function sanitizePersistErrorMessage`')
  process.exit(1)
}

// ─── Sandbox: avalia o bloco completo extraído do hook ───
var sandbox = { console: console }
vm.createContext(sandbox)
vm.runInContext(blockSrc, sandbox, { filename: 'extracted-sanitizer-block.js' })
var sanitize = sandbox.sanitizePersistErrorMessage
if (typeof sanitize !== 'function') {
  console.error('FAIL: sanitizePersistErrorMessage não é função após eval do bloco extraído')
  process.exit(1)
}

// ─── Casos de teste ───
// `expect`  → saída literal exata.
// `noLeak`  → lista de fragmentos que NÃO podem aparecer na saída.
// `has`     → lista de fragmentos que DEVEM aparecer na saída.
var tests = [
  // ── 16 casos existentes (G26) ──
  { input: 'headers: {"Cookie":"session=ULTRASECRET"}', expect: 'headers: [REDACTED]' },
  { input: 'Authorization: Basic dXNlcjpwYXNz', expect: 'Authorization: Basic [REDACTED]' },
  { input: 'password: abc def ghi', expect: 'password: [REDACTED]' },
  {
    input: 'private_key: -----BEGIN PRIVATE KEY----- ABC DEF',
    expect: 'private_key: [REDACTED]',
  },
  { input: 'x-api-key: key value with spaces', expect: 'x-api-key: [REDACTED]' },
  { input: 'password=segredo123', expect: 'password=[REDACTED]' },
  { input: 'token: abc.def.ghi', expect: 'token: [REDACTED]' },
  {
    input: 'Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0',
    expect: 'Authorization: Bearer [REDACTED]',
  },
  {
    input: '{"private_key":"CHAVE_PRIVADA_SECRETA"}',
    expect: '{"private_key":"[REDACTED]"}',
  },
  { input: 'client-secret=valor-super-secreto', expect: 'client-secret=[REDACTED]' },
  {
    input: 'https://usuario:senha@host.interno/caminho?token=abc',
    expect: '[REDACTED_URL]',
  },
  { input: 'email: joao@example.com enviado', expect: 'email: [REDACTED] enviado' },
  { input: 'tel: +55 11 99999-9999', expect: 'tel: [REDACTED]' },
  { input: 'api_key=sk-abc123-def456', expect: 'api_key=[REDACTED]' },
  { input: 'access_token: xyz.789', expect: 'access_token: [REDACTED]' },
  {
    input: '"headers":{"Authorization":"Bearer xyz","Cookie":"s=secret"}',
    expect: '"headers":[REDACTED]',
  },
  // ── Casos obrigatórios G27 ──
  // headers aninhados com Cookie secreto (objeto com valor string contendo
  // chaves escapadas — balanceamento real, não [^}]*).
  {
    input: '{"headers":{"Cookie":"session=ULTRASECRET","X":"{\\"nested\\":true}"}}',
    expect: '{"headers":[REDACTED]}',
    noLeak: ['ULTRASECRET', 'session', 'nested'],
  },
  // PEM completo multilinha.
  {
    input:
      '-----BEGIN PRIVATE KEY-----\nMIIBVwIBADANBgkqhkiG9w0BAQEFAASCAUEw\n-----END PRIVATE KEY-----',
    expect: '[REDACTED]',
    noLeak: ['MIIBVwIBADAN', 'BEGIN', 'END', 'PRIVATE'],
  },
  // PEM sem END — fail-closed: remove todo o restante da mensagem.
  {
    input: '-----BEGIN PRIVATE KEY-----\nMIIBVwIBADAN\nno end here',
    expect: '[REDACTED]',
    noLeak: ['MIIBVwIBADAN', 'no end here', 'BEGIN', 'PRIVATE'],
  },
  // Authorization Basic com valor contendo espaços.
  {
    input: 'Authorization: Basic dXNlcjpwYXNz with spaces',
    expect: 'Authorization: Basic [REDACTED]',
    noLeak: ['dXNlcjpwYXNz', 'with spaces'],
  },
  // Authorization Bearer com valor contendo espaços.
  {
    input: 'Authorization: Bearer eyJhbGciOiJIUzI1NiJ9 with spaces here',
    expect: 'Authorization: Bearer [REDACTED]',
    noLeak: ['eyJhbGciOiJIUzI1NiJ9', 'with spaces here'],
  },
  // Confirmação de saída sem fragmentos residuais (colchete/secret/suffix).
  // `[REDACTED]` simples NÃO é vazamento — é a própria sanitização
  // funcionando. `noLeak` contém apenas fragmentos realmente secretos/
  // residuais: `ABCDEF`, `suffix`, `tail` e `[REDACTED]]` (colchete duplo).
  {
    input: 'secret=ABCDEF secret suffix tail',
    expect: 'secret=[REDACTED]',
    noLeak: ['ABCDEF', 'suffix', 'tail', '[REDACTED]]'],
    has: ['secret=[REDACTED]'],
  },
]

// ─── Runner ───
var passed = 0
var failed = 0
tests.forEach(function (t, i) {
  var result = sanitize(t.input)
  var ok = true
  var reasons = []
  if (t.expect !== undefined && result !== t.expect) {
    ok = false
    reasons.push('saída divergente do esperado')
  }
  if (t.noLeak) {
    t.noLeak.forEach(function (frag) {
      if (result.indexOf(frag) !== -1) {
        ok = false
        reasons.push('vazou fragmento: ' + JSON.stringify(frag))
      }
    })
  }
  if (t.has) {
    t.has.forEach(function (frag) {
      if (result.indexOf(frag) === -1) {
        ok = false
        reasons.push('ausente fragmento: ' + JSON.stringify(frag))
      }
    })
  }
  // Verificação global: nenhum colchete residual duplicado.
  if (/\[REDACTED\]\]/.test(result) || /\[REDACTED_URL\]\]/.test(result)) {
    ok = false
    reasons.push('colchete residual duplicado')
  }
  if (ok) {
    passed++
    console.log(
      'TEST ' + (i + 1) + ' PASS: ' + JSON.stringify(t.input) + ' → ' + JSON.stringify(result),
    )
  } else {
    failed++
    console.log('TEST ' + (i + 1) + ' FAIL: ' + JSON.stringify(t.input))
    console.log('  reasons:  ' + reasons.join('; '))
    if (t.expect !== undefined) console.log('  expected: ' + JSON.stringify(t.expect))
    console.log('  got:      ' + JSON.stringify(result))
  }
})

console.log('\n' + passed + '/' + (passed + failed) + ' passed')
if (failed > 0) process.exit(1)
