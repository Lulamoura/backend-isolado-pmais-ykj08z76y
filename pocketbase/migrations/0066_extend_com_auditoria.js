// G39-I1 — Estende com_auditoria com campos transversais (G39-E2C-C1-R1).
// Incremental, idempotente e reversível.
//
// Divergência documentada: os campos existentes `collection_name` (max 100),
// `record_id` (max 100), `justificativa` (max 1000), `origem_alteracao`
// (max 50) e `usuario_id` (opcional) JÁ estão no estado exigido pelo plano
// (migration 0017). Logo, nenhum ajuste é necessário sobre eles — apenas
// adicionamos os novos campos e índices. `valor_anterior` e `valor_novo`
// permanecem `text` (sem conversão para json), conforme exigido.
migrate(
  (app) => {
    var col = app.findCollectionByNameOrId('com_auditoria')
    var auditId = col.id

    // --- Novos campos (todos opcionais) ---
    if (!col.fields.getByName('perfil')) {
      col.fields.add(new TextField({ name: 'perfil', max: 64 }))
    }
    if (!col.fields.getByName('escopo')) {
      col.fields.add(new TextField({ name: 'escopo', max: 64 }))
    }
    if (!col.fields.getByName('comando')) {
      col.fields.add(new TextField({ name: 'comando', max: 128 }))
    }
    if (!col.fields.getByName('origem')) {
      col.fields.add(new TextField({ name: 'origem', max: 32 }))
    }
    if (!col.fields.getByName('command_idempotency_key')) {
      col.fields.add(new TextField({ name: 'command_idempotency_key', max: 128 }))
    }
    if (!col.fields.getByName('correlation_id')) {
      col.fields.add(new TextField({ name: 'correlation_id', max: 255 }))
    }
    if (!col.fields.getByName('transacao_id')) {
      col.fields.add(new TextField({ name: 'transacao_id', max: 64 }))
    }
    if (!col.fields.getByName('sequencia')) {
      col.fields.add(new NumberField({ name: 'sequencia', onlyInt: true }))
    }
    if (!col.fields.getByName('evento_em')) {
      col.fields.add(new DateField({ name: 'evento_em' }))
    }
    if (!col.fields.getByName('snapshot_hash')) {
      col.fields.add(new TextField({ name: 'snapshot_hash', max: 64 }))
    }
    if (!col.fields.getByName('snapshot_hash_versao')) {
      col.fields.add(new TextField({ name: 'snapshot_hash_versao', max: 32 }))
    }
    if (!col.fields.getByName('retifica_id')) {
      col.fields.add(
        new RelationField({
          name: 'retifica_id',
          collectionId: auditId,
          maxSelect: 1,
        }),
      )
    }
    if (!col.fields.getByName('evidencia_estruturada')) {
      col.fields.add(new JSONField({ name: 'evidencia_estruturada', maxSize: 2048 }))
    }

    app.save(col)

    // --- Índices adicionais (idempotentes via addIndex) ---
    col.addIndex('idx_com_auditoria_comando', false, 'comando', '')
    col.addIndex('idx_com_auditoria_command_key', false, 'command_idempotency_key', '')
    col.addIndex('idx_com_auditoria_correlation_id', false, 'correlation_id', '')
    col.addIndex('idx_com_auditoria_transacao_id', false, 'transacao_id', '')
    col.addIndex('idx_com_auditoria_usuario_id', false, 'usuario_id', '')
    col.addIndex('idx_com_auditoria_evento_em', false, 'evento_em', '')
    col.addIndex('idx_com_auditoria_retifica_id', false, 'retifica_id', '')
    app.save(col)

    // --- Regras de acesso (preservar list/view existentes; garantir create/update/delete server-side only) ---
    // create: server-side only (API desabilitada via regra impossível)
    col.createRule = "@request.auth.id != '' && @request.auth.id = ''"
    // update: ninguém
    col.updateRule = null
    // delete: ninguém
    col.deleteRule = null
    app.save(col)
  },
  (app) => {
    try {
      var col = app.findCollectionByNameOrId('com_auditoria')
      var fieldsToRemove = [
        'perfil',
        'escopo',
        'comando',
        'origem',
        'command_idempotency_key',
        'correlation_id',
        'transacao_id',
        'sequencia',
        'evento_em',
        'snapshot_hash',
        'snapshot_hash_versao',
        'retifica_id',
        'evidencia_estruturada',
      ]
      fieldsToRemove.forEach(function (fn) {
        if (col.fields.getByName(fn)) col.fields.removeByName(fn)
      })

      var idxToRemove = [
        'idx_com_auditoria_comando',
        'idx_com_auditoria_command_key',
        'idx_com_auditoria_correlation_id',
        'idx_com_auditoria_transacao_id',
        'idx_com_auditoria_usuario_id',
        'idx_com_auditoria_evento_em',
        'idx_com_auditoria_retifica_id',
      ]
      idxToRemove.forEach(function (idx) {
        try {
          col.removeIndex(idx)
        } catch (_) {}
      })

      // Restaura createRule para o estado anterior ao 0057/0066 (server-side já
      // era garantido por 0057 com createRule=null). Mantemos null para
      // consistência com o estado imediatamente anterior.
      col.createRule = null
      col.updateRule = null
      col.deleteRule = null
      app.save(col)
    } catch (_) {}
  },
)
