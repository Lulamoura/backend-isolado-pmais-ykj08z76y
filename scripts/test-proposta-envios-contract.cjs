const fs = require('fs')
const hook = fs.readFileSync('pocketbase/hooks/com_proposta_envios.js', 'utf8')
const timeline = fs.readFileSync('pocketbase/hooks/com_proposta_arquivos.js', 'utf8')
const service = fs.readFileSync('src/services/propostas.ts', 'utf8')
const checks = [
  [
    'duas rotas autenticadas',
    hook.includes('/enviar-email') &&
      hook.includes('/preparar-whatsapp') &&
      (hook.match(/\$apis\.requireAuth\(\)/g) || []).length === 2,
  ],
  [
    'gate antes do segredo e HTTP',
    hook.indexOf('proposta.email_habilitado') < hook.indexOf("$secrets.get('RESEND_API_KEY')") &&
      hook.indexOf('proposta.email_habilitado') < hook.indexOf('$http.send'),
  ],
  [
    'Resend backend only',
    hook.includes('https://api.resend.com/emails') && !service.includes('RESEND_API_KEY'),
  ],
  ['Resend com User-Agent obrigatório', hook.includes("'User-Agent': 'PMais-Comercial/1.0'")],
  [
    'idempotência provider',
    hook.includes("'Idempotency-Key': chave") && hook.includes('command_idempotency_key'),
  ],
  [
    'remetente do envio comercial é o usuário logado, não o padrão GV/no-reply',
    hook.includes('function emailUsuarioComercial') &&
      hook.includes('function formatarFromUsuarioComercial') &&
      hook.includes('var from = formatarFromUsuarioComercial(ator)') &&
      hook.includes('from: from') &&
      !hook.includes("from: 'PMais Serviços <nao-responda@pmaisservicos.com.br>'"),
  ],
  [
    'reply-to usa o e-mail do usuário logado e cópia operacional continua preservada',
    hook.includes('reply_to: replyTo') &&
      hook.includes('var replyTo = emailUsuarioComercial(ator)') &&
      hook.includes('cc: cc'),
  ],
  [
    'PDF não anexado',
    !hook.includes('attachments') &&
      (hook.includes('Acessar proposta') || hook.includes('Visualizar proposta')),
  ],
  [
    'composição completa e cópia',
    hook.includes('body.cc') &&
      hook.includes('body.assunto') &&
      hook.includes('body.corpo') &&
      hook.includes('cc: cc'),
  ],
  [
    'HTML preserva parágrafos e quebras de linha sem depender de white-space',
    hook.includes('.split(/\\n{2,}/)') &&
      hook.includes("paragrafo.replace(/\\n/g, '<br>')") &&
      hook.includes('<p style="margin:0 0 16px 0">') &&
      !hook.includes('white-space:pre-wrap'),
  ],
  [
    'token não persiste no snapshot',
    hook.includes('[LINK_SEGURO_NAO_PERSISTIDO]') &&
      !hook.includes("mensagem_snapshot', mensagem)"),
  ],
  [
    'WhatsApp somente assistido',
    hook.includes('https://wa.me/') && !hook.includes('graph.facebook.com'),
  ],
  [
    'timeline inclui envios',
    timeline.includes('enviosRows') && timeline.includes('envios: envios'),
  ],
  [
    'frontend possui clientes',
    service.includes('enviarPropostaPorEmail') && service.includes('prepararPropostaWhatsApp'),
  ],
]
let passed = 0
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`)
  if (ok) passed++
}
console.log(`\n${passed}/${checks.length} verificações aprovadas`)
if (passed !== checks.length) process.exit(1)
