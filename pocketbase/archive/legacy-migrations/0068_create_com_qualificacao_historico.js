// G39-I2 — Cria coleção com_qualificacao_historico (pacote G39-E2C-C2A).
// Incremental, idempotente e reversível.
//
// Append-only de eventos de qualificação de negócios. Criação/atualização/
// exclusão via API pública são desabilitadas por regras impossíveis (mesma
// técnica usada em com_idempotencia). Somente o servidor (via $app.save, que
// bypassa regras de API) pode criar registros.
//
// CONTRATOS SERVER-SIDE (documentados, sem constraint física):
//  - negocio_id: imutável após criação.
//  - idempotency_key: imutável e unique (constraint física via índice UNIQUE).
//  - estado_anterior: nulo somente no evento inicial.
//  - tipo_entrada: presente somente no evento inicial.
//  - motivo: obrigatório server-side quando estado_novo = desqualificada OU
//    transição qualificada -> pendente.
migrate(
  (app) => {
    // Coleção já existe? -> nada a fazer (idempotente)
    try {
      app.findCollectionByNameOrId('com_qualificacao_historico')
      return
    } catch (_) {}

    var negociosId = app.findCollectionByNameOrId('com_negocios').id

    // Regra impossível: sempre falsa. Desabilita create/update/delete via API
    // pública, mas NÃO bloqueia criação server-side via $app.save.
    var DISABLED = "@request.auth.id != '' && @request.auth.id = ''"

    var collection = new Collection({
      name: 'com_qualificacao_historico',
      type: 'base',
      // list/view: usuário autenticado
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      // create/update/delete: server-side only (API desabilitada)
      createRule: DISABLED,
      updateRule: DISABLED,
      deleteRule: DISABLED,
      fields: [
        // negocio_id: relation -> com_negocios, maxSelect 1, required, imutável
        {
          name: 'negocio_id',
          type: 'relation',
          required: true,
          collectionId: negociosId,
          maxSelect: 1,
        },
        // idempotency_key: text(128), required, unique (via índice), imutável
        { name: 'idempotency_key', type: 'text', required: true, max: 128 },
        // estado_anterior: select, opcional (nulo somente no evento inicial)
        {
          name: 'estado_anterior',
          type: 'select',
          values: ['pendente', 'qualificada', 'desqualificada'],
          maxSelect: 1,
        },
        // estado_novo: select, required
        {
          name: 'estado_novo',
          type: 'select',
          required: true,
          values: ['pendente', 'qualificada', 'desqualificada'],
          maxSelect: 1,
        },
        // tipo_entrada: select, opcional (presente somente no evento inicial)
        {
          name: 'tipo_entrada',
          type: 'select',
          values: ['pendente', 'pre_qualificada'],
          maxSelect: 1,
        },
        // motivo: text(500), opcional no schema
        { name: 'motivo', type: 'text', max: 500 },
        // autor_id: relation -> users, maxSelect 1, required
        {
          name: 'autor_id',
          type: 'relation',
          required: true,
          collectionId: '_pb_users_auth_',
          maxSelect: 1,
        },
        // origem: select, required
        {
          name: 'origem',
          type: 'select',
          required: true,
          values: [
            'manual',
            'entrada_pre_qualificada',
            'reavaliacao',
            'reativacao',
            'integracao',
            'sistema',
          ],
          maxSelect: 1,
        },
        // justificativa: text(1000), opcional
        { name: 'justificativa', type: 'text', max: 1000 },
        // data_hora_efetiva: date, required
        { name: 'data_hora_efetiva', type: 'date', required: true },
        // created/updated: autodate
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_com_qualificacao_historico_idempotency_key ON com_qualificacao_historico (idempotency_key)',
        'CREATE INDEX idx_com_qualificacao_historico_negocio_created ON com_qualificacao_historico (negocio_id, created)',
        'CREATE INDEX idx_com_qualificacao_historico_negocio_estado ON com_qualificacao_historico (negocio_id, estado_novo)',
        'CREATE INDEX idx_com_qualificacao_historico_autor ON com_qualificacao_historico (autor_id)',
        'CREATE INDEX idx_com_qualificacao_historico_data ON com_qualificacao_historico (data_hora_efetiva)',
      ],
    })
    app.save(collection)
  },
  (app) => {
    try {
      var col = app.findCollectionByNameOrId('com_qualificacao_historico')
      app.delete(col)
    } catch (_) {}
  },
)
