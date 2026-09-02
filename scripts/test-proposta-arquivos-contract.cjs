const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const hook = fs.readFileSync(path.join(root, 'pocketbase/hooks/com_proposta_arquivos.js'), 'utf8')
const service = fs.readFileSync(path.join(root, 'src/services/propostas.ts'), 'utf8')
const page = fs.readFileSync(path.join(root, 'src/pages/Propostas.tsx'), 'utf8')

const checks = [
  ['rota de upload autenticada', hook.includes("'/backend/v1/propostas/{negocioId}/versoes'")],
  ['rota de timeline autenticada', hook.includes("'/backend/v1/propostas/{negocioId}/timeline'")],
  ['arquivo capturado no servidor', hook.includes("e.findUploadedFiles('arquivo_pdf')")],
  ['limite de 20 MB', hook.includes('20 * 1024 * 1024')],
  ['assinatura PDF validada', hook.includes("conteudo.substring(0, 5) !== '%PDF-'")],
  ['hash SHA-256 persistido', hook.includes("versao.set('arquivo_sha256', arquivoHash)")],
  ['arquivo privado persistido', hook.includes("versao.set('arquivo_pdf', arquivo)")],
  ['versao sempre incrementada', hook.includes("Number(anterior.get('numero') || 0) + 1")],
  ['versao anterior nao atualizada', !hook.includes("anterior.set('arquivo_pdf'")],
  ['idempotencia server-side', hook.includes("comando = 'criar_versao_pdf_proposta'")],
  ['auditoria criada', hook.includes("'proposta_versao_pdf_criada'")],
  ['aprovacao configuravel', hook.includes("'proposta.aprovacao_interna_obrigatoria'")],
  ['UI usa multipart', service.includes('const body = new FormData()')],
  ['UI aceita somente PDF', page.includes('accept="application/pdf,.pdf"')],
  ['UI exibe timeline', page.includes('Ver histórico')],
  ['nenhuma pagina publica', !hook.includes('/public/')],
  ['nenhum envio de email', !hook.includes('resend') && !hook.includes('sendMail')],
]

let failures = 0
for (const [name, ok] of checks) {
  if (!ok) failures++
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`)
}
console.log(`\n${checks.length - failures}/${checks.length} verificacoes aprovadas`)
if (failures) process.exit(1)
