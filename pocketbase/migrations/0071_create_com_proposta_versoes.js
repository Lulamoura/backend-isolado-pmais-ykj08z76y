// G39-I3 — Cria coleção com_proposta_versoes (pacote G39-E2C-C2B1-R1).
// Incremental, idempotente e reversível. Zero backfill/update/create/delete
// de registros existentes; não altera migrations 0065–0069 nem coleções/regras
// existentes. Não cria hooks, endpoints, telas, rotas ou serviços.
//
// Depende de 0070 (com_propostas) já aplicada.
//
// Criação/atualização/exclusão via API pública são desabilitadas por regras
// impossíveis (mesma técnica usada em com_idempotencia / com_qualificacao_
// historico). Somente o servidor (via $app.save, que bypassa regras de API)
// pode criar registros.
//
// CONTRATOS SERVER-SIDE (documentados, sem constraint física de default):
//  - proposta_id: imutável após criação.
//  - numero: number inteiro, required, imutável, SEM default (fornecido pelo
//    criador server-side).
//  - estado: required no schema; default server-side = "rascunho".
//  - modalidade: required=FALSE no schema físico porque o PocketBase não
//    suporta select required sem default estático e não há default aplicável
//    (o valor depende do contexto da versão). CONTRATO SERVER-SIDE: campo
//    obrigatório, sem default — o hook que criar o registro deve preenchê-lo
//    com "pontual" ou "recorrente".
//  - leitura_estado: required no schema; default server-side = "nao_rastreavel".
//  - creation_idempotency_key: required, imutável, unique (constraint física
//    via índice UNIQUE).
migrate(
  (app) => {
    // Coleção já existe? -> nada a fazer (idempotente)
    try {
      app.findCollectionByNameOrId('com_proposta_versoes')
      return
    } catch (_) {}

    var propostasId = app.findCollectionByNameOrId('com_propostas').id

    // Regra impossível: sempre falsa. Desabilita create/update/delete via API
    // pública, mas NÃO bloqueia criação server-side via $app.save.
    var DISABLED = "@request.auth.id != '' && @request.auth.id = ''"

    var collection = new Collection({
      name: 'com_proposta_versoes',
      type: 'base',
      // list/view: apenas superadministrador autenticado
      listRule: "@request.auth.id != '' && @request.auth.perfil_id.slug = 'superadministrador'",
      viewRule: "@request.auth.id != '' && @request.auth.perfil_id.slug = 'superadministrador'",
      // create/update/delete: server-side only (API desabilitada)
      createRule: DISABLED,
      updateRule: DISABLED,
      deleteRule: DISABLED,
      fields: [
        // 1. proposta_id: relation -> com_propostas, maxSelect 1, required, imutável
        {
          name: 'proposta_id',
          type: 'relation',
          required: true,
          collectionId: propostasId,
          maxSelect: 1,
        },
        // 2. numero: number (integer), required, imutável, sem default
        { name: 'numero', type: 'number', required: true, onlyInt: true },
        // 3. estado: select, required; default server-side = "rascunho"
        {
          name: 'estado',
          type: 'select',
          required: true,
          values: ['rascunho', 'enviada', 'aceita', 'recusada', 'cancelada'],
          maxSelect: 1,
        },
        // 4. modalidade: select, required=FALSE no schema (contrato server-side)
        {
          name: 'modalidade',
          type: 'select',
          values: ['pontual', 'recorrente'],
          maxSelect: 1,
        },
        // 5. valor_total_centavos: number (integer, min 0), required
        {
          name: 'valor_total_centavos',
          type: 'number',
          required: true,
          min: 0,
          onlyInt: true,
        },
        // 6. valor_mensal_centavos: number (integer, min 0), optional
        {
          name: 'valor_mensal_centavos',
          type: 'number',
          min: 0,
          onlyInt: true,
        },
        // 7. enviada_em: date, optional
        { name: 'enviada_em', type: 'date' },
        // 8. destinatario: text(200), optional
        { name: 'destinatario', type: 'text', max: 200 },
        // 9. canal_envio: select, optional
        {
          name: 'canal_envio',
          type: 'select',
          values: ['email', 'provelo', 'whatsapp', 'presencial'],
          maxSelect: 1,
        },
        // 10. validade: date, optional
        { name: 'validade', type: 'date' },
        // 11. documento_url: text(500), optional
        { name: 'documento_url', type: 'text', max: 500 },
        // 12. responsavel_envio_id: relation -> users, maxSelect 1, optional
        {
          name: 'responsavel_envio_id',
          type: 'relation',
          collectionId: '_pb_users_auth_',
          maxSelect: 1,
        },
        // 13. creation_idempotency_key: text(128), required, unique, imutável
        {
          name: 'creation_idempotency_key',
          type: 'text',
          required: true,
          max: 128,
        },
        // 14. leitura_estado: select, required; default server-side = "nao_rastreavel"
        {
          name: 'leitura_estado',
          type: 'select',
          required: true,
          values: ['nao_rastreavel', 'nao_lida', 'lida'],
          maxSelect: 1,
        },
        // 15. primeira_leitura_em: date, optional
        { name: 'primeira_leitura_em', type: 'date' },
        // 16. ultima_leitura_em: date, optional
        { name: 'ultima_leitura_em', type: 'date' },
        // 17. decisao_em: date, optional
        { name: 'decisao_em', type: 'date' },
        // 18. tipo_evidencia_decisao: select, optional
        {
          name: 'tipo_evidencia_decisao',
          type: 'select',
          values: [
            'assinatura',
            'aceite_formal_corporativo',
            'aceite_formal_provelo',
            'pedido_compra',
            'equivalente_formal',
          ],
          maxSelect: 1,
        },
        // 19. evidencia_decisao: text(500), optional
        { name: 'evidencia_decisao', type: 'text', max: 500 },
        // 20. created/updated: autodate
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        // 1. UNIQUE creation_idempotency_key
        'CREATE UNIQUE INDEX idx_com_proposta_versoes_idempotency ON com_proposta_versoes (creation_idempotency_key)',
        // 2. UNIQUE (proposta_id, numero)
        'CREATE UNIQUE INDEX idx_com_proposta_versoes_proposta_numero ON com_proposta_versoes (proposta_id, numero)',
        // 3. UNIQUE parcial: (proposta_id) WHERE estado =
        "CREATE UNIQUE INDEX idx_com_proposta_versoes_proposta_aceita ON com_proposta_versoes (proposta_id) WHERE estado = 'aceita'",
        // 4. INDEX (proposta_id, numero)
        'CREATE INDEX idx_com_proposta_versoes_proposta_numero_idx ON com_proposta_versoes (proposta_id, numero)',
        // 5. INDEX estado
        'CREATE INDEX idx_com_proposta_versoes_estado ON com_proposta_versoes (estado)',
      ],
    })
    app.save(collection)
  },
  (app) => {
    try {
      var col = app.findCollectionByNameOrId('com_proposta_versoes')
      app.delete(col)
    } catch (_) {}
  },
)
