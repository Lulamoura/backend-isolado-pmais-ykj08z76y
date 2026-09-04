const fs = require('node:fs')
const assert = require('node:assert/strict')

const migration = fs.readFileSync(
  'pocketbase/migrations/202609041756_proposta_email_primeira_abertura.js',
  'utf8',
)
const hook = fs.readFileSync('pocketbase/hooks/com_proposta_abertura_email.js', 'utf8')
const envios = fs.readFileSync('pocketbase/hooks/com_proposta_envios.js', 'utf8')

assert.ok(migration.includes("name: 'remetente_id'"), 'migration registra o remetente real')
assert.ok(
  migration.includes("name: 'com_proposta_abertura_emails'"),
  'migration cria trilha auditável',
)
assert.ok(
  migration.includes('idx_com_proposta_abertura_email_publicacao'),
  'uma notificação por publicação é garantida no banco',
)
assert.ok(
  migration.includes("name: 'created'") && migration.includes("name: 'updated'"),
  'coleção declara os campos automáticos usados pelos índices',
)
assert.ok(
  migration.includes("'proposta.email_notificar_remetente_abertura'") &&
    migration.includes("parametro.set('valor', 'false')"),
  'gate inicia fechado para homologação segura',
)
assert.ok(
  envios.includes("envio.set('remetente_id', ator.id)"),
  'envio grava o usuário autenticado',
)
assert.ok(
  hook.includes("evento.getString('tipo') !== 'pagina_acessada'") &&
    hook.includes("'ocorrido_em',\n        1"),
  'aviso deriva da primeira abertura real',
)
assert.ok(
  hook.includes("envios[0].getString('remetente_id')") &&
    hook.includes("versao.getString('responsavel_envio_id')") &&
    hook.includes("negocio.getString('responsavel_id')"),
  'resolução prioriza remetente e preserva fallbacks históricos',
)
assert.ok(
  hook.includes("'Idempotency-Key': 'proposta-abertura-' + publicacao.id"),
  'Resend recebe chave idempotente por publicação',
)
assert.ok(
  hook.includes("aviso.set('estado', 'falhou')") &&
    hook.includes('tentativa') &&
    hook.includes('>= 3'),
  'falhas ficam auditáveis e limitadas a três tentativas',
)
assert.ok(
  hook.indexOf("parametro('proposta.email_habilitado'") <
    hook.indexOf("$secrets.get('RESEND_API_KEY')"),
  'gates antecedem leitura do segredo',
)

console.log('Contrato do e-mail de primeira abertura: 11/11 verificações aprovadas.')
