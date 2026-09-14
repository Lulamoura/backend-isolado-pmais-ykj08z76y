// Nexo — relatório gerencial da equipe comercial.
// Endpoint: GET /backend/v1/nexo/relatorios/equipe-comercial
// Somente leitura. Não cria, altera, envia ou sincroniza dados.

routerAdd(
  'GET',
  '/backend/v1/nexo/relatorios/equipe-comercial',
  (e) => {
    function esc(value) {
      return String(value || '')
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
    }

    function htmlEsc(value) {
      return String(value === null || value === undefined ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
    }

    function isCivilDate(value) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false
      var d = new Date(value + 'T03:00:00.000Z')
      return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value
    }

    function nextCivilDate(value) {
      var d = new Date(value + 'T03:00:00.000Z')
      return new Date(d.getTime() + 86400000).toISOString().slice(0, 10)
    }

    function civilStartUtc(value) {
      return value + ' 03:00:00.000Z'
    }

    function hojeRecife() {
      return new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10)
    }

    function percentual(numerador, denominador) {
      if (!denominador) return null
      return Math.round((numerador * 10000) / denominador) / 100
    }

    function centavos(value) {
      var n = Number(value)
      if (!isFinite(n) || n < 0) return 0
      return Math.round(n)
    }

    function money(valor) {
      var v = centavos(valor) / 100
      return 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    }

    function pct(value) {
      if (value === null || value === undefined) return '—'
      return String(value).replace('.', ',') + '%'
    }

    function bindingVigente(inicio, fim, hoje) {
      if (inicio && inicio.slice(0, 10) > hoje) return false
      if (fim && fim.slice(0, 10) < hoje) return false
      return true
    }

    function maxScope(a, b) {
      var rank = { proprios: 1, equipe: 2, todos: 3 }
      return (rank[b] || 0) > (rank[a] || 0) ? b : a
    }

    function modalidadeBase(slug) {
      var labels = {
        recorrente: 'Recorrente',
        evento: 'Evento',
        serv_eventual: 'Serv. Eventual',
      }
      return {
        modalidade: slug,
        modalidade_label: labels[slug] || slug || 'Não informada',
        total: { quantidade: 0, valor_centavos: 0 },
        ganhos: { quantidade: 0, valor_centavos: 0 },
        perdidos: { quantidade: 0, valor_centavos: 0 },
        abertos: { quantidade: 0, valor_centavos: 0 },
        conversao_global_percentual: null,
        conversao_qualitativa_valor_percentual: null,
      }
    }

    function indicadorBase() {
      return {
        total: { quantidade: 0, valor_centavos: 0 },
        ganhos: { quantidade: 0, valor_centavos: 0 },
        perdidos: { quantidade: 0, valor_centavos: 0 },
        abertos: { quantidade: 0, valor_centavos: 0 },
        modalidades: {
          recorrente: modalidadeBase('recorrente'),
          evento: modalidadeBase('evento'),
          serv_eventual: modalidadeBase('serv_eventual'),
        },
        conversao_global_percentual: null,
        conversao_qualitativa_valor_percentual: null,
      }
    }

    function usuarioResumo(id) {
      if (!id) return { id: null, nome: 'Sem responsável', email: null, ativo_comercial: false }
      try {
        var u = $app.findRecordById('users', id)
        return {
          id: u.id,
          nome: u.getString('name') || u.getString('email') || u.id,
          email: u.getString('email') || null,
          ativo_comercial: u.getBool('ativo_comercial'),
        }
      } catch (_) {
        return { id: id, nome: 'Responsável não identificado', email: null, ativo_comercial: false }
      }
    }

    function acumular(bucket, situacao, valor) {
      bucket.total.quantidade++
      if (valor > 1) bucket.total.valor_centavos += valor
      if (situacao === 'ganho') {
        bucket.ganhos.quantidade++
        if (valor > 1) bucket.ganhos.valor_centavos += valor
      } else if (situacao === 'perdido') {
        bucket.perdidos.quantidade++
        if (valor > 1) bucket.perdidos.valor_centavos += valor
      } else {
        bucket.abertos.quantidade++
        if (valor > 1) bucket.abertos.valor_centavos += valor
      }
    }

    function fecharIndicadores(ind) {
      ind.conversao_global_percentual = percentual(
        ind.ganhos.quantidade,
        ind.ganhos.quantidade + ind.perdidos.quantidade,
      )
      ind.conversao_qualitativa_valor_percentual = percentual(
        ind.ganhos.valor_centavos,
        ind.ganhos.valor_centavos + ind.perdidos.valor_centavos,
      )
      var keys = Object.keys(ind.modalidades)
      for (var i = 0; i < keys.length; i++) {
        var m = ind.modalidades[keys[i]]
        m.conversao_global_percentual = percentual(
          m.ganhos.quantidade,
          m.ganhos.quantidade + m.perdidos.quantidade,
        )
        m.conversao_qualitativa_valor_percentual = percentual(
          m.ganhos.valor_centavos,
          m.ganhos.valor_centavos + m.perdidos.valor_centavos,
        )
      }
      return ind
    }

    function ordenarModalidades(map) {
      return ['recorrente', 'evento', 'serv_eventual'].map(function (key) {
        return map[key] || modalidadeBase(key)
      })
    }

    function validarQuery(query) {
      var q = query || {}
      var allow = ['inicio', 'fim', 'equipe_id', 'responsavel_id', 'incluir_html']
      var keys = Object.keys(q)
      for (var i = 0; i < keys.length; i++) {
        if (allow.indexOf(keys[i]) === -1) return { valido: false }
      }
      if (q.inicio !== undefined && !isCivilDate(q.inicio)) return { valido: false }
      if (q.fim !== undefined && !isCivilDate(q.fim)) return { valido: false }
      if (q.inicio && q.fim && q.inicio > q.fim) return { valido: false }
      if (q.incluir_html !== undefined && q.incluir_html !== 'true' && q.incluir_html !== 'false')
        return { valido: false }
      return {
        valido: true,
        params: {
          inicio: q.inicio || '',
          fim: q.fim || '',
          equipe_id: q.equipe_id || '',
          responsavel_id: q.responsavel_id || '',
          incluir_html: q.incluir_html !== 'false',
        },
      }
    }

    function resolverEscopo(actor, hoje) {
      var scope = ''
      var equipeIds = []
      var seenEquipes = {}
      try {
        var directPerfilId = actor.getString('perfil_id')
        if (directPerfilId) {
          var directPerfil = $app.findRecordById('com_perfis', directPerfilId)
          if (directPerfil.getBool('ativo')) {
            if (directPerfil.getString('slug') === 'superadministrador') scope = 'todos'
            var directLinks = $app.findRecordsByFilter(
              'com_perfil_permissoes',
              "perfil_id = '" + esc(directPerfilId) + "'",
              '',
              500,
              0,
            )
            for (var dl = 0; dl < directLinks.length; dl++) {
              var dp = $app.findRecordById('com_permissoes', directLinks[dl].getString('permissao_id'))
              if (dp.getString('slug') === 'dashboard.view')
                scope = maxScope(scope, directLinks[dl].getString('escopo'))
            }
          }
        }
        var bindings = $app.findRecordsByFilter(
          'com_usuarios_equipes',
          "usuario_id = '" + esc(actor.id) + "' && ativo = true",
          '',
          500,
          0,
        )
        for (var bi = 0; bi < bindings.length; bi++) {
          var b = bindings[bi]
          if (!bindingVigente(b.getString('inicio_vigencia'), b.getString('fim_vigencia'), hoje)) continue
          var equipeId = b.getString('equipe_id')
          if (equipeId && !seenEquipes[equipeId]) {
            seenEquipes[equipeId] = true
            equipeIds.push(equipeId)
          }
          var perfil = $app.findRecordById('com_perfis', b.getString('perfil_id'))
          if (!perfil.getBool('ativo')) continue
          if (perfil.getString('slug') === 'superadministrador') scope = 'todos'
          var links = $app.findRecordsByFilter(
            'com_perfil_permissoes',
            "perfil_id = '" + esc(perfil.id) + "'",
            '',
            500,
            0,
          )
          for (var li = 0; li < links.length; li++) {
            var perm = $app.findRecordById('com_permissoes', links[li].getString('permissao_id'))
            if (perm.getString('slug') === 'dashboard.view')
              scope = maxScope(scope, links[li].getString('escopo'))
          }
        }
      } catch (_) {}
      return { scope: scope, equipe_ids: equipeIds }
    }

    function filtroNegocios(params, escopo) {
      var parts = ['inativo = false']
      if (params.inicio) parts.push("created >= '" + civilStartUtc(params.inicio) + "'")
      if (params.fim) parts.push("created < '" + civilStartUtc(nextCivilDate(params.fim)) + "'")
      if (params.equipe_id) parts.push("equipe_id = '" + esc(params.equipe_id) + "'")
      if (params.responsavel_id) parts.push("responsavel_id = '" + esc(params.responsavel_id) + "'")
      if (escopo.scope === 'proprios') parts.push("responsavel_id = '" + esc(e.auth.id) + "'")
      if (escopo.scope === 'equipe') {
        var ors = []
        for (var i = 0; i < escopo.equipe_ids.length; i++)
          ors.push("equipe_id = '" + esc(escopo.equipe_ids[i]) + "'")
        parts.push(ors.length ? '(' + ors.join(' || ') + ')' : "id = '__sem_equipe__'")
      }
      return parts.join(' && ')
    }

    function classificarSituacao(rec) {
      var resultado = rec.getString('resultado') || ''
      if (resultado === 'ganho') return 'ganho'
      if (resultado === 'perdido' || resultado === 'desqualificado') return 'perdido'
      return 'aberto'
    }

    function montarHtml(payload) {
      var ops = payload.operadoras
      var cards = ''
      for (var i = 0; i < ops.length; i++) {
        var op = ops[i]
        var rows = ''
        for (var mi = 0; mi < op.indicadores.modalidades.length; mi++) {
          var m = op.indicadores.modalidades[mi]
          rows +=
            '<tr><td>' +
            htmlEsc(m.modalidade_label) +
            '</td><td>' +
            m.total.quantidade +
            '</td><td>' +
            money(m.total.valor_centavos) +
            '</td><td>' +
            m.ganhos.quantidade +
            '</td><td>' +
            money(m.ganhos.valor_centavos) +
            '</td><td>' +
            m.perdidos.quantidade +
            '</td><td>' +
            money(m.perdidos.valor_centavos) +
            '</td><td>' +
            pct(m.conversao_global_percentual) +
            '</td><td>' +
            pct(m.conversao_qualitativa_valor_percentual) +
            '</td></tr>'
        }
        cards +=
          '<section class="card"><h2>' +
          htmlEsc(op.operadora.nome) +
          '</h2><div class="kpis"><div><b>' +
          op.indicadores.total.quantidade +
          '</b><span>negócios</span></div><div><b>' +
          money(op.indicadores.total.valor_centavos) +
          '</b><span>valor total</span></div><div><b>' +
          pct(op.indicadores.conversao_global_percentual) +
          '</b><span>conversão global</span></div><div><b>' +
          pct(op.indicadores.conversao_qualitativa_valor_percentual) +
          '</b><span>conversão por valor</span></div></div><table><thead><tr><th>Modalidade</th><th>Total</th><th>Valor</th><th>Ganhos</th><th>Valor ganho</th><th>Perdidos</th><th>Valor perdido</th><th>Conv.</th><th>Conv. valor</th></tr></thead><tbody>' +
          rows +
          '</tbody></table></section>'
      }
      return (
        '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Relatório Nexo — equipe comercial</title><style>body{font-family:Inter,Arial,sans-serif;background:#f6f4ef;color:#1f2933;margin:0;padding:28px}.wrap{max-width:1180px;margin:auto}h1{margin:0 0 4px;font-size:30px}.sub{color:#64748b;margin:0 0 22px}.hero,.card{background:#fff;border:1px solid #e5e7eb;border-radius:18px;padding:20px;margin:16px 0;box-shadow:0 8px 22px rgba(15,23,42,.06)}.kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.kpis div{background:#0f172a;color:#fff;border-radius:14px;padding:14px}.kpis b{display:block;font-size:22px}.kpis span{font-size:12px;color:#cbd5e1}table{width:100%;border-collapse:collapse;margin-top:16px;font-size:13px}th,td{text-align:left;padding:10px;border-bottom:1px solid #e5e7eb}th{color:#475569;background:#f8fafc}.note{font-size:12px;color:#64748b}@media(max-width:800px){.kpis{grid-template-columns:1fr}table{display:block;overflow:auto}}</style></head><body><main class="wrap"><h1>Relatório Nexo — equipe comercial</h1><p class="sub">Período: ' +
        htmlEsc(payload.periodo.inicio || 'início aberto') +
        ' a ' +
        htmlEsc(payload.periodo.fim || 'fim aberto') +
        '</p><section class="hero"><div class="kpis"><div><b>' +
        payload.resumo_geral.total.quantidade +
        '</b><span>negócios totais</span></div><div><b>' +
        money(payload.resumo_geral.total.valor_centavos) +
        '</b><span>valor total</span></div><div><b>' +
        pct(payload.resumo_geral.conversao_global_percentual) +
        '</b><span>conversão global</span></div><div><b>' +
        pct(payload.resumo_geral.conversao_qualitativa_valor_percentual) +
        '</b><span>conversão por valor</span></div></div><p class="note">Base somente leitura. Abertos não entram no denominador das conversões.</p></section>' +
        cards +
        '</main></body></html>'
      )
    }

    var actor = e.auth
    if (!actor) return e.unauthorizedError('Autenticacao necessaria')
    if (!actor.getBool('ativo_comercial')) return e.forbiddenError('Usuario comercial ativo necessario')

    var query = e.requestInfo().query || {}
    var validated = validarQuery(query)
    if (!validated.valido) return e.badRequestError('Parametros de consulta invalidos')
    var params = validated.params
    var escopo = resolverEscopo(actor, hojeRecife())
    if (!escopo.scope) return e.forbiddenError('Permissao dashboard.view necessaria')

    var filter = filtroNegocios(params, escopo)
    var resumoGeral = indicadorBase()
    var porOperadora = {}
    var offset = 0
    var batchSize = 500
    while (true) {
      var batch = $app.findRecordsByFilter('com_negocios', filter, 'created,id', batchSize, offset)
      for (var ri = 0; ri < batch.length; ri++) {
        var rec = batch[ri]
        var responsavelId = rec.getString('responsavel_id') || '__sem_responsavel__'
        if (!porOperadora[responsavelId]) {
          porOperadora[responsavelId] = {
            operadora: usuarioResumo(rec.getString('responsavel_id')),
            indicadores: indicadorBase(),
          }
        }
        var modalidade = rec.getString('modalidade') || ''
        if (modalidade !== 'recorrente' && modalidade !== 'evento' && modalidade !== 'serv_eventual')
          modalidade = 'serv_eventual'
        var valor = centavos(rec.get('valor'))
        var situacao = classificarSituacao(rec)
        acumular(resumoGeral, situacao, valor)
        acumular(resumoGeral.modalidades[modalidade], situacao, valor)
        acumular(porOperadora[responsavelId].indicadores, situacao, valor)
        acumular(porOperadora[responsavelId].indicadores.modalidades[modalidade], situacao, valor)
      }
      if (batch.length < batchSize) break
      offset += batchSize
    }

    var operadoras = Object.keys(porOperadora).map(function (key) {
      var item = porOperadora[key]
      fecharIndicadores(item.indicadores)
      item.indicadores.modalidades = ordenarModalidades(item.indicadores.modalidades)
      return item
    })
    operadoras.sort(function (a, b) {
      return (
        b.indicadores.ganhos.valor_centavos - a.indicadores.ganhos.valor_centavos ||
        b.indicadores.total.valor_centavos - a.indicadores.total.valor_centavos ||
        a.operadora.nome.localeCompare(b.operadora.nome)
      )
    })
    fecharIndicadores(resumoGeral)
    resumoGeral.modalidades = ordenarModalidades(resumoGeral.modalidades)

    var payload = {
      contrato: 'nexo_relatorio_equipe_comercial_v1',
      modo: 'somente_leitura',
      periodo: {
        inicio: params.inicio || null,
        fim: params.fim || null,
        data_civil: 'America/Recife',
        campo: 'created',
      },
      escopo: escopo.scope,
      filtros: {
        equipe_id: params.equipe_id || null,
        responsavel_id: params.responsavel_id || null,
      },
      modalidades_oficiais: [
        { slug: 'recorrente', label: 'Recorrente' },
        { slug: 'evento', label: 'Evento' },
        { slug: 'serv_eventual', label: 'Serv. Eventual' },
      ],
      formulas: {
        taxa_conversao_global: 'ganhos_quantidade / (ganhos_quantidade + perdidos_quantidade)',
        taxa_qualitativa_valor: 'valor_ganho_centavos / (valor_ganho_centavos + valor_perdido_centavos)',
      },
      resumo_geral: resumoGeral,
      operadoras: operadoras,
      avisos: [
        'Endpoint somente leitura: não cria, altera, envia, publica ou sincroniza dados.',
        'Valores monetários estão em centavos; valores zero e um centavo não entram nas somas monetárias.',
        'Negócios abertos entram em volume/carteira, mas não entram no denominador das taxas de conversão.',
        'Negócios sem modalidade oficial são classificados como Serv. Eventual até saneamento da origem.',
      ],
    }
    if (params.incluir_html) payload.html_executivo = montarHtml(payload)
    return e.json(200, payload)
  },
  $apis.requireAuth('users'),
)
