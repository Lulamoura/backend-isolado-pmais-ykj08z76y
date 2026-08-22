// G39-I4 — Cria coleção com_recuperacao_agendas (pacote G39-E2C-C2B2A —
// ATIVIDADES E RECUPERAÇÃO).
// Incremental, idempotente e reversível. Zero backfill/update/create/delete de
// registros existentes; não altera migrations 0065–0072 nem coleções/regras
// existentes. Não cria hooks, endpoints, telas, rotas ou serviços.
//
// Depende de 0009 (com_negocios) já aplicada.
//
// Criação/atualização/exclusão via API pública são desabilitadas por regras
// impossíveis (mesma técnica usada em com_idempotencia / com_propostas /
// com_proposta_versoes / com_atividades). Somente o servidor (via $app.save,
// que bypassa regras de API) pode criar registros.
//
// CONTRATOS SERVER-SIDE (documentados, sem constraint física de default):
//  - Só existe para negócio com resultado = "perdido".
//  - estado: required no schema; default server-side = "ativa". Alterado pela
//    máquina de estados (ativa -> concluida_por_reativacao | adiada | descartada).
//  - negocio_perdido_id: imutável após criação.
//  - agenda_origem_id: imutável (self-relation; aponta para a agenda "adiada"
//    que originou uma nova agenda "ativa"). Criado num segundo save porque a
//    self-relation exige que a coleção já exista.
//  - autor_id: imutável após criação.
//  - data_alvo + antecedencia_dias: imutáveis após ativação. Alterar data ou
//    antecedência = "adiada" + nova "ativa" com agenda_origem_id — nunca
//    in-place.
//  - contexto / responsavel_id: mutáveis somente enquanto estado = "ativa".
//  - motivo_adiamento_descarte: imutável após preenchimento.
//  - negocio_novo_id: imutável após preenchimento.
//  - Máx. 1 ativa por negócio perdido (garantido pelo UNIQUE parcial).
//  - data_acionamento = data_alvo - antecedencia_dias: projeção CALCULADA;
//    não existe campo físico.
//  - Sugestão de fluxo: 60 dias; sem default no schema.
//  - Fechamento perdido + primeira agenda ativa: atômicos (server-side).
//  - Reativação: novo negócio + evento qualificação + negocio_novo_id + encerra
//    agenda (concluida_por_reativacao); atômico.
//  - Retry da reativação retorna o mesmo negocio_novo_id (idempotente).
//  - Após terminal: todos os campos de domínio imutáveis.
//  - creation_idempotency_key: chave técnica, FORA dos snapshots de auditoria.
migrate(
  (app) => {
    // Coleção já existe? -> nada a fazer (idempotente)
    try {
      app.findCollectionByNameOrId('com_recuperacao_agendas')
      return
    } catch (_) {}

    var negociosId = app.findCollectionByNameOrId('com_negocios').id

    // Regra impossível: sempre falsa. Desabilita create/update/delete via API
    // pública, mas NÃO bloqueia criação server-side via $app.save.
    var DISABLED = "@request.auth.id != '' && @request.auth.id = ''"

    // A self-relation (agenda_origem_id -> com_recuperacao_agendas) só pode
    // apontar para a própria coleção depois dela salva, então criamos a coleção
    // sem esse campo e o adicionamos a seguir num segundo save.
    var collection = new Collection({
      name: 'com_recuperacao_agendas',
      type: 'base',
      // list/view: apenas superadministrador autenticado
      listRule: "@request.auth.id != '' && @request.auth.perfil_id.slug = 'superadministrador'",
      viewRule: "@request.auth.id != '' && @request.auth.perfil_id.slug = 'superadministrador'",
      // create/update/delete: server-side only (API desabilitada)
      createRule: DISABLED,
      updateRule: DISABLED,
      deleteRule: DISABLED,
      fields: [
        // 1. negocio_perdido_id: relation -> com_negocios, maxSelect 1, required, imutável
        {
          name: 'negocio_perdido_id',
          type: 'relation',
          required: true,
          collectionId: negociosId,
          maxSelect: 1,
        },
        // 2. agenda_origem_id: relation -> com_recuperacao_agendas (self),
        //    maxSelect 1, optional, imutável — ADICIONADO NO SEGUNDO SAVE.
        // 3. data_alvo: date, required, imutável após ativação
        { name: 'data_alvo', type: 'date', required: true },
        // 4. antecedencia_dias: number (integer, min 0), required, sem default,
        //    imutável após ativação
        { name: 'antecedencia_dias', type: 'number', required: true, min: 0, onlyInt: true },
        // 5. contexto: text(2000), optional, mutável só enquanto estado = "ativa"
        { name: 'contexto', type: 'text', max: 2000 },
        // 6. responsavel_id: relation -> users, maxSelect 1, required,
        //    mutável somente enquanto estado = "ativa"
        {
          name: 'responsavel_id',
          type: 'relation',
          required: true,
          collectionId: '_pb_users_auth_',
          maxSelect: 1,
        },
        // 7. estado: select, required; default server-side = "ativa"
        {
          name: 'estado',
          type: 'select',
          required: true,
          values: ['ativa', 'concluida_por_reativacao', 'adiada', 'descartada'],
          maxSelect: 1,
        },
        // 8. motivo_adiamento_descarte: text(500), optional, imutável após preenchimento
        { name: 'motivo_adiamento_descarte', type: 'text', max: 500 },
        // 9. negocio_novo_id: relation -> com_negocios, maxSelect 1, optional,
        //    imutável após preenchimento
        {
          name: 'negocio_novo_id',
          type: 'relation',
          collectionId: negociosId,
          maxSelect: 1,
        },
        // 10. autor_id: relation -> users, maxSelect 1, required, imutável
        {
          name: 'autor_id',
          type: 'relation',
          required: true,
          collectionId: '_pb_users_auth_',
          maxSelect: 1,
        },
        // 11. creation_idempotency_key: text(128), required, unique, imutável.
        //     Chave técnica, fora dos snapshots de auditoria.
        {
          name: 'creation_idempotency_key',
          type: 'text',
          required: true,
          max: 128,
        },
        // 12. created/updated: autodate PocketBase
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        // 1. UNIQUE creation_idempotency_key
        'CREATE UNIQUE INDEX idx_com_recuperacao_agendas_idempotency ON com_recuperacao_agendas (creation_idempotency_key)',
        // 2. UNIQUE parcial: (negocio_perdido_id) WHERE estado =
        "CREATE UNIQUE INDEX idx_com_recuperacao_agendas_unica_ativa ON com_recuperacao_agendas (negocio_perdido_id) WHERE estado = 'ativa'",
        // 3. INDEX (responsavel_id, estado)
        'CREATE INDEX idx_com_recuperacao_agendas_responsavel_estado ON com_recuperacao_agendas (responsavel_id, estado)',
        // 4. INDEX data_alvo
        'CREATE INDEX idx_com_recuperacao_agendas_data_alvo ON com_recuperacao_agendas (data_alvo)',
      ],
    })
    app.save(collection)

    // Segundo save: adiciona a self-relation agenda_origem_id -> com_recuperacao_agendas.
    var savedCol = app.findCollectionByNameOrId('com_recuperacao_agendas')
    if (!savedCol.fields.getByName('agenda_origem_id')) {
      savedCol.fields.add(
        new RelationField({
          name: 'agenda_origem_id',
          collectionId: savedCol.id,
          maxSelect: 1,
        }),
      )
      app.save(savedCol)
    }
  },
  (app) => {
    try {
      var col = app.findCollectionByNameOrId('com_recuperacao_agendas')
      app.delete(col)
    } catch (_) {}
  },
)
