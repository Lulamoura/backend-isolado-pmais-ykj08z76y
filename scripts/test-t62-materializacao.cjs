const fs = require('fs')

const source = fs.readFileSync('pocketbase/hooks/com_t62_materializacao.js', 'utf8')
const probe = fs.readFileSync('pocketbase/hooks/com_t62_runtime_probe.js', 'utf8')
const checks = [
  [
    'sonda v6 em hook e prefixo independentes',
    probe.includes("'/backend/v1/t6-2/runtime-probe-v6'") &&
      probe.includes("probe_version: 't62-runtime-probe-v6'") &&
      probe.includes('handler_alcancado: true'),
  ],
  [
    'sonda v6 não acessa autenticação, dados, segredos ou rede',
    !/(requireAuth|e\.auth|\$app|\$secrets|\$http|fetch|save|runInTransaction|delete|POST)/.test(
      probe,
    ) && probe.includes('mutacoes_executadas: 0'),
  ],
  [
    'diagnóstico GET autenticado e versionado',
    source.includes("ROTA + '/diagnostico-v7'") &&
      source.includes("HOOK_VERSION = 't62-materializacao-precheck-v7'") &&
      source.includes('handler_alcancado: true') &&
      source.match(/ROTA \+ '\/diagnostico-v7'[\s\S]{0,900}var ator = e\.auth/),
  ],
  [
    'rotas dry-run e execução separadas',
    source.includes("ROTA + '/dry-run'") && source.includes("ROTA + '/executar'"),
  ],
  [
    'callback dry-run autocontido no wrapper do SKIP',
    (() => {
      const start = source.indexOf("ROTA + '/dry-run'")
      const end = source.indexOf("ROTA + '/executar'", start)
      const block = source.slice(start, end)
      return (
        block.includes('function autenticarSeguro(evento)') &&
        block.includes('function corpoSeguro(evento)') &&
        block.includes('function snapshot(app)') &&
        block.includes('function codigoSnapshot(err)') &&
        block.includes('function previsto(state)')
      )
    })(),
  ],
  [
    'callback executar autocontido no wrapper do SKIP',
    (() => {
      const start = source.indexOf("ROTA + '/executar'")
      const block = source.slice(start)
      return (
        block.includes("var COMANDO = 't62_materializar_menor_privilegio'") &&
        block.includes("var CONFIRMACAO = 'MATERIALIZAR_T62_MENOR_PRIVILEGIO'") &&
        block.includes('function autenticarSeguro(evento)') &&
        block.includes('function corpoSeguro(evento)') &&
        block.includes('function snapshot(app)') &&
        block.includes('function codigoSnapshot(err)') &&
        block.includes('function fingerprint(app)')
      )
    })(),
  ],
  [
    'middleware genérico preservado nas duas rotas mutantes',
    (source.match(/\$apis\.requireAuth\(\)/g) || []).length === 2,
  ],
  [
    'diagnóstico exige coleção users e valida SuperAdmin internamente',
    (() => {
      const start = source.indexOf("ROTA + '/diagnostico-v7'")
      const end = source.indexOf("ROTA + '/dry-run'", start)
      const block = source.slice(start, end)
      return (
        block.includes('var ator = e.auth') &&
        block.includes("perfilSlug !== 'superadministrador'") &&
        block.includes("$apis.requireAuth('users')") &&
        !block.includes('autenticarSeguro(e)') &&
        !block.includes('HOOK_VERSION')
      )
    })(),
  ],
  [
    'SuperAdmin comercial obrigatório',
    source.includes("perfilSlug($app, ator) !== 'superadministrador'") &&
      source.includes('ativo_comercial'),
  ],
  [
    'dry-run sem transação ou save',
    source.includes('somente_leitura: true') && source.includes('mutacoes_executadas: 0'),
  ],
  [
    'fingerprint SHA-256 do estado',
    source.includes('fingerprint_estado: $security.sha256(canonicalize(state))'),
  ],
  [
    'contrato fechado de execução',
    source.includes('command_idempotency_key,confirmacao,fingerprint_estado,justificativa,modo'),
  ],
  [
    'confirmação literal',
    source.includes('MATERIALIZAR_T62_MENOR_PRIVILEGIO') &&
      source.includes('CONFIRMACAO_LITERAL_OBRIGATORIA'),
  ],
  [
    'concorrência antes e dentro da transação',
    (source.match(/STALE_WRITE/g) || []).length >= 4 && source.includes('fingerprint(tx)'),
  ],
  ['transação atômica', source.includes('$app.runInTransaction')],
  [
    'calendário e SLA idempotentes',
    source.includes('com_calendario_feriados') &&
      source.includes('sla.negociacao_dias_uteis') &&
      source.includes('if (!parametro)'),
  ],
  [
    'perfil restrito canônico',
    source.includes("PERFIL_SLUG = 'negociacao-propria'") &&
      source.includes("perfil.set('ativo', true)"),
  ],
  [
    'somente três permissões de leitura',
    source.includes("['empresas.view', 'negocios.view', 'dashboard.view']"),
  ],
  ['escopo próprios imposto', (source.match(/set\('escopo', 'proprios'\)/g) || []).length >= 2],
  [
    'Shirleide fechada por ID, e-mail e obrigatoriamente inativa',
    source.includes("ID_SHIRLEIDE = 'pmdghnoqc5x3rnn'") &&
      source.includes('comercial06@pmaisservicos.com.br') &&
      source.includes('CONTA_ALVO_DIVERGENTE') &&
      source.includes('CONTA_ALVO_ATIVA'),
  ],
  [
    'regras de usuários fechadas',
    source.includes("@request.auth.perfil_id.slug = 'superadministrador'") &&
      source.includes('@request.auth.id = id'),
  ],
  [
    'regras de auditoria fechadas',
    source.includes("@request.auth.perfil_id.slug = 'gestor-comercial'") &&
      source.includes("@request.auth.perfil_id.slug = 'leitura-executiva'"),
  ],
  [
    'auditoria server-side',
    source.includes("auditoria.set('origem', 'server-side')") &&
      source.includes("auditoria.set('comando', COMANDO)"),
  ],
  [
    'idempotência concluída e replay',
    source.includes("idem.set('estado', 'concluido')") &&
      source.includes('replay: true') &&
      source.includes('payload_hash'),
  ],
  [
    'nenhuma ativação de conta',
    !source.includes("set('ativo_comercial', true)") && source.includes('contas_ativadas: 0'),
  ],
  ['nenhuma exclusão', !source.includes('$app.delete') && !source.includes('tx.delete')],
  [
    'snapshot dividido em etapas fechadas',
    ['CONTA_ALVO', 'PERFIL_DESTINO', 'VINCULOS', 'PERMISSOES', 'SLA', 'CALENDARIO', 'REGRAS'].every(
      (code) => source.includes(`'${code}'`),
    ),
  ],
  [
    'diagnóstico não expõe mensagem interna',
    source.includes("return 'SNAPSHOT_INDISPONIVEL'") &&
      source.includes('error: codigoSnapshot(err)') &&
      !source.includes('error: String(err)'),
  ],
  [
    'parsing usa requestInfo nas duas rotas',
    (source.match(/e\.requestInfo\(\)/g) || []).length === 1 &&
      !source.includes('e.request.body') &&
      source.includes('var parsed = corpoSeguro(e)'),
  ],
  [
    'pré-handler possui códigos fechados',
    source.includes("error: 'PRECHECK_AUTH'") && source.includes("error: 'PRECHECK_BODY'"),
  ],
  [
    'diagnóstico GET sem primitivas de escrita',
    source.includes('mutacoes_executadas: 0') &&
      !source.match(/ROTA \+ '\/diagnostico'[\s\S]{0,500}(save|runInTransaction|delete)\(/),
  ],
]

let passed = 0
for (const [name, ok] of checks) {
  console.log(`TEST ${ok ? 'PASS' : 'FAIL'}: ${name}`)
  if (ok) passed += 1
}
console.log(`\nRESULTADO: ${passed}/${checks.length} aprovados`)
process.exitCode = passed === checks.length ? 0 : 1
