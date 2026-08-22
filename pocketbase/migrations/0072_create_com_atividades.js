// G39-I4 — Cria coleção com_atividades (pacote G39-E2C-C2B2A — ATIVIDADES E RECUPERAÇÃO).
// Incremental, idempotente e reversível. Zero backfill/update/create/delete de
// registros existentes; não altera migrations 0065–0071 nem coleções/regras
// existentes. Não cria hooks, endpoints, telas, rotas ou serviços.
//
// Depende de 0009 (com_negocios) e 0071 (com_proposta_versoes) já aplicadas.
//
// Criação/atualização/exclusão via API pública são desabilitadas por regras
// impossíveis (mesma técnica usada em com_idempotencia / com_propostas /
// com_proposta_versoes). Somente o servidor (via $app.save, que bypassa regras
// de API) pode criar registros.
//
// CONTRATOS SERVER-SIDE (documentados, sem constraint física de default; o
// PocketBase não expõe default estático no schema de select/text — o hook que
// criar o registro deve preenchê-los):
//  - estado: required no schema; default server-side = "planejada". Alterado
//    exclusivamente pela máquina de estados (planejada -> realizada | cancelada).
//  - tipo: required no schema; imutável desde a criação.
//  - negocio_id: imutável após criação.
//  - autor_id: imutável após criação.
//  - atividade_origem_id: imutável (self-relation; aponta para a atividade
//    cancelada que originou um reagendamento). Criado num segundo save porque
//    a self-relation exige que a coleção já exista.
//  - proposta_versao_id: imutável após criação.
//  - descricao / responsavel_id / canal: mutáveis somente enquanto não terminal
//    (enquanto estado = "planejada").
//  - planejada_para: mutável só enquanto estado = "planejada"; reagendamento
//    nunca in-place — cancelar + criar novo (ligado via atividade_origem_id).
//  - realizada_em: imutável após preenchimento.
//  - resultado: imutável após preenchimento.
//  - justificativa_cancelamento: imutável após preenchimento.
//  - canal: obrigatório quando realizada e tipo != "tarefa_interna" (server-side).
//  - realizada_em + resultado: obrigatórios quando estado = "realizada".
//  - justificativa_cancelamento: obrigatório quando estado = "cancelada".
//  - Delete físico nunca (hook server-side deve negar).
//  - Negociação exige >=1 atividade planejada; "decisao_combinada" futura satisfaz.
//  - Aceite verbal não altera proposta nem fecha negócio.
//  - Cadência "perdeu contato": 5 tentativas, 10 dias úteis, >=2 canais quando
//    disponíveis (server-side).
//  - creation_idempotency_key: chave técnica, FORA dos snapshots de auditoria.
migrate(
  (app) => {
    // Coleção já existe? -> nada a fazer (idempotente)
    try {
      app.findCollectionByNameOrId('com_atividades')
      return
    } catch (_) {}

    var negociosId = app.findCollectionByNameOrId('com_negocios').id
    var propostaVersoesId = app.findCollectionByNameOrId('com_proposta_versoes').id

    // Regra impossível: sempre falsa. Desabilita create/update/delete via API
    // pública, mas NÃO bloqueia criação server-side via $app.save.
    var DISABLED = "@request.auth.id != '' && @request.auth.id = ''"

    // A self-relation (atividade_origem_id -> com_atividades) só pode apontar
    // para a própria coleção depois dela salva, então criamos a coleção sem
    // esse campo e o adicionamos a seguir num segundo save.
    var collection = new Collection({
      name: 'com_atividades',
      type: 'base',
      // list/view: apenas superadministrador autenticado
      listRule: "@request.auth.id != '' && @request.auth.perfil_id.slug = 'superadministrador'",
      viewRule: "@request.auth.id != '' && @request.auth.perfil_id.slug = 'superadministrador'",
      // create/update/delete: server-side only (API desabilitada)
      createRule: DISABLED,
      updateRule: DISABLED,
      deleteRule: DISABLED,
      fields: [
        // 1. negocio_id: relation -> com_negocios, maxSelect 1, required, imutável
        {
          name: 'negocio_id',
          type: 'relation',
          required: true,
          collectionId: negociosId,
          maxSelect: 1,
        },
        // 2. tipo: select, required, imutável desde a criação, sem default físico
        {
          name: 'tipo',
          type: 'select',
          required: true,
          values: [
            'tentativa_contato',
            'reuniao',
            'visita',
            'envio_proposta',
            'acompanhamento_proposta',
            'aceite_verbal_pendente',
            'decisao_combinada',
            'tarefa_interna',
          ],
          maxSelect: 1,
        },
        // 3. descricao: text(2000), optional, mutável só enquanto não terminal
        { name: 'descricao', type: 'text', max: 2000 },
        // 4. autor_id: relation -> users, maxSelect 1, required, imutável
        {
          name: 'autor_id',
          type: 'relation',
          required: true,
          collectionId: '_pb_users_auth_',
          maxSelect: 1,
        },
        // 5. responsavel_id: relation -> users, maxSelect 1, required,
        //    mutável somente enquanto não terminal
        {
          name: 'responsavel_id',
          type: 'relation',
          required: true,
          collectionId: '_pb_users_auth_',
          maxSelect: 1,
        },
        // 6. canal: select, optional, mutável só enquanto não terminal
        {
          name: 'canal',
          type: 'select',
          values: ['telefone', 'email', 'whatsapp', 'presencial', 'video'],
          maxSelect: 1,
        },
        // 7. estado: select, required; default server-side = "planejada";
        //    alterado exclusivamente pela máquina de estados
        {
          name: 'estado',
          type: 'select',
          required: true,
          values: ['planejada', 'realizada', 'cancelada'],
          maxSelect: 1,
        },
        // 8. planejada_para: date, optional; mutável só enquanto "planejada";
        //    reagendamento nunca in-place
        { name: 'planejada_para', type: 'date' },
        // 9. realizada_em: date, optional; imutável após preenchimento
        { name: 'realizada_em', type: 'date' },
        // 10. resultado: text(1000), optional; imutável após preenchimento
        { name: 'resultado', type: 'text', max: 1000 },
        // 11. atividade_origem_id: relation -> com_atividades (self),
        //     maxSelect 1, optional, imutável — ADICIONADO NO SEGUNDO SAVE.
        // 12. proposta_versao_id: relation -> com_proposta_versoes,
        //     maxSelect 1, optional, imutável
        {
          name: 'proposta_versao_id',
          type: 'relation',
          collectionId: propostaVersoesId,
          maxSelect: 1,
        },
        // 13. justificativa_cancelamento: text(500), optional,
        //     imutável após preenchimento
        { name: 'justificativa_cancelamento', type: 'text', max: 500 },
        // 14. creation_idempotency_key: text(128), required, unique, imutável.
        //     Chave técnica, fora dos snapshots de auditoria.
        {
          name: 'creation_idempotency_key',
          type: 'text',
          required: true,
          max: 128,
        },
        // 15. created/updated: autodate PocketBase
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        // 1. UNIQUE creation_idempotency_key
        'CREATE UNIQUE INDEX idx_com_atividades_idempotency ON com_atividades (creation_idempotency_key)',
        // 2. INDEX (negocio_id, planejada_para)
        'CREATE INDEX idx_com_atividades_negocio_planejada ON com_atividades (negocio_id, planejada_para)',
        // 3. INDEX (responsavel_id, estado)
        'CREATE INDEX idx_com_atividades_responsavel_estado ON com_atividades (responsavel_id, estado)',
        // 4. INDEX (estado, planejada_para)
        'CREATE INDEX idx_com_atividades_estado_planejada ON com_atividades (estado, planejada_para)',
      ],
    })
    app.save(collection)

    // Segundo save: adiciona a self-relation atividade_origem_id -> com_atividades.
    var savedCol = app.findCollectionByNameOrId('com_atividades')
    if (!savedCol.fields.getByName('atividade_origem_id')) {
      savedCol.fields.add(
        new RelationField({
          name: 'atividade_origem_id',
          collectionId: savedCol.id,
          maxSelect: 1,
        }),
      )
      app.save(savedCol)
    }
  },
  (app) => {
    try {
      var col = app.findCollectionByNameOrId('com_atividades')
      app.delete(col)
    } catch (_) {}
  },
)
