migrate(
  function (app) {
    var decisoes = app.findCollectionByNameOrId('com_nexo_curadoria_decisoes')
    decisoes.createRule = null
    decisoes.updateRule = null
    decisoes.deleteRule = null
    app.save(decisoes)

    function sameFieldValue(left, right) {
      if (left === right) return true
      return (
        left !== null &&
        right !== null &&
        typeof left === 'object' &&
        typeof right === 'object' &&
        String(left) === String(right)
      )
    }

    function collectionOrNew(name) {
      try {
        return app.findCollectionByNameOrId(name)
      } catch (_) {
        return new Collection({
          type: 'base',
          name: name,
          createRule: null,
          updateRule: null,
          deleteRule: null,
          listRule: null,
          viewRule: null,
        })
      }
    }

    function lockDown(collection) {
      collection.createRule = null
      collection.updateRule = null
      collection.deleteRule = null
      collection.listRule = null
      collection.viewRule = null
    }

    function addOrValidate(collection, field) {
      var existing = collection.fields.getByName(field.name)
      if (!existing) {
        collection.fields.add(field)
        return
      }

      if (existing.type() !== field.type()) {
        throw new Error('incompatible field ' + collection.name + '.' + field.name + ': type')
      }

      var keys = ['required', 'max', 'min', 'maxSize', 'onlyInt']
      for (var i = 0; i < keys.length; i++) {
        var key = keys[i]
        if (field[key] !== undefined && !sameFieldValue(existing[key], field[key])) {
          throw new Error('incompatible field ' + collection.name + '.' + field.name + ': ' + key)
        }
      }
    }

    function ensureFields(collection, fields) {
      for (var i = 0; i < fields.length; i++) addOrValidate(collection, fields[i])
    }

    function indexName(definition) {
      var match = String(definition).match(
        /^\s*CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:"([^"]+)"|\[([^\]]+)\]|([^\s]+))/i,
      )
      return match ? match[1] || match[2] || match[3] : null
    }

    function withoutIndex(indexes, name) {
      var out = []
      for (var i = 0; i < (indexes || []).length; i++) {
        if (indexName(indexes[i]) !== name) out.push(indexes[i])
      }
      return out
    }

    function setIndexes(collection, definitions) {
      var current = collection.indexes || []
      for (var i = 0; i < definitions.length; i++) {
        current = withoutIndex(current, indexName(definitions[i]))
        current.push(definitions[i])
      }
      collection.indexes = current
    }

    function normalizeSql(definition) {
      return String(definition).trim().replace(/\s+/g, ' ').toLowerCase()
    }

    function preflightPopulated(collection, requiredFields, uniqueIndexes) {
      try {
        app.findCollectionByNameOrId(collection.name)
      } catch (_) {
        return
      }
      if (app.countRecords(collection.name) === 0) return

      var problems = []
      for (var fi = 0; fi < requiredFields.length; fi++) {
        var expected = requiredFields[fi]
        var existing = collection.fields.getByName(expected.name)
        if (!existing) {
          problems.push('missing required field ' + expected.name)
          continue
        }
        if (existing.type() !== expected.type()) {
          problems.push('incompatible required field ' + expected.name + '.type')
          continue
        }
        var keys = ['required', 'max', 'min', 'maxSize', 'onlyInt']
        for (var ki = 0; ki < keys.length; ki++) {
          var key = keys[ki]
          if (expected[key] !== undefined && !sameFieldValue(existing[key], expected[key])) {
            problems.push('incompatible required field ' + expected.name + '.' + key)
            break
          }
        }
      }
      for (var ii = 0; ii < uniqueIndexes.length; ii++) {
        var expectedIndex = uniqueIndexes[ii]
        var matches = 0
        for (var ci = 0; ci < (collection.indexes || []).length; ci++) {
          if (
            indexName(collection.indexes[ci]) === indexName(expectedIndex) &&
            normalizeSql(collection.indexes[ci]) === normalizeSql(expectedIndex)
          ) {
            matches++
          }
        }
        if (matches !== 1)
          problems.push('missing or incompatible unique index ' + indexName(expectedIndex))
      }

      if (problems.length > 0) {
        throw new Error(
          'populated partial Curadoria collection ' +
            collection.name +
            ': ' +
            problems.join(', ') +
            '; refusing schema changes',
        )
      }
    }

    var eventos = app.findCollectionByNameOrId('com_nexo_aprendizado_eventos')
    ensureFields(eventos, [
      new TextField({ name: 'fonte_origem', required: false, max: 160 }),
      new TextField({ name: 'evidencia_status', required: false, max: 80 }),
      new BoolField({ name: 'whatsapp_evidencia', required: false }),
      new TextField({ name: 'whatsapp_evidencia_hash', required: false, max: 160 }),
      new DateField({ name: 'whatsapp_janela_inicio', required: false }),
      new DateField({ name: 'whatsapp_janela_fim', required: false }),
      new NumberField({ name: 'whatsapp_conversas', min: 0, onlyInt: true, required: false }),
      new NumberField({ name: 'whatsapp_mensagens', min: 0, onlyInt: true, required: false }),
      new TextField({ name: 'whatsapp_resumo_factual', required: false, max: 4000 }),
      new BoolField({ name: 'conhecimento_oficial', required: false }),
    ])
    app.save(eventos)

    var ledger = app.findCollectionByNameOrId('com_ledger_comercial')
    ensureFields(ledger, [
      new TextField({ name: 'payload_hash', required: false, max: 160 }),
      new TextField({ name: 'negocio_id', required: false, max: 80 }),
      new TextField({ name: 'responsavel_id', required: false, max: 80 }),
      new TextField({ name: 'equipe_id', required: false, max: 80 }),
    ])
    ledger.indexes = withoutIndex(ledger.indexes, 'idx_com_ledger_comercial_audit')
    setIndexes(ledger, [
      "CREATE UNIQUE INDEX idx_com_ledger_comercial_audit_unique ON com_ledger_comercial (audit_id) WHERE audit_id != ''",
    ])
    app.save(ledger)

    var casos = collectionOrNew('com_nexo_curadoria_casos')
    preflightPopulated(
      casos,
      [
        new TextField({ name: 'fingerprint', required: true, max: 160 }),
        new NumberField({ name: 'revisao', required: true, min: 1 }),
        new TextField({ name: 'status', required: true, max: 80 }),
        new TextField({ name: 'fonte_principal', required: true, max: 80 }),
        new TextField({ name: 'escopo_tipo', required: true, max: 80 }),
        new TextField({ name: 'assunto_chave', required: true, max: 160 }),
        new TextField({ name: 'recorrencia_chave', required: true, max: 160 }),
        new TextField({ name: 'titulo', required: true, max: 300 }),
        new TextField({ name: 'resumo_factual', required: true, max: 4000 }),
        new TextField({ name: 'motivo_curadoria', required: true, max: 2000 }),
        new NumberField({ name: 'evidencia_contagem', required: true, min: 0 }),
        new NumberField({ name: 'casos_independentes', required: true, min: 0 }),
        new NumberField({ name: 'recorrencia_contagem', required: true, min: 0 }),
        new TextField({ name: 'risco_classe', required: true, max: 80 }),
        new TextField({ name: 'alcada', required: true, max: 80 }),
        new TextField({ name: 'confianca', required: true, max: 40 }),
        new DateField({ name: 'first_seen_at', required: true }),
        new DateField({ name: 'last_seen_at', required: true }),
      ],
      [
        'CREATE UNIQUE INDEX idx_com_nexo_curadoria_casos_fingerprint ON com_nexo_curadoria_casos (fingerprint)',
      ],
    )
    lockDown(casos)
    ensureFields(casos, [
      new TextField({ name: 'fingerprint', required: true, max: 160 }),
      new NumberField({ name: 'revisao', required: true, min: 1 }),
      new TextField({ name: 'status', required: true, max: 80 }),
      new TextField({ name: 'fonte_principal', required: true, max: 80 }),
      new JSONField({ name: 'fontes', required: false, maxSize: 4000 }),
      new TextField({ name: 'escopo_tipo', required: true, max: 80 }),
      new TextField({ name: 'escopo_ref', required: false, max: 160 }),
      new TextField({ name: 'empresa_nome', required: false, max: 240 }),
      new TextField({ name: 'contato_nome', required: false, max: 240 }),
      new TextField({ name: 'negocio_numero', required: false, max: 120 }),
      new TextField({ name: 'negocio_titulo', required: false, max: 300 }),
      new TextField({ name: 'responsavel_nome', required: false, max: 200 }),
      new TextField({ name: 'assunto_chave', required: true, max: 160 }),
      new TextField({ name: 'recorrencia_chave', required: true, max: 160 }),
      new TextField({ name: 'titulo', required: true, max: 300 }),
      new TextField({ name: 'resumo_factual', required: true, max: 4000 }),
      new TextField({ name: 'motivo_curadoria', required: true, max: 2000 }),
      new TextField({ name: 'regra_candidata', required: false, max: 4000 }),
      new NumberField({ name: 'evidencia_contagem', required: true, min: 0 }),
      new NumberField({ name: 'casos_independentes', required: true, min: 0 }),
      new NumberField({ name: 'recorrencia_contagem', required: true, min: 0 }),
      new JSONField({ name: 'evidencia_hashes', required: false, maxSize: 12000 }),
      new TextField({ name: 'risco_classe', required: true, max: 80 }),
      new TextField({ name: 'alcada', required: true, max: 80 }),
      new JSONField({ name: 'sensivel_motivos', required: false, maxSize: 4000 }),
      new TextField({ name: 'confianca', required: true, max: 40 }),
      new BoolField({ name: 'human_review_required', required: false }),
      new BoolField({ name: 'automatic_promotion_allowed', required: false }),
      new JSONField({ name: 'entrevista_respostas', required: false, maxSize: 12000 }),
      new NumberField({ name: 'entrevista_etapa', required: false, min: 0 }),
      new TextField({ name: 'decisao_observacao', required: false, max: 2400 }),
      new TextField({ name: 'validado_por', required: false, max: 80 }),
      new DateField({ name: 'decisao_em', required: false }),
      new TextField({ name: 'conhecimento_status', required: false, max: 80 }),
      new TextField({ name: 'conhecimento_audit_id', required: false, max: 160 }),
      new TextField({ name: 'conhecimento_versao', required: false, max: 160 }),
      new TextField({ name: 'created_by', required: false, max: 80 }),
      new TextField({ name: 'updated_by', required: false, max: 80 }),
      new DateField({ name: 'first_seen_at', required: true }),
      new DateField({ name: 'last_seen_at', required: true }),
      new DateField({ name: 'next_review_at', required: false }),
      new DateField({ name: 'approved_at', required: false }),
      new DateField({ name: 'withdrawn_at', required: false }),
      new TextField({ name: 'responsavel_id', required: false, max: 80 }),
      new TextField({ name: 'equipe_id', required: false, max: 80 }),
      new TextField({ name: 'negocio_id', required: false, max: 80 }),
    ])
    setIndexes(casos, [
      'CREATE UNIQUE INDEX idx_com_nexo_curadoria_casos_fingerprint ON com_nexo_curadoria_casos (fingerprint)',
      'CREATE INDEX idx_com_nexo_curadoria_casos_fila ON com_nexo_curadoria_casos (status, alcada, last_seen_at)',
      'CREATE INDEX idx_com_nexo_curadoria_casos_escopo ON com_nexo_curadoria_casos (escopo_tipo, escopo_ref)',
      'CREATE INDEX idx_com_nexo_curadoria_casos_autorizacao ON com_nexo_curadoria_casos (equipe_id, responsavel_id, negocio_id)',
    ])
    app.save(casos)

    var evidencias = collectionOrNew('com_nexo_curadoria_evidencias')
    preflightPopulated(
      evidencias,
      [
        new TextField({ name: 'caso_id', required: true, max: 80 }),
        new TextField({ name: 'fonte_tipo', required: true, max: 80 }),
        new TextField({ name: 'evidencia_hash', required: true, max: 160 }),
        new TextField({ name: 'resumo_factual', required: true, max: 2400 }),
        new DateField({ name: 'occurred_at', required: true }),
      ],
      [
        'CREATE UNIQUE INDEX idx_com_nexo_curadoria_evidencias_unica ON com_nexo_curadoria_evidencias (caso_id, evidencia_hash)',
      ],
    )
    lockDown(evidencias)
    ensureFields(evidencias, [
      new TextField({ name: 'caso_id', required: true, max: 80 }),
      new TextField({ name: 'fonte_tipo', required: true, max: 80 }),
      new TextField({ name: 'fonte_ref', required: false, max: 200 }),
      new TextField({ name: 'evidencia_hash', required: true, max: 160 }),
      new TextField({ name: 'escopo_ref', required: false, max: 160 }),
      new TextField({ name: 'resumo_factual', required: true, max: 2400 }),
      new JSONField({ name: 'metadados', required: false, maxSize: 6000 }),
      new DateField({ name: 'occurred_at', required: true }),
    ])
    setIndexes(evidencias, [
      'CREATE UNIQUE INDEX idx_com_nexo_curadoria_evidencias_unica ON com_nexo_curadoria_evidencias (caso_id, evidencia_hash)',
      'CREATE INDEX idx_com_nexo_curadoria_evidencias_fonte ON com_nexo_curadoria_evidencias (fonte_tipo, occurred_at)',
    ])
    app.save(evidencias)

    var transicoes = collectionOrNew('com_nexo_curadoria_transicoes')
    preflightPopulated(
      transicoes,
      [
        new TextField({ name: 'caso_id', required: true, max: 80 }),
        new TextField({ name: 'transicao_chave', required: true, max: 200 }),
        new TextField({ name: 'status_novo', required: true, max: 80 }),
        new TextField({ name: 'motivo', required: true, max: 2000 }),
        new DateField({ name: 'ocorreu_em', required: true }),
      ],
      [
        'CREATE UNIQUE INDEX idx_com_nexo_curadoria_transicoes_chave ON com_nexo_curadoria_transicoes (transicao_chave)',
      ],
    )
    lockDown(transicoes)
    ensureFields(transicoes, [
      new TextField({ name: 'caso_id', required: true, max: 80 }),
      new TextField({ name: 'transicao_chave', required: true, max: 200 }),
      new TextField({ name: 'status_anterior', required: false, max: 80 }),
      new TextField({ name: 'status_novo', required: true, max: 80 }),
      new TextField({ name: 'ator_id', required: false, max: 80 }),
      new TextField({ name: 'motivo', required: true, max: 2000 }),
      new JSONField({ name: 'metadados', required: false, maxSize: 6000 }),
      new DateField({ name: 'ocorreu_em', required: true }),
      new TextField({ name: 'command_hash', required: false, max: 160 }),
    ])
    setIndexes(transicoes, [
      'CREATE UNIQUE INDEX idx_com_nexo_curadoria_transicoes_chave ON com_nexo_curadoria_transicoes (transicao_chave)',
      'CREATE INDEX idx_com_nexo_curadoria_transicoes_caso ON com_nexo_curadoria_transicoes (caso_id, ocorreu_em)',
    ])
    app.save(transicoes)

    var outbox = collectionOrNew('com_nexo_curadoria_outbox')
    preflightPopulated(
      outbox,
      [
        new TextField({ name: 'caso_id', required: true, max: 80 }),
        new TextField({ name: 'acao', required: true, max: 40 }),
        new TextField({ name: 'idempotency_key', required: true, max: 200 }),
        new TextField({ name: 'status', required: true, max: 80 }),
        new NumberField({ name: 'tentativas', required: true, min: 0 }),
        new TextField({ name: 'payload_hash', required: true, max: 160 }),
        new JSONField({ name: 'payload_json', required: true, maxSize: 16000 }),
        new NumberField({ name: 'caso_revisao', required: true, min: 1 }),
        new DateField({ name: 'requested_at', required: true }),
      ],
      [
        'CREATE UNIQUE INDEX idx_com_nexo_curadoria_outbox_idempotency ON com_nexo_curadoria_outbox (idempotency_key)',
      ],
    )
    lockDown(outbox)
    ensureFields(outbox, [
      new TextField({ name: 'caso_id', required: true, max: 80 }),
      new TextField({ name: 'decisao_id', required: false, max: 80 }),
      new TextField({ name: 'acao', required: true, max: 40 }),
      new TextField({ name: 'idempotency_key', required: true, max: 200 }),
      new TextField({ name: 'status', required: true, max: 80 }),
      new NumberField({ name: 'tentativas', required: true, min: 0 }),
      new TextField({ name: 'last_error', required: false, max: 2000 }),
      new TextField({ name: 'payload_hash', required: true, max: 160 }),
      new JSONField({ name: 'payload_json', required: true, maxSize: 16000 }),
      new NumberField({ name: 'caso_revisao', required: true, min: 1 }),
      new TextField({ name: 'audit_id', required: false, max: 160 }),
      new TextField({ name: 'target_version', required: false, max: 160 }),
      new DateField({ name: 'requested_at', required: true }),
      new DateField({ name: 'processed_at', required: false }),
      new DateField({ name: 'next_attempt_at', required: false }),
      new DateField({ name: 'last_attempt_at', required: false }),
      new NumberField({ name: 'tentativas_ciclo', required: false, min: 0, onlyInt: true }),
      new NumberField({ name: 'retry_count', required: false, min: 0, onlyInt: true }),
      new TextField({ name: 'retry_requested_by', required: false, max: 80 }),
      new TextField({ name: 'retry_reason', required: false, max: 1000 }),
      new TextField({ name: 'superseded_by', required: false, max: 80 }),
      new TextField({ name: 'claim_token', required: false, max: 160 }),
      new DateField({ name: 'claimed_at', required: false }),
      new DateField({ name: 'claim_expires_at', required: false }),
    ])
    setIndexes(outbox, [
      'CREATE UNIQUE INDEX idx_com_nexo_curadoria_outbox_idempotency ON com_nexo_curadoria_outbox (idempotency_key)',
      'CREATE INDEX idx_com_nexo_curadoria_outbox_fila ON com_nexo_curadoria_outbox (status, requested_at)',
      'CREATE INDEX idx_com_nexo_curadoria_outbox_caso_revisao ON com_nexo_curadoria_outbox (caso_id, caso_revisao, status)',
      'CREATE INDEX idx_com_nexo_curadoria_outbox_retry ON com_nexo_curadoria_outbox (status, next_attempt_at, requested_at)',
      'CREATE INDEX idx_com_nexo_curadoria_outbox_claim ON com_nexo_curadoria_outbox (status, claim_expires_at, requested_at)',
    ])
    app.save(outbox)

    var auditoria = collectionOrNew('com_nexo_curadoria_outbox_auditoria')
    preflightPopulated(
      auditoria,
      [
        new TextField({ name: 'outbox_id', required: true, max: 80 }),
        new NumberField({ name: 'retry_count', required: true, min: 1, onlyInt: true }),
        new TextField({ name: 'ator_id', required: true, max: 80 }),
        new TextField({ name: 'motivo', required: true, max: 1000 }),
        new TextField({ name: 'status_anterior', required: true, max: 80 }),
        new DateField({ name: 'requested_at', required: true }),
      ],
      [
        'CREATE UNIQUE INDEX idx_com_nexo_curadoria_outbox_auditoria_retry ON com_nexo_curadoria_outbox_auditoria (outbox_id, retry_count)',
      ],
    )
    lockDown(auditoria)
    ensureFields(auditoria, [
      new TextField({ name: 'outbox_id', required: true, max: 80 }),
      new NumberField({ name: 'retry_count', required: true, min: 1, onlyInt: true }),
      new TextField({ name: 'ator_id', required: true, max: 80 }),
      new TextField({ name: 'motivo', required: true, max: 1000 }),
      new TextField({ name: 'status_anterior', required: true, max: 80 }),
      new DateField({ name: 'requested_at', required: true }),
    ])
    setIndexes(auditoria, [
      'CREATE UNIQUE INDEX idx_com_nexo_curadoria_outbox_auditoria_retry ON com_nexo_curadoria_outbox_auditoria (outbox_id, retry_count)',
      'CREATE INDEX idx_com_nexo_curadoria_outbox_auditoria_data ON com_nexo_curadoria_outbox_auditoria (requested_at)',
    ])
    app.save(auditoria)
  },
  function (_) {
    // Intentionally non-destructive: recovery only converges schema, ACLs, and indexes.
  },
)
