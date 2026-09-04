const fs = require('node:fs')
const assert = require('node:assert/strict')

const page = fs.readFileSync('src/pages/Propostas.tsx', 'utf8')
const service = fs.readFileSync('src/services/propostas.ts', 'utf8')
const publicPage = fs.readFileSync('src/pages/PropostaPublica.tsx', 'utf8')
const hook = fs.readFileSync('pocketbase/hooks/com_propostas_operacao.js', 'utf8')
const migration = fs.readFileSync(
  'pocketbase/migrations/202609041755_proposta_mensagem_email_rascunho.js',
  'utf8',
)

assert.ok(fs.existsSync('public/proposta-banner.jpg'), 'banner global deve existir')
assert.ok(publicPage.includes('src="/proposta-banner.jpg"'), 'página pública deve exibir banner')
assert.ok(service.includes('/mensagem-email'), 'serviço deve expor gravação da mensagem')
assert.ok(page.includes('salvarMensagemEmailProposta(negocioId, mensagem)'))
assert.ok(page.includes('item.proposta?.mensagem_email_rascunho'))
assert.ok(page.includes('onBlur={() => void gravarMensagemAgora(item)}'))
assert.ok(hook.includes("proposta.set('mensagem_email_rascunho', mensagem)"))
assert.ok(migration.includes("new TextField({ name: 'mensagem_email_rascunho'"))

for (const campo of ['destinatario', 'cc', 'reply_to', 'assunto']) {
  assert.ok(
    !hook.includes(`proposta.set('${campo}'`),
    `${campo} não pode ser persistido como rascunho da proposta`,
  )
}

console.log('Contrato de banner e mensagem persistente: 10/10 verificações aprovadas.')
