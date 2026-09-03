const fs = require('node:fs')

const page = fs.readFileSync('src/pages/Propostas.tsx', 'utf8')
const hook = fs.readFileSync('pocketbase/hooks/com_propostas_operacao.js', 'utf8')
const service = fs.readFileSync('src/services/propostas.ts', 'utf8')

const checks = [
  ['card oferece Lançar proposta', page.includes('Lançar proposta')],
  ['card oferece Histórico', page.includes('Histórico')],
  [
    'operações usam modal',
    page.includes('<DialogContent') && page.includes("modo: 'operacao' | 'historico'"),
  ],
  ['versão usa rótulo amigável', page.includes("'PDF lançado' : 'PDF pendente'")],
  ['nome físico não aparece na interface', !page.includes('arquivo_nome')],
  ['hash não aparece na interface', !page.includes('arquivo_sha256') && !page.includes('SHA-256:')],
  ['histórico reúne acessos', page.includes('Acessos e ações do cliente')],
  ['histórico reúne envios', page.includes('<h3 className="font-medium">Envios</h3>')],
  [
    'envio e abertura são estados distintos',
    page.includes('p?.enviada_sistema') && page.includes('p.aberta'),
  ],
  [
    'backend calcula envio pelo sistema',
    hook.includes('enviadaSistema') && hook.includes("canal='email' && estado='enviado'"),
  ],
  ['cliente tipa envio pelo sistema', service.includes('enviada_sistema: boolean')],
]

let passed = 0
for (const [label, condition] of checks) {
  console.log(`${condition ? 'PASS' : 'FAIL'} ${label}`)
  if (condition) passed++
}
console.log(`\n${passed}/${checks.length} verificações aprovadas`)
if (passed !== checks.length) process.exit(1)
