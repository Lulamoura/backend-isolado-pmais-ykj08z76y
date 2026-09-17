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

const simulacaoGetSource = source.split("routerAdd('POST', '/backend/v1/ipcp/snapshots/simulado'")[0]

assert(simulacaoGetSource.includes("modo: 'simulacao'"), 'simulação deve declarar modo próprio')
assert(simulacaoGetSource.includes('incluir_evidencias'), 'simulação deve aceitar evidências resumidas opcionais')
assert(simulacaoGetSource.includes('colecao_snapshot_criada: false'), 'simulação GET não deve criar coleção snapshot')
assert(simulacaoGetSource.includes('gravacao_snapshot_realizada: false'), 'simulação GET não deve gravar snapshot')
assert(simulacaoGetSource.includes('job_automatico_ativo: false'), 'simulação GET não deve ativar job automático')
assert(simulacaoGetSource.includes('function canViewTeam'), 'simulação deve resolver escopo no backend')
assert(simulacaoGetSource.includes('function canViewAll'), 'simulação deve limitar escopo todos no backend')
assert(simulacaoGetSource.includes("requestedScope === 'equipe'"), 'deve suportar escopo equipe com permissão')
assert(simulacaoGetSource.includes("requestedScope === 'todos'"), 'deve suportar escopo todos com permissão')
assert(!/^function ipcp/m.test(simulacaoGetSource), 'hook não deve depender de funções top-level no JSVM do PocketBase')
assert(!/\$app\.save\s*\(/.test(simulacaoGetSource), 'simulação GET não pode usar $app.save')
assert(!/\.save\s*\(/.test(simulacaoGetSource), 'simulação GET não pode usar save')
assert(!/\$app\.delete\s*\(/.test(simulacaoGetSource), 'simulação GET não pode usar $app.delete')
assert(!/\.delete\s*\(/.test(simulacaoGetSource), 'simulação GET não pode usar delete')
assert(source.includes("routerAdd('POST', '/backend/v1/ipcp/snapshots/simulado'"), 'POST permitido apenas para snapshot simulado autorizado')

console.log('OK: contrato IPCP simulacao read-only protegido')
