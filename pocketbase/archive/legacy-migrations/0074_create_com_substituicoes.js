// G39-I5 — Cria coleção com_substituicoes (pacote com_substituicoes).
// Incremental, idempotente e reversível. Zero backfill/update/create/delete de
// registros existentes; não altera migrations 0065–0073 nem coleções/regras
// existentes. Não cria hooks, endpoints, telas, rotas, serviços, scheduler ou
// integração. Não implementa RBAC granular definitivo, invariantes, projeções,
// fila "Sem cobertura", auditoria operacional nem escrita durante leitura.
//
// Depende de 0009 (com_negocios) já aplicada.
//
// Criação/atualização/exclusão via API pública são desabilitadas por regras
// impossíveis (mesma técnica usada em com_atividades / com_recuperacao_agendas).
// Somente o servidor (via $app.save, que bypassa regras de API) pode criar
// registros.
//
// Escopo: apenas estrutura. Coleção nasce vazia (sem backfill).
migrate(
  (app) => {
    // Coleção já existe? -> nada a fazer (idempotente)
    try {
      app.findCollectionByNameOrId('com_substituicoes')
      return
    } catch (_) {}

    var negociosId = app.findCollectionByNameOrId('com_negocios').id

    // Regra impossível: sempre falsa. Desabilita create/update/delete via API
    // pública, mas NÃO bloqueia criação server-side via $app.save.
    var DISABLED = "@request.auth.id != '' && @request.auth.id = ''"

    var collection = new Collection({
      name: 'com_substituicoes',
      type: 'base',
      // list/view: apenas superadministrador autenticado (provisório)
      listRule: "@request.auth.id != '' && @request.auth.perfil_id.slug = 'superadministrador'",
      viewRule: "@request.auth.id != '' && @request.auth.perfil_id.slug = 'superadministrador'",
      // create/update/delete: server-side only (API desabilitada) — provisório
      createRule: DISABLED,
      updateRule: DISABLED,
      deleteRule: DISABLED,
      fields: [
        // 1. titular_id: relation single -> users, required
        {
          name: 'titular_id',
          type: 'relation',
          required: true,
          collectionId: '_pb_users_auth_',
          maxSelect: 1,
        },
        // 2. substituto_principal_id: relation single -> users, optional
        {
          name: 'substituto_principal_id',
          type: 'relation',
          collectionId: '_pb_users_auth_',
          maxSelect: 1,
        },
        // 3. substituto_reserva_id: relation single -> users, optional
        {
          name: 'substituto_reserva_id',
          type: 'relation',
          collectionId: '_pb_users_auth_',
          maxSelect: 1,
        },
        // 4. data_inicio: date, required
        { name: 'data_inicio', type: 'date', required: true },
        // 5. data_fim: date, required
        { name: 'data_fim', type: 'date', required: true },
        // 6. tipo_cobertura: select (integral | por_negocios), required
        {
          name: 'tipo_cobertura',
          type: 'select',
          required: true,
          values: ['integral', 'por_negocios'],
          maxSelect: 1,
        },
        // 7. negocios_cobertos: relation multiple -> com_negocios, optional,
        //    maxSelect 999
        {
          name: 'negocios_cobertos',
          type: 'relation',
          collectionId: negociosId,
          maxSelect: 999,
        },
        // 8. motivo: select (ferias | licenca | falta), required
        {
          name: 'motivo',
          type: 'select',
          required: true,
          values: ['ferias', 'licenca', 'falta'],
          maxSelect: 1,
        },
        // 9. observacao: text(1000), optional
        { name: 'observacao', type: 'text', max: 1000 },
        // 10. cancelada_em: date, optional
        { name: 'cancelada_em', type: 'date' },
        // 11. justificativa_cancelamento: text(500), optional
        { name: 'justificativa_cancelamento', type: 'text', max: 500 },
        // 12. autor_id: relation single -> users, required
        {
          name: 'autor_id',
          type: 'relation',
          required: true,
          collectionId: '_pb_users_auth_',
          maxSelect: 1,
        },
        // 13. creation_idempotency_key: text(128), required, unique
        {
          name: 'creation_idempotency_key',
          type: 'text',
          required: true,
          max: 128,
        },
        // 14. created/updated: autodate PocketBase
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        // 1. UNIQUE creation_idempotency_key
        'CREATE UNIQUE INDEX idx_com_substituicoes_idempotency ON com_substituicoes (creation_idempotency_key)',
        // 2. INDEX (titular_id, data_inicio, data_fim)
        'CREATE INDEX idx_com_substituicoes_titular_periodo ON com_substituicoes (titular_id, data_inicio, data_fim)',
        // 3. INDEX substituto_principal_id
        'CREATE INDEX idx_com_substituicoes_substituto_principal ON com_substituicoes (substituto_principal_id)',
        // 4. INDEX substituto_reserva_id
        'CREATE INDEX idx_com_substituicoes_substituto_reserva ON com_substituicoes (substituto_reserva_id)',
        // 5. INDEX data_inicio
        'CREATE INDEX idx_com_substituicoes_data_inicio ON com_substituicoes (data_inicio)',
      ],
    })
    app.save(collection)
  },
  (app) => {
    try {
      var col = app.findCollectionByNameOrId('com_substituicoes')
      app.delete(col)
    } catch (_) {}
  },
)
