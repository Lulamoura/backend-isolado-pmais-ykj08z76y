migrate(
  function (app) {
    var POLICY_KEY = 'nexo.curadoria.fluxo_corrente_v1'
    var POLICY_VERSION = 'pmais_nexo_auto_promotion_policy_v1'
    var AUTOMATIC_SCHEMA_VERSION = 'pmais_nexo_curadoria_conhecimento_automatico_v1'
    var AUTOMATIC_AGENT_ID = 'nexo-curadoria-automatico'

    try {
      var existing = app.findFirstRecordByData('com_parametros', 'chave', POLICY_KEY)
      var parsed = JSON.parse(existing.getString('valor') || '{}')
      var cutoff = parsed.cutoff || {}
      var expectedHash = String(
        $security.sha256(
          [
            POLICY_VERSION,
            String(cutoff.created || ''),
            String(cutoff.id || ''),
            AUTOMATIC_SCHEMA_VERSION,
            AUTOMATIC_AGENT_ID,
          ].join('|'),
        ),
      )
      if (
        !existing.getBool('ativo') ||
        existing.getString('tipo') !== 'json_imutavel' ||
        Number(existing.getInt('versao') || 0) !== 1 ||
        parsed.policy_version !== POLICY_VERSION ||
        parsed.automatic_schema_version !== AUTOMATIC_SCHEMA_VERSION ||
        parsed.automatic_agent_id !== AUTOMATIC_AGENT_ID ||
        !cutoff.created ||
        !cutoff.id ||
        parsed.integrity_hash !== expectedHash
      )
        throw new Error('incompatible immutable current-flow policy')
      return
    } catch (error) {
      if (String(error && error.message ? error.message : error).indexOf('incompatible') >= 0)
        throw error
    }

    var last = app.findRecordsByFilter('com_ledger_comercial', "id != ''", '-created,-id', 1, 0)
    var cutoffCreated = last.length ? last[0].getString('created') : '1970-01-01 00:00:00.000Z'
    var cutoffId = last.length ? String(last[0].id || '') : '000000000000000'
    if (!cutoffCreated || !cutoffId)
      throw new Error('cannot establish immutable current-flow cutoff')

    var policy = {
      policy_version: POLICY_VERSION,
      cutoff: { created: cutoffCreated, id: cutoffId },
      automatic_schema_version: AUTOMATIC_SCHEMA_VERSION,
      automatic_agent_id: AUTOMATIC_AGENT_ID,
      integrity_hash: String(
        $security.sha256(
          [
            POLICY_VERSION,
            cutoffCreated,
            cutoffId,
            AUTOMATIC_SCHEMA_VERSION,
            AUTOMATIC_AGENT_ID,
          ].join('|'),
        ),
      ),
    }
    var record = new Record(app.findCollectionByNameOrId('com_parametros'))
    record.set('chave', POLICY_KEY)
    record.set('valor', JSON.stringify(policy))
    record.set(
      'descricao',
      'Política imutável e marco (created,id) do fluxo corrente da Curadoria Nexo.',
    )
    record.set('tipo', 'json_imutavel')
    record.set('ativo', true)
    record.set('versao', 1)
    app.save(record)
  },
  function (_) {
    // Non-destructive by design: removing the watermark could expose the historical backlog.
  },
)
