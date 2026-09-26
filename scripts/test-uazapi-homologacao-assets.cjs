const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const { payloads, summary } = require('./uazapi-simulated-payloads.cjs')
const pacote = fs.readFileSync(
  path.join(root, 'docs/uazapi/PACOTE-SIMULACAO-WHATSAPP-COMERCIAL.md'),
  'utf8',
)
const roteiro = fs.readFileSync(
  path.join(root, 'docs/uazapi/ROTEIRO-HOMOLOGACAO-WHATSAPP-COMERCIAL.md'),
  'utf8',
)

function assert(name, cond, detail = '') {
  if (!cond) {
    console.error(`FAIL ${name}${detail ? ` — ${detail}` : ''}`)
    process.exit(1)
  }
  console.log(`OK ${name}`)
}

assert('simulação possui oito cenários', payloads.length === 8, String(payloads.length))
assert('inclui mensagem recebida privada', payloads.some((p) => p.message?.fromMe === false && p.message?.isGroup === false && p.message?.mediaType === 'text'))
assert('inclui mensagem enviada pela operadora', payloads.some((p) => p.message?.fromMe === true && p.message?.isGroup === false))
assert('inclui áudio por AudioMessage', payloads.some((p) => p.message?.messageType === 'AudioMessage' && String(p.message?.content?.mimetype || '').includes('audio/')))
assert('inclui imagem', payloads.some((p) => p.message?.messageType === 'ImageMessage'))
assert('inclui documento', payloads.some((p) => p.message?.messageType === 'DocumentMessage'))
assert('inclui grupo para bloqueio', payloads.some((p) => p.message?.isGroup === true))
assert('inclui status/update', payloads.some((p) => p.EventType === 'messages_update'))
assert('não inclui token real', !JSON.stringify(payloads).match(/eyJ|sk-|ghp_|admintoken/i))
assert('sumário executa', Array.isArray(summary()) && summary().length === payloads.length)

assert('pacote documenta cenários simulados', pacote.includes('Mensagem recebida') && pacote.includes('Mensagem enviada'))
assert('pacote preserva grupo bloqueado', pacote.includes('Grupo deve continuar fora'))
assert('roteiro protege Produção', roteiro.includes('Manter Produção fora do teste'))
assert('roteiro exige tela na Administração', roteiro.includes('tela **WhatsApp Comercial** está restrito à Administração'))
assert('roteiro mantém sem envio automático', roteiro.includes('não há envio automático'))
assert('roteiro lista critérios de aprovação', roteiro.includes('Critérios de aprovação da etapa'))

console.log('Ativos de homologação Uazapi validados')
