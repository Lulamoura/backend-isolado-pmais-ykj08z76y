// T4.4 — porta única, transacional e auditável de nova oportunidade.
routerAdd(
  'POST',
  '/backend/v1/negocios/entrada',
  (e) => {
    // T6.AC — enquanto o ActiveCampaign for a fonte oficial, a entrada manual
    // não integra o fluxo operacional. Somente o Superadministrador pode usar
    // a contingência, que será endurecida com justificativa/auditoria no pacote.
    var perfilEntrada = ''
    try {
      var perfilRestrito = $app.findRecordById('com_perfis', e.auth.getString('perfil_id'))
      perfilEntrada = perfilRestrito.getString('slug')
    } catch (_) {}
    if (perfilEntrada === 'negociacao-propria') return e.json(403, { error: 'ACAO_NAO_AUTORIZADA' })
    if (perfilEntrada !== 'superadministrador')
      return e.json(403, {
        error: 'ENTRADA_MANUAL_BLOQUEADA',
        message: 'O ActiveCampaign e a fonte oficial de novas oportunidades',
      })
    function canonicalize(obj) {
      if (obj === null || obj === undefined) return 'null'
      if (typeof obj !== 'object') return JSON.stringify(obj)
      var keys = Object.keys(obj).sort(),
        parts = []
      for (var i = 0; i < keys.length; i++)
        parts.push(JSON.stringify(keys[i]) + ':' + canonicalize(obj[keys[i]]))
      return '{' + parts.join(',') + '}'
    }
    function rid(v) {
      return /^[a-z0-9]{15}$/.test(v || '')
    }
    function txt(v, max) {
      v = String(v || '').trim()
      return v.length <= max ? v : ''
    }

    var ator = e.auth
    if (!ator) return e.unauthorizedError('Autenticacao necessaria')
    if (!ator.getBool('ativo_comercial')) return e.forbiddenError('Usuario comercial inativo')
    var body
    try {
      body = JSON.parse(toString(e.request.body))
    } catch (_) {
      return e.badRequestError('JSON invalido')
    }
    var allowed = [
      'titulo',
      'empresa_id',
      'contato_principal_id',
      'equipe_id',
      'responsavel_id',
      'captador_id',
      'origem_canal',
      'modo',
      'modalidade',
      'necessidade',
      'localizacao',
      'dimensao_estimada',
      'prazo_cliente',
      'proxima_acao',
      'proxima_acao_em',
      'descricao',
      'justificativa_contingencia',
      'confirmacao_contingencia',
      'command_idempotency_key',
    ]
    var keys = Object.keys(body || {})
    for (var k = 0; k < keys.length; k++)
      if (allowed.indexOf(keys[k]) === -1)
        return e.json(400, { error: 'VALIDATION', message: 'Campo nao permitido: ' + keys[k] })
    var modo =
      body.modo === 'pre_qualificada'
        ? 'pre_qualificada'
        : body.modo === 'pendente'
          ? 'pendente'
          : ''
    var justificativaContingencia = txt(body.justificativa_contingencia, 1000)
    if (
      justificativaContingencia.length < 20 ||
      body.confirmacao_contingencia !== 'CRIAR FORA DO ACTIVECAMPAIGN'
    )
      return e.json(400, {
        error: 'CONTINGENCIA_NAO_CONFIRMADA',
        message: 'Justificativa e confirmacao literal sao obrigatorias',
      })
    if (
      !modo ||
      !txt(body.titulo, 300) ||
      !rid(body.empresa_id) ||
      !rid(body.responsavel_id) ||
      !txt(body.origem_canal, 120) ||
      !body.command_idempotency_key ||
      body.command_idempotency_key.length > 128
    )
      return e.json(400, {
        error: 'CAMPOS_MINIMOS',
        message: 'Titulo, empresa, responsavel, origem, modo e idempotencia sao obrigatorios',
      })
    var minimoPre =
      rid(body.contato_principal_id) &&
      ['recorrente', 'evento', 'serv_eventual'].indexOf(body.modalidade) >= 0 &&
      txt(body.necessidade, 2000) &&
      txt(body.dimensao_estimada, 300) &&
      body.prazo_cliente &&
      txt(body.proxima_acao, 1000) &&
      body.proxima_acao_em
    if (modo === 'pre_qualificada' && !minimoPre)
      return e.json(400, {
        error: 'PRE_QUALIFICACAO_INCOMPLETA',
        message:
          'Pre-qualificacao exige contato, modalidade, necessidade, dimensao, prazo e proxima acao datada',
      })

    var payload = {}
    for (var p = 0; p < allowed.length; p++)
      if (allowed[p] !== 'command_idempotency_key') payload[allowed[p]] = body[allowed[p]] || null
    var payloadHash = $security.sha256(canonicalize(payload))
    var existentes = $app.findRecordsByFilter(
      'com_idempotencia',
      "ator_id='" +
        ator.id +
        "' && comando='criar_oportunidade' && command_idempotency_key='" +
        body.command_idempotency_key +
        "'",
      '',
      1,
      0,
    )
    if (existentes.length) {
      if (existentes[0].getString('payload_hash') !== payloadHash)
        return e.json(409, { error: 'CONFLICT' })
      // O JSVM pode expor JSON persistido como mapa dinâmico sem propriedades
      // enumeráveis. Os IDs canônicos também estão em registros_afetados e o
      // estado é derivado do payload já validado, evitando resposta vazia.
      var afetados = []
      try {
        afetados = JSON.parse(existentes[0].getString('registros_afetados') || '[]')
      } catch (_) {}
      return e.json(200, {
        negocio_id: afetados.length ? afetados[0] : '',
        etapa: modo === 'pre_qualificada' ? 'producao_proposta' : 'prospects',
        qualificacao: modo === 'pre_qualificada' ? 'qualificada' : 'pendente',
        historico_id: modo === 'pre_qualificada' && afetados.length > 1 ? afetados[1] : '',
        replay: true,
      })
    }
    var resposta = null,
      txError = ''
    try {
      $app.runInTransaction(function (tx) {
        var usuario = tx.findRecordById('users', ator.id)
        if (!usuario.getBool('ativo_comercial')) throw new Error('FORBIDDEN')
        tx.findRecordById('com_empresas', body.empresa_id)
        tx.findRecordById('users', body.responsavel_id)
        if (body.contato_principal_id) tx.findRecordById('com_contatos', body.contato_principal_id)
        var idem = new Record(tx.findCollectionByNameOrId('com_idempotencia'))
        idem.set('command_idempotency_key', body.command_idempotency_key)
        idem.set('comando', 'criar_oportunidade')
        idem.set('ator_id', ator.id)
        idem.set('payload_hash', payloadHash)
        idem.set('estado', 'executando')
        idem.set('executor_id', 'pb-primary')
        idem.set('tentativa', 1)
        idem.set('claim_version', 1)
        idem.set('inicio_em', new Date())
        idem.set('lease_ate', new Date(Date.now() + 300000))
        idem.set('resultado', {})
        idem.set('registros_afetados', [])
        tx.save(idem)
        var n = new Record(tx.findCollectionByNameOrId('com_negocios'))
        n.set('titulo', txt(body.titulo, 300))
        n.set('empresa_id', body.empresa_id)
        n.set('responsavel_id', body.responsavel_id)
        if (body.equipe_id) n.set('equipe_id', body.equipe_id)
        if (body.contato_principal_id) n.set('contato_principal_id', body.contato_principal_id)
        if (body.captador_id) n.set('captador_id', body.captador_id)
        n.set('origem_canal', txt(body.origem_canal, 120))
        n.set('tipo_entrada', modo)
        n.set('qualificacao', modo === 'pre_qualificada' ? 'qualificada' : 'pendente')
        n.set('etapa', modo === 'pre_qualificada' ? 'producao_proposta' : 'prospects')
        n.set('prospectivo', true)
        n.set('inativo', false)
        if (body.modalidade) n.set('modalidade', body.modalidade)
        if (body.necessidade) n.set('necessidade', txt(body.necessidade, 2000))
        if (body.localizacao) n.set('localizacao', txt(body.localizacao, 300))
        if (body.dimensao_estimada) n.set('dimensao_estimada', txt(body.dimensao_estimada, 300))
        if (body.prazo_cliente) n.set('prazo_cliente', body.prazo_cliente)
        n.set('descricao', txt(body.descricao, 2000))
        tx.save(n)
        var histId = ''
        if (modo === 'pre_qualificada') {
          var h = new Record(tx.findCollectionByNameOrId('com_qualificacao_historico'))
          h.set('negocio_id', n.id)
          h.set('idempotency_key', body.command_idempotency_key)
          h.set('estado_anterior', 'pendente')
          h.set('estado_novo', 'qualificada')
          h.set('autor_id', ator.id)
          h.set('origem', 'entrada_pre_qualificada')
          h.set('justificativa', 'Campos mínimos satisfeitos na entrada')
          h.set('data_hora_efetiva', new Date())
          tx.save(h)
          histId = h.id
        }
        var atividadeId = ''
        if (modo === 'pre_qualificada') {
          var at = new Record(tx.findCollectionByNameOrId('com_atividades'))
          at.set('negocio_id', n.id)
          at.set('tipo', 'tarefa_interna')
          at.set('descricao', txt(body.proxima_acao, 1000))
          at.set('autor_id', ator.id)
          at.set('responsavel_id', body.responsavel_id)
          at.set('estado', 'planejada')
          at.set('planejada_para', body.proxima_acao_em)
          at.set('creation_idempotency_key', body.command_idempotency_key + ':atividade')
          tx.save(at)
          atividadeId = at.id
        }
        var evidencia = {
          negocio_id: n.id,
          tipo_entrada: modo,
          etapa: n.getString('etapa'),
          qualificacao: n.getString('qualificacao'),
          autor_id: ator.id,
          atividade_id: atividadeId || null,
        }
        var a = new Record(tx.findCollectionByNameOrId('com_auditoria'))
        a.set('collection_name', 'com_negocios')
        a.set('record_id', n.id)
        a.set('acao', 'create')
        a.set('usuario_id', ator.id)
        a.set('comando', 'criar_oportunidade')
        a.set('command_idempotency_key', body.command_idempotency_key)
        a.set('transacao_id', $security.sha256(body.command_idempotency_key + '|' + n.id))
        a.set('evento_em', new Date())
        a.set('snapshot_hash', $security.sha256(canonicalize(evidencia)))
        a.set('snapshot_hash_versao', '1')
        a.set('evidencia_estruturada', evidencia)
        a.set('escopo', 'comando')
        a.set('origem', 'server-side')
        a.set('justificativa', justificativaContingencia)
        a.set('sequencia', 1)
        tx.save(a)
        resposta = {
          negocio_id: n.id,
          etapa: n.getString('etapa'),
          qualificacao: n.getString('qualificacao'),
          historico_id: histId,
          replay: false,
        }
        idem.set('estado', 'concluido')
        idem.set('conclusao_em', new Date())
        idem.set('codigo_retorno', '200')
        idem.set('resultado', resposta)
        idem.set('registros_afetados', histId ? [n.id, histId, atividadeId] : [n.id])
        tx.save(idem)
      })
    } catch (err) {
      txError = String(err).substring(0, 500)
    }
    if (txError.indexOf('FORBIDDEN') !== -1) return e.json(403, { error: 'FORBIDDEN' })
    if (txError) return e.json(500, { error: 'INTERNAL', message: 'Falha ao criar oportunidade' })
    return e.json(200, resposta)
  },
  $apis.requireAuth(),
)
