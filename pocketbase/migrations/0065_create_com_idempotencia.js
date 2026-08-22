// G39-I1 — Cria coleção com_idempotencia (pacote transversal G39-E2C-C1-R1)
// Incremental, idempotente e reversível.
//
// Observação técnica: o PocketBase não expõe "default" estático no schema de
// campos (defaults são responsabilidade do hook que cria o registro). Os campos
// `estado`, `tentativa` e `claim_version` são `required` no schema; o hook
// server-side que consumir esta coleção deve preenchê-los (estado=executando,
// tentativa=1, claim_version=1). `inicio_em` é required e também preenchido pelo
// servidor no onCreate. Criação/atualização via API são desabilitadas por regras
// impossíveis; somente o servidor (via $app.save, que bypassa regras de API)
// pode criar/atualizar registros.
migrate(
  (app) => {
    // Coleção já existe? -> nada a fazer (idempotente)
    try {
      app.findCollectionByNameOrId('com_idempotencia')
      return
    } catch (_) {}

    // Regra impossível: sempre falsa. Desabilita create/update via API pública,
    // mas NÃO bloqueia criação server-side via $app.save (que bypassa regras).
    var DISABLED = "@request.auth.id != '' && @request.auth.id = ''"

    var collection = new Collection({
      name: 'com_idempotencia',
      type: 'base',
      // list/view: apenas admin (auth + perfil superadministrador)
      listRule: "@request.auth.id != '' && @request.auth.perfil_id.slug = 'superadministrador'",
      viewRule: "@request.auth.id != '' && @request.auth.perfil_id.slug = 'superadministrador'",
      // create/update: server-side only (API desabilitada)
      createRule: DISABLED,
      updateRule: DISABLED,
      // delete: ninguém
      deleteRule: DISABLED,
      fields: [
        { name: 'command_idempotency_key', type: 'text', required: true, max: 128 },
        { name: 'comando', type: 'text', required: true, min: 1, max: 128 },
        {
          name: 'ator_id',
          type: 'relation',
          required: true,
          collectionId: '_pb_users_auth_',
          maxSelect: 1,
        },
        { name: 'payload_hash', type: 'text', required: true, min: 1, max: 64 },
        {
          name: 'estado',
          type: 'select',
          required: true,
          values: ['executando', 'concluido', 'rejeitado', 'abandonado'],
          maxSelect: 1,
        },
        { name: 'codigo_retorno', type: 'text', max: 64 },
        { name: 'resultado', type: 'json', maxSize: 8192 },
        { name: 'registros_afetados', type: 'json', maxSize: 2048 },
        { name: 'executor_id', type: 'text', required: true, min: 1, max: 64 },
        { name: 'lease_ate', type: 'date', required: true },
        { name: 'tentativa', type: 'number', required: true, min: 1, onlyInt: true },
        {
          name: 'claim_version',
          type: 'number',
          required: true,
          min: 1,
          onlyInt: true,
        },
        { name: 'inicio_em', type: 'date', required: true },
        { name: 'conclusao_em', type: 'date' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_com_idempotencia_unique_identity ON com_idempotencia (ator_id, comando, command_idempotency_key)',
        'CREATE INDEX idx_com_idempotencia_key ON com_idempotencia (command_idempotency_key)',
        'CREATE INDEX idx_com_idempotencia_estado_lease ON com_idempotencia (estado, lease_ate)',
        'CREATE INDEX idx_com_idempotencia_id_claim ON com_idempotencia (id, claim_version)',
      ],
    })
    app.save(collection)
  },
  (app) => {
    try {
      var col = app.findCollectionByNameOrId('com_idempotencia')
      app.delete(col)
    } catch (_) {}
  },
)
