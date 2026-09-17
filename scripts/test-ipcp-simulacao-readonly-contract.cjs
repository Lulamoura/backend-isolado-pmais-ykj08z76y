const fs = require('node:fs')
const path = require('node:path')

const hookPath = path.join(__dirname, '..', 'pocketbase', 'hooks', 'com_ipcp_diario.js')
const source = fs.readFileSync(hookPath, 'utf8')

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`)
    process.exit(1)
  }
}

assert(source.includes("modo: 'simulacao'"), 'simulação deve declarar modo próprio')
assert(source.includes('incluir_evidencias'), 'simulação deve aceitar evidências resumidas opcionais')
assert(source.includes('colecao_snapshot_criada: false'), 'simulação não deve criar coleção snapshot')
assert(source.includes('gravacao_snapshot_realizada: false'), 'simulação não deve gravar snapshot')
assert(source.includes('job_automatico_ativo: false'), 'simulação não deve ativar job automático')
assert(source.includes('function canViewTeam'), 'simulação deve resolver escopo no backend')
assert(source.includes('function canViewAll'), 'simulação deve limitar escopo todos no backend')
assert(source.includes("requestedScope === 'equipe'"), 'deve suportar escopo equipe com permissão')
assert(source.includes("requestedScope === 'todos'"), 'deve suportar escopo todos com permissão')
assert(!/^function ipcp/m.test(source), 'hook não deve depender de funções top-level no JSVM do PocketBase')
assert(!/com_ipcp_snapshots/.test(source), 'hook de simulação não deve depender da coleção futura')
assert(!/\$app\.save\s*\(/.test(source), 'simulação não pode usar $app.save')
assert(!/\.save\s*\(/.test(source), 'simulação não pode usar save')
assert(!/\$app\.delete\s*\(/.test(source), 'simulação não pode usar $app.delete')
assert(!/\.delete\s*\(/.test(source), 'simulação não pode usar delete')
assert(!/routerAdd\('POST', '\/backend\/v1\/ipcp\//.test(source), 'IPCP não deve expor POST nesta fase')

console.log('OK: contrato IPCP simulacao read-only protegido')
