migrate(
  function (app) {
    var casos = new Collection({
      type: 'base',
      name: 'com_nexo_curadoria_casos',
      createRule: null,
      updateRule: null,
      deleteRule: null,
      listRule: null,
      viewRule: null,
    })
    casos.fields.add(new TextField({ name: 'fingerprint', required: true, max: 160 }))
    casos.fields.add(new NumberField({ name: 'revisao', required: true, min: 1 }))
    casos.fields.add(new TextField({ name: 'status', required: true, max: 80 }))
    casos.fields.add(new TextField({ name: 'fonte_principal', required: true, max: 80 }))
    casos.fields.add(new JSONField({ name: 'fontes', required: false, maxSize: 4000 }))
    casos.fields.add(new TextField({ name: 'escopo_tipo', required: true, max: 80 }))
    casos.fields.add(new TextField({ name: 'escopo_ref', required: false, max: 160 }))
    casos.fields.add(new TextField({ name: 'empresa_nome', required: false, max: 240 }))
    casos.fields.add(new TextField({ name: 'contato_nome', required: false, max: 240 }))
    casos.fields.add(new TextField({ name: 'negocio_numero', required: false, max: 120 }))
    casos.fields.add(new TextField({ name: 'negocio_titulo', required: false, max: 300 }))
    casos.fields.add(new TextField({ name: 'responsavel_nome', required: false, max: 200 }))
    casos.fields.add(new TextField({ name: 'assunto_chave', required: true, max: 160 }))
    casos.fields.add(new TextField({ name: 'recorrencia_chave', required: true, max: 160 }))
    casos.fields.add(new TextField({ name: 'titulo', required: true, max: 300 }))
    casos.fields.add(new TextField({ name: 'resumo_factual', required: true, max: 4000 }))
    casos.fields.add(new TextField({ name: 'motivo_curadoria', required: true, max: 2000 }))
    casos.fields.add(new TextField({ name: 'regra_candidata', required: false, max: 4000 }))
    casos.fields.add(new NumberField({ name: 'evidencia_contagem', required: true, min: 0 }))
    casos.fields.add(new NumberField({ name: 'casos_independentes', required: true, min: 0 }))
    casos.fields.add(new NumberField({ name: 'recorrencia_contagem', required: true, min: 0 }))
    casos.fields.add(new JSONField({ name: 'evidencia_hashes', required: false, maxSize: 12000 }))
    casos.fields.add(new TextField({ name: 'risco_classe', required: true, max: 80 }))
    casos.fields.add(new TextField({ name: 'alcada', required: true, max: 80 }))
    casos.fields.add(new JSONField({ name: 'sensivel_motivos', required: false, maxSize: 4000 }))
    casos.fields.add(new TextField({ name: 'confianca', required: true, max: 40 }))
    casos.fields.add(new BoolField({ name: 'human_review_required', required: false }))
    casos.fields.add(new BoolField({ name: 'automatic_promotion_allowed', required: false }))
    casos.fields.add(
      new JSONField({ name: 'entrevista_respostas', required: false, maxSize: 12000 }),
    )
    casos.fields.add(new NumberField({ name: 'entrevista_etapa', required: false, min: 0 }))
    casos.fields.add(new TextField({ name: 'decisao_observacao', required: false, max: 2400 }))
    casos.fields.add(new TextField({ name: 'validado_por', required: false, max: 80 }))
    casos.fields.add(new DateField({ name: 'decisao_em', required: false }))
    casos.fields.add(new TextField({ name: 'conhecimento_status', required: false, max: 80 }))
    casos.fields.add(new TextField({ name: 'conhecimento_audit_id', required: false, max: 160 }))
    casos.fields.add(new TextField({ name: 'conhecimento_versao', required: false, max: 160 }))
    casos.fields.add(new TextField({ name: 'created_by', required: false, max: 80 }))
    casos.fields.add(new TextField({ name: 'updated_by', required: false, max: 80 }))
    casos.fields.add(new DateField({ name: 'first_seen_at', required: true }))
    casos.fields.add(new DateField({ name: 'last_seen_at', required: true }))
    casos.fields.add(new DateField({ name: 'next_review_at', required: false }))
    casos.fields.add(new DateField({ name: 'approved_at', required: false }))
    casos.fields.add(new DateField({ name: 'withdrawn_at', required: false }))
    casos.indexes = [
      'CREATE UNIQUE INDEX idx_com_nexo_curadoria_casos_fingerprint ON com_nexo_curadoria_casos (fingerprint)',
      'CREATE INDEX idx_com_nexo_curadoria_casos_fila ON com_nexo_curadoria_casos (status, alcada, last_seen_at)',
      'CREATE INDEX idx_com_nexo_curadoria_casos_escopo ON com_nexo_curadoria_casos (escopo_tipo, escopo_ref)',
    ]
    app.save(casos)

    var evidencias = new Collection({
      type: 'base',
      name: 'com_nexo_curadoria_evidencias',
      createRule: null,
      updateRule: null,
      deleteRule: null,
      listRule: null,
      viewRule: null,
    })
    evidencias.fields.add(new TextField({ name: 'caso_id', required: true, max: 80 }))
    evidencias.fields.add(new TextField({ name: 'fonte_tipo', required: true, max: 80 }))
    evidencias.fields.add(new TextField({ name: 'fonte_ref', required: false, max: 200 }))
    evidencias.fields.add(new TextField({ name: 'evidencia_hash', required: true, max: 160 }))
    evidencias.fields.add(new TextField({ name: 'escopo_ref', required: false, max: 160 }))
    evidencias.fields.add(new TextField({ name: 'resumo_factual', required: true, max: 2400 }))
    evidencias.fields.add(new JSONField({ name: 'metadados', required: false, maxSize: 6000 }))
    evidencias.fields.add(new DateField({ name: 'occurred_at', required: true }))
    evidencias.indexes = [
      'CREATE UNIQUE INDEX idx_com_nexo_curadoria_evidencias_unica ON com_nexo_curadoria_evidencias (caso_id, evidencia_hash)',
      'CREATE INDEX idx_com_nexo_curadoria_evidencias_fonte ON com_nexo_curadoria_evidencias (fonte_tipo, occurred_at)',
    ]
    app.save(evidencias)

    var transicoes = new Collection({
      type: 'base',
      name: 'com_nexo_curadoria_transicoes',
      createRule: null,
      updateRule: null,
      deleteRule: null,
      listRule: null,
      viewRule: null,
    })
    transicoes.fields.add(new TextField({ name: 'caso_id', required: true, max: 80 }))
    transicoes.fields.add(new TextField({ name: 'transicao_chave', required: true, max: 200 }))
    transicoes.fields.add(new TextField({ name: 'status_anterior', required: false, max: 80 }))
    transicoes.fields.add(new TextField({ name: 'status_novo', required: true, max: 80 }))
    transicoes.fields.add(new TextField({ name: 'ator_id', required: false, max: 80 }))
    transicoes.fields.add(new TextField({ name: 'motivo', required: true, max: 2000 }))
    transicoes.fields.add(new JSONField({ name: 'metadados', required: false, maxSize: 6000 }))
    transicoes.fields.add(new DateField({ name: 'ocorreu_em', required: true }))
    transicoes.indexes = [
      'CREATE UNIQUE INDEX idx_com_nexo_curadoria_transicoes_chave ON com_nexo_curadoria_transicoes (transicao_chave)',
      'CREATE INDEX idx_com_nexo_curadoria_transicoes_caso ON com_nexo_curadoria_transicoes (caso_id, ocorreu_em)',
    ]
    app.save(transicoes)

    var outbox = new Collection({
      type: 'base',
      name: 'com_nexo_curadoria_outbox',
      createRule: null,
      updateRule: null,
      deleteRule: null,
      listRule: null,
      viewRule: null,
    })
    outbox.fields.add(new TextField({ name: 'caso_id', required: true, max: 80 }))
    outbox.fields.add(new TextField({ name: 'decisao_id', required: false, max: 80 }))
    outbox.fields.add(new TextField({ name: 'acao', required: true, max: 40 }))
    outbox.fields.add(new TextField({ name: 'idempotency_key', required: true, max: 200 }))
    outbox.fields.add(new TextField({ name: 'status', required: true, max: 80 }))
    outbox.fields.add(new NumberField({ name: 'tentativas', required: true, min: 0 }))
    outbox.fields.add(new TextField({ name: 'last_error', required: false, max: 2000 }))
    outbox.fields.add(new TextField({ name: 'payload_hash', required: true, max: 160 }))
    outbox.fields.add(new JSONField({ name: 'payload_json', required: true, maxSize: 16000 }))
    outbox.fields.add(new NumberField({ name: 'caso_revisao', required: true, min: 1 }))
    outbox.fields.add(new TextField({ name: 'audit_id', required: false, max: 160 }))
    outbox.fields.add(new TextField({ name: 'target_version', required: false, max: 160 }))
    outbox.fields.add(new DateField({ name: 'requested_at', required: true }))
    outbox.fields.add(new DateField({ name: 'processed_at', required: false }))
    outbox.indexes = [
      'CREATE UNIQUE INDEX idx_com_nexo_curadoria_outbox_idempotency ON com_nexo_curadoria_outbox (idempotency_key)',
      'CREATE INDEX idx_com_nexo_curadoria_outbox_fila ON com_nexo_curadoria_outbox (status, requested_at)',
    ]
    app.save(outbox)
  },
  function (app) {
    var nomes = [
      'com_nexo_curadoria_outbox',
      'com_nexo_curadoria_transicoes',
      'com_nexo_curadoria_evidencias',
      'com_nexo_curadoria_casos',
    ]
    for (var i = 0; i < nomes.length; i++) {
      try {
        app.delete(app.findCollectionByNameOrId(nomes[i]))
      } catch (_) {}
    }
  },
)
