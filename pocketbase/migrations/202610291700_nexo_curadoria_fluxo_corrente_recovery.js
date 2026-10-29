migrate(
  function (app) {
    var POLICY_KEY = 'nexo.curadoria.fluxo_corrente_v1'
    var POLICY_VERSION = 'pmais_nexo_auto_promotion_policy_v1'
    var AUTOMATIC_SCHEMA_VERSION = 'pmais_nexo_curadoria_conhecimento_automatico_v1'
    var AUTOMATIC_AGENT_ID = 'nexo-curadoria-automatico'
    var MINIMUM_ID = '000000000000000'

    function validPocketBaseDate(value) {
      var match = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})\.(\d{3})Z$/.exec(
        String(value || ''),
      )
      if (!match) return false
      var year = Number(match[1])
      var month = Number(match[2])
      var day = Number(match[3])
      var hour = Number(match[4])
      var minute = Number(match[5])
      var second = Number(match[6])
      if (month < 1 || month > 12 || hour > 23 || minute > 59 || second > 59) return false
      var leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
      var days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
      return day >= 1 && day <= days[month - 1]
    }

    var ledger = app.findCollectionByNameOrId('com_ledger_comercial')
    var createdField = null
    try {
      createdField = ledger.fields.getByName('created')
    } catch (_) {}
    var hadCreatedField = !!createdField
    if (createdField) {
      if (createdField.type() !== 'autodate' || !createdField.onCreate || createdField.onUpdate)
        throw new Error('incompatible immutable ledger created field')
    }

    var cases = app.findCollectionByNameOrId('com_nexo_curadoria_casos')
    var casesCreatedField = null
    try {
      casesCreatedField = cases.fields.getByName('created')
    } catch (_) {}
    if (casesCreatedField) {
      if (
        casesCreatedField.type() !== 'autodate' ||
        !casesCreatedField.onCreate ||
        casesCreatedField.onUpdate
      )
        throw new Error('incompatible immutable cases created field')
    } else {
      cases.fields.add(new AutodateField({ name: 'created', onCreate: true, onUpdate: false }))
      app.save(cases)
    }

    var existingRows = app.findRecordsByFilter(
      'com_parametros',
      "chave = '" + POLICY_KEY + "'",
      '',
      2,
      0,
    )
    if (existingRows.length > 1) throw new Error('incompatible duplicate current-flow policy')
    if (existingRows.length === 1) {
      var existing = existingRows[0]
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
        !validPocketBaseDate(cutoff.created) ||
        !/^[a-z0-9]{15}$/.test(String(cutoff.id || '')) ||
        parsed.integrity_hash !== expectedHash
      )
        throw new Error('incompatible immutable current-flow policy')
      if (!hadCreatedField) {
        ledger.fields.add(new AutodateField({ name: 'created', onCreate: true, onUpdate: false }))
        app.save(ledger)
        var recoveredDated = app.findRecordsByFilter(
          'com_ledger_comercial',
          "created != ''",
          'created,id',
          1,
          0,
        )
        if (recoveredDated.length)
          throw new Error('historical ledger rows must remain undated after schema recovery')
      }
      return
    }

    if (hadCreatedField) {
      var ambiguousRows = app.findRecordsByFilter('com_ledger_comercial', "id != ''", 'id', 1, 0)
      if (ambiguousRows.length)
        throw new Error('ambiguous current-flow recovery with preexisting created field')
    } else {
      ledger.fields.add(new AutodateField({ name: 'created', onCreate: true, onUpdate: false }))
      app.save(ledger)
      var unexpectedlyDated = app.findRecordsByFilter(
        'com_ledger_comercial',
        "created != ''",
        'created,id',
        1,
        0,
      )
      if (unexpectedlyDated.length)
        throw new Error('historical ledger rows must remain undated after schema recovery')
    }

    var cutoffCreated = new Date().toISOString().replace('T', ' ')
    var cutoffId = MINIMUM_ID
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
    // Recovery is intentionally non-destructive and keeps an existing policy immutable.
  },
)
