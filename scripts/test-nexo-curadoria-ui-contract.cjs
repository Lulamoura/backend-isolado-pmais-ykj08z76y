const fs = require('fs')
const assert = require('assert')

const layout = fs.readFileSync('src/components/Layout.tsx', 'utf8')
const app = fs.readFileSync('src/App.tsx', 'utf8')
const navigation = fs.readFileSync('src/lib/navigation.ts', 'utf8')
const packageJson = fs.readFileSync('package.json', 'utf8')

assert.match(navigation, /Curadoria Nexo/, 'menu principal deve declarar Curadoria Nexo')
assert.match(navigation, /\/nexo\/curadoria/, 'menu deve apontar para /nexo/curadoria')
assert.match(navigation, /MessageSquareText|MessagesSquare|BookOpenCheck/, 'menu deve usar ícone próprio de curadoria')

assert.match(layout, /CURADORIA_NEXO_ALLOWLIST/, 'Layout deve ter allowlist explícita para curadoria')
assert.match(layout, /podeVerCuradoriaNexo/, 'Layout deve calcular visibilidade do canal de curadoria')
assert.match(layout, /curadoriaNexoPendencias/, 'Layout deve expor indicador de pendências da curadoria')
assert.match(layout, /aria-label=\{`Curadoria Nexo: \$\{curadoriaNexoPendencias\} pendência\(s\) para tratar`\}/, 'indicador deve ser acessível e explicar pendências')
assert.match(layout, /item\.path === '\/nexo\/curadoria'/, 'indicador deve estar preso ao item Curadoria Nexo')

assert.match(app, /NexoCuradoria/, 'App deve importar a página NexoCuradoria')
assert.match(app, /path="\/nexo\/curadoria"/, 'App deve registrar rota exclusiva de curadoria')
assert.match(app, /NexoCuradoriaRoute/, 'rota deve ter gate específico para usuários habilitados')

const pagePath = 'src/pages/NexoCuradoria.tsx'
assert.ok(fs.existsSync(pagePath), 'deve existir página NexoCuradoria')
const page = fs.readFileSync(pagePath, 'utf8')
assert.match(page, /Iniciar curadoria/, 'página deve ter botão para iniciar curadoria')
assert.match(page, /entrevista guiada/i, 'página deve explicar que é entrevista guiada')
assert.match(page, /não grava direto no segundo cérebro/i, 'página deve deixar claro que não promove direto')
assert.match(page, /Aguardando curadoria/, 'página deve listar pendências de curadoria')
assert.doesNotMatch(page, /Digite aqui qualquer coisa para treinar o Nexo/i, 'página não pode incentivar canal livre sem padrão')

assert.match(packageJson, /test-nexo-curadoria-ui-contract\.cjs/, 'npm test deve encadear contrato da curadoria Nexo')

console.log('nexo-curadoria-ui contract: PASS')
