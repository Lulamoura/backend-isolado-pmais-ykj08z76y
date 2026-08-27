const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const contract = fs.readFileSync(path.join(root, 'docs/t6-ac-integration-contract.md'), 'utf8')
const webhook = fs.readFileSync(path.join(root, 'pocketbase/hooks/ac_webhook.js'), 'utf8')
const entry = fs.readFileSync(path.join(root, 'pocketbase/hooks/com_entrada_negocio.js'), 'utf8')
const negociosUi = fs.readFileSync(
  path.join(root, 'src/components/foundation/NegociosTab.tsx'),
  'utf8',
)
const reconciliationHook = fs.readFileSync(
  path.join(root, 'pocketbase/hooks/com_ac_reconciliacao.js'),
  'utf8',
)
const reconciliationService = fs.readFileSync(
  path.join(root, 'src/services/ac-reconciliation.ts'),
  'utf8',
)
const reconciliationUi = fs.readFileSync(
  path.join(root, 'src/components/foundation/ActiveCampaignReconciliationCard.tsx'),
  'utf8',
)
const migration = fs.readFileSync(
  path.join(root, 'pocketbase/migrations/0002_t6_ac8r_integration_controls.js'),
  'utf8',
)
const synthetic = fs.readFileSync(path.join(root, 'pocketbase/hooks/ac_synthetic_v1.js'), 'utf8')
const runtimeControls = fs.readFileSync(
  path.join(root, 'pocketbase/hooks/ac_runtime_controls.js'),
  'utf8',
)
const preoperationGuard = fs.readFileSync(
  path.join(root, 'pocketbase/hooks/com_preoperacao_guard.js'),
  'utf8',
)
const protectedMutationHooks = [
  'com_qualificacao.js',
  'com_atividades_operacao.js',
  'com_fechamentos_operacao.js',
].map((name) => fs.readFileSync(path.join(root, 'pocketbase/hooks', name), 'utf8'))
const oeHook = fs.readFileSync(path.join(root, 'pocketbase/hooks/com_ordens_execucao.js'), 'utf8')

const checks = [
  ['contrato define event_id', contract.includes('"event_id"')],
  ['contrato define source_version', contract.includes('"source_version"')],
  ['contrato define replay canônico', contract.includes('replay=true')],
  ['contrato define evento obsoleto', contract.includes('stale=true')],
  ['contrato define atomicidade', contract.includes('Cada evento é uma única transação')],
  ['contrato define dry-run/fingerprint', contract.includes('fingerprint do plano')],
  ['contrato define lock/cursor', contract.includes('lock global') && contract.includes('cursor')],
  ['contrato define Vendedor 3 sem inferência', contract.includes('Vendedor 3')],
  ['entrada manual recusa não-superadmin', entry.includes('ENTRADA_MANUAL_BLOQUEADA')],
  [
    'contingência exige justificativa e confirmação literal',
    entry.includes('CONTINGENCIA_NAO_CONFIRMADA') && entry.includes('CRIAR FORA DO ACTIVECAMPAIGN'),
  ],
  [
    'interface oculta entrada operacional',
    negociosUi.includes('isSuperAdmin && !loadingSuperAdmin') &&
      negociosUi.includes('Adicionar em contingência'),
  ],
  [
    'webhook V1 continua desligado por parâmetro',
    webhook.includes("paramTrue('ac_webhook_enabled')") &&
      migration.includes("['ac_webhook_enabled', 'false'") &&
      webhook.includes("$security.sha256('activecampaign|' + event.event_id)"),
  ],
  [
    'webhook V1 trata replay, obsolescência, conflito e transação',
    webhook.includes('replay: true') &&
      webhook.includes('stale: true') &&
      webhook.includes('VERSAO_CONFLITANTE') &&
      webhook.includes('$app.runInTransaction'),
  ],
  [
    'parâmetros de integração nascem inertes',
    migration.includes("['ac_reconciliation_enabled', 'false'") &&
      migration.includes("['ac_synthetic_preview_enabled', 'false'") &&
      migration.includes("'ac_preoperation_read_only'") &&
      migration.includes("'true'"),
  ],
  [
    'canal sintético é restrito e atravessa webhook assinado',
    synthetic.includes("slug !== 'superadministrador'") &&
      synthetic.includes("indexOf('test:')") &&
      synthetic.includes("indexOf('[TESTE]')") &&
      synthetic.includes("'/backend/v1/integracao/ac/webhook'") &&
      synthetic.includes('$security.hs256(serialized, secret)'),
  ],
  [
    'reconciliação é inerte por padrão e restrita ao SuperAdmin',
    reconciliationHook.includes('ac_reconciliation_enabled') &&
      reconciliationHook.includes("slug !== 'superadministrador'"),
  ],
  [
    'consulta ActiveCampaign somente no backend',
    reconciliationHook.includes("$secrets.get('AC_API_KEY')") &&
      reconciliationHook.includes("'Api-Token': apiKey") &&
      !reconciliationService.includes('AC_API_KEY') &&
      !reconciliationUi.includes('Api-Token'),
  ],
  [
    'endpoints implementam Simular e Executar',
    reconciliationHook.includes('/reconciliacao/simular') &&
      reconciliationHook.includes('/reconciliacao/executar') &&
      reconciliationService.includes("confirmation: 'RECONCILIAR ACTIVECAMPAIGN'"),
  ],
  [
    'execução usa fingerprint, validade, lock e idempotência',
    reconciliationHook.includes('FINGERPRINT_OBSOLETO') &&
      reconciliationHook.includes('RECONCILIACAO_EM_ANDAMENTO') &&
      reconciliationHook.includes('reconcile-command|'),
  ],
  [
    'execução refaz leitura antes da transação',
    reconciliationHook.includes('revalidation_of') &&
      reconciliationHook.includes('recheck.json.fingerprint !== body.fingerprint') &&
      reconciliationHook.includes('function canonicalize(value)') &&
      reconciliationHook.includes('$security.sha256(canonicalize(planCore))') &&
      !reconciliationHook.includes('$security.sha256(JSON.stringify(planCore))'),
  ],
  [
    'execução comercial e cursor usam transação única',
    reconciliationHook.includes('$app.runInTransaction') &&
      reconciliationHook.includes('ac_reconciliation_cursor') &&
      reconciliationHook.includes('EXECUCAO_REVERTIDA'),
  ],
  [
    'interface exige simulação anterior',
    reconciliationUi.includes('Verificar atualizações') &&
      reconciliationUi.includes('Confirmar reconciliação') &&
      reconciliationUi.includes('!simulation?.can_execute'),
  ],
  [
    'incremental limita negócios ao pipeline e ao escopo operacional',
    reconciliationHook.includes('String(candidate.group) !== pipelineId') &&
      reconciliationHook.includes("candidateStatus === '0'") &&
      reconciliationHook.includes("candidateStage === 'producao_proposta'") &&
      reconciliationHook.includes("candidateStage === 'negociacao'") &&
      reconciliationHook.includes("candidateStage === 'prospects'") &&
      reconciliationHook.includes("Date.parse('2026-08-24T03:00:00.000Z')"),
  ],
  [
    'incremental deriva empresas e contatos somente dos negócios selecionados',
    !reconciliationHook.includes("list('/api/3/accounts', 'accounts', false, '')") &&
      reconciliationHook.includes('var selectedContacts = {}') &&
      reconciliationHook.includes('selectedAccounts = {}') &&
      reconciliationHook.includes("'/api/3/accounts/' + encodeURIComponent") &&
      reconciliationHook.includes("'/api/3/contacts/' + encodeURIComponent"),
  ],
  [
    'incremental hidrata campos personalizados dos negócios selecionados',
    reconciliationHook.includes("list('/api/3/dealCustomFieldMeta'") &&
      reconciliationHook.includes("'&filters[dealId]='") &&
      reconciliationHook.includes("customFields['Responsável']") &&
      reconciliationHook.includes("customFields['Modalidade']"),
  ],
  [
    'incremental acompanha terminal somente de negócio conhecido',
    reconciliationHook.includes('isKnownTerminal') &&
      reconciliationHook.includes("external_type='business'") &&
      reconciliationHook.includes("candidateStatus !== '0'") &&
      reconciliationHook.includes('(isOpenScope || isKnownTerminal)'),
  ],
  [
    'terminal conhecido não exige alias de etapa aberta',
    reconciliationHook.includes("if (String(ev.data.status) === '0')") &&
      reconciliationHook.includes("dimensao='etapa' && valor_original='"),
  ],
  [
    'pré-carga filtra aberto + Negociação e usa Responsável comercial',
    reconciliationHook.includes("requestedMode === 'initial_open_negotiation'") &&
      reconciliationHook.includes("candidateStatus === '0'") &&
      reconciliationHook.includes("stageTitle === 'negociação'") &&
      reconciliationHook.includes('String(candidate.stage) === negotiationStageId') &&
      reconciliationHook.includes(
        "'/api/3/accounts/' + encodeURIComponent(selectedAccountIds[sai])",
      ) &&
      reconciliationHook.includes(
        "'/api/3/contacts/' + encodeURIComponent(selectedContactIds[sci])",
      ) &&
      reconciliationHook.includes(
        "'&filters[dealId]=' + encodeURIComponent(String(deals[sdi].id))",
      ) &&
      reconciliationHook.includes(
        'initialCompanyByContact[selectedContactId] = selectedAccountId',
      ) &&
      reconciliationHook.includes('initialCompanyByContact[String(contacts[c].id)]') &&
      reconciliationHook.includes("customFields['Responsável']"),
  ],
  [
    'pré-operação bloqueia comandos comerciais mutantes sobre importados reais',
    reconciliationHook.includes("target.set('origem_canal', 'activecampaign')") &&
      protectedMutationHooks.every(
        (source) =>
          source.includes('ac_preoperation_read_only') &&
          source.includes("origem_canal') === 'activecampaign'"),
      ),
  ],
  [
    'OE é exceção interna auditada à trava de pré-operação',
    !oeHook.includes("preop.getString('valor') === 'true'") &&
      oeHook.includes("auditoria.set('escopo', 'ordem_execucao')") &&
      oeHook.includes("auditoria.set('origem', 'server-side')"),
  ],
  ['API direta de negócio fica fechada', migration.includes('negocios.updateRule = null')],
  [
    'responsável usa o tipo canônico business_owner',
    webhook.includes("external_type='business_owner'") &&
      (reconciliationHook.match(/external_type='business_owner'/g) || []).length === 2 &&
      !webhook.includes("external_type='owner'") &&
      !reconciliationHook.includes("external_type='owner'"),
  ],
  [
    'negócios AC usam etapa durante negociação e distinguem desqualificação de perda',
    webhook.includes("dealStatus === '0'") &&
      webhook.includes("isProspect ? 'desqualificado' : 'perdido'") &&
      reconciliationHook.includes("dealStatus === '0'") &&
      reconciliationHook.includes("? 'desqualificado'") &&
      !webhook.includes("target.set(\n            'status'") &&
      !reconciliationHook.includes("target.set('status', 'aberto')"),
  ],
  [
    'prospect após o corte aceita ausência de responsável sem importar estoque histórico',
    webhook.includes("var isProspect = String(event.data.stage || '') === 'prospects'") &&
      webhook.includes('(!isProspect && !links.owner_code)') &&
      reconciliationHook.includes('2026-08-24T03:00:00.000Z') &&
      reconciliationHook.includes("canonicalStage === 'prospects'") &&
      reconciliationHook.includes('(!eventIsProspect && !ev.links.owner_code)') &&
      reconciliationHook.includes('if (ev.links.owner_code && !eventIsProspect)') &&
      reconciliationHook.includes('if (ev.links.owner_code && !executionIsProspect)'),
  ],
  [
    'controles possuem materialização runtime idempotente e autenticada',
    runtimeControls.includes('/backend/v1/integracao/ac/configuracao/materializar') &&
      runtimeControls.includes("body.confirmation !== 'MATERIALIZAR CONTROLES AC'") &&
      runtimeControls.includes("slug !== 'superadministrador'") &&
      runtimeControls.includes('if (current)') &&
      runtimeControls.includes("['ac_webhook_enabled', 'false'") &&
      runtimeControls.includes("['ac_synthetic_preview_enabled', 'false'") &&
      runtimeControls.includes("'UNINITIALIZED'"),
  ],
  [
    'cursor não inicializado bloqueia incremental sem bloquear pré-carga ou sintético',
    reconciliationHook.includes("requestedMode === 'incremental' && cursor === 'UNINITIALIZED'") &&
      reconciliationHook.includes("error: 'PRE_CARGA_INICIAL_PENDENTE'") &&
      reconciliationHook.includes(
        "requestedMode === 'initial_open_negotiation' || requestedMode === 'synthetic'",
      ),
  ],
  [
    'gate sintético é transacional, auditado, idempotente e exclusivo do SuperAdmin',
    runtimeControls.includes('/backend/v1/integracao/ac/configuracao/gate-sintetico') &&
      runtimeControls.includes("slug !== 'superadministrador'") &&
      runtimeControls.includes("'ABRIR GATE SINTETICO T6.AC.8'") &&
      runtimeControls.includes("'FECHAR GATE SINTETICO T6.AC.8'") &&
      runtimeControls.includes("commandKey.indexOf('t6-ac8-gate-')") &&
      runtimeControls.includes("$security.sha256('synthetic-gate|' + commandKey)") &&
      runtimeControls.includes("'synthetic_gate_open'") &&
      runtimeControls.includes("'synthetic_gate_close'") &&
      runtimeControls.includes('$app.runInTransaction'),
  ],
  [
    'fechamento do gate desliga os três canais e restaura cursor inicial',
    runtimeControls.includes("webhook.set('valor', enabled ? 'true' : 'false')") &&
      runtimeControls.includes("reconciliation.set('valor', enabled ? 'true' : 'false')") &&
      runtimeControls.includes("synthetic.set('valor', enabled ? 'true' : 'false')") &&
      runtimeControls.includes("if (!enabled) cursor.set('valor', 'UNINITIALIZED')") &&
      runtimeControls.includes("cursor.getString('valor') !== 'UNINITIALIZED'"),
  ],
  [
    'modelo bloqueia propostas e atividades reais na pré-operação',
    preoperationGuard.includes('Cada callback é autocontido') &&
      (preoperationGuard.match(/function guard\(record\)/g) || []).length === 2 &&
      preoperationGuard.includes("'com_propostas'") &&
      preoperationGuard.includes("'com_proposta_versoes'") &&
      preoperationGuard.includes("'com_atividades'") &&
      preoperationGuard.includes('PREOPERACAO_SOMENTE_LEITURA'),
  ],
]

let failures = 0
for (const [name, ok] of checks) {
  process.stdout.write(`${ok ? 'PASS' : 'FAIL'} ${name}\n`)
  if (!ok) failures++
}
if (failures) process.exit(1)
process.stdout.write(`PASS ${checks.length}/${checks.length}\n`)
