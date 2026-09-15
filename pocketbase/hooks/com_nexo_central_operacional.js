// Central operacional do Nexo — análise agregada por frente, escopo e responsável.
// Endpoint: POST /backend/v1/nexo/central/analise

routerAdd(
  'POST',
  '/backend/v1/nexo/central/analise',
  (e) => {
    var ator = e.auth
    if (!ator || !ator.getBool('ativo_comercial')) return e.forbiddenError('Usuario comercial necessario')

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

    function nomeRelacionado(collection, id, fields) {
      if (!id) return ''
      try {
        var rec = $app.findRecordById(collection, id)
        for (var i = 0; i < fields.length; i++) {
          var value = rec.getString(fields[i])
          if (value) return value
        }
      } catch (_) {}
      return ''
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

    function formatarDataBR(value) {
      var d = dataCivil(value)
      if (!d || d.length !== 10) return ''
      return d.slice(8, 10) + '/' + d.slice(5, 7) + '/' + d.slice(0, 4)
    }

    function proximaFmt(n) {
      return formatarDataBR(n.proxima_acao_em) || 'sem data definida'
    }

    function diasPara(n) {
      if (n.dias_ate_proxima_acao === null || n.dias_ate_proxima_acao === undefined) return null
      return -n.dias_ate_proxima_acao
    }

    function nomeHumanoModelo(modelo) {
      var m = String(modelo || '').trim()
      if (!m) return 'modelo não informado'
      if (m === 'gpt-5.5') return 'Gpt 5.5 Codex'
      if (m === 'gpt-6-astra') return 'Gpt 6 Astra Codex'
      return m.replace(/^gpt-/, 'Gpt ').replace(/-/g, ' ')
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
        'recomendacoes-dia': 'Analise os negócios abertos e gere recomendações do dia, priorizando ação concreta, risco e oportunidade de avanço.',
        'risco-esfriamento': 'Identifique negócios com risco de esfriamento por silêncio, próxima ação distante, falta de decisor, falta de prazo ou histórico fraco.',
        'propostas-sem-retorno': 'Analise propostas enviadas ou publicadas sem retorno objetivo, diferenciando sem abertura, aberta sem resposta e follow-up insuficiente.',
        'notas-incompletas': 'Encontre negócios com notas ruins ou incompletas: sem decisor, sem prazo, sem objeção, sem pendência clara ou sem próximo passo verificável.',
        'followups-atrasados': 'Identifique follow-ups vencidos, ausentes ou mal definidos e sugira correção objetiva para cada prioridade.',
        'aprendizados-comerciais': 'Extraia aprendizados comerciais dos padrões dos negócios: objeções recorrentes, serviços demandados, motivos prováveis de perda e boas práticas para playbook.',
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
          "collection_name = 'com_negocios' && record_id = '" + esc(negocio.id) + "' && sistema_origem = 'activecampaign' && external_type = 'business'",
          '-created',
          1,
          0,
        )
        if (rows.length) return rows[0].getString('external_id')
      } catch (_) {}
      try {
        return negocio.getString('external_id') || null
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
          if (envios.length) resumo.ultimo_envio_email_em = envios[0].getString('enviado_em') || null
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
            texto: limparTexto(rows[i].getString('texto') || rows[i].getString('conteudo') || rows[i].getString('nota'), 800),
          })
        }
      } catch (_) {}
      return notas
    }

    function negocioResumo(n) {
      var responsavelId = n.getString('responsavel_id')
      var empresaId = n.getString('empresa_id')
      var contatoId = n.getString('contato_principal_id')
      var external = externalIdNegocio(n)
      var oeNumero = ''
      try {
        oeNumero = n.getString('oe_numero') || ''
      } catch (_) {}
      return {
        negocio_id: n.id,
        external_id: external,
        id_negocio: oeNumero || external || 'Sem ID externo',
        titulo: n.getString('titulo') || 'Negócio sem título',
        cliente_nome: nomeRelacionado('com_empresas', empresaId, ['nome', 'razao_social']),
        contato_nome: nomeRelacionado('com_contatos', contatoId, ['nome']),
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

    function destinoCliente(n) {
      if (n.contato_nome && n.cliente_nome) return n.contato_nome + ' / ' + n.cliente_nome
      if (n.contato_nome) return n.contato_nome
      if (n.cliente_nome) return n.cliente_nome
      return 'cliente solicitante'
    }

    function detalhamentoPropostaItemCentral(n) {
      var partes = []
      if (n.proposta) {
        partes.push(n.proposta.identificador || n.proposta.id || 'proposta vinculada')
        partes.push(n.proposta.aberta ? 'aberta pelo cliente' : 'sem abertura confirmada')
        if (n.proposta.ultimo_envio_email_em) partes.push('último envio em ' + formatarDataBR(n.proposta.ultimo_envio_email_em))
      } else {
        partes.push('sem proposta vinculada')
      }
      partes.push('etapa ' + (n.etapa || 'não informada'))
      partes.push('próxima ação ' + (formatarDataBR(n.proxima_acao_em) || 'não informada'))
      if (!n.notas_followups || !n.notas_followups.length) partes.push('sem nota/follow-up recente')
      else partes.push(n.notas_followups.length + ' nota(s)/follow-up(s) recente(s)')
      return partes.join('; ') + '.'
    }

    function riscoItemCentral(frente, n) {
      if (frente === 'notas-incompletas' && (!n.notas_followups || !n.notas_followups.length))
        return 'Histórico insuficiente para o Nexo orientar com precisão.'
      if ((frente === 'followups-atrasados' || frente === 'recomendacoes-dia') && n.dias_ate_proxima_acao !== null && n.dias_ate_proxima_acao > 0)
        return 'Próxima ação vencida ou anterior à data civil atual.'
      if (frente === 'propostas-sem-retorno' && n.proposta && !n.proposta.aberta)
        return 'Proposta enviada/publicada sem abertura confirmada.'
      if (frente === 'risco-esfriamento' && n.dias_desde_atualizacao !== null && n.dias_desde_atualizacao >= 7)
        return 'Negócio sem atualização recente suficiente.'
      return 'Requer acompanhamento conforme contexto do negócio.'
    }

    function contar(negocios, pred) {
      var total = 0
      for (var i = 0; i < negocios.length; i++) if (pred(negocios[i])) total++
      return total
    }

    function analiseCentralOperacional(frente, escopo, negocios) {
      var total = negocios.length
      var citados = negocios.slice(0, 6)
      var vencidos = contar(negocios, function (n) {
        return n.dias_ate_proxima_acao !== null && n.dias_ate_proxima_acao > 0
      })
      var proximos = contar(negocios, function (n) {
        var d = diasPara(n)
        return d !== null && d >= 0 && d <= 3
      })
      var distantes = contar(negocios, function (n) {
        var d = diasPara(n)
        return d !== null && d >= 10
      })
      var semNotas = contar(negocios, function (n) {
        return !n.notas_followups || !n.notas_followups.length
      })
      var semAbertura = contar(negocios, function (n) {
        return n.proposta && !n.proposta.aberta
      })
      var comProposta = contar(negocios, function (n) {
        return !!n.proposta
      })
      var linhas = []
      if (frente === 'propostas-sem-retorno') {
        linhas.push('Síntese da Central: a leitura procura propostas abertas ou enviadas sem resposta objetiva. Foram considerados ' + total + ' negócio(s) no escopo atual; ' + comProposta + ' têm proposta vinculada e ' + semAbertura + ' aparecem sem abertura confirmada.')
        linhas.push('Prioridade prática: confirmar recebimento quando não houver abertura e buscar prazo/decisor quando a proposta já tiver sido analisada pelo cliente.')
      } else if (frente === 'recomendacoes-dia') {
        linhas.push('Síntese da Central: a recomendação do dia organiza quais negócios merecem atenção agora no escopo atual. Foram considerados ' + total + ' negócio(s); ' + vencidos + ' têm ação vencida, ' + proximos + ' têm próxima ação muito próxima e ' + semNotas + ' precisam de histórico melhor para orientar o contato.')
        linhas.push('Prioridade prática: atacar primeiro ações vencidas e propostas sem abertura; depois qualificar negócios com histórico fraco para evitar follow-up genérico.')
      } else if (frente === 'risco-esfriamento') {
        linhas.push('Síntese da Central: a leitura aponta negócios que podem perder temperatura por silêncio, próxima ação distante ou histórico fraco. No escopo atual, ' + distantes + ' negócio(s) têm próxima ação distante e ' + semNotas + ' estão com histórico insuficiente.')
        linhas.push('Prioridade prática: antecipar contato nos casos de prazo distante e registrar decisor, pendência e prazo real de retorno.')
      } else if (frente === 'notas-incompletas') {
        linhas.push('Síntese da Central: a leitura identifica negócios em que o registro atual limita a atuação do Nexo. No escopo atual, ' + semNotas + ' negócio(s) não têm nota ou follow-up recente suficiente.')
        linhas.push('Prioridade prática: completar as notas com cliente/contato, necessidade, decisor, prazo, objeção e próximo passo antes de pedir nova recomendação comercial.')
      } else if (frente === 'followups-atrasados') {
        linhas.push('Síntese da Central: a leitura separa follow-ups vencidos, sem data clara ou incompatíveis com o ritmo do cliente. No escopo atual, ' + vencidos + ' negócio(s) têm próxima ação vencida e ' + proximos + ' exigem atenção nos próximos dias.')
        linhas.push('Prioridade prática: regularizar os vencidos hoje e registrar novo compromisso verificável com o cliente/contato externo.')
      } else {
        linhas.push('Síntese da Central: a leitura busca padrões comerciais nos negócios do escopo atual. Foram considerados ' + total + ' negócio(s), com ' + semNotas + ' casos em que o histórico ainda limita aprendizado confiável.')
        linhas.push('Prioridade prática: transformar os casos citados em orientação de playbook apenas quando houver contexto suficiente de proposta, objeção, prazo e resultado.')
      }
      if (citados.length) {
        var exemplos = []
        for (var i = 0; i < citados.length && i < 3; i++) exemplos.push((citados[i].id_negocio || 'Sem ID') + ' — ' + destinoCliente(citados[i]))
        linhas.push('Primeiros negócios citados: ' + exemplos.join('; ') + '.')
      }
      linhas.push('Nenhuma mensagem foi enviada e nenhum negócio foi alterado automaticamente.')
      return linhas.join('\n\n')
    }

    function acaoItemCentral(frente, n) {
      var destino = destinoCliente(n)
      var proxima = proximaFmt(n)
      var prazoDias = diasPara(n)
      var semNotas = !n.notas_followups || !n.notas_followups.length
      var proposta = n.proposta || null
      var vencida = n.dias_ate_proxima_acao !== null && n.dias_ate_proxima_acao > 0
      var semAbertura = proposta && !proposta.aberta
      var idNegocio = n.id_negocio || n.external_id || 'Sem ID externo'
      if (frente === 'notas-incompletas') {
        if (semAbertura) return 'Registrar no negócio ' + idNegocio + ' se ' + destino + ' recebeu a proposta, quem analisa e qual prazo de retorno; a pendência principal é confirmar recebimento antes de cobrar decisão.'
        if (vencida) return 'Atualizar o negócio ' + idNegocio + ' com o resultado do follow-up vencido em ' + proxima + ', registrando quem respondeu, objeção e novo compromisso.'
        if (semNotas) return 'Criar nota mínima no negócio ' + idNegocio + ' com necessidade do cliente, decisor, prazo e próximo passo combinado com ' + destino + '.'
        return 'Complementar a última nota do negócio ' + idNegocio + ' com prazo de decisão, objeção objetiva e responsável externo pela resposta.'
      }
      if (frente === 'propostas-sem-retorno') {
        if (proposta && proposta.aberta) return 'Abordar ' + destino + ' sobre o negócio ' + idNegocio + ' perguntando quais pontos da proposta aberta precisam de esclarecimento e qual prazo real de decisão.'
        if (semAbertura) return 'Confirmar com ' + destino + ' se o link da proposta do negócio ' + idNegocio + ' chegou corretamente e oferecer reenvio ou esclarecimento, sem cobrança genérica.'
        return 'Verificar com ' + destino + ' se o negócio ' + idNegocio + ' já está pronto para proposta formal ou se ainda falta qualificação.'
      }
      if (frente === 'followups-atrasados') {
        if (vencida) return 'Regularizar hoje o follow-up vencido do negócio ' + idNegocio + ' com ' + destino + ', registrando retorno esperado e novo prazo combinado.'
        if (!n.proxima_acao_em) return 'Definir e registrar uma próxima ação objetiva para o negócio ' + idNegocio + ' com ' + destino + ', incluindo data, assunto e resultado esperado.'
        return 'Revisar se a próxima ação do negócio ' + idNegocio + ' com ' + destino + ' tem objetivo claro e prazo compatível com o cliente.'
      }
      if (frente === 'risco-esfriamento') {
        if (n.dias_desde_atualizacao !== null && n.dias_desde_atualizacao >= 7) return 'Reaquecer o negócio ' + idNegocio + ' com ' + destino + ' porque está sem atualização recente; retomar necessidade e pendência específica antes da próxima data (' + proxima + ').'
        if (semAbertura) return 'Reduzir risco de esfriamento do negócio ' + idNegocio + ' confirmando recebimento da proposta com ' + destino + ' antes que o prazo se alongue.'
        if (prazoDias !== null && prazoDias <= 3) return 'Preparar contato próximo com ' + destino + ' no negócio ' + idNegocio + ', pois a próxima ação está prevista para ' + proxima + ' e precisa sair com objetivo claro.'
        if (prazoDias !== null && prazoDias >= 10) return 'Antecipar leitura do negócio ' + idNegocio + ' com ' + destino + ': a próxima ação ficou distante (' + proxima + '), então vale confirmar interesse e prazo real de decisão.'
        return 'Acompanhar o negócio ' + idNegocio + ' com ' + destino + ' antes de ' + proxima + ', focando em decisor, interesse atual e obstáculo específico.'
      }
      if (frente === 'aprendizados-comerciais') {
        if (semAbertura) return 'Aprendizado do negócio ' + idNegocio + ': proposta enviada sem abertura exige checagem rápida de recebimento antes de interpretar silêncio como desinteresse.'
        if (vencida) return 'Aprendizado do negócio ' + idNegocio + ': próxima ação vencida indica necessidade de disciplina de prazo e registro de retorno combinado com ' + destino + '.'
        if (semNotas) return 'Aprendizado do negócio ' + idNegocio + ': histórico fraco limita a inteligência do Nexo; padronizar nota com necessidade, decisor, prazo e objeção.'
        return 'Aprendizado do negócio ' + idNegocio + ': transformar a interação com ' + destino + ' em orientação de abordagem, objeção e cadência para casos semelhantes.'
      }
      if (vencida) return 'Prioridade do dia: recuperar o negócio ' + idNegocio + ' com ' + destino + ' por causa da próxima ação vencida em ' + proxima + ' e registrar novo compromisso verificável.'
      if (semAbertura) return 'Prioridade do dia: confirmar com ' + destino + ' se a proposta do negócio ' + idNegocio + ' chegou corretamente, pois ainda não há abertura confirmada.'
      if (semNotas && prazoDias !== null && prazoDias <= 3) return 'Prioridade do dia: qualificar hoje o histórico do negócio ' + idNegocio + ' com ' + destino + ', porque a próxima ação está próxima (' + proxima + ') e faltam dados para orientar o contato.'
      if (semNotas && prazoDias !== null && prazoDias >= 10) return 'Prioridade do dia: revisar antecipadamente o negócio ' + idNegocio + ' com ' + destino + ', pois a próxima ação está distante (' + proxima + ') e o histórico ainda está fraco.'
      if (semNotas) return 'Prioridade do dia: qualificar melhor o histórico do negócio ' + idNegocio + ' com ' + destino + ' antes de novo avanço comercial previsto para ' + proxima + '.'
      return 'Prioridade do dia: contato objetivo no negócio ' + idNegocio + ' com ' + destino + ' para avançar etapa, confirmar decisor e prazo de retorno.'
    }

    function respostaFallback(frente, escopo, negocios, motivo) {
      var linhas = []
      linhas.push('A IA do Nexo não respondeu nesta tentativa. Esta é uma contingência contextual, baseada apenas no resumo operacional disponível.')
      linhas.push('Frente analisada: ' + frente + '. Escopo: ' + escopo.label + '. Negócios considerados: ' + negocios.length + '.')
      for (var i = 0; i < negocios.length && i < 5; i++) {
        linhas.push('- ' + negocios[i].titulo + ': responsável ' + (negocios[i].responsavel_nome || 'não informado') + ', etapa ' + (negocios[i].etapa || 'não informada') + ', próxima ação ' + (formatarDataBR(negocios[i].proxima_acao_em) || 'não informada') + '.')
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
            id_negocio: n.id_negocio,
            titulo: n.titulo,
            cliente: n.cliente_nome || null,
            contato: n.contato_nome || null,
            responsavel: n.responsavel_nome,
            detalhamento_proposta: detalhamentoPropostaItemCentral(n),
            acao_sugerida: acaoItemCentral(frente, n),
            risco: riscoItemCentral(frente, n) + ' Motivo do fallback: ' + motivo,
          }
        }),
        aviso: 'Fallback contextual. Nenhuma mensagem foi enviada e nenhum negócio foi alterado.',
        provider: 'pmais_app_contextual',
        nexo_provider: 'fallback_contextual',
        modelo: 'fallback_contextual',
        agent_display: 'Fallback contextual',
        model_display: 'Sem modelo de IA real',
        fallback: true,
        second_brain: null,
      }
    }

    function respostaGateway(frente, escopo, negocios, gatewayJson) {
      var texto = analiseCentralOperacional(frente, escopo, negocios)
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
            id_negocio: n.id_negocio,
            titulo: n.titulo,
            cliente: n.cliente_nome || null,
            contato: n.contato_nome || null,
            responsavel: n.responsavel_nome,
            detalhamento_proposta: detalhamentoPropostaItemCentral(n),
            acao_sugerida: acaoItemCentral(frente, n),
            risco: riscoItemCentral(frente, n),
          }
        }),
        aviso:
          limparTexto(gatewayJson.aviso, 500) ||
          'Sugestão gerada para revisão humana. Nenhuma mensagem foi enviada e nenhum negócio foi alterado.',
        provider: 'nexo_hermes',
        nexo_provider: gatewayJson.nexo_provider || gatewayJson.provider || 'pmais_agent_gateway',
        modelo: gatewayJson.modelo || (gatewayJson.model_routing && gatewayJson.model_routing.selected_model) || gatewayJson.nexo_provider || null,
        agent_display: 'Agente Nexo',
        model_display: nomeHumanoModelo(gatewayJson.modelo || (gatewayJson.model_routing && gatewayJson.model_routing.selected_model) || gatewayJson.nexo_provider),
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

    var filtro = 'inativo = false'
    if (frente !== 'aprendizados-comerciais') {
      filtro += " && resultado = '' && (etapa != 'prospects' || (qualificacao != 'pendente' && qualificacao != ''))"
    }
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
    if (!bridgeSecret) return e.json(200, respostaFallback(frente, escopo, negocios, 'SEGREDO_BRIDGE_AUSENTE'))

    var contexto = {
      tipo: 'central_operacional',
      frente: frente,
      escopo: escopo,
      total_negocios: negocios.length,
      negocios: negocios,
      instrucoes_saida: [
        'Responda como análise operacional da Central Assistente Nexo, não como ajuda de um único negócio.',
        'Priorize negócios concretos pelo cliente, contato solicitante, título e responsável quando houver dados suficientes.',
        'Nunca trate responsavel_nome como cliente ou destinatário do follow-up; responsável é membro interno PMais.',
        'Para cada negócio citado, gere orientação específica; não repita a mesma ação textual para todos os negócios.',
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
      return e.json(200, respostaFallback(frente, escopo, negocios, 'GATEWAY_HTTP_' + response.statusCode))
    } catch (err) {
      return e.json(200, respostaFallback(frente, escopo, negocios, 'GATEWAY_FALHA'))
    }
  },
  $apis.requireAuth('users'),
)
