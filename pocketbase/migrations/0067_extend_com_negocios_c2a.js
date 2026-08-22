// G39-I2 — Estende com_negocios com novos campos do pacote C2A (G39-E2C-C2A).
// Incremental, idempotente e reversível. Não altera regras de acesso, não
// altera campos/índices existentes, não altera dados reais.
//
// CONTRATOS SERVER-SIDE (documentados, sem constraint física):
//  - tipo_entrada: imutável após criação. Default lógico = "pendente"
//    (preenchido pelo hook server-side no onCreate; PocketBase não suporta
//     default estático no schema).
//  - qualificacao: projeção do último evento válido de qualificação
//    (com_qualificacao_historico). Sem escrita independente pelo cliente.
//  - fechamento_motivo: obrigatório server-side quando resultado = perdido
//    após proposta.
//  - fechamento_data: obrigatório server-side quando resultado ∈ {ganho, perdido}.
//  - fechamento_valor_efetivo_centavos: obrigatório server-side quando
//    resultado = ganho. Snapshot imutável, sem escrita independente.
//  - prospectivo: classificação pelo corte 01/09/2026; backfill reservado
//    para migration futura.
//
// Observação técnica (bool required): o PocketBase trata `false` como valor
// vazio para bool; `required: true` rejeita criações que enviem `false` ou
// omitam o campo. Este é o comportamento contratual desejado para
// `prospectivo` (classificação obrigatória server-side). O hook que criar
// negócios deve sempre informar o valor explicitamente.
migrate(
  (app) => {
    var col = app.findCollectionByNameOrId('com_negocios')
    var negociosId = col.id

    // --- Novos campos (todos adicionados com guarda de idempotência) ---

    // tipo_entrada: select, required, valores pendente | pre_qualificada
    if (!col.fields.getByName('tipo_entrada')) {
      col.fields.add(
        new SelectField({
          name: 'tipo_entrada',
          required: true,
          values: ['pendente', 'pre_qualificada'],
          maxSelect: 1,
        }),
      )
    }

    // qualificacao: select, required, valores pendente | qualificada | desqualificada
    if (!col.fields.getByName('qualificacao')) {
      col.fields.add(
        new SelectField({
          name: 'qualificacao',
          required: true,
          values: ['pendente', 'qualificada', 'desqualificada'],
          maxSelect: 1,
        }),
      )
    }

    // origem_canal: text, max 120, opcional
    if (!col.fields.getByName('origem_canal')) {
      col.fields.add(new TextField({ name: 'origem_canal', max: 120 }))
    }

    // captador_id: relation -> users, maxSelect 1, opcional
    if (!col.fields.getByName('captador_id')) {
      col.fields.add(
        new RelationField({
          name: 'captador_id',
          collectionId: '_pb_users_auth_',
          maxSelect: 1,
        }),
      )
    }

    // negocio_original_id: relation -> com_negocios (self), maxSelect 1, opcional
    if (!col.fields.getByName('negocio_original_id')) {
      col.fields.add(
        new RelationField({
          name: 'negocio_original_id',
          collectionId: negociosId,
          maxSelect: 1,
        }),
      )
    }

    // fechamento_motivo: select, opcional
    if (!col.fields.getByName('fechamento_motivo')) {
      col.fields.add(
        new SelectField({
          name: 'fechamento_motivo',
          values: [
            'preco',
            'fechou_com_outra_empresa',
            'perdeu_contato',
            'desistiu',
            'nao_atendido',
          ],
          maxSelect: 1,
        }),
      )
    }

    // fechamento_data: date, opcional
    if (!col.fields.getByName('fechamento_data')) {
      col.fields.add(new DateField({ name: 'fechamento_data' }))
    }

    // fechamento_valor_efetivo_centavos: number, inteiro, min 0, opcional
    if (!col.fields.getByName('fechamento_valor_efetivo_centavos')) {
      col.fields.add(
        new NumberField({
          name: 'fechamento_valor_efetivo_centavos',
          min: 0,
          onlyInt: true,
        }),
      )
    }

    // oe_numero: text, max 80, opcional
    if (!col.fields.getByName('oe_numero')) {
      col.fields.add(new TextField({ name: 'oe_numero', max: 80 }))
    }

    // oe_data_envio: date, opcional
    if (!col.fields.getByName('oe_data_envio')) {
      col.fields.add(new DateField({ name: 'oe_data_envio' }))
    }

    // oe_responsavel_envio_id: relation -> users, maxSelect 1, opcional
    if (!col.fields.getByName('oe_responsavel_envio_id')) {
      col.fields.add(
        new RelationField({
          name: 'oe_responsavel_envio_id',
          collectionId: '_pb_users_auth_',
          maxSelect: 1,
        }),
      )
    }

    // prospectivo: bool, required (contrato server-side)
    if (!col.fields.getByName('prospectivo')) {
      col.fields.add(new BoolField({ name: 'prospectivo', required: true }))
    }

    // NÃO alterar regras de acesso — os novos campos herdam o comportamento da coleção.
    // NÃO adicionar índices — o plano C2A não especifica índices para com_negocios.
    app.save(col)
  },
  (app) => {
    try {
      var col = app.findCollectionByNameOrId('com_negocios')
      var fieldsToRemove = [
        'tipo_entrada',
        'qualificacao',
        'origem_canal',
        'captador_id',
        'negocio_original_id',
        'fechamento_motivo',
        'fechamento_data',
        'fechamento_valor_efetivo_centavos',
        'oe_numero',
        'oe_data_envio',
        'oe_responsavel_envio_id',
        'prospectivo',
      ]
      fieldsToRemove.forEach(function (fn) {
        if (col.fields.getByName(fn)) col.fields.removeByName(fn)
      })
      app.save(col)
    } catch (_) {}
  },
)
