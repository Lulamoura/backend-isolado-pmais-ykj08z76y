// G39-I3 — Cria coleção com_propostas (pacote G39-E2C-C2B1-R1).
// Incremental, idempotente e reversível. Zero backfill/update/create/delete
// de registros existentes; não altera migrations 0065–0069 nem coleções/regras
// existentes. Não cria hooks, endpoints, telas, rotas ou serviços.
//
// Criação/atualização/exclusão via API pública são desabilitadas por regras
// impossíveis (mesma técnica usada em com_idempotencia / com_qualificacao_
// historico). Somente o servidor (via $app.save, que bypassa regras de API)
// pode criar registros.
//
// CONTRATOS SERVER-SIDE (documentados, sem constraint física de default):
//  - negocio_id: imutável após criação.
//  - autor_id: imutável após criação.
//  - status: required no schema; default server-side = "ativa" (o PocketBase
//    não expõe default estático no schema de select; o hook que criar o
//    registro deve preencher "ativa" quando omitido).
migrate(
  (app) => {
    // Coleção já existe? -> nada a fazer (idempotente)
    try {
      app.findCollectionByNameOrId('com_propostas')
      return
    } catch (_) {}

    var negociosId = app.findCollectionByNameOrId('com_negocios').id

    // Regra impossível: sempre falsa. Desabilita create/update/delete via API
    // pública, mas NÃO bloqueia criação server-side via $app.save.
    var DISABLED = "@request.auth.id != '' && @request.auth.id = ''"

    var collection = new Collection({
      name: 'com_propostas',
      type: 'base',
      // list/view: apenas superadministrador autenticado
      listRule: "@request.auth.id != '' && @request.auth.perfil_id.slug = 'superadministrador'",
      viewRule: "@request.auth.id != '' && @request.auth.perfil_id.slug = 'superadministrador'",
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
        // identificador: text(60), required
        { name: 'identificador', type: 'text', required: true, max: 60 },
        // autor_id: relation -> users, maxSelect 1, required, imutável
        {
          name: 'autor_id',
          type: 'relation',
          required: true,
          collectionId: '_pb_users_auth_',
          maxSelect: 1,
        },
        // status: select, required; default server-side = "ativa"
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['ativa', 'arquivada', 'cancelada'],
          maxSelect: 1,
        },
        // created/updated: autodate
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_com_propostas_negocio_status ON com_propostas (negocio_id, status)',
      ],
    })
    app.save(collection)
  },
  (app) => {
    try {
      var col = app.findCollectionByNameOrId('com_propostas')
      app.delete(col)
    } catch (_) {}
  },
)
