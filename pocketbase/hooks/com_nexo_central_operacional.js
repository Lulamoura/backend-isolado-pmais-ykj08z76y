// Central operacional do Nexo — análise agregada por frente, escopo e responsável.
// Endpoint: POST /backend/v1/nexo/central/analise

routerAdd(
  'POST',
  '/backend/v1/nexo/central/analise',
  (e) => {
    var ator = e.auth
    if (!ator || !ator.getBool('ativo_comercial'))
      return e.forbiddenError('Usuario comercial necessario')

    function esc(value) {
      return String(value || '')
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
    }

    function limparTexto(value, max) {
      var text = String(value || '')
        .replace(/<br\s*\/?\s*>/gi, '\n')
        .replace(/<\/p>/gi, '\n\n')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\r\n/g, '\n')
        .replace(/[ \t]+/g, ' ')
        .replace(/\n[ \t]+/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
      if (max && text.length > max) text = text.slice(0, max - 1).trim() + '…'
      return text
    }

    function perfilSlug(userRec) {
      try {
        return $app.findRecordById('com_perfis', userRec.getString('perfil_id')).getString('slug')
      } catch (_) {
        return ''
      }
    }

    function nomeUsuario(id) {
      if (!id) return ''
      try {
        var u = $app.findRecordById('users', id)
        return u.getString('name') || u.getString('email') || id
      } catch (_) {
        return id
      }
    }

    function podeVisaoGeral(slug) {
      return (
        slug === 'superadministrador' ||
        slug === 'leitura-executiva' ||
        slug === 'gestor' ||
        slug === 'gestor-comercial'
      )
    }

    function hojeRecife() {
      return new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10)
    }

    function dataCivil(value) {
      return value ? String(value).slice(0, 10) : ''
    }

    function diasDesde(value) {
      var d = dataCivil(value)
      if (!d) return null
      var a = new Date(d + 'T00:00:00Z').getTime()
      var b = new Date(hojeRecife() + 'T00:00:00Z').getTime()
      return Math.floor((b - a) / 86400000)
    }

    function frenteInstrucao(frente) {
      var mapa = {
        'recomendacoes-dia':
          'Analise os negócios abertos e gere recomendações do dia, priorizando ação concreta, risco e oportunidade de avanço.',
        'risco-esfriamento':
          'Identifique negócios com risco de esfriamento por silêncio, próxima ação distante, falta de decisor, falta de prazo ou histórico fraco.',
        'propostas-sem-retorno':
          'Analise propostas enviadas ou publicadas sem retorno objetivo, diferenciando sem abertura, aberta sem resposta e follow-up insuficiente.',
        'notas-incompletas':
          'Encontre negócios com notas ruins ou incompletas: sem decisor, sem prazo, sem objeção, sem pendência clara ou sem próximo passo verificável.',
        'followups-atrasados':
          'Identifique follow-ups vencidos, ausentes ou mal definidos e sugira correção objetiva para cada prioridade.',
        'aprendizados-comerciais':
          'Extraia aprendizados comerciais dos padrões dos negócios: objeções recorrentes, serviços demandados, motivos prováveis de perda e boas práticas para playbook.',
      }
      return mapa[frente] || mapa['recomendacoes-dia']
    }

    function acaoParaGateway(frente) {
      if (frente === 'notas-incompletas') return 'melhorar_notas'
      if (frente === 'risco-esfriamento') return 'avaliar_risco_perda'
      if (frente === 'propostas-sem-retorno') return 'proximo_follow_up'
      if (frente === 'followups-atrasados') return 'proximo_follow_up'
      if (frente === 'aprendizados-comerciais') return 'avaliar_risco_perda'
      return 'proximo_follow_up'
    }

    function externalIdNegocio(negocio) {
      try {
        var rows = $app.findRecordsByFilter(
          'com_vinculos_externos',
          "collection_name='com_negocios' && record_id='" +
            esc(negocio.id) +
            "' && provider='activecampaign'",
          '-created',
          1,
          0,
        )
        if (rows.length) return rows[0].getString('external_id')
      } catch (_) {}
      return null
    }

    function propostaResumo(negocioId) {
      try {
        var proposta = $app.findFirstRecordByData('com_propostas', 'negocio_id', negocioId)
        var resumo = {
          id: proposta.id,
          identificador: proposta.getString('identificador') || null,
          status: proposta.getString('status') || null,
          publicacao_estado: null,
          ultimo_envio_email_em: null,
          aberta: false,
        }
        try {
          var pub = $app.findFirstRecordByFilter(
            'com_proposta_publicacoes',
            "proposta_id='" + esc(proposta.id) + "' && estado='ativa'",
          )
          resumo.publicacao_estado = pub.getString('estado')
          var acessos = $app.findRecordsByFilter(
            'com_proposta_eventos_publicos',
            "publicacao_id='" + esc(pub.id) + "' && tipo='pagina_acessada'",
            '-ocorrido_em',
            1,
            0,
          )
          resumo.aberta = acessos.length > 0
        } catch (_) {}
        try {
          var envios = $app.findRecordsByFilter(
            'com_proposta_envios',
            "proposta_id='" + esc(proposta.id) + "' && canal='email' && estado='enviado'",
            '-enviado_em',
            1,
            0,
          )
          if (envios.length)
            resumo.ultimo_envio_email_em = envios[0].getString('enviado_em') || null
        } catch (_) {}
        return resumo
      } catch (_) {
        return null
      }
    }

    function notasResumo(negocioId) {
      var notas = []
      try {
        var rows = $app.findRecordsByFilter(
          'com_notas_negocio',
          "negocio_id='" + esc(negocioId) + "'",
          '-created',
          5,
          0,
        )
        for (var i = 0; i < rows.length; i++) {
          notas.push({
            data: rows[i].getString('created'),
            texto: limparTexto(
              rows[i].getString('texto') ||
                rows[i].getString('conteudo') ||
                rows[i].getString('nota'),
              800,
            ),
          })
        }
      } catch (_) {}
      return notas
    }

    function negocioResumo(n) {
      var responsavelId = n.getString('responsavel_id')
      return {
        negocio_id: n.id,
        external_id: externalIdNegocio(n),
        titulo: n.getString('titulo') || 'Negócio sem título',
        etapa: n.getString('etapa') || null,
        fase_crm: n.getString('fase_crm') || null,
        valor_centavos: n.getInt('valor_centavos') || 0,
        responsavel_id: responsavelId,
        responsavel_nome: nomeUsuario(responsavelId),
        equipe_id: n.getString('equipe_id') || null,
        proxima_acao_em: n.getString('proxima_acao_em') || null,
        updated: n.getString('updated'),
        criado_em: n.getString('crm_created_at') || n.getString('created'),
        dias_desde_atualizacao: diasDesde(n.getString('updated')),
        dias_ate_proxima_acao: diasDesde(n.getString('proxima_acao_em')),
        proposta: propostaResumo(n.id),
        notas_followups: notasResumo(n.id),
      }
    }

    function respostaFallback(frente, escopo, negocios, motivo) {
      var linhas = []
      linhas.push(
        'A IA do Nexo não respondeu nesta tentativa. Esta é uma contingência contextual, baseada apenas no resumo operacional disponível.',
      )
      linhas.push(
        'Frente analisada: ' +
          frente +
          '. Escopo: ' +
          escopo.label +
          '. Negócios considerados: ' +
          negocios.length +
          '.',
      )
      for (var i = 0; i < negocios.length && i < 5; i++) {
        linhas.push(
          '- ' +
            negocios[i].titulo +
            ': responsável ' +
            (negocios[i].responsavel_nome || 'não informado') +
            ', etapa ' +
            (negocios[i].etapa || 'não informada') +
            ', próxima ação ' +
            (negocios[i].proxima_acao_em || 'não informada') +
            '.',
        )
      }
      return {
        contrato: 'nexo_central_operacional_v1',
        frente: frente,
        escopo: escopo,
        total_negocios: negocios.length,
        analise: linhas.join('\n\n'),
        itens: negocios.slice(0, 6).map(function (n) {
          return {
            negocio_id: n.negocio_id,
            external_id: n.external_id,
            titulo: n.titulo,
            responsavel: n.responsavel_nome,
            resumo:
              'Etapa: ' +
              (n.etapa || 'não informada') +
              '. Próxima ação: ' +
              (n.proxima_acao_em || 'não informada') +
              '.',
            acao_sugerida: 'Revisar manualmente enquanto a IA estiver indisponível.',
            risco: motivo,
          }
        }),
        aviso: 'Fallback contextual. Nenhuma mensagem foi enviada e nenhum negócio foi alterado.',
        provider: 'pmais_app_contextual',
        nexo_provider: 'fallback_contextual',
        fallback: true,
        second_brain: null,
      }
    }

    function respostaGateway(frente, escopo, negocios, gatewayJson) {
      var texto =
        limparTexto(gatewayJson.resposta_curta, 6000) ||
        limparTexto(gatewayJson.diagnostico, 6000) ||
        'O Nexo retornou a análise, mas sem texto principal estruturado.'
      return {
        contrato: 'nexo_central_operacional_v1',
        frente: frente,
        escopo: escopo,
        total_negocios: negocios.length,
        analise: texto,
        itens: negocios.slice(0, 6).map(function (n) {
          return {
            negocio_id: n.negocio_id,
            external_id: n.external_id,
            titulo: n.titulo,
            responsavel: n.responsavel_nome,
            resumo:
              'Etapa: ' +
              (n.etapa || 'não informada') +
              '. Próxima ação: ' +
              (n.proxima_acao_em || 'não informada') +
              '.',
            acao_sugerida: Array.isArray(gatewayJson.proximos_passos)
              ? gatewayJson.proximos_passos[0]
              : limparTexto(gatewayJson.proximo_passo || gatewayJson.recomendacao, 280),
            risco: Array.isArray(gatewayJson.riscos)
              ? gatewayJson.riscos[0]
              : limparTexto(gatewayJson.risco_principal, 280),
          }
        }),
        aviso:
          limparTexto(gatewayJson.aviso, 500) ||
          'Sugestão gerada para revisão humana. Nenhuma mensagem foi enviada e nenhum negócio foi alterado.',
        provider: 'nexo_hermes',
        nexo_provider: gatewayJson.nexo_provider || gatewayJson.provider || 'pmais_agent_gateway',
        fallback: false,
        second_brain: gatewayJson.second_brain || null,
      }
    }

    var body = e.requestInfo().body || {}
    var frente = String(body.frente || 'recomendacoes-dia')
    var permitidas = {
      'recomendacoes-dia': true,
      'risco-esfriamento': true,
      'propostas-sem-retorno': true,
      'notas-incompletas': true,
      'followups-atrasados': true,
      'aprendizados-comerciais': true,
    }
    if (!permitidas[frente]) return e.json(400, { error: 'FRENTE_INVALIDA' })

    var slug = perfilSlug(ator)
    var responsavelId = String(body.responsavel_id || '').trim()
    var escopo = {
      tipo: 'proprios',
      label: 'Escopo da análise: seus negócios',
      responsavel_id: ator.id,
      responsavel_nome: nomeUsuario(ator.id),
      perfil_slug: slug,
    }

    var filtro =
      "inativo = false && (etapa != 'ganho' && etapa != 'perdido' && etapa != 'desqualificado')"
    if (podeVisaoGeral(slug)) {
      if (responsavelId) {
        filtro += " && responsavel_id='" + esc(responsavelId) + "'"
        escopo = {
          tipo: 'responsavel',
          label: 'Escopo da análise: responsável selecionado — ' + nomeUsuario(responsavelId),
          responsavel_id: responsavelId,
          responsavel_nome: nomeUsuario(responsavelId),
          perfil_slug: slug,
        }
      } else {
        escopo = {
          tipo: 'todos',
          label: 'Escopo da análise: visão geral da operação comercial',
          responsavel_id: null,
          responsavel_nome: null,
          perfil_slug: slug,
        }
      }
    } else {
      responsavelId = ator.id
      filtro += " && responsavel_id='" + esc(ator.id) + "'"
    }

    var negocios = []
    try {
      var rows = $app.findRecordsByFilter('com_negocios', filtro, '-updated', 30, 0)
      for (var i = 0; i < rows.length; i++) negocios.push(negocioResumo(rows[i]))
    } catch (err) {
      return e.json(500, { error: 'NEXO_CENTRAL_NEGOCIOS', message: String(err).substring(0, 200) })
    }

    var bridgeSecret = ''
    try {
      bridgeSecret = $secrets.get('AC_WEBHOOK_SECRET') || ''
    } catch (_) {}
    if (!bridgeSecret)
      return e.json(200, respostaFallback(frente, escopo, negocios, 'SEGREDO_BRIDGE_AUSENTE'))

    var contexto = {
      tipo: 'central_operacional',
      frente: frente,
      escopo: escopo,
      total_negocios: negocios.length,
      negocios: negocios,
      instrucoes_saida: [
        'Responda como análise operacional da Central Assistente Nexo, não como ajuda de um único negócio.',
        'Priorize negócios concretos pelo título e responsável quando houver dados suficientes.',
        'Explique por que cada prioridade importa e qual ação humana deve ser tomada.',
        'Use o segundo cérebro do Nexo para linguagem, critérios comerciais e limites de promessa.',
        'Não envie mensagem, não altere CRM, não prometa preço, prazo operacional ou disponibilidade.',
      ],
    }

    var gatewayBody = JSON.stringify({
      negocio_external_id: 'central-' + frente,
      acao: acaoParaGateway(frente),
      instrucao_operador: frenteInstrucao(frente) + ' ' + escopo.label + '.',
      contexto: contexto,
    })

    try {
      var response = $http.send({
        url: 'https://agents.pmaisservicos.com.br/v1/comercial/skip/nexo/ajuda-negocio',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'x-pmais-skip-bridge-secret': bridgeSecret,
        },
        body: gatewayBody,
        timeout: 60,
      })
      if (response.statusCode >= 200 && response.statusCode < 300)
        return e.json(200, respostaGateway(frente, escopo, negocios, response.json || {}))
      console.error('NEXO_CENTRAL_GATEWAY_ERRO', JSON.stringify({ status: response.statusCode }))
      return e.json(
        200,
        respostaFallback(frente, escopo, negocios, 'GATEWAY_HTTP_' + response.statusCode),
      )
    } catch (err) {
      return e.json(200, respostaFallback(frente, escopo, negocios, 'GATEWAY_FALHA'))
    }
  },
  $apis.requireAuth('users'),
)
