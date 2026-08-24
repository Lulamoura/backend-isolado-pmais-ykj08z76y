// Dashboard V1 — contrato backend somente leitura.
// Endpoint: GET /backend/v1/dashboard/resumo
//
// ZERO escrita, integração externa, migration ou alteração de dados.

routerAdd(
  'GET',
  '/backend/v1/dashboard/resumo',
  (e) => {
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

    function isRecordId(value) {
      return /^[a-z0-9]{15}$/.test(value || '')
    }

    function validarQuery(query) {
      var allow = ['inicio', 'fim', 'equipe_id', 'responsavel_id', 'modalidade', 'incluir_inativos']
      var q = query || {}
      var keys = Object.keys(q)
      for (var i = 0; i < keys.length; i++) {
        if (allow.indexOf(keys[i]) === -1) return { valido: false, erro: 'VALIDATION' }
      }
      if (q.inicio !== undefined && !isCivilDate(q.inicio))
        return { valido: false, erro: 'VALIDATION' }
      if (q.fim !== undefined && !isCivilDate(q.fim)) return { valido: false, erro: 'VALIDATION' }
      if (q.inicio && q.fim && q.inicio > q.fim) return { valido: false, erro: 'VALIDATION' }
      if (q.equipe_id !== undefined && !isRecordId(q.equipe_id))
        return { valido: false, erro: 'VALIDATION' }
      if (q.responsavel_id !== undefined && !isRecordId(q.responsavel_id))
        return { valido: false, erro: 'VALIDATION' }
      if (
        q.modalidade !== undefined &&
        q.modalidade !== 'pontual' &&
        q.modalidade !== 'recorrente'
      )
        return { valido: false, erro: 'VALIDATION' }
      if (
        q.incluir_inativos !== undefined &&
        q.incluir_inativos !== 'true' &&
        q.incluir_inativos !== 'false'
      )
        return { valido: false, erro: 'VALIDATION' }
      return {
        valido: true,
        params: {
          inicio: q.inicio || '',
          fim: q.fim || '',
          equipe_id: q.equipe_id || '',
          responsavel_id: q.responsavel_id || '',
          modalidade: q.modalidade || '',
          incluir_inativos: q.incluir_inativos === 'true',
        },
      }
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

    function classificarResultado(rec) {
      var resultado = rec.resultado || rec.status || ''
      if (resultado === 'ganho') return 'ganho'
      if (resultado === 'perdido') return 'perdido'
      if (resultado === 'desqualificado') return 'desqualificado'
      return 'aberto'
    }

    function percentual(numerador, denominador) {
      if (!denominador) return null
      return Math.round((numerador * 10000) / denominador) / 100
    }

    function agregarNegocios(items) {
      var out = {
        total: 0,
        situacao: { abertos: 0, ganhos: 0, perdidos: 0, desqualificados: 0 },
        qualificacao: { pendentes: 0, qualificadas: 0, desqualificadas: 0 },
        valores: {
          total_precificado_centavos: 0,
          carteira_aberta_centavos: 0,
          ganho_centavos: 0,
          perdido_centavos: 0,
          negocios_precificados: 0,
          negocios_valor_zero: 0,
          negocios_marcador_um_centavo: 0,
          ticket_medio_precificado_centavos: null,
          ticket_medio_ganho_centavos: null,
        },
        conversoes: {
          global_percentual: null,
          qualitativa_percentual: null,
          decisoes_valor_centavos: 0,
          qualificacao_percentual: null,
          propostas_percentual: null,
          propostas_status: 'indisponivel_sem_evento_comprovado',
        },
        cobertura: {
          origem: { preenchidos: 0, total: 0, percentual: null },
          responsavel: { preenchidos: 0, total: 0, percentual: null },
          modalidade: { preenchidos: 0, total: 0, percentual: null, status: 'disponivel' },
        },
        perdas_por_motivo: [],
        modalidades: [],
      }
      var ganhosPrecificados = 0
      var perdasPorMotivo = {}
      var modalidades = {}
      for (var i = 0; i < items.length; i++) {
        var n = items[i]
        out.total++
        var situacao = classificarResultado(n)
        if (situacao === 'ganho') out.situacao.ganhos++
        else if (situacao === 'perdido') out.situacao.perdidos++
        else if (situacao === 'desqualificado') out.situacao.desqualificados++
        else out.situacao.abertos++
        var motivoPerda = ''
        if (situacao === 'perdido') {
          motivoPerda = String(n.fechamento_motivo || '').trim() || 'Não informado'
          if (!perdasPorMotivo[motivoPerda])
            perdasPorMotivo[motivoPerda] = {
              motivo: motivoPerda,
              quantidade: 0,
              valor_centavos: 0,
            }
          perdasPorMotivo[motivoPerda].quantidade++
        }

        if (n.qualificacao === 'desqualificada' || situacao === 'desqualificado')
          out.qualificacao.desqualificadas++
        else if (n.qualificacao === 'qualificada' || n.etapa !== 'prospects')
          out.qualificacao.qualificadas++
        else out.qualificacao.pendentes++

        var modalidade = String(n.modalidade || '').trim()
        if (modalidade) {
          out.cobertura.modalidade.preenchidos++
          if (!modalidades[modalidade])
            modalidades[modalidade] = {
              modalidade: modalidade,
              quantidade: 0,
              valor_centavos: 0,
            }
          modalidades[modalidade].quantidade++
        }

        var valor = Number(n.valor)
        if (!isFinite(valor) || valor < 0) valor = 0
        if (valor === 0) out.valores.negocios_valor_zero++
        if (valor === 1) out.valores.negocios_marcador_um_centavo++
        if (valor > 1) {
          out.valores.negocios_precificados++
          out.valores.total_precificado_centavos += valor
          if (modalidade) modalidades[modalidade].valor_centavos += valor
          if (situacao === 'aberto') out.valores.carteira_aberta_centavos += valor
          if (situacao === 'ganho') {
            out.valores.ganho_centavos += valor
            ganhosPrecificados++
          }
          if (situacao === 'perdido') {
            out.valores.perdido_centavos += valor
            perdasPorMotivo[motivoPerda].valor_centavos += valor
          }
        }

        if (n.origem_canal) out.cobertura.origem.preenchidos++
        if (n.responsavel_id) out.cobertura.responsavel.preenchidos++
      }
      out.cobertura.origem.total = out.total
      out.cobertura.responsavel.total = out.total
      out.cobertura.modalidade.total = out.total
      out.cobertura.origem.percentual = percentual(out.cobertura.origem.preenchidos, out.total)
      out.cobertura.responsavel.percentual = percentual(
        out.cobertura.responsavel.preenchidos,
        out.total,
      )
      out.cobertura.modalidade.percentual = percentual(
        out.cobertura.modalidade.preenchidos,
        out.total,
      )
      out.valores.ticket_medio_precificado_centavos = out.valores.negocios_precificados
        ? Math.round(out.valores.total_precificado_centavos / out.valores.negocios_precificados)
        : null
      out.valores.ticket_medio_ganho_centavos = ganhosPrecificados
        ? Math.round(out.valores.ganho_centavos / ganhosPrecificados)
        : null
      out.conversoes.global_percentual = percentual(
        out.situacao.ganhos,
        out.situacao.ganhos + out.situacao.perdidos + out.situacao.desqualificados,
      )
      out.conversoes.decisoes_valor_centavos =
        out.valores.ganho_centavos + out.valores.perdido_centavos
      out.conversoes.qualitativa_percentual = percentual(
        out.valores.ganho_centavos,
        out.conversoes.decisoes_valor_centavos,
      )
      out.conversoes.qualificacao_percentual = percentual(
        out.qualificacao.qualificadas,
        out.qualificacao.qualificadas + out.qualificacao.desqualificadas,
      )
      out.perdas_por_motivo = Object.keys(perdasPorMotivo)
        .map(function (key) {
          return perdasPorMotivo[key]
        })
        .sort(function (a, b) {
          return b.quantidade - a.quantidade
        })
      out.modalidades = Object.keys(modalidades)
        .map(function (key) {
          return modalidades[key]
        })
        .sort(function (a, b) {
          return b.valor_centavos - a.valor_centavos
        })
      return out
    }

    function comporFiltro(params, scope, actorId, equipeIds) {
      var parts = []
      if (!params.incluir_inativos) parts.push('inativo = false')
      if (params.inicio) parts.push("created >= '" + civilStartUtc(params.inicio) + "'")
      if (params.fim) parts.push("created < '" + civilStartUtc(nextCivilDate(params.fim)) + "'")
      if (params.equipe_id) parts.push("equipe_id = '" + params.equipe_id + "'")
      if (params.responsavel_id) parts.push("responsavel_id = '" + params.responsavel_id + "'")
      if (params.modalidade) parts.push("modalidade = '" + params.modalidade + "'")
      if (scope === 'proprios') parts.push("responsavel_id = '" + actorId + "'")
      if (scope === 'equipe') {
        var ors = []
        for (var i = 0; i < equipeIds.length; i++) ors.push("equipe_id = '" + equipeIds[i] + "'")
        parts.push(ors.length ? '(' + ors.join(' || ') + ')' : "id = '__sem_equipe__'")
      }
      return parts.join(' && ')
    }

    var query = e.requestInfo().query || {}
    var validated = validarQuery(query)
    if (!validated.valido) return e.badRequestError('Parametros de consulta invalidos')

    var actorId = e.auth ? e.auth.id : ''
    if (!actorId) return e.unauthorizedError('Autenticacao necessaria')
    if (!e.auth.getBool('ativo_comercial')) return e.forbiddenError('Usuario comercial inativo')

    var hoje = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10)
    var scope = ''
    var equipeIds = []
    var seenEquipes = {}
    try {
      var directPerfilId = e.auth.getString('perfil_id')
      if (directPerfilId) {
        var directPerfil = $app.findRecordById('com_perfis', directPerfilId)
        if (directPerfil.getBool('ativo')) {
          if (directPerfil.getString('slug') === 'superadministrador') scope = 'todos'
          var directLinks = $app.findRecordsByFilter(
            'com_perfil_permissoes',
            "perfil_id = '" + directPerfilId + "'",
            '',
            500,
            0,
          )
          for (var dl = 0; dl < directLinks.length; dl++) {
            var dp = $app.findRecordById(
              'com_permissoes',
              directLinks[dl].getString('permissao_id'),
            )
            if (dp.getString('slug') === 'dashboard.view')
              scope = maxScope(scope, directLinks[dl].getString('escopo'))
          }
        }
      }
      var bindings = $app.findRecordsByFilter(
        'com_usuarios_equipes',
        "usuario_id = '" + actorId + "' && ativo = true",
        '',
        500,
        0,
      )
      for (var bi = 0; bi < bindings.length; bi++) {
        var b = bindings[bi]
        if (!bindingVigente(b.getString('inicio_vigencia'), b.getString('fim_vigencia'), hoje))
          continue
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
          "perfil_id = '" + perfil.id + "'",
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
    if (!scope) return e.forbiddenError('Permissao dashboard.view necessaria')

    var filter = comporFiltro(validated.params, scope, actorId, equipeIds)
    var records = []
    var offset = 0
    var batchSize = 500
    while (true) {
      var batch = $app.findRecordsByFilter('com_negocios', filter, 'created,id', batchSize, offset)
      for (var ri = 0; ri < batch.length; ri++) {
        records.push({
          valor: batch[ri].get('valor'),
          status: batch[ri].getString('status'),
          resultado: batch[ri].getString('resultado'),
          qualificacao: batch[ri].getString('qualificacao'),
          etapa: batch[ri].getString('etapa'),
          modalidade: batch[ri].getString('modalidade'),
          origem_canal: batch[ri].getString('origem_canal'),
          responsavel_id: batch[ri].getString('responsavel_id'),
          fechamento_motivo: batch[ri].getString('fechamento_motivo'),
        })
      }
      if (batch.length < batchSize) break
      offset += batchSize
    }

    var resumo = agregarNegocios(records)
    return e.json(200, {
      periodo: {
        inicio: validated.params.inicio || null,
        fim: validated.params.fim || null,
        data_civil: 'America/Recife',
        campo: 'created',
      },
      filtros: {
        equipe_id: validated.params.equipe_id || null,
        responsavel_id: validated.params.responsavel_id || null,
        modalidade: validated.params.modalidade || null,
        incluir_inativos: validated.params.incluir_inativos,
      },
      escopo: scope,
      resumo: resumo,
      avisos: [
        'Valores monetarios estao em centavos; zero e um centavo nao entram nas somas.',
        'Conversao de propostas permanece indisponivel sem evento comprovado de proposta emitida.',
      ],
    })

    /* ──── BLOCO DE TESTES ESTÁTICOS ──── */
    var __testExports = {
      isCivilDate: isCivilDate,
      nextCivilDate: nextCivilDate,
      civilStartUtc: civilStartUtc,
      isRecordId: isRecordId,
      validarQuery: validarQuery,
      bindingVigente: bindingVigente,
      maxScope: maxScope,
      classificarResultado: classificarResultado,
      percentual: percentual,
      agregarNegocios: agregarNegocios,
      comporFiltro: comporFiltro,
    }
    /* ──── FIM DO BLOCO DE TESTES ESTÁTICOS ──── */
  },
  $apis.requireAuth(),
)
