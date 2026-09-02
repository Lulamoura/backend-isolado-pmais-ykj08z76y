const fs = require('fs')
const hook = fs.readFileSync('pocketbase/hooks/com_proposta_envios.js', 'utf8')
const timeline = fs.readFileSync('pocketbase/hooks/com_proposta_arquivos.js', 'utf8')
const service = fs.readFileSync('src/services/propostas.ts', 'utf8')
const checks = [
  ['duas rotas autenticadas', hook.includes('/enviar-email') && hook.includes('/preparar-whatsapp') && (hook.match(/\$apis\.requireAuth\(\)/g) || []).length === 2],
  ['gate antes do segredo e HTTP', hook.indexOf("proposta.email_habilitado") < hook.indexOf("$secrets.get('RESEND_API_KEY')") && hook.indexOf("proposta.email_habilitado") < hook.indexOf('$http.send')],
  ['Resend backend only', hook.includes('https://api.resend.com/emails') && !service.includes('RESEND_API_KEY')],
  ['Resend com User-Agent obrigatório', hook.includes("'User-Agent': 'PMais-Comercial/1.0'")],
  ['idempotência provider', hook.includes("'Idempotency-Key': chave") && hook.includes('command_idempotency_key')],
  ['reply-to e remetente corporativo verificado', hook.includes('reply_to: replyTo') && hook.includes('nao-responda@pmaisservicos.com.br')],
  ['PDF não anexado', !hook.includes('attachments') && hook.includes('Acessar proposta')],
  ['token não persiste no snapshot', hook.includes('[LINK_SEGURO_NAO_PERSISTIDO]') && !hook.includes("mensagem_snapshot', mensagem)" )],
  ['WhatsApp somente assistido', hook.includes('https://wa.me/') && !hook.includes('graph.facebook.com')],
  ['timeline inclui envios', timeline.includes('enviosRows') && timeline.includes('envios: envios')],
  ['frontend possui clientes', service.includes('enviarPropostaPorEmail') && service.includes('prepararPropostaWhatsApp')],
]
let passed = 0
for (const [name, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); if (ok) passed++ }
console.log(`\n${passed}/${checks.length} verificações aprovadas`)
if (passed !== checks.length) process.exit(1)
