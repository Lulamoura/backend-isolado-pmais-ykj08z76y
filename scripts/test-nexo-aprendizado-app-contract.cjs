const fs = require('node:fs')
const assert = require('node:assert/strict')

const hookPath = 'pocketbase/hooks/com_propostas_operacao.js'
const migrationPath = 'pocketbase/migrations/202609190900_nexo_aprendizado_eventos.js'
const packagePath = 'package.json'

const hook = fs.readFileSync(hookPath, 'utf8')
const migration = fs.existsSync(migrationPath) ? fs.readFileSync(migrationPath, 'utf8') : ''
const pkg = fs.readFileSync(packagePath, 'utf8')

assert.ok(migration, 'deve existir migração da coleção com_nexo_aprendizado_eventos')
assert.match(migration, /com_nexo_aprendizado_eventos/, 'migração deve criar coleção de eventos de aprendizado do Nexo')
assert.match(migration, /createRule:\s*null/, 'eventos de aprendizado não devem aceitar criação direta pelo cliente')
assert.match(migration, /updateRule:\s*null/, 'eventos de aprendizado não devem aceitar atualização direta pelo cliente')
assert.match(migration, /deleteRule:\s*null/, 'eventos de aprendizado não devem aceitar exclusão direta pelo cliente')
assert.match(migration, /external_id/, 'evento deve guardar ID humano/externo do negócio')
assert.match(migration, /acao/, 'evento deve guardar ação solicitada ao Nexo')
assert.match(migration, /contexto_resumo/, 'evento deve guardar resumo sanitizado do contexto')
assert.match(migration, /resposta_resumo/, 'evento deve guardar resumo sanitizado da resposta')
assert.match(migration, /segundo_cerebro_usado/, 'evento deve registrar se segundo cérebro foi usado')
assert.match(migration, /segundo_cerebro_fontes/, 'evento deve registrar fontes do segundo cérebro')
assert.match(migration, /segundo_cerebro_versao/, 'evento deve registrar versão/hash do segundo cérebro quando disponível')
assert.match(migration, /fallback/, 'evento deve registrar fallback')
assert.match(migration, /human_review_required/, 'evento deve exigir revisão humana')
assert.match(migration, /automatic_send_allowed/, 'evento deve registrar envio automático bloqueado')
assert.match(migration, /crm_write_allowed/, 'evento deve registrar escrita CRM bloqueada')
assert.match(migration, /audit_id/, 'evento deve guardar audit_id correlacionável')
assert.match(migration, /created_at/, 'evento deve guardar timestamp de captura')

assert.match(hook, /nexo_consulta_suporte_app/, 'hook deve declarar o tipo de evento nexo_consulta_suporte_app')
assert.match(hook, /function\s+nexoCapturarAprendizadoApp/, 'hook deve ter função dedicada de captura de aprendizado')
assert.match(hook, /com_nexo_aprendizado_eventos/, 'hook deve persistir na coleção de eventos de aprendizado')
assert.match(hook, /contexto_resumo/, 'hook deve persistir resumo sanitizado do contexto')
assert.match(hook, /resposta_resumo/, 'hook deve persistir resumo sanitizado da resposta')
assert.match(hook, /human_review_required[\s\S]{0,120}true/, 'evento deve nascer exigindo revisão humana')
assert.match(hook, /automatic_send_allowed[\s\S]{0,120}false/, 'evento não pode autorizar envio automático')
assert.match(hook, /crm_write_allowed[\s\S]{0,120}false/, 'evento não pode autorizar escrita no CRM')
assert.match(hook, /catch\s*\([^)]*\)\s*\{[\s\S]{0,260}NEXO_APRENDIZADO_EVENTO_ERRO/, 'falha de captura deve ser logada de forma segura')
assert.match(hook, /nexoCapturarAprendizadoApp\([\s\S]{0,500}return e\.json\(200/, 'captura deve ocorrer antes da resposta 200 ao usuário')
assert.doesNotMatch(hook, /segundo-cerebro-pmais[\s\S]{0,600}(writeFile|fs\.|app\.save\()/, 'hook do app não pode escrever diretamente no segundo cérebro')
assert.doesNotMatch(hook, /com_nexo_aprendizado_eventos[\s\S]{0,1200}(token|password|senha|secret|api[_-]?key|authorization|bearer)/i, 'payload persistido não pode conter segredos ou headers')
assert.match(pkg, /test-nexo-aprendizado-app-contract\.cjs/, 'npm test deve executar o contrato de aprendizado do Nexo no app')

console.log('nexo-aprendizado-app contract: PASS')
