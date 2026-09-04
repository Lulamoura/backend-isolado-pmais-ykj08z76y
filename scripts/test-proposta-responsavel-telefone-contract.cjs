const fs = require('node:fs')
const assert = require('node:assert/strict')

const hook = fs.readFileSync('pocketbase/hooks/com_proposta_publicacao.js', 'utf8')
const page = fs.readFileSync('src/pages/PropostaPublica.tsx', 'utf8')

assert.equal(
  (
    hook.match(/var responsavelTelefone = versao\.getString\('responsavel_telefone_snapshot'\)/g) ||
    []
  ).length,
  2,
  'preflight e acesso identificado devem priorizar o snapshot',
)
assert.equal(
  (
    hook.match(/findRecordById\('users', negocioResponsavel\.getString\('responsavel_id'\)\)/g) ||
    []
  ).length,
  2,
  'as duas respostas públicas devem consultar o responsável atual somente como fallback',
)
assert.equal(
  (hook.match(/responsavel_telefone: responsavelTelefone/g) || []).length,
  2,
  'as duas respostas públicas devem devolver o telefone resolvido',
)
assert.ok(page.includes("{dados.responsavel_telefone || '—'}"))

console.log('Contrato do telefone do responsável: 4/4 verificações aprovadas.')
