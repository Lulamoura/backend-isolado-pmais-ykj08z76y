// ════════════════════════════════════════════════════════════════════
// 0063 — Eliminar cascadeDelete + estender evidência 2D.2B (v0.0.137)
// ════════════════════════════════════════════════════════════════════
// CORREÇÃO 3 (eliminação de cascadeDelete):
//   A relação execucao_id em com_etapas_porta_2d2b foi criada com
//   cascadeDelete=true (migration 0060). A API JSVM permite alterar a
//   flag cascadeDelete de um RelationField existente via mutação direta
//   (documentado em pocketbase.io/docs/js-collections — "returns a
//   pointer and direct modifications are allowed without reinsert").
//   Esta migration muda cascadeDelete para false SEM remover/recriar o
//   campo, preservando dados e índices existentes. A proteção contra
//   delete server-side não autorizado é garantida pelos hooks de modelo
//   (onRecordDelete) em ac_immutable_porta_2d2b.js — não apenas por
//   esta flag.
//
// CORREÇÃO 7 (truncamento e sanitização):
//   Adiciona resposta_truncated (bool), resposta_original_length (number),
//   raw_body_sanitized (text), raw_body_sanitized_sha256 (text),
//   raw_body_size (number), sanitized (bool), raw_body_original_sha256
//   (text), contrato (text), contrato_ok (bool) em com_etapas_porta_2d2b.
//
// CORREÇÃO 8 (contadores semanticamente corretos):
//   Adiciona allowed_internal_calls (number), blocked_external_attempts
//   (number), activecampaign_calls (number) em com_execucoes_porta_2d2b.
//   O campo prova_zero_chamadas_externas (bool) é mantido por
//   compatibilidade, mas não é mais a prova canônica.
// ════════════════════════════════════════════════════════════════════
migrate(
  (app) => {
    // ─── CORREÇÃO 3: cascadeDelete=false na relação execucao_id ───
    var etapasCol = app.findCollectionByNameOrId('com_etapas_porta_2d2b')
    var relField = etapasCol.fields.getByName('execucao_id')
    if (relField) {
      relField.cascadeDelete = false
    }
    app.save(etapasCol)

    // ─── CORREÇÃO 7: campos de truncamento, sanitização e hash verificável ───
    if (!etapasCol.fields.getByName('resposta_truncated')) {
      etapasCol.fields.add(new BoolField({ name: 'resposta_truncated' }))
    }
    if (!etapasCol.fields.getByName('resposta_original_length')) {
      etapasCol.fields.add(new NumberField({ name: 'resposta_original_length' }))
    }
    if (!etapasCol.fields.getByName('raw_body_sanitized')) {
      etapasCol.fields.add(new TextField({ name: 'raw_body_sanitized' }))
    }
    if (!etapasCol.fields.getByName('raw_body_sanitized_sha256')) {
      etapasCol.fields.add(new TextField({ name: 'raw_body_sanitized_sha256' }))
    }
    if (!etapasCol.fields.getByName('raw_body_size')) {
      etapasCol.fields.add(new NumberField({ name: 'raw_body_size' }))
    }
    if (!etapasCol.fields.getByName('sanitized')) {
      etapasCol.fields.add(new BoolField({ name: 'sanitized' }))
    }
    if (!etapasCol.fields.getByName('raw_body_original_sha256')) {
      etapasCol.fields.add(new TextField({ name: 'raw_body_original_sha256' }))
    }
    if (!etapasCol.fields.getByName('contrato')) {
      etapasCol.fields.add(new TextField({ name: 'contrato' }))
    }
    if (!etapasCol.fields.getByName('contrato_ok')) {
      etapasCol.fields.add(new BoolField({ name: 'contrato_ok' }))
    }
    app.save(etapasCol)

    // ─── CORREÇÃO 8: contadores semanticamente corretos ───
    var execCol = app.findCollectionByNameOrId('com_execucoes_porta_2d2b')
    if (!execCol.fields.getByName('allowed_internal_calls')) {
      execCol.fields.add(new NumberField({ name: 'allowed_internal_calls' }))
    }
    if (!execCol.fields.getByName('blocked_external_attempts')) {
      execCol.fields.add(new NumberField({ name: 'blocked_external_attempts' }))
    }
    if (!execCol.fields.getByName('activecampaign_calls')) {
      execCol.fields.add(new NumberField({ name: 'activecampaign_calls' }))
    }
    app.save(execCol)
  },
  (app) => {
    // Reverte: restaura cascadeDelete=true (campos adicionais permanecem
    // para evitar perda de dados — strategy aditiva).
    var etapasCol = app.findCollectionByNameOrId('com_etapas_porta_2d2b')
    var relField = etapasCol.fields.getByName('execucao_id')
    if (relField) {
      relField.cascadeDelete = true
    }
    app.save(etapasCol)
  },
)
