const fs = require('fs')
const path = require('path')
const root = path.join(__dirname, '..')
const hook = fs.readFileSync(path.join(root, 'pocketbase/hooks/com_proposta_publicacao.js'), 'utf8')
const timeline = fs.readFileSync(
  path.join(root, 'pocketbase/hooks/com_proposta_arquivos.js'),
  'utf8',
)
const page = fs.readFileSync(path.join(root, 'src/pages/PropostaPublica.tsx'), 'utf8')
const service = fs.readFileSync(path.join(root, 'src/services/propostas.ts'), 'utf8')

const checks = [
  ['acesso público registrado', hook.includes("evento.set('tipo', 'pagina_acessada')")],
  ['acesso idempotente em janela', hook.includes("pub.id + ':pagina_acessada:'")],
  ['contadores de acesso atualizados no servidor', hook.includes("propostaTx.set('total_acessos'")],
  ['rota de PDF controlada', hook.includes("'/backend/v1/public/propostas/{token}/pdf'")],
  [
    'PDF servido do armazenamento privado',
    hook.includes('$app.newFilesystem()') && hook.includes('versao.baseFilesPath()'),
  ],
  ['download auditado', hook.includes("evento.set('tipo', 'pdf_baixado')")],
  [
    'contador de download atualizado no servidor',
    hook.includes("propostaTx.set('total_downloads'"),
  ],
  ['rota pública de decisão', hook.includes("'/backend/v1/public/propostas/{token}/decisao'")],
  ['aceite ou recusa somente', hook.includes("decisao !== 'aceita' && decisao !== 'recusada'")],
  ['recusa exige motivo', hook.includes("decisao === 'recusada' && motivo.length < 5")],
  ['decisão idempotente', hook.includes("pub.id + ':decisao:' + comandoId")],
  ['decisão terminal protegida', hook.includes("throw new Error('JA_DECIDIDA:' + atual)")],
  [
    'eventos terminais distintos',
    hook.includes("'aceite_confirmado'") && hook.includes("'recusa_confirmada'"),
  ],
  ['token forte validado nas seis rotas', (hook.match(/token\.length !== 64/g) || []).length === 6],
  [
    'gate público nas seis rotas',
    (hook.match(/if \(!gate\(\$app\)\) return indisponivel\(\)/g) || []).length === 6,
  ],
  [
    'resposta pública sem cache e sem indexação',
    hook.includes("'Cache-Control', 'no-store'") &&
      hook.includes("'X-Robots-Tag', 'noindex, nofollow, noarchive'"),
  ],
  [
    'timeline interna agrega eventos públicos',
    timeline.includes('eventos_publicos: eventosPublicos'),
  ],
  [
    'serviço tipa métricas públicas',
    service.includes('total_acessos: number') && service.includes('total_downloads: number'),
  ],
  ['UI oferece download', page.includes('Baixar proposta em PDF')],
  [
    'UI oferece aceite e recusa',
    page.includes('Aceitar proposta') && page.includes('Recusar proposta'),
  ],
  ['UI não envia e-mail ou WhatsApp', !page.includes('Resend') && !page.includes('WhatsApp')],
]

let failed = 0
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`)
  if (!ok) failed++
}
console.log(`\n${checks.length - failed}/${checks.length} verificacoes aprovadas`)
if (failed) process.exit(1)
