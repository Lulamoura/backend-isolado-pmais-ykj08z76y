const fs = require('fs')

const page = fs.readFileSync('src/pages/Propostas.tsx', 'utf8')
const service = fs.readFileSync('src/services/propostas.ts', 'utf8')
const hook = fs.readFileSync('pocketbase/hooks/com_propostas_operacao.js', 'utf8')

const checks = [
  [
    'preparação usa valor sincronizado do ActiveCampaign',
    page.includes('body.valor_total_centavos = item.contexto.valor_centavos') &&
      hook.includes("versao.set('valor_total_centavos', valorNegocioCentavos)"),
  ],
  [
    'botão não depende de conversão de texto monetário',
    !page.includes('disabled={!Number(valores[item.negocio.id])}'),
  ],
  [
    'preparação valida valor e modalidade sincronizados',
    page.includes('item.contexto.valor_centavos <= 0 || !item.contexto.modalidade'),
  ],
  ['campo redundante de valor foi removido', !page.includes("? 'Valor total em reais'")],
  [
    'valor sincronizado fica identificado para conferência',
    page.includes('sincronizado do') && page.includes('ActiveCampaign'),
  ],
  [
    'backend expõe configuração de aprovação',
    hook.includes('aprovacao_interna_obrigatoria: aprovacaoInternaObrigatoria($app)'),
  ],
  [
    'cliente tipa configuração de aprovação',
    service.includes('aprovacao_interna_obrigatoria: boolean'),
  ],
  [
    'aprovação só aparece quando obrigatória',
    page.includes('!p.aprovada && aprovacaoObrigatoria') &&
      page.includes('p.aprovada && aprovacaoObrigatoria'),
  ],
  [
    'fluxo de publicação é explicado na tela',
    page.includes('Crie a versão privada do PDF') && page.includes('gere o link'),
  ],
  [
    'link só pode ser gerado depois do PDF',
    page.includes('disabled={!p.pdf_disponivel}') &&
      hook.includes('pdf_disponivel:') &&
      service.includes('pdf_disponivel: boolean'),
  ],
]

let passed = 0
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`)
  if (ok) passed++
}
console.log(`\n${passed}/${checks.length} verificações aprovadas`)
if (passed !== checks.length) process.exit(1)
