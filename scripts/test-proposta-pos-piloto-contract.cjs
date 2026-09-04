const fs = require('fs')

const migration = fs.readFileSync(
  'pocketbase/migrations/202609031900_proposta_visitante_pdf_inline.js',
  'utf8',
)
const publication = fs.readFileSync('pocketbase/hooks/com_proposta_publicacao.js', 'utf8')
const controls = fs.readFileSync('pocketbase/hooks/com_proposta_runtime_controls.js', 'utf8')
const operation = fs.readFileSync('pocketbase/hooks/com_propostas_operacao.js', 'utf8')
const timeline = fs.readFileSync('pocketbase/hooks/com_proposta_arquivos.js', 'utf8')
const publicPage = fs.readFileSync('src/pages/PropostaPublica.tsx', 'utf8')
const internalPage = fs.readFileSync('src/pages/Propostas.tsx', 'utf8')
const service = fs.readFileSync('src/services/propostas.ts', 'utf8')

const checks = [
  [
    'parâmetro nasce obrigatório',
    migration.includes("'proposta.identificacao_visitante_obrigatoria'") &&
      migration.includes("parametro.set('valor', 'true')"),
  ],
  [
    'nome e visualização possuem schema aditivo',
    migration.includes("name: 'visitante_nome'") && migration.includes("'pdf_visualizado'"),
  ],
  [
    'controle é restrito a SuperAdministrador',
    controls.includes("'/backend/v1/propostas/configuracao/identificacao'") &&
      controls.includes("perfil !== 'superadministrador'"),
  ],
  [
    'página exige identificação sem expor nome em URL',
    publication.includes("'/backend/v1/public/propostas/{token}/acessar'") &&
      publication.includes('body.visitante_nome') &&
      !publication.includes('visitante_nome='),
  ],
  [
    'acesso é idempotente por carregamento',
    publication.includes("pub.id + ':pagina_acessada:' + acessoId"),
  ],
  [
    'visualização inline e evento são separados do download',
    publication.includes("'/backend/v1/public/propostas/{token}/pdf/visualizar'") &&
      publication.includes("'/backend/v1/public/propostas/{token}/visualizacao'") &&
      publication.includes("evento.set('tipo', 'pdf_visualizado')"),
  ],
  [
    'timeline expõe nome informado',
    timeline.includes('visitante_nome:') && service.includes('visitante_nome: string | null'),
  ],
  [
    'fila calcula abertura da publicação vigente',
    operation.includes('primeiro_acesso_publicacao_em') && service.includes('aberta: boolean'),
  ],
  [
    'UI reutiliza nome por publicação no navegador',
    publicPage.includes('localStorage') && publicPage.includes('visitanteNome'),
  ],
  [
    'UI móvel renderiza todas as páginas por rolagem e preserva o iframe no computador',
    publicPage.includes('Visualização da proposta em PDF') &&
      publicPage.includes('Baixar proposta em PDF') &&
      publicPage.includes('<iframe') &&
      publicPage.includes('MobilePdfPages') &&
      publicPage.includes('getDocument({ data: new Uint8Array(arquivo)') &&
      publicPage.includes('pagina.render({') &&
      publicPage.includes('h-[68vh]') &&
      publicPage.includes('overflow-y-auto') &&
      publicPage.includes('Página {Math.min(paginaAtual') &&
      publicPage.includes("window.matchMedia('(max-width: 639px)')") &&
      publicPage.includes('visualizacaoMovel ? ('),
  ],
  [
    'modelo operacional completo de envio foi preservado',
    internalPage.includes('Publicar e enviar por e-mail') &&
      internalPage.includes('Somente publicar') &&
      /Copiar mensagem para\s+WhatsApp/.test(internalPage) &&
      internalPage.includes('Com cópia (Cc)') &&
      internalPage.includes('Responder para') &&
      internalPage.includes('[LINK_PROPOSTA]'),
  ],
  [
    'destinatário prioriza o e-mail do contato e continua editável',
    internalPage.includes("item.contexto.contato?.email || item.proposta?.destinatario || ''") &&
      internalPage.includes('destinosEmail[item.negocio.id] ?? destinatarioPadrao(item)') &&
      internalPage.includes('setDestinosEmail'),
  ],
  ['card usa indicador binário', internalPage.includes("p.aberta ? 'Aberta' : 'Não Aberta'")],
  [
    'nova terminologia visível',
    internalPage.includes('Lançar proposta') && !internalPage.includes('Preparar proposta'),
  ],
]

let passed = 0
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`)
  if (ok) passed++
}
console.log(`\n${passed}/${checks.length} verificações aprovadas`)
if (passed !== checks.length) process.exit(1)
