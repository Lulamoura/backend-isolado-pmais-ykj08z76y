// T4.5 — SLAs, calendário útil, alertas e parâmetros auditáveis.
// GET  /backend/v1/slas/fila
// POST /backend/v1/slas/parametros

routerAdd(
  'GET',
  '/backend/v1/slas/fila',
  (e) => {
    function maxScope(a, b) {
      var rank = { proprios: 1, equipe: 2, todos: 3 }
      return (rank[b] || 0) > (rank[a] || 0) ? b : a
    }
    function resolverEscopo(ator) {
      var scope = ''
      var perfilId = ator.getString('perfil_id')
      if (!perfilId) return scope
      try {
        var perfil = $app.findRecordById('com_perfis', perfilId)
        if (perfil.getBool('ativo') && perfil.getString('slug') === 'superadministrador')
          scope = 'todos'
        var links = $app.findRecordsByFilter(
          'com_perfil_permissoes',
          "perfil_id = '" + perfilId + "'",
          '',
          500,
          0,
        )
        for (var i = 0; i < links.length; i++) {
          var permissao = $app.findRecordById('com_permissoes', links[i].getString('permissao_id'))
          if (permissao.getString('slug') === 'negocios.view')
            scope = maxScope(scope, links[i].getString('escopo'))
        }
      } catch (_) {}
      return scope
    }
    function inteiro(chave, padrao) {
      try {
        var n = Number(
          $app.findFirstRecordByData('com_parametros', 'chave', chave).getString('valor'),
        )
        return Number.isInteger(n) && n > 0 && n <= 60 ? n : padrao
      } catch (_) {
        return padrao
      }
    }
    function chaveData(d) {
      return d.toISOString().slice(0, 10)
    }
    function feriados() {
      var fixos = [
        '2026-01-01',
        '2026-04-03',
        '2026-04-21',
        '2026-05-01',
        '2026-06-04',
        '2026-06-24',
        '2026-07-16',
        '2026-09-07',
        '2026-10-12',
        '2026-11-02',
        '2026-11-15',
        '2026-11-20',
        '2026-12-08',
        '2026-12-25',
      ]
      var out = {}
      for (var f = 0; f < fixos.length; f++) out[fixos[f]] = true
      try {
        var rs = $app.findRecordsByFilter('com_calendario_feriados', 'ativo = true', '', 500, 0)
        for (var i = 0; i < rs.length; i++) out[rs[i].getString('data').slice(0, 10)] = true
      } catch (_) {}
      return out
    }
    function diaUtil(d, fs) {
      var w = d.getUTCDay()
      return w !== 0 && w !== 6 && !fs[chaveData(d)]
    }
    function fimDiaUtil(base, dias, fs) {
      var d = new Date(base)
      d.setUTCHours(23, 59, 59, 999)
      var feitos = 0
      while (feitos < dias) {
        d.setUTCDate(d.getUTCDate() + 1)
        if (diaUtil(d, fs)) feitos++
      }
      return d
    }
    var ator = e.auth
    if (!ator) return e.unauthorizedError('Autenticacao necessaria')
    if (!ator.getBool('ativo_comercial')) return e.forbiddenError('Usuario comercial inativo')
    var filtroSituacao = String(e.requestInfo().query.situacao || 'todas')
    if (
      ['todas', 'atencao', 'vencido', 'alerta', 'no_prazo', 'nao_calculavel'].indexOf(
        filtroSituacao,
      ) === -1
    )
      return e.json(400, { error: 'VALIDATION' })
    var escopo = resolverEscopo(ator)
    if (!escopo) return e.forbiddenError('Permissao negocios.view necessaria')
    var filtro = "inativo = false && resultado = ''"
    if (escopo !== 'todos') {
      var equipe = ator.getString('equipe_id')
      filtro +=
        escopo === 'equipe' && equipe
          ? " && equipe_id='" + equipe + "'"
          : " && responsavel_id='" + ator.id + "'"
    }
    var cfg = {
      lead: inteiro('sla.lead_dias_uteis', 1),
      proposta: inteiro('sla.proposta_dias_uteis', 5),
      negociacao: inteiro('sla.negociacao_dias_uteis', 2),
      antecedencia: inteiro('sla.alerta_antecedencia_dias_uteis', 1),
    }
    var fs = feriados(),
      agora = new Date(),
      itens = []
    var negocios = $app.findRecordsByFilter('com_negocios', filtro, 'created', 500, 0)
    for (var i = 0; i < negocios.length; i++) {
      var n = negocios[i],
        etapa = n.getString('etapa')
      var dias =
        etapa === 'prospects'
          ? cfg.lead
          : etapa === 'producao_proposta'
            ? cfg.proposta
            : cfg.negociacao
      var marco = n.getString('etapa_entrou_em')
      var vence = marco ? fimDiaUtil(marco, dias, fs) : null
      var alerta = fimDiaUtil(agora, cfg.antecedencia, fs)
      var situacao = !vence
        ? 'nao_calculavel'
        : vence < agora
          ? 'vencido'
          : vence <= alerta
            ? 'alerta'
            : 'no_prazo'
      var proxima = $app.findRecordsByFilter(
        'com_atividades',
        "negocio_id='" + n.id + "' && estado='planejada'",
        'planejada_para',
        1,
        0,
      )
      if (
        filtroSituacao !== 'todas' &&
        !(
          (filtroSituacao === 'atencao' && (situacao === 'vencido' || situacao === 'alerta')) ||
          filtroSituacao === situacao
        )
      )
        continue
      var dono = null,
        empresa = null,
        externalId = null
      try {
        var ur = $app.findRecordById('users', n.getString('responsavel_id'))
        dono = { id: ur.id, nome: ur.getString('name') || ur.getString('email') }
      } catch (_) {}
      try {
        var er = $app.findRecordById('com_empresas', n.getString('empresa_id'))
        empresa = { id: er.id, nome: er.getString('nome') }
      } catch (_) {}
      try {
        externalId = $app
          .findFirstRecordByFilter(
            'com_vinculos_externos',
            "sistema_origem='activecampaign' && external_type='business' && record_id='" +
              n.id +
              "'",
          )
          .getString('external_id')
      } catch (_) {}
      itens.push({
        negocio: {
          id: n.id,
          external_id: externalId,
          titulo: n.getString('titulo'),
          etapa: etapa,
          empresa: empresa,
          responsavel: dono,
        },
        marco_inicial: marco || null,
        vence_em: vence ? vence.toISOString() : null,
        situacao: situacao,
        dias_uteis: dias,
        proxima_acao_em: proxima.length ? proxima[0].getString('planejada_para') : null,
      })
    }
    itens.sort(function (a, b) {
      if (!a.vence_em) return 1
      if (!b.vence_em) return -1
      return a.vence_em < b.vence_em ? -1 : 1
    })
    return e.json(200, {
      itens: itens,
      parametros: cfg,
      calendario: { timezone: 'America/Recife', feriados_ativos: Object.keys(fs).length },
    })
  },
  $apis.requireAuth(),
)

routerAdd(
  'POST',
  '/backend/v1/slas/parametros',
  (e) => {
    function canonicalize(obj) {
      if (obj === null || obj === undefined) return 'null'
      if (typeof obj !== 'object') return JSON.stringify(obj)
      var ks = Object.keys(obj).sort(),
        out = []
      for (var i = 0; i < ks.length; i++)
        out.push(JSON.stringify(ks[i]) + ':' + canonicalize(obj[ks[i]]))
      return '{' + out.join(',') + '}'
    }
    var ator = e.auth
    if (!ator) return e.unauthorizedError('Autenticacao necessaria')
    var perfil = ''
    try {
      perfil = $app.findRecordById('com_perfis', ator.getString('perfil_id')).getString('slug')
    } catch (_) {}
    if (perfil !== 'superadministrador') return e.forbiddenError('SuperAdmin necessario')
    var body
    try {
      body = JSON.parse(toString(e.request.body))
    } catch (_) {
      return e.json(400, { error: 'VALIDATION' })
    }
    var permitidas = [
      'sla.lead_dias_uteis',
      'sla.proposta_dias_uteis',
      'sla.negociacao_dias_uteis',
      'sla.alerta_antecedencia_dias_uteis',
    ]
    var valor = Number(body.valor),
      justificativa = String(body.justificativa || '').trim()
    if (
      permitidas.indexOf(body.chave) === -1 ||
      !Number.isInteger(valor) ||
      valor < 1 ||
      valor > 60 ||
      !justificativa ||
      !body.updated_esperado
    )
      return e.json(400, { error: 'VALIDATION' })
    var resposta,
      erro = ''
    try {
      $app.runInTransaction(function (tx) {
        var p = null,
          criado = false
        try {
          p = tx.findFirstRecordByData('com_parametros', 'chave', body.chave)
        } catch (_) {
          if (body.updated_esperado !== 'DEFAULT') throw new Error('STALE_WRITE')
          criado = true
          var defaults = {
            'sla.lead_dias_uteis': '1',
            'sla.proposta_dias_uteis': '5',
            'sla.negociacao_dias_uteis': '2',
            'sla.alerta_antecedencia_dias_uteis': '1',
          }
          p = new Record(tx.findCollectionByNameOrId('com_parametros'))
          p.set('chave', body.chave)
          p.set('valor', defaults[body.chave])
          p.set('descricao', 'Parâmetro canônico de SLA')
          p.set('versao', 1)
          p.set('ativo', true)
          p.set('tipo', 'numero')
          p.set('unidade', 'dias_uteis')
          p.set('regra_validacao', 'inteiro entre 1 e 60')
          tx.save(p)
        }
        if (
          (!criado && body.updated_esperado === 'DEFAULT') ||
          (body.updated_esperado !== 'DEFAULT' && p.getString('updated') !== body.updated_esperado)
        )
          throw new Error('STALE_WRITE')
        var anterior = p.getString('valor'),
          versao = Number(p.get('versao') || 1) + 1
        p.set('valor', String(valor))
        tx.save(p)
        var evidencia = {
          chave: body.chave,
          anterior: anterior,
          novo: String(valor),
          versao: versao,
        }
        var a = new Record(tx.findCollectionByNameOrId('com_auditoria'))
        a.set('collection_name', 'com_parametros')
        a.set('record_id', p.id)
        a.set('acao', 'update')
        a.set('usuario_id', ator.id)
        a.set('comando', 'alterar_parametro_sla')
        a.set('evento_em', new Date())
        a.set('justificativa', justificativa)
        a.set('perfil', perfil)
        a.set('escopo', 'configuracao')
        a.set('origem', 'server-side')
        a.set('evidencia_estruturada', evidencia)
        a.set('snapshot_hash', $security.sha256(canonicalize(evidencia)))
        a.set('snapshot_hash_versao', '1')
        a.set('sequencia', versao)
        tx.save(a)
        resposta = { id: p.id }
      })
    } catch (err) {
      erro = String(err)
    }
    if (erro.indexOf('STALE_WRITE') !== -1) return e.json(409, { error: 'STALE_WRITE' })
    if (erro) return e.json(500, { error: 'INTERNAL' })
    var salvo = $app.findRecordById('com_parametros', resposta.id)
    resposta = {
      id: salvo.id,
      chave: body.chave,
      valor: salvo.getString('valor'),
      versao: Number(salvo.get('versao') || 1),
      updated: salvo.getString('updated'),
    }
    return e.json(200, resposta)
  },
  $apis.requireAuth(),
)
