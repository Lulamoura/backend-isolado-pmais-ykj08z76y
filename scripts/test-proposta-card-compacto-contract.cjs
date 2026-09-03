const fs = require('node:fs')

const page = fs.readFileSync('src/pages/Propostas.tsx', 'utf8')
const contextCard = fs.readFileSync('src/components/CommercialContextCard.tsx', 'utf8')
const hook = fs.readFileSync('pocketbase/hooks/com_propostas_operacao.js', 'utf8')
const service = fs.readFileSync('src/services/propostas.ts', 'utf8')

const checks = [
  ['card oferece Lançar proposta', page.includes('Lançar proposta')],
  ['card oferece Histórico', page.includes('Histórico')],
  [
    'card preserva Notas em modal',
    !page.includes('showNotes={false}') &&
      contextCard.includes('showNotes = true') &&
      contextCard.includes('<BusinessNotesDialog negocioId={negocioId} />'),
  ],
  [
    'operações usam modal',
    page.includes('<DialogContent') && page.includes("modo: 'operacao' | 'historico'"),
  ],
  ['versão usa rótulo amigável', page.includes("'PDF lançado' : 'PDF pendente'")],
  ['nome físico não aparece na interface', !page.includes('arquivo_nome')],
  ['hash não aparece na interface', !page.includes('arquivo_sha256') && !page.includes('SHA-256:')],
  [
    'histórico reúne acessos na linha do tempo',
    page.includes("evento.tipo === 'pagina_acessada'") && page.includes('Linha do tempo'),
  ],
  [
    'histórico reúne envios na linha do tempo',
    page.includes('...timeline.envios.map') && page.includes("tipo: 'envio'"),
  ],
  [
    'card mostra etapa comercial em vez da origem técnica',
    page.includes('Proposta em Negociação') && !page.includes('Proposta originada no CRM'),
  ],
  [
    'envio e abertura são estados distintos',
    page.includes("? 'Enviada'") && page.includes("p.aberta ? 'Aberta' : 'Não Aberta'"),
  ],
  [
    'não aberta fica vermelha somente após 24 horas do envio',
    page.includes('Date.now() - envioSistemaEm >= 24 * 60 * 60 * 1000') &&
      page.includes('border-red-200 bg-red-50 text-red-700'),
  ],
  [
    'aberta usa indicador azul',
    page.includes('border-blue-200 bg-blue-50 text-blue-700'),
  ],
  [
    'backend calcula envio pelo sistema',
    hook.includes('enviadaSistema') && hook.includes("canal='email' && estado='enviado'"),
  ],
  ['cliente tipa envio pelo sistema', service.includes('enviada_sistema: boolean')],
  [
    'backend e cliente expõem data do último envio',
    hook.includes('ultimo_envio_sistema_em: ultimoEnvioSistemaEm') &&
      service.includes('ultimo_envio_sistema_em: string | null'),
  ],
]

let passed = 0
for (const [label, condition] of checks) {
  console.log(`${condition ? 'PASS' : 'FAIL'} ${label}`)
  if (condition) passed++
}
console.log(`\n${passed}/${checks.length} verificações aprovadas`)
if (passed !== checks.length) process.exit(1)
