const fs = require('fs'),
  path = require('path'),
  root = path.resolve(__dirname, '..')
const hook = fs.readFileSync(path.join(root, 'pocketbase/hooks/com_proposta_publicacao.js'), 'utf8')
const page = fs.readFileSync(path.join(root, 'src/pages/PropostaPublica.tsx'), 'utf8')
const app = fs.readFileSync(path.join(root, 'src/App.tsx'), 'utf8')
const checks = [
  [
    'publicação autenticada',
    hook.includes("'/backend/v1/propostas/{negocioId}/publicar'") &&
      hook.includes('$apis.requireAuth()'),
  ],
  ['token forte 64 caracteres', /randomStringWithAlphabet\(\s*64/.test(hook)],
  [
    'somente hash persistido',
    hook.includes("publicacao.set('token_hash', $security.sha256(token))"),
  ],
  [
    'token puro não entra em persistência',
    hook.includes("idem.set('resultado', {") && hook.includes('replay.token = null'),
  ],
  [
    'expiração configurável 1–90 dias',
    hook.includes("'proposta.link_expiracao_dias'") && hook.includes('dias > 90'),
  ],
  ['aprovação configurável', hook.includes("'proposta.aprovacao_interna_obrigatoria'")],
  ['revogação autenticada', hook.includes("'/backend/v1/propostas/{negocioId}/revogar'")],
  [
    'página pública com gate',
    hook.includes("'proposta.pagina_publica_habilitada'") && hook.includes('if (!gate($app))'),
  ],
  ['resposta genérica', hook.includes("'PROPOSTA_INDISPONIVEL'")],
  ['noindex e no-store', hook.includes('X-Robots-Tag') && hook.includes('Cache-Control')],
  ['rota pública no React', app.includes('path="/p/:token"')],
  ['estado indisponível seguro', page.includes('Proposta indisponível')],
  ['sem Resend', !hook.toLowerCase().includes('resend')],
  ['sem WhatsApp', !hook.toLowerCase().includes('whatsapp')],
]
let falhas = 0
for (const [nome, ok] of checks) {
  if (!ok) falhas++
  console.log(`${ok ? 'PASS' : 'FAIL'} ${nome}`)
}
console.log(`\n${checks.length - falhas}/${checks.length} verificacoes aprovadas`)
if (falhas) process.exit(1)
