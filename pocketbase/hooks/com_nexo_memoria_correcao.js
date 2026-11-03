routerAdd(
  'POST',
  '/backend/v1/nexo/negocios/{externalId}/memoria/correcao',
  function (e) {
    var ator = e.auth
    if (!ator || !ator.getBool('ativo_comercial'))
      return e.forbiddenError('Usuario comercial necessario')
    var perfil = ''
    try {
      perfil = $app.findRecordById('com_perfis', ator.getString('perfil_id')).getString('slug')
    } catch (_) {}
    if (!perfil || perfil === 'integracao')
      return e.forbiddenError('Perfil comercial nao autorizado para o Nexo')
    var externalId = String(e.request.pathValue('externalId') || '').trim()
    if (!/^[0-9]+$/.test(externalId)) return e.badRequestError('ID externo invalido')

    var body = {}
    try {
      body = e.requestInfo().body || {}
    } catch (_) {
      return e.badRequestError('Correcao invalida')
    }
    var signals = body.signals
    if (!signals || typeof signals !== 'object' || Array.isArray(signals))
      return e.badRequestError('Correcao invalida')
    var keys = Object.keys(signals).sort()
    if (keys.join(',') !== 'commitment_codes,next_step_code,objection_codes,risk_codes')
      return e.badRequestError('Campos da correcao invalidos')

    var permitidos = {
      commitment_codes: [
        'internal_validation_pending',
        'return_promised',
        'proposal_review_pending',
        'meeting_scheduled',
        'documents_pending',
      ],
      objection_codes: [
        'price',
        'deadline',
        'scope',
        'supplier_change',
        'decision_authority',
        'budget',
        'trust',
      ],
      risk_codes: [
        'stale_followup',
        'overdue_commitment',
        'no_response',
        'decision_delay',
        'scope_unclear',
        'commercial_divergence',
      ],
      next_step_code: [
        'request_confirmation',
        'schedule_followup',
        'clarify_scope',
        'send_proposal_for_review',
        'await_customer_return',
        'escalate_human_review',
        'no_action',
        'none',
      ],
    }
    function validarLista(nome) {
      var lista = signals[nome]
      if (!Array.isArray(lista) || lista.length > 5) return false
      var vistos = {}
      for (var i = 0; i < lista.length; i++) {
        if (
          typeof lista[i] !== 'string' ||
          permitidos[nome].indexOf(lista[i]) < 0 ||
          vistos[lista[i]]
        )
          return false
        vistos[lista[i]] = true
      }
      return true
    }
    if (
      !validarLista('commitment_codes') ||
      !validarLista('objection_codes') ||
      !validarLista('risk_codes') ||
      typeof signals.next_step_code !== 'string' ||
      permitidos.next_step_code.indexOf(signals.next_step_code) < 0
    )
      return e.badRequestError('Codigos da correcao invalidos')

    var vinculo
    var negocio
    try {
      vinculo = $app.findFirstRecordByFilter(
        'com_vinculos_externos',
        "sistema_origem='activecampaign' && external_type='business' && external_id = '" +
          externalId +
          "'",
      )
      negocio = $app.findRecordById('com_negocios', vinculo.getString('record_id'))
    } catch (_) {
      return e.notFoundError('Negocio nao encontrado')
    }
    function listaContem(lista, id) {
      if (!lista || !id) return false
      if (Array.isArray(lista)) return lista.indexOf(id) >= 0
      var texto = ''
      try {
        texto = JSON.stringify(lista)
      } catch (_) {
        texto = String(lista || '')
      }
      return texto.indexOf(id) >= 0
    }
    function substituicaoAutoriza(app, user, registroNegocio) {
      var titularId = registroNegocio.getString('responsavel_id')
      if (!titularId || !user || !user.id) return false
      try {
        var hojeRecife = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10)
        var filtro =
          "titular_id = '" +
          titularId +
          "' && (substituto_principal_id = '" +
          user.id +
          "' || substituto_reserva_id = '" +
          user.id +
          "')"
        var substituicoes = app.findRecordsByFilter(
          'com_substituicoes',
          filtro,
          '-created,-id',
          500,
          0,
        )
        for (var si = 0; si < substituicoes.length; si++) {
          var substituicao = substituicoes[si]
          if (substituicao.getString('cancelada_em')) continue
          var inicio = substituicao.getString('data_inicio').slice(0, 10)
          var fim = substituicao.getString('data_fim').slice(0, 10)
          if ((inicio && inicio > hojeRecife) || (fim && fim < hojeRecife)) continue
          if (substituicao.getString('tipo_cobertura') === 'integral') return true
          if (listaContem(substituicao.get('negocios_cobertos'), registroNegocio.id)) return true
        }
      } catch (_) {}
      return false
    }
    function podeAcessar(app, user, perfilSlug, registroNegocio) {
      if (perfilSlug === 'superadministrador' || perfilSlug === 'leitura-executiva') return true
      if (registroNegocio.getString('responsavel_id') === user.id) return true
      if (substituicaoAutoriza(app, user, registroNegocio)) return true
      var escopo = 'proprios'
      try {
        var links = app.findRecordsByFilter(
          'com_perfil_permissoes',
          "perfil_id = '" + user.getString('perfil_id') + "'",
          '-created,-id',
          500,
          0,
        )
        for (var p = 0; p < links.length; p++) {
          var permissao = app.findRecordById('com_permissoes', links[p].getString('permissao_id'))
          if (permissao.getString('slug') === 'negocios.view') escopo = links[p].getString('escopo')
        }
      } catch (_) {}
      if (escopo === 'todos') return true
      return (
        escopo === 'equipe' &&
        !!user.getString('equipe_id') &&
        registroNegocio.getString('equipe_id') === user.getString('equipe_id')
      )
    }
    if (!podeAcessar($app, ator, perfil, negocio)) return e.forbiddenError('Sem acesso ao negocio')

    var canonicalSignals = {
      commitment_codes: signals.commitment_codes.slice().sort(),
      objection_codes: signals.objection_codes.slice().sort(),
      risk_codes: signals.risk_codes.slice().sort(),
      next_step_code: signals.next_step_code,
    }
    var snapshot = JSON.stringify(canonicalSignals)
    var snapshotHash = $security.sha256(snapshot)
    var resposta
    try {
      $app.runInTransaction(function (tx) {
        var anteriores = tx.findRecordsByFilter(
          'com_nexo_memoria_correcoes_v1',
          "external_id = '" + externalId + "'",
          '-revision',
          1,
          0,
        )
        if (anteriores.length && anteriores[0].getString('snapshot_hash') === snapshotHash) {
          resposta = { status: 'registrado', revision: anteriores[0].getInt('revision') }
          return
        }
        var revision = anteriores.length ? anteriores[0].getInt('revision') + 1 : 1
        var record = new Record(tx.findCollectionByNameOrId('com_nexo_memoria_correcoes_v1'))
        record.set('external_id', externalId)
        record.set('revision', revision)
        record.set('schema_version', 'nexo_honcho_correction_v1')
        record.set('signals', canonicalSignals)
        record.set('snapshot_hash', snapshotHash)
        record.set('usuario_id', ator.id)
        record.set('created_at', new Date())
        tx.save(record)
        resposta = { status: 'registrado', revision: revision }
      })
    } catch (err) {
      $app.logger().error('nexo memory correction failed', 'error', String(err).slice(0, 160))
      return e.json(409, { error: 'CORRECAO_NAO_REGISTRADA' })
    }
    return e.json(201, resposta)
  },
  $apis.requireAuth('users'),
)
