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
          "collection_name = 'com_negocios' && record_id = '" +
            esc(negocio.id) +
            "' && sistema_origem = 'activecampaign' && external_type = 'business'",
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
        if (n.proposta.ultimo_envio_email_em)
          partes.push('último envio em ' + formatarDataBR(n.proposta.ultimo_envio_email_em))
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
      if (
        (frente === 'followups-atrasados' || frente === 'recomendacoes-dia') &&
        n.dias_ate_proxima_acao !== null &&
        n.dias_ate_proxima_acao > 0
      )
        return 'Próxima ação vencida ou anterior à data civil atual.'
      if (frente === 'propostas-sem-retorno' && n.proposta && !n.proposta.aberta)
        return 'Proposta enviada/publicada sem abertura confirmada.'
      if (
        frente === 'risco-esfriamento' &&
        n.dias_desde_atualizacao !== null &&
        n.dias_desde_atualizacao >= 7
      )
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
        linhas.push(
          'Síntese da Central: a leitura procura propostas abertas ou enviadas sem resposta objetiva. Foram considerados ' +
            total +
            ' negócio(s) no escopo atual; ' +
            comProposta +
            ' têm proposta vinculada e ' +
            semAbertura +
            ' aparecem sem abertura confirmada.',
        )
        linhas.push(
          'Prioridade prática: confirmar recebimento quando não houver abertura e buscar prazo/decisor quando a proposta já tiver sido analisada pelo cliente.',
        )
      } else if (frente === 'recomendacoes-dia') {
        linhas.push(
          'Síntese da Central: a recomendação do dia organiza quais negócios merecem atenção agora no escopo atual. Foram considerados ' +
            total +
            ' negócio(s); ' +
            vencidos +
            ' têm ação vencida, ' +
            proximos +
            ' têm próxima ação muito próxima e ' +
            semNotas +
            ' precisam de histórico melhor para orientar o contato.',
        )
        linhas.push(
          'Prioridade prática: atacar primeiro ações vencidas e propostas sem abertura; depois qualificar negócios com histórico fraco para evitar follow-up genérico.',
        )
      } else if (frente === 'risco-esfriamento') {
        linhas.push(
          'Síntese da Central: a leitura aponta negócios que podem perder temperatura por silêncio, próxima ação distante ou histórico fraco. No escopo atual, ' +
            distantes +
            ' negócio(s) têm próxima ação distante e ' +
            semNotas +
            ' estão com histórico insuficiente.',
        )
        linhas.push(
          'Prioridade prática: antecipar contato nos casos de prazo distante e registrar decisor, pendência e prazo real de retorno.',
        )
      } else if (frente === 'notas-incompletas') {
        linhas.push(
          'Síntese da Central: a leitura identifica negócios em que o registro atual limita a atuação do Nexo. No escopo atual, ' +
            semNotas +
            ' negócio(s) não têm nota ou follow-up recente suficiente.',
        )
        linhas.push(
          'Prioridade prática: completar as notas com cliente/contato, necessidade, decisor, prazo, objeção e próximo passo antes de pedir nova recomendação comercial.',
        )
      } else if (frente === 'followups-atrasados') {
        linhas.push(
          'Síntese da Central: a leitura separa follow-ups vencidos, sem data clara ou incompatíveis com o ritmo do cliente. No escopo atual, ' +
            vencidos +
            ' negócio(s) têm próxima ação vencida e ' +
            proximos +
            ' exigem atenção nos próximos dias.',
        )
        linhas.push(
          'Prioridade prática: regularizar os vencidos hoje e registrar novo compromisso verificável com o cliente/contato externo.',
        )
      } else {
        linhas.push(
          'Síntese da Central: a leitura busca padrões comerciais nos negócios abertos do escopo atual. Foram considerados ' +
            total +
            ' negócio(s), com ' +
            semNotas +
            ' casos em que o histórico ainda limita aprendizado confiável.',
        )
        linhas.push(
          'Prioridade prática: transformar os casos citados em orientação de playbook apenas quando houver contexto suficiente de proposta, objeção, prazo e resultado.',
        )
      }
      if (citados.length) {
        var exemplos = []
        for (var i = 0; i < citados.length && i < 3; i++)
          exemplos.push((citados[i].id_negocio || 'Sem ID') + ' — ' + destinoCliente(citados[i]))
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
        if (semAbertura)
          return (
            'Registrar no negócio ' +
            idNegocio +
            ' se ' +
            destino +
            ' recebeu a proposta, quem analisa e qual prazo de retorno; a pendência principal é confirmar recebimento antes de cobrar decisão.'
          )
        if (vencida)
          return (
            'Atualizar o negócio ' +
            idNegocio +
            ' com o resultado do follow-up vencido em ' +
            proxima +
            ', registrando quem respondeu, objeção e novo compromisso.'
          )
        if (semNotas)
          return (
            'Criar nota mínima no negócio ' +
            idNegocio +
            ' com necessidade do cliente, decisor, prazo e próximo passo combinado com ' +
            destino +
            '.'
          )
        return (
          'Complementar a última nota do negócio ' +
          idNegocio +
          ' com prazo de decisão, objeção objetiva e responsável externo pela resposta.'
        )
      }
      if (frente === 'propostas-sem-retorno') {
        if (proposta && proposta.aberta)
          return (
            'Abordar ' +
            destino +
            ' sobre o negócio ' +
            idNegocio +
            ' perguntando quais pontos da proposta aberta precisam de esclarecimento e qual prazo real de decisão.'
          )
        if (semAbertura)
          return (
            'Confirmar com ' +
            destino +
            ' se o link da proposta do negócio ' +
            idNegocio +
            ' chegou corretamente e oferecer reenvio ou esclarecimento, sem cobrança genérica.'
          )
        return (
          'Verificar com ' +
          destino +
          ' se o negócio ' +
          idNegocio +
          ' já está pronto para proposta formal ou se ainda falta qualificação.'
        )
      }
      if (frente === 'followups-atrasados') {
        if (vencida)
          return (
            'Regularizar hoje o follow-up vencido do negócio ' +
            idNegocio +
            ' com ' +
            destino +
            ', registrando retorno esperado e novo prazo combinado.'
          )
        if (!n.proxima_acao_em)
          return (
            'Definir e registrar uma próxima ação objetiva para o negócio ' +
            idNegocio +
            ' com ' +
            destino +
            ', incluindo data, assunto e resultado esperado.'
          )
        return (
          'Revisar se a próxima ação do negócio ' +
          idNegocio +
          ' com ' +
          destino +
          ' tem objetivo claro e prazo compatível com o cliente.'
        )
      }
      if (frente === 'risco-esfriamento') {
        if (n.dias_desde_atualizacao !== null && n.dias_desde_atualizacao >= 7)
          return (
            'Reaquecer o negócio ' +
            idNegocio +
            ' com ' +
            destino +
            ' porque está sem atualização recente; retomar necessidade e pendência específica antes da próxima data (' +
            proxima +
            ').'
          )
        if (semAbertura)
          return (
            'Reduzir risco de esfriamento do negócio ' +
            idNegocio +
            ' confirmando recebimento da proposta com ' +
            destino +
            ' antes que o prazo se alongue.'
          )
        if (prazoDias !== null && prazoDias <= 3)
          return (
            'Preparar contato próximo com ' +
            destino +
            ' no negócio ' +
            idNegocio +
            ', pois a próxima ação está prevista para ' +
            proxima +
            ' e precisa sair com objetivo claro.'
          )
        if (prazoDias !== null && prazoDias >= 10)
          return (
            'Antecipar leitura do negócio ' +
            idNegocio +
            ' com ' +
            destino +
            ': a próxima ação ficou distante (' +
            proxima +
            '), então vale confirmar interesse e prazo real de decisão.'
          )
        return (
          'Acompanhar o negócio ' +
          idNegocio +
          ' com ' +
          destino +
          ' antes de ' +
          proxima +
          ', focando em decisor, interesse atual e obstáculo específico.'
        )
      }
      if (frente === 'aprendizados-comerciais') {
        if (semAbertura)
          return (
            'Aprendizado do negócio ' +
            idNegocio +
            ': proposta enviada sem abertura exige checagem rápida de recebimento antes de interpretar silêncio como desinteresse.'
          )
        if (vencida)
          return (
            'Aprendizado do negócio ' +
            idNegocio +
            ': próxima ação vencida indica necessidade de disciplina de prazo e registro de retorno combinado com ' +
            destino +
            '.'
          )
        if (semNotas)
          return (
            'Aprendizado do negócio ' +
            idNegocio +
            ': histórico fraco limita a inteligência do Nexo; padronizar nota com necessidade, decisor, prazo e objeção.'
          )
        return (
          'Aprendizado do negócio ' +
          idNegocio +
          ': transformar a interação com ' +
          destino +
          ' em orientação de abordagem, objeção e cadência para casos semelhantes.'
        )
      }
      if (vencida)
        return (
          'Prioridade do dia: recuperar o negócio ' +
          idNegocio +
          ' com ' +
          destino +
          ' por causa da próxima ação vencida em ' +
          proxima +
          ' e registrar novo compromisso verificável.'
        )
      if (semAbertura)
        return (
          'Prioridade do dia: confirmar com ' +
          destino +
          ' se a proposta do negócio ' +
          idNegocio +
          ' chegou corretamente, pois ainda não há abertura confirmada.'
        )
      if (semNotas && prazoDias !== null && prazoDias <= 3)
        return (
          'Prioridade do dia: qualificar hoje o histórico do negócio ' +
          idNegocio +
          ' com ' +
          destino +
          ', porque a próxima ação está próxima (' +
          proxima +
          ') e faltam dados para orientar o contato.'
        )
      if (semNotas && prazoDias !== null && prazoDias >= 10)
        return (
          'Prioridade do dia: revisar antecipadamente o negócio ' +
          idNegocio +
          ' com ' +
          destino +
          ', pois a próxima ação está distante (' +
          proxima +
          ') e o histórico ainda está fraco.'
        )
      if (semNotas)
        return (
          'Prioridade do dia: qualificar melhor o histórico do negócio ' +
          idNegocio +
          ' com ' +
          destino +
          ' antes de novo avanço comercial previsto para ' +
          proxima +
          '.'
        )
      return (
        'Prioridade do dia: contato objetivo no negócio ' +
        idNegocio +
        ' com ' +
        destino +
        ' para avançar etapa, confirmar decisor e prazo de retorno.'
      )
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
            (formatarDataBR(negocios[i].proxima_acao_em) || 'não informada') +
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
        modelo:
          gatewayJson.modelo ||
          (gatewayJson.model_routing && gatewayJson.model_routing.selected_model) ||
          gatewayJson.nexo_provider ||
          null,
        agent_display: 'Agente Nexo',
        model_display: nomeHumanoModelo(
          gatewayJson.modelo ||
            (gatewayJson.model_routing && gatewayJson.model_routing.selected_model) ||
            gatewayJson.nexo_provider,
        ),
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

// Nexo — consulta técnica e somente leitura ao Aplicativo Comercial.
// Endpoint: POST /backend/v1/nexo/consulta-app
// Uso: canal governado para o Nexo responder perguntas específicas sem login humano.
routerAdd('POST', '/backend/v1/nexo/consulta-app', (e) => {
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

  function dataCivil(value) {
    return value ? String(value).slice(0, 10) : ''
  }

  function hojeRecife() {
    return new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10)
  }

  function formatarDataBR(value) {
    var d = dataCivil(value)
    if (!d || d.length !== 10) return null
    return d.slice(8, 10) + '/' + d.slice(5, 7) + '/' + d.slice(0, 4)
  }

  function nomeUsuario(id) {
    if (!id) return null
    try {
      var u = $app.findRecordById('users', id)
      return u.getString('name') || u.getString('email') || id
    } catch (_) {
      return id
    }
  }

  function nomeRelacionado(collection, id, fields) {
    if (!id) return null
    try {
      var rec = $app.findRecordById(collection, id)
      for (var i = 0; i < fields.length; i++) {
        var value = rec.getString(fields[i])
        if (value) return value
      }
    } catch (_) {}
    return null
  }

  function moneyCentavos(value) {
    var n = Number(value || 0)
    if (!isFinite(n)) n = 0
    var cents = Math.round(n)
    var sinal = cents < 0 ? '-' : ''
    cents = Math.abs(cents)
    var inteiro = Math.floor(cents / 100)
    var decimal = String(cents % 100)
    if (decimal.length < 2) decimal = '0' + decimal
    var inteiroStr = String(inteiro)
    var partes = []
    while (inteiroStr.length > 3) {
      partes.unshift(inteiroStr.slice(-3))
      inteiroStr = inteiroStr.slice(0, -3)
    }
    partes.unshift(inteiroStr || '0')
    return sinal + 'R$ ' + partes.join('.') + ',' + decimal
  }

  function externalIdNegocio(negocio) {
    try {
      var rows = $app.findRecordsByFilter(
        'com_vinculos_externos',
        "collection_name = 'com_negocios' && record_id = '" +
          esc(negocio.id) +
          "' && sistema_origem = 'activecampaign' && external_type = 'business'",
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

  function resumoNegocio(n) {
    var responsavelId = n.getString('responsavel_id')
    var empresaId = n.getString('empresa_id')
    var contatoId = n.getString('contato_principal_id')
    var external = externalIdNegocio(n)
    var oeNumero = ''
    try {
      oeNumero = n.getString('oe_numero') || ''
    } catch (_) {}
    return {
      id: n.id,
      id_negocio: oeNumero || external || n.getString('codigo') || 'Sem número legível',
      external_id: external,
      titulo: n.getString('titulo') || 'Negócio sem título',
      cliente: nomeRelacionado('com_empresas', empresaId, ['nome', 'razao_social']),
      contato: nomeRelacionado('com_contatos', contatoId, ['nome']),
      responsavel: nomeUsuario(responsavelId),
      etapa: n.getString('etapa') || null,
      fase_crm: n.getString('fase_crm') || null,
      qualificacao: n.getString('qualificacao') || null,
      resultado: n.getString('resultado') || null,
      modalidade: n.getString('modalidade') || null,
      valor_centavos: n.getInt('valor_centavos') || 0,
      valor_formatado: moneyCentavos(n.getInt('valor_centavos') || 0),
      proxima_acao_em: formatarDataBR(n.getString('proxima_acao_em')),
      atualizado_em: formatarDataBR(n.getString('updated')),
    }
  }

  function contratoBase(tipo) {
    return {
      contrato: 'nexo_consulta_app_v1',
      tipo_consulta: tipo,
      somente_leitura: true,
      read_only: true,
      sem_mutacao: true,
      no_mutation: true,
      aviso:
        'Consulta técnica do Nexo. Nenhuma mensagem foi enviada e nenhum dado do aplicativo foi alterado.',
    }
  }

  function resposta(tipo, dados) {
    var base = contratoBase(tipo)
    for (var k in dados) base[k] = dados[k]
    return e.json(200, base)
  }

  function leituraPayloadIpcp(record) {
    if (!record) return {}
    try {
      var raw = record.get('payload')
      if (!raw) return {}
      if (typeof raw === 'string') return JSON.parse(raw || '{}')
      if (raw.raw && typeof raw.raw === 'string') return JSON.parse(raw.raw || '{}')
      return raw
    } catch (_) {
      return {}
    }
  }

  function blocoIpcpLista(blocos) {
    var b = blocos || {}
    return [
      {
        chave: 'resultado_comercial',
        titulo: 'Resultado comercial',
        valor: Number(b.resultado_comercial || 0),
      },
      {
        chave: 'valor_estrategico',
        titulo: 'Valor estratégico',
        valor: Number(b.valor_estrategico || 0),
      },
      {
        chave: 'disciplina_carteira',
        titulo: 'Disciplina da carteira',
        valor: Number(b.disciplina_carteira || 0),
      },
      {
        chave: 'qualidade_followup',
        titulo: 'Qualidade de follow-up',
        valor: Number(b.qualidade_followup || 0),
      },
      {
        chave: 'registros_aprendizado',
        titulo: 'Registros e aprendizados',
        valor: Number(b.registros_aprendizado || 0),
      },
    ]
  }

  function consultaIpcpGerencial(body) {
    var data = hojeRecife()
    var escopoReq = String(body.escopo || 'equipe').trim()
    var escopo = escopoReq === 'todos' ? 'todos' : 'equipe'
    var responsavelId = String(body.responsavel_id || '').trim()
    if (responsavelId) escopo = 'equipe'
    var filtro = "data_referencia <= '" + esc(data) + "' && escopo = '" + esc(escopo) + "'"
    if (responsavelId) filtro += " && responsavel_id = '" + esc(responsavelId) + "'"
    var snapshots = []
    var fonteDisponivel = true
    try {
      snapshots = $app.findRecordsByFilter(
        'com_ipcp_snapshots',
        filtro,
        '-data_referencia,-created',
        5,
        0,
      )
      if (!snapshots.length && responsavelId) {
        snapshots = $app.findRecordsByFilter(
          'com_ipcp_snapshots',
          "data_referencia <= '" + esc(data) + "' && escopo = '" + esc(escopo) + "'",
          '-data_referencia,-created',
          5,
          0,
        )
      }
    } catch (_) {
      fonteDisponivel = false
      snapshots = []
    }
    var snapshot = snapshots.length ? snapshots[0] : null
    var payload = leituraPayloadIpcp(snapshot)
    var ipcp = payload.ipcp || {}
    var resumo = payload.resumo_nexo || {}
    var prioridades = resumo.prioridades || []
    var negocios = payload.negocios_atencao || []

    if (!Number(ipcp.total || 0)) {
      var filtroNegocios = 'inativo = false'
      if (responsavelId) filtroNegocios += " && responsavel_id = '" + esc(responsavelId) + "'"
      var negociosRows = []
      var atividadesRows = []
      var propostasRows = []
      try {
        negociosRows = $app.findRecordsByFilter(
          'com_negocios',
          filtroNegocios,
          '-updated,-created',
          200,
          0,
        )
      } catch (_) {}
      var IPCP_ALTO_VALOR_REFERENCIA_REAIS = 10000
      var IPCP_ALTO_VALOR_REFERENCIA = IPCP_ALTO_VALOR_REFERENCIA_REAIS * 100
      var IPCP_MIN_DECIDIDOS_CONFIANCA_TOTAL = 5
      function clampLocal(v, min, max) {
        if (v < min) return min
        if (v > max) return max
        return v
      }
      function roundLocal(v) {
        return Math.round(Number(v || 0) * 10) / 10
      }
      function valorNegocioIpcpTelegram(rec) {
        var valor = Number(rec.get('valor') || 0)
        if (!isFinite(valor) || valor <= 0) valor = Number(rec.get('valor_centavos') || 0)
        if (!isFinite(valor) || valor < 0) return 0
        return valor
      }
      function negocioComputavelIpcpTelegram(rec) {
        if (!rec.getString('responsavel_id')) return false
        if (!rec.getString('modalidade')) return false
        if (valorNegocioIpcpTelegram(rec) <= 1) return false
        return true
      }
      var negociosComputaveisRows = []
      for (var nci = 0; nci < negociosRows.length; nci++) {
        if (negocioComputavelIpcpTelegram(negociosRows[nci])) negociosComputaveisRows.push(negociosRows[nci])
      }
      function filtroPorIdsIpcpTelegram(campo, ids) {
        if (!ids || !ids.length) return "id = '__sem_registros__'"
        var partes = []
        for (var fi = 0; fi < ids.length && fi < 80; fi++) partes.push(campo + " = '" + esc(ids[fi]) + "'")
        return partes.length ? '(' + partes.join(' || ') + ')' : "id = '__sem_registros__'"
      }
      function filtroPorNegociosIpcpTelegram(campo, negocios) {
        var ids = []
        for (var fni = 0; fni < negocios.length; fni++) ids.push(negocios[fni].id)
        return filtroPorIdsIpcpTelegram(campo, ids)
      }
      function filtroPorPropostasIpcpTelegram(campo, propostasCarteira) {
        var ids = []
        for (var fpi = 0; fpi < propostasCarteira.length; fpi++) ids.push(propostasCarteira[fpi].id)
        return filtroPorIdsIpcpTelegram(campo, ids)
      }
      function negocioRecorrenteIpcp(rec) {
        return String(rec.getString('modalidade') || '').toLowerCase() === 'recorrente'
      }
      function negocioAltoValorIpcp(valor) {
        return Number(valor || 0) >= IPCP_ALTO_VALOR_REFERENCIA
      }
      function calcularResultadoComercialIpcp(ganhos, perdidos) {
        var totalDecididos = ganhos + perdidos
        var conversao = totalDecididos ? ganhos / totalDecididos : 0
        var confiancaDecididos = Math.min(1, totalDecididos / IPCP_MIN_DECIDIDOS_CONFIANCA_TOTAL)
        return roundLocal(
          clampLocal(12 + conversao * 10 * confiancaDecididos + Math.min(8, ganhos * 0.8), 8, 30),
        )
      }
      function calcularValorEstrategicoIpcp(metricas) {
        var abertos = Math.max(0, Number(metricas.abertos || 0))
        var recorrenciaCarteiraAberta = Math.min(
          3,
          abertos ? (Number(metricas.abertosRecorrentes || 0) / abertos) * 3 : 0,
        )
        var valorFinanceiroCarteiraAberta = Math.min(1, Number(metricas.valorAberto || 0) / 200000)
        var recorrenteAltoValor = Math.min(
          5,
          abertos ? (Number(metricas.abertosRecorrentesAltoValor || 0) / abertos) * 5 : 0,
        )
        var valorGanhoEstrategico = Math.min(
          5,
          Number(metricas.ganhosEstrategicos || 0) * 2.5 +
            Number(metricas.valorGanhoEstrategico || 0) / 50000,
        )
        var maturidadeComercialQualificada = Math.min(
          1,
          abertos ? Number(metricas.madurosQualificados || 0) / abertos : 0,
        )
        return roundLocal(
          clampLocal(
            recorrenciaCarteiraAberta +
              valorFinanceiroCarteiraAberta +
              recorrenteAltoValor +
              valorGanhoEstrategico +
              maturidadeComercialQualificada,
            0,
            15,
          ),
        )
      }
      var filtroNegociosRelacionadosTelegram = filtroPorNegociosIpcpTelegram(
        'negocio_id',
        negociosComputaveisRows,
      )
      var propostasCarteiraRows = []
      try {
        atividadesRows = $app.findRecordsByFilter(
          'com_atividades',
          filtroNegociosRelacionadosTelegram,
          '-created',
          200,
          0,
        )
        propostasCarteiraRows = $app.findRecordsByFilter(
          'com_propostas',
          filtroNegociosRelacionadosTelegram,
          '-created',
          200,
          0,
        )
        propostasRows = $app.findRecordsByFilter(
          'com_proposta_envios',
          filtroPorPropostasIpcpTelegram('proposta_id', propostasCarteiraRows),
          '-created',
          200,
          0,
        )
      } catch (_) {}
      var abertos = 0
      var ganhos = 0
      var perdidos = 0
      var semResponsavel = 0
      var semModalidade = 0
      var valorAberto = 0
      var abertosRecorrentes = 0
      var abertosRecorrentesAltoValor = 0
      var ganhosEstrategicos = 0
      var valorGanhoEstrategico = 0
      var madurosQualificados = 0
      for (var gi = 0; gi < negociosComputaveisRows.length; gi++) {
        var nr = negociosComputaveisRows[gi]
        var resultado = nr.getString('resultado') || ''
        var valor = valorNegocioIpcpTelegram(nr)
        var recorrente = negocioRecorrenteIpcp(nr)
        var altoValor = negocioAltoValorIpcp(valor)
        if (resultado === 'ganho') {
          ganhos++
          if (recorrente || altoValor) {
            ganhosEstrategicos++
            if (valor > 1) valorGanhoEstrategico += valor
          }
        } else if (resultado) perdidos++
        else {
          abertos++
          if (valor > 1) valorAberto += valor
          if (recorrente) abertosRecorrentes++
          if (recorrente && altoValor) abertosRecorrentesAltoValor++
          if (nr.getString('modalidade') && valor > 1 && nr.getString('proxima_acao_em'))
            madurosQualificados++
        }
        if (!nr.getString('responsavel_id')) semResponsavel++
        if (!nr.getString('modalidade')) semModalidade++
      }
      var coberturaResponsavel = negociosComputaveisRows.length
        ? (negociosComputaveisRows.length - semResponsavel) / negociosComputaveisRows.length
        : 1
      var coberturaModalidade = negociosComputaveisRows.length
        ? (negociosComputaveisRows.length - semModalidade) / negociosComputaveisRows.length
        : 1
      var atividadePorAberto = abertos ? atividadesRows.length / abertos : atividadesRows.length
      var blocosVivos = {
        resultado_comercial: calcularResultadoComercialIpcp(ganhos, perdidos),
        valor_estrategico: calcularValorEstrategicoIpcp({
          abertos: abertos,
          valorAberto: valorAberto,
          abertosRecorrentes: abertosRecorrentes,
          abertosRecorrentesAltoValor: abertosRecorrentesAltoValor,
          ganhosEstrategicos: ganhosEstrategicos,
          valorGanhoEstrategico: valorGanhoEstrategico,
          madurosQualificados: madurosQualificados,
        }),
        disciplina_carteira: roundLocal(
          clampLocal(7 + Math.min(8, atividadePorAberto * 1.6) + coberturaResponsavel * 4, 4, 20),
        ),
        qualidade_followup: roundLocal(
          clampLocal(
            6 + Math.min(7, atividadesRows.length / 8) + Math.min(4, propostasRows.length / 10),
            4,
            20,
          ),
        ),
        registros_aprendizado: roundLocal(
          clampLocal(3 + coberturaModalidade * 6 + Math.min(3, atividadesRows.length / 20), 3, 15),
        ),
      }
      ipcp = {
        total: roundLocal(
          blocosVivos.resultado_comercial +
            blocosVivos.valor_estrategico +
            blocosVivos.disciplina_carteira +
            blocosVivos.qualidade_followup +
            blocosVivos.registros_aprendizado,
        ),
        blocos: blocosVivos,
      }
      prioridades = [
        {
          titulo: 'Qualificar registros comerciais',
          motivo: semModalidade + ' negócio(s) sem modalidade ou dados comerciais completos.',
          bloco_afetado: 'registros_aprendizado',
        },
        {
          titulo: 'Manter cadência da carteira aberta',
          motivo:
            abertos + ' negócio(s) aberto(s) exigem responsável, próxima ação e acompanhamento.',
          bloco_afetado: 'disciplina_carteira',
        },
      ]
      resumo = {
        texto:
          'Leitura IPCP gerencial calculada para o Nexo Telegram com base nos sinais comerciais vivos disponíveis: negócios, atividades e propostas.',
      }
      negocios = []
      for (var ni = 0; ni < negociosRows.length && negocios.length < 5; ni++) {
        var ng = resumoNegocio(negociosRows[ni])
        if (ng.resultado) continue
        negocios.push({
          id_negocio: ng.id_negocio,
          cliente: ng.cliente || ng.titulo || 'Negócio sem nome',
          motivo: 'negócio aberto requer qualificação e próximo passo verificável',
          acao_recomendada:
            'Registrar decisor, pendência, prazo de retorno e próxima ação objetiva.',
        })
      }
    }

    return resposta('ipcp_gerencial', {
      contrato_ipcp: 'nexo_telegram_ipcp_v1',
      data_referencia: snapshot ? snapshot.getString('data_referencia') || data : data,
      escopo_efetivo: {
        tipo: escopo,
        responsavel_id: responsavelId || null,
        responsavel_nome: responsavelId
          ? nomeUsuario(responsavelId)
          : escopo === 'todos'
            ? 'Todos'
            : 'Equipe',
      },
      fonte_dados: 'com_ipcp_snapshots',
      dados_vivos: {
        consultados: true,
        fonte_disponivel: fonteDisponivel,
        snapshot_encontrado: !!snapshot,
        total_lido: snapshots.length,
        limite_leitura: 5,
      },
      ipcp: {
        total: Number(ipcp.total || 0),
        carater: 'educativo_gerencial',
        blocos: ipcp.blocos || {},
        blocos_lista: blocoIpcpLista(ipcp.blocos || {}),
      },
      resumo_ipcp: {
        texto: limparTexto(
          resumo.texto || 'Leitura IPCP gerencial disponível para consulta do Nexo.',
          700,
        ),
        recomendacoes: prioridades.slice(0, 5),
      },
      negocios_atencao: negocios.slice(0, 5),
      evidencias: payload.evidencias || {},
      guardrails: {
        somente_leitura: true,
        read_only: true,
        sem_mutacao: true,
        sem_crm_write: true,
        sem_app_write: true,
        sem_envio: true,
        sem_ranking_punitivo: true,
        fallback_openai_bloqueado: true,
        provider_oficial: 'nexo_hermes',
      },
    })
  }

  function filtroPeriodo(body) {
    var filtro = 'inativo = false'
    var inicio = String(body.inicio || body.data_inicio || '').slice(0, 10)
    var fim = String(body.fim || body.data_fim || '').slice(0, 10)
    if (/^\d{4}-\d{2}-\d{2}$/.test(inicio))
      filtro += " && created >= '" + esc(inicio) + " 03:00:00.000Z'"
    if (/^\d{4}-\d{2}-\d{2}$/.test(fim)) filtro += " && created <= '" + esc(fim) + " 23:59:59.999Z'"
    return filtro
  }

  function resolverTipo(body) {
    var tipo = String(body.tipo_consulta || '').trim()
    var pergunta = String(body.pergunta || '').toLowerCase()
    if (tipo) return tipo
    if (
      pergunta.indexOf('proposta') >= 0 &&
      (pergunta.indexOf('retorno') >= 0 || pergunta.indexOf('abertura') >= 0)
    )
      return 'propostas_sem_retorno'
    if (
      pergunta.indexOf('follow') >= 0 ||
      pergunta.indexOf('vencid') >= 0 ||
      pergunta.indexOf('atrasad') >= 0
    )
      return 'followups_vencidos'
    if (pergunta.indexOf('ipcp') >= 0 || pergunta.indexOf('índice de performance') >= 0)
      return 'ipcp_gerencial'
    if (
      pergunta.indexOf('aprendizado') >= 0 ||
      pergunta.indexOf('perdid') >= 0 ||
      pergunta.indexOf('ganh') >= 0
    )
      return 'aprendizados_comerciais'
    if (
      pergunta.indexOf('negócio') >= 0 ||
      pergunta.indexOf('negocio') >= 0 ||
      body.id_negocio ||
      body.external_id
    )
      return 'negocio_por_id'
    return 'resumo_pipeline'
  }

  var expected = ''
  try {
    expected = $secrets.get('PMAIS_NEXO_SERVICE_SECRET') || $secrets.get('AC_WEBHOOK_SECRET') || ''
  } catch (_) {}
  var provided =
    e.request.header.get('x-pmais-nexo-service-secret') ||
    e.request.header.get('x-pmais-skip-bridge-secret') ||
    ''
  if (!expected || provided !== expected) return e.forbiddenError('NEXO_CONSULTA_FORBIDDEN')

  var body = e.requestInfo().body || {}
  var tipo = resolverTipo(body)
  var permitidas = {
    resumo_pipeline: true,
    negocio_por_id: true,
    propostas_sem_retorno: true,
    followups_vencidos: true,
    aprendizados_comerciais: true,
    ipcp_gerencial: true,
  }
  if (!permitidas[tipo])
    return e.json(400, { error: 'TIPO_CONSULTA_INVALIDO', permitidas: Object.keys(permitidas) })

  if (tipo === 'ipcp_gerencial') return consultaIpcpGerencial(body)

  if (tipo === 'negocio_por_id') {
    var id = String(body.id_negocio || body.external_id || '').trim()
    if (!id) return e.json(400, { error: 'ID_NEGOCIO_OBRIGATORIO' })
    var negocio = null
    try {
      var vinculos = $app.findRecordsByFilter(
        'com_vinculos_externos',
        "collection_name = 'com_negocios' && external_id = '" +
          esc(id) +
          "' && sistema_origem = 'activecampaign' && external_type = 'business'",
        '-created',
        1,
        0,
      )
      if (vinculos.length)
        negocio = $app.findRecordById('com_negocios', vinculos[0].getString('record_id'))
    } catch (_) {}
    if (!negocio) {
      try {
        negocio = $app.findFirstRecordByFilter(
          'com_negocios',
          "oe_numero = '" + esc(id) + "' || id = '" + esc(id) + "'",
        )
      } catch (_) {}
    }
    if (!negocio) return e.json(404, { error: 'NEGOCIO_NAO_ENCONTRADO' })
    return resposta(tipo, { negocio: resumoNegocio(negocio) })
  }

  var filtro = filtroPeriodo(body)
  if (tipo === 'propostas_sem_retorno') filtro += " && resultado = ''"
  if (tipo === 'followups_vencidos')
    filtro += " && resultado = '' && proxima_acao_em < '" + hojeRecife() + " 03:00:00.000Z'"

  var rows = []
  try {
    rows = $app.findRecordsByFilter('com_negocios', filtro, '-updated', 80, 0)
  } catch (err) {
    return e.json(500, { error: 'NEXO_CONSULTA_APP_FALHA', message: String(err).substring(0, 180) })
  }

  var resumo = {
    total_lido: rows.length,
    abertos: 0,
    ganhos: 0,
    perdidos_ou_desqualificados: 0,
    em_qualificacao: 0,
    valor_total_formatado: 'R$ 0,00',
  }
  var totalCentavos = 0
  var itens = []
  for (var i = 0; i < rows.length; i++) {
    var r = resumoNegocio(rows[i])
    totalCentavos += r.valor_centavos || 0
    if (r.resultado === 'ganho') resumo.ganhos++
    else if (r.resultado) resumo.perdidos_ou_desqualificados++
    else resumo.abertos++
    if (r.etapa === 'prospects' && (r.qualificacao === 'pendente' || !r.qualificacao))
      resumo.em_qualificacao++
    if (tipo !== 'resumo_pipeline' && itens.length < 15) itens.push(r)
  }
  resumo.valor_total_formatado = moneyCentavos(totalCentavos)

  if (tipo === 'aprendizados_comerciais') {
    return resposta(tipo, {
      resumo: resumo,
      leitura:
        'Base liberada para leitura histórica do Nexo, incluindo ganhos, perdas/desqualificações e qualificação quando existirem no escopo consultado.',
      itens: itens,
    })
  }

  return resposta(tipo, { resumo: resumo, itens: itens })
})
