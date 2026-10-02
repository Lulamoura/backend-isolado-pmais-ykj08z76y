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

    function envValue(nome) {
      try {
        if (typeof $os !== 'undefined' && $os.getenv) return $os.getenv(nome) || ''
      } catch (_) {}
      return ''
    }

    function pmaisAgentGatewayAjudaUrl(base) {
      var url = String(base || '').replace(/\/+$/, '')
      if (!url) return ''
      return url + '/v1/comercial/nexo/ajuda-negocio'
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

    function valorNegocioCentavosConsulta(rec) {
      var valor = Number(rec.get('valor') || 0)
      if (!isFinite(valor) || valor <= 0) valor = Number(rec.get('valor_centavos') || 0)
      if (!isFinite(valor) || valor < 0) return 0
      return Math.round(valor)
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
        valor_centavos: valorNegocioCentavosConsulta(n),
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
      if (!gatewayJson || typeof gatewayJson !== 'object')
        throw new Error('GATEWAY_CONTRACT_INVALID')
      var modeloGateway =
        gatewayJson.modelo || (gatewayJson.model_routing || {}).selected_model || ''
      if (
        gatewayJson.ok !== true ||
        gatewayJson.contract_version !== 'pmais_agent_gateway_nexo_ajuda_v1' ||
        typeof gatewayJson.provider !== 'string' ||
        !gatewayJson.provider.trim() ||
        typeof gatewayJson.nexo_provider !== 'string' ||
        !gatewayJson.nexo_provider.trim() ||
        typeof gatewayJson.fallback !== 'boolean' ||
        !modeloGateway ||
        typeof gatewayJson.resposta_curta !== 'string'
      ) {
        throw new Error('GATEWAY_CONTRACT_INVALID')
      }
      var texto = limparTexto(gatewayJson.resposta_curta, 12000)
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
        provider: gatewayJson.provider,
        nexo_provider: gatewayJson.nexo_provider,
        modelo: modeloGateway,
        agent_display: 'Agente Nexo',
        model_display: nomeHumanoModelo(
          gatewayJson.modelo ||
            (gatewayJson.model_routing && gatewayJson.model_routing.selected_model) ||
            gatewayJson.nexo_provider,
        ),
        fallback: gatewayJson.fallback,
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
    if (frente !== 'aprendizados-comerciais') {
      filtro += " && resultado = '' && etapa != 'prospects' && qualificacao != 'pendente'"
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

    var pmaisGatewayUrlBase = ''
    var pmaisGatewayApiKey = ''
    var pmaisGatewayHmacSecret = ''
    var bridgeSecret = ''
    try {
      pmaisGatewayUrlBase =
        $secrets.get('PMAIS_AGENT_GATEWAY_URL') || envValue('PMAIS_AGENT_GATEWAY_URL') || ''
      pmaisGatewayApiKey =
        $secrets.get('PMAIS_AGENT_GATEWAY_API_KEY') || envValue('PMAIS_AGENT_GATEWAY_API_KEY') || ''
      pmaisGatewayHmacSecret =
        $secrets.get('PMAIS_AGENT_GATEWAY_HMAC_SECRET') ||
        envValue('PMAIS_AGENT_GATEWAY_HMAC_SECRET') ||
        ''
      bridgeSecret = $secrets.get('AC_WEBHOOK_SECRET') || ''
    } catch (_) {}
    var signedGatewayUrl = pmaisAgentGatewayAjudaUrl(pmaisGatewayUrlBase)
    if (!signedGatewayUrl && !bridgeSecret)
      return e.json(200, respostaFallback(frente, escopo, negocios, 'SEGREDO_GATEWAY_AUSENTE'))

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

    function chamarGatewayAssinado() {
      if (!signedGatewayUrl || !pmaisGatewayApiKey || !pmaisGatewayHmacSecret) return null
      var timestamp = String(Math.floor(Date.now() / 1000))
      var signature = $security.hs256(timestamp + '.' + gatewayBody, pmaisGatewayHmacSecret)
      return $http.send({
        url: signedGatewayUrl,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'x-pmais-api-key': pmaisGatewayApiKey,
          'x-pmais-timestamp': timestamp,
          'x-pmais-signature': signature,
        },
        body: gatewayBody,
        timeout: 120,
      })
    }

    function chamarSkipBridge() {
      if (!bridgeSecret) return null
      return $http.send({
        url: 'https://agents.pmaisservicos.com.br/v1/comercial/skip/nexo/ajuda-negocio',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'x-pmais-skip-bridge-secret': bridgeSecret,
        },
        body: gatewayBody,
        timeout: 120,
      })
    }

    try {
      var response = chamarGatewayAssinado() || chamarSkipBridge()
      if (!response)
        return e.json(200, respostaFallback(frente, escopo, negocios, 'SEGREDO_GATEWAY_AUSENTE'))
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

  function valorNegocioCentavosConsulta(rec) {
    var valor = Number(rec.get('valor') || 0)
    if (!isFinite(valor) || valor <= 0) valor = Number(rec.get('valor_centavos') || 0)
    if (!isFinite(valor) || valor < 0) return 0
    return Math.round(valor)
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
      valor_centavos: valorNegocioCentavosConsulta(n),
      valor_formatado: moneyCentavos(valorNegocioCentavosConsulta(n)),
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
        if (negocioComputavelIpcpTelegram(negociosRows[nci]))
          negociosComputaveisRows.push(negociosRows[nci])
      }
      function filtroPorIdsIpcpTelegram(campo, ids) {
        if (!ids || !ids.length) return "id = '__sem_registros__'"
        var partes = []
        for (var fi = 0; fi < ids.length && fi < 80; fi++)
          partes.push(campo + " = '" + esc(ids[fi]) + "'")
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

  function consultaAprendizadosWhatsappComercial(body) {
    var limite = Number(body.limite || 25)
    if (!isFinite(limite) || limite <= 0) limite = 25
    if (limite > 80) limite = 80

    var inicio = String(body.inicio || body.data_inicio || '').slice(0, 10)
    var fim = String(body.fim || body.data_fim || '').slice(0, 10)

    function proximoDiaCivil(data) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return ''
      var partes = data.split('-')
      var d = new Date(Date.UTC(Number(partes[0]), Number(partes[1]) - 1, Number(partes[2]) + 1))
      var ano = String(d.getUTCFullYear())
      var mes = String(d.getUTCMonth() + 1)
      if (mes.length < 2) mes = '0' + mes
      var dia = String(d.getUTCDate())
      if (dia.length < 2) dia = '0' + dia
      return ano + '-' + mes + '-' + dia
    }

    function filtroPeriodoCampo(campo) {
      var filtro = ''
      if (/^\d{4}-\d{2}-\d{2}$/.test(inicio))
        filtro += ' && ' + campo + " >= '" + esc(inicio) + " 03:00:00.000Z'"
      if (/^\d{4}-\d{2}-\d{2}$/.test(fim))
        filtro += ' && ' + campo + " <= '" + esc(proximoDiaCivil(fim)) + " 02:59:59.999Z'"
      return filtro
    }

    function safeGet(rec, field) {
      try {
        return rec.getString(field) || ''
      } catch (_) {
        return ''
      }
    }

    function safeBool(rec, field) {
      try {
        return Boolean(rec.getBool(field))
      } catch (_) {
        return false
      }
    }

    function itemLedger(rec) {
      return {
        data: dataCivil(safeGet(rec, 'occurred_at') || safeGet(rec, 'created')),
        fonte: safeGet(rec, 'fonte'),
        canal: safeGet(rec, 'canal'),
        tipo_evento: safeGet(rec, 'tipo_evento'),
        fato: limparTexto(safeGet(rec, 'fato'), 420),
        destino_sugerido: safeGet(rec, 'destino_sugerido'),
        risco: safeGet(rec, 'risco'),
        status: safeGet(rec, 'status'),
        empresa: safeGet(rec, 'empresa_nome') || null,
        contato: safeGet(rec, 'contato_nome') || null,
        negocio: safeGet(rec, 'negocio_ref') || null,
        responsavel: safeGet(rec, 'responsavel') || null,
      }
    }

    var ledgerRows = []
    var mensagensRows = []
    var curadoriaRows = []
    var conhecimentosAtivosRows = []
    var fontes = {
      ledger_disponivel: true,
      mensagens_whatsapp_disponivel: true,
      curadoria_disponivel: true,
      decisoes_disponivel: true,
    }

    try {
      var filtroLedger =
        "(fonte ~ 'whatsapp' || canal ~ 'WhatsApp' || origem ~ 'whatsapp' || origem ~ 'uazapi')" +
        filtroPeriodoCampo('occurred_at')
      ledgerRows = $app.findRecordsByFilter(
        'com_ledger_comercial',
        filtroLedger,
        '-occurred_at',
        limite,
        0,
      )
    } catch (_) {
      fontes.ledger_disponivel = false
      ledgerRows = []
    }

    try {
      var filtroMsg = "provider != ''" + filtroPeriodoCampo('message_at')
      mensagensRows = $app.findRecordsByFilter(
        'com_whatsapp_mensagens',
        filtroMsg,
        '-message_at,-created',
        limite,
        0,
      )
    } catch (_) {
      fontes.mensagens_whatsapp_disponivel = false
      mensagensRows = []
    }

    try {
      var filtroCuradoria =
        'whatsapp_evidencia = true' +
        " && triagem_status = 'curadoria_necessaria' && human_review_required = true" +
        filtroPeriodoCampo('created_at')
      curadoriaRows = $app.findRecordsByFilter(
        'com_nexo_aprendizado_eventos',
        filtroCuradoria,
        '-created_at,-created',
        limite,
        0,
      )
    } catch (_) {
      fontes.curadoria_disponivel = false
      curadoriaRows = []
    }

    try {
      var filtroConhecimento =
        "status = 'aprovado' && conhecimento_status = 'ativo'" +
        " && conhecimento_audit_id != '' && conhecimento_versao != ''" +
        filtroPeriodoCampo('last_seen_at')
      var casosAtivos = $app.findRecordsByFilter(
        'com_nexo_curadoria_casos',
        filtroConhecimento,
        '-decisao_em,-last_seen_at,-created',
        limite,
        0,
      )
      for (var di = 0; di < casosAtivos.length; di++) {
        var fontesCaso = []
        try {
          fontesCaso = casosAtivos[di].get('fontes') || []
          if (typeof fontesCaso === 'string') fontesCaso = JSON.parse(fontesCaso)
        } catch (_) {
          fontesCaso = []
        }
        var origemWhatsapp = false
        for (var fi = 0; fi < fontesCaso.length; fi++) {
          if (String(fontesCaso[fi]).toLowerCase().indexOf('whatsapp') !== -1) {
            origemWhatsapp = true
            break
          }
        }
        if (origemWhatsapp) conhecimentosAtivosRows.push(casosAtivos[di])
      }
    } catch (_) {
      fontes.decisoes_disponivel = false
      conhecimentosAtivosRows = []
    }

    var fatos = []
    for (var i = 0; i < ledgerRows.length && fatos.length < 8; i++)
      fatos.push(itemLedger(ledgerRows[i]))

    var candidatos = []
    for (var c = 0; c < ledgerRows.length && candidatos.length < 8; c++) {
      var l = itemLedger(ledgerRows[c])
      if (
        l.destino_sugerido === 'curadoria' ||
        l.destino_sugerido === 'escalar_direcao' ||
        l.destino_sugerido === 'promover_baixo_risco'
      )
        candidatos.push(l)
    }
    for (var a = 0; a < curadoriaRows.length && candidatos.length < 8; a++) {
      var ev = curadoriaRows[a]
      candidatos.push({
        data: dataCivil(safeGet(ev, 'created_at') || safeGet(ev, 'created')),
        fonte: 'nexo_curadoria',
        tipo_evento: safeGet(ev, 'tipo_evento'),
        fato: limparTexto(safeGet(ev, 'motivo_curadoria') || safeGet(ev, 'resposta_resumo'), 420),
        destino_sugerido: 'curadoria',
        risco: safeGet(ev, 'impacto_ipcp_potencial') ? 'medio' : 'baixo',
        empresa: safeGet(ev, 'empresa_nome') || null,
        contato: safeGet(ev, 'contato_nome') || null,
        negocio: safeGet(ev, 'negocio_titulo') || null,
        responsavel: safeGet(ev, 'responsavel_nome') || null,
      })
    }

    var aprovados = []
    for (var d = 0; d < conhecimentosAtivosRows.length && aprovados.length < 8; d++) {
      var dec = conhecimentosAtivosRows[d]
      aprovados.push({
        data: dataCivil(safeGet(dec, 'decisao_em') || safeGet(dec, 'last_seen_at')),
        regra: limparTexto(safeGet(dec, 'regra_candidata'), 500),
        empresa: safeGet(dec, 'empresa_nome') || null,
        negocio: safeGet(dec, 'negocio_numero') || safeGet(dec, 'negocio_titulo') || null,
        status: safeGet(dec, 'status'),
        conhecimento_status: safeGet(dec, 'conhecimento_status'),
      })
    }

    var fontesIndisponiveis =
      !fontes.ledger_disponivel ||
      !fontes.mensagens_whatsapp_disponivel ||
      !fontes.curadoria_disponivel ||
      !fontes.decisoes_disponivel

    return resposta('aprendizados_whatsapp_comercial', {
      contrato_whatsapp_aprendizados: 'nexo_whatsapp_aprendizados_v1',
      periodo: {
        inicio: inicio || null,
        fim: fim || null,
      },
      fontes: fontes,
      contadores: {
        ledger_whatsapp_lidos: ledgerRows.length,
        mensagens_whatsapp_lidas: mensagensRows.length,
        candidatos_curadoria_lidos: curadoriaRows.length,
        conhecimentos_aprovados_lidos: conhecimentosAtivosRows.length,
      },
      leitura_governada: {
        status: aprovados.length
          ? 'ha_conhecimento_aprovado'
          : candidatos.length
            ? 'ha_candidatos_sem_promocao_final'
            : fontesIndisponiveis
              ? 'inconclusivo_fontes_indisponiveis'
              : fatos.length
                ? 'ha_fatos_sem_aprendizado_aprovado'
                : 'sem_sinal_suficiente',
        resposta_curta: aprovados.length
          ? 'Há conhecimento operacional aprovado relacionado ao WhatsApp Comercial. Separar fatos e decisões antes de usar como regra.'
          : candidatos.length
            ? 'Há sinais/candidatos vindos do WhatsApp Comercial, mas eles ainda exigem curadoria antes de virarem conhecimento oficial.'
            : fontesIndisponiveis
              ? 'A consulta encontrou informação parcial, mas uma ou mais fontes necessárias estão indisponíveis. Não é possível concluir se existem recorrências, candidatos ou conhecimento aprovado neste recorte.'
              : fatos.length
                ? 'Há registros factuais do WhatsApp Comercial no ledger, mas ainda não há aprendizado aprovado a partir deles.'
                : 'Não encontrei sinal suficiente de aprendizado do WhatsApp Comercial no recorte consultado.',
      },
      fatos_observados: fatos,
      possiveis_aprendizados: candidatos,
      conhecimento_aprovado: aprovados,
      guardrails: {
        somente_leitura: true,
        sem_mutacao: true,
        sem_envio: true,
        nao_expoe_payload_bruto: true,
        nao_promove_conhecimento_sozinho: true,
        captura_nao_e_aprendizado: true,
      },
    })
  }

  function consultaRevisoesIpcpPendentes() {
    var rows = []
    try {
      rows = $app.findRecordsByFilter(
        'com_nexo_curadoria_decisoes',
        "status = 'aprovada_uso_operacional'",
        '-updated_at,-created_at',
        40,
        0,
      )
    } catch (_) {
      rows = []
    }

    function parseImpacto(raw) {
      try {
        return JSON.parse(String(raw || '{}'))
      } catch (_) {
        return {}
      }
    }
    function textoDecisao(decisao) {
      return [
        decisao.getString('regra_proposta'),
        decisao.getString('excecao_condicao'),
        decisao.getString('decisao_observacao'),
        decisao.getString('responsavel_validacao'),
      ]
        .join(' ')
        .toLowerCase()
    }
    function impactaIpcp(decisao) {
      var impacto = parseImpacto(decisao.getString('impacto_json'))
      var texto = textoDecisao(decisao)
      return Boolean(
        impacto.altera_indicador ||
        impacto.altera_politica_comercial ||
        impacto.altera_funil ||
        impacto.altera_risco ||
        impacto.altera_perda ||
        /ipcp|indicador|política comercial|politica comercial|fórmula|formula|peso|pontuação|pontuacao|follow[- ]?up|valor estratégico|valor estrategico|conversão|conversao|perda|ganho|proposta enviada|recorrência|recorrencia|alto valor|qualidade do registro|maturidade comercial/.test(
          texto,
        ),
      )
    }
    function blocos(decisao) {
      var texto = textoDecisao(decisao)
      var lista = []
      function add(item) {
        if (lista.indexOf(item) < 0) lista.push(item)
      }
      if (/ipcp|indicador|fórmula|formula|peso|pontuação|pontuacao/.test(texto)) add('IPCP geral')
      if (/follow[- ]?up|próximo passo|proximo passo|retorno|prazo/.test(texto))
        add('Qualidade do follow-up')
      if (
        /registro|aprendizado|decisor|necessidade|objeção|objecao|risco|pendência|pendencia/.test(
          texto,
        )
      )
        add('Registros e aprendizado')
      if (
        /proposta enviada|valor estratégico|valor estrategico|recorrência|recorrencia|alto valor|maturidade comercial/.test(
          texto,
        )
      )
        add('Valor estratégico')
      if (/ganho|perda|conversão|conversao/.test(texto)) add('Resultado comercial')
      if (/funil|etapa|fase|carteira|sla|cadência|cadencia/.test(texto))
        add('Disciplina da carteira')
      return lista.length ? lista : ['IPCP geral']
    }

    var itens = []
    for (var i = 0; i < rows.length && itens.length < 10; i++) {
      var d = rows[i]
      var revisaoStatus = ''
      try {
        revisaoStatus = d.getString('ipcp_revisao_status')
      } catch (_) {
        revisaoStatus = ''
      }
      if (
        revisaoStatus &&
        revisaoStatus !== 'pendente' &&
        revisaoStatus !== 'ajuste_solicitado' &&
        revisaoStatus !== 'alteracao_formula_aprovada' &&
        revisaoStatus !== 'estudo_autorizado'
      )
        continue
      if (!impactaIpcp(d)) continue
      itens.push({
        id: d.id,
        external_id: d.getString('external_id') || null,
        empresa_nome: d.getString('empresa_nome') || null,
        contato_nome: d.getString('contato_nome') || null,
        negocio_titulo: d.getString('negocio_titulo') || null,
        regra_proposta: limparTexto(d.getString('regra_proposta'), 800),
        status_revisao_ipcp: revisaoStatus || 'pendente',
        blocos_ipcp: blocos(d),
        gatilho:
          'Decisão aprovada pode impactar indicador, política comercial, follow-up, conversão, valor estratégico, risco, perda ou registro comercial.',
        atualizado_em:
          d.getString('updated_at') || d.getString('created_at') || d.getString('created'),
      })
    }

    return resposta('ipcp_revisoes_pendentes', {
      contrato_ipcp_revisao: 'nexo_ipcp_revisoes_pendentes_v1',
      total: itens.length,
      itens: itens,
      aviso_telegram_recomendado: itens.length > 0,
      guardrails: {
        somente_leitura: true,
        sem_mutacao: true,
        nao_altera_formula: true,
        formula_ipcp_exige_aprovacao_lula_direcao: true,
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
    if (pergunta.indexOf('revis') >= 0 && pergunta.indexOf('ipcp') >= 0)
      return 'ipcp_revisoes_pendentes'
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
      pergunta.indexOf('aprendizado') >= 0 &&
      (pergunta.indexOf('whatsapp') >= 0 ||
        pergunta.indexOf('uazapi') >= 0 ||
        pergunta.indexOf('conversa') >= 0)
    )
      return 'aprendizados_whatsapp_comercial'
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
    aprendizados_whatsapp_comercial: true,
    ipcp_gerencial: true,
    ipcp_revisoes_pendentes: true,
  }
  if (!permitidas[tipo])
    return e.json(400, { error: 'TIPO_CONSULTA_INVALIDO', permitidas: Object.keys(permitidas) })

  if (tipo === 'ipcp_gerencial') return consultaIpcpGerencial(body)
  if (tipo === 'ipcp_revisoes_pendentes') return consultaRevisoesIpcpPendentes()
  if (tipo === 'aprendizados_whatsapp_comercial') return consultaAprendizadosWhatsappComercial(body)

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

routerAdd('POST', '/backend/v1/nexo/curadoria/triagem-shadow', function (e) {
  function texto(record, field) {
    if (!record) return ''
    try {
      return record.getString(field) || ''
    } catch (_) {
      return ''
    }
  }

  function limparTexto(value, max) {
    var out = String(value || '')
      .replace(/<br\s*\/?\s*>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (max && out.length > max) out = out.slice(0, max - 1).trim() + '…'
    return out
  }

  function normalizar(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/[áàâãä]/g, 'a')
      .replace(/[éèêë]/g, 'e')
      .replace(/[íìîï]/g, 'i')
      .replace(/[óòôõö]/g, 'o')
      .replace(/[úùûü]/g, 'u')
      .replace(/ç/g, 'c')
  }

  function contemAlgum(textoBase, termos) {
    for (var i = 0; i < termos.length; i++) {
      if (textoBase.indexOf(termos[i]) !== -1) return true
    }
    return false
  }

  function motivosSensiveis(record) {
    var base = normalizar(
      [
        texto(record, 'fato'),
        texto(record, 'observacao'),
        texto(record, 'tipo_evento'),
        texto(record, 'canal'),
      ].join(' '),
    )
    var motivos = []
    var classes = [
      {
        nome: 'preco_ou_desconto',
        termos: ['preco', 'desconto', 'reajuste', 'margem', 'comissao', 'condicao comercial'],
      },
      {
        nome: 'contrato_ou_promessa_sensivel',
        termos: ['contrato', 'clausula', 'multa', 'promessa', 'garantia', 'compromisso financeiro'],
      },
      {
        nome: 'lgpd_ou_dados_pessoais',
        termos: ['lgpd', 'dado pessoal', 'dados pessoais', 'consentimento', 'vazamento'],
      },
      {
        nome: 'politica_comercial',
        termos: ['politica comercial', 'regra comercial', 'excecao de alcada', 'mudanca de regra'],
      },
      {
        nome: 'indicador_ou_ipcp',
        termos: ['ipcp', 'indicador', 'ranking', 'meta comercial'],
      },
      {
        nome: 'integridade_ou_conflito',
        termos: ['fraude', 'denuncia', 'conflito de interesse', 'reclamacao grave', 'juridico'],
      },
    ]
    for (var ci = 0; ci < classes.length; ci++) {
      if (contemAlgum(base, classes[ci].termos)) motivos.push(classes[ci].nome)
    }
    var risco = normalizar(texto(record, 'risco'))
    if (risco === 'alto' || risco === 'critico') motivos.push('risco_alto')
    if (texto(record, 'destino_sugerido') === 'escalar_direcao') motivos.push('escalado_na_origem')
    return motivos
  }

  function classificar(record) {
    var destinoOrigem = texto(record, 'destino_sugerido')
    var risco = normalizar(texto(record, 'risco'))
    var confianca = normalizar(texto(record, 'confianca'))
    var negocio = texto(record, 'negocio_ref')
    var motivos = motivosSensiveis(record)
    if (motivos.length) return { destino: 'direcao', motivos: motivos }
    if (destinoOrigem === 'curadoria' || risco === 'medio' || confianca === 'baixa')
      return {
        destino: 'curadoria',
        motivos: [confianca === 'baixa' ? 'baixa_confianca' : 'revisao_do_gestor'],
      }
    if (destinoOrigem === 'pendencia')
      return { destino: 'pendencia', motivos: ['pendencia_comercial'] }
    if (
      texto(record, 'promocao_modo') === 'promover_baixo_risco' &&
      risco === 'baixo' &&
      (confianca === 'alta' || confianca === 'media') &&
      !!negocio
    )
      return { destino: 'baixo_risco', motivos: ['sinal_operacional_rastreavel'] }
    return { destino: 'sem_acao', motivos: ['evidencia_insuficiente'] }
  }

  var actor = e.auth
  if (!actor || !actor.getBool('ativo_comercial'))
    return e.forbiddenError('Usuario comercial necessario')
  var slug = ''
  try {
    var perfil = $app.findRecordById('com_perfis', actor.getString('perfil_id'))
    if (!perfil.getBool('ativo')) return e.forbiddenError('Perfil comercial inativo')
    slug = perfil.getString('slug') || ''
  } catch (_) {
    return e.forbiddenError('Perfil comercial necessario')
  }
  if (slug !== 'superadministrador' && slug !== 'leitura-executiva' && slug !== 'gestor-comercial')
    return e.forbiddenError('Perfil de curadoria necessario')

  var body = e.requestInfo().body || {}
  var limiteItens = Number(body.limite || 100)
  if (!isFinite(limiteItens)) limiteItens = 100
  limiteItens = Math.max(1, Math.min(500, Math.floor(limiteItens)))

  var rows = []
  var offset = 0
  var pageSize = 500
  var maxRows = 5000
  var hasMore = false
  try {
    while (rows.length <= maxRows) {
      var page = $app.findRecordsByFilter(
        'com_ledger_comercial',
        "status != 'descartado'",
        '-occurred_at,-created,-id',
        pageSize,
        offset,
      )
      for (var pi = 0; pi < page.length; pi++) rows.push(page[pi])
      if (page.length < pageSize) break
      offset += page.length
    }
    if (rows.length > maxRows) {
      rows = rows.slice(0, maxRows)
      hasMore = true
    }
  } catch (_) {
    return e.json(503, {
      ok: false,
      error: 'LEDGER_INDISPONIVEL',
      modo: 'shadow',
      sem_mutacao: true,
    })
  }

  var contadores = {
    total_analisado: rows.length,
    sem_acao: 0,
    pendencia: 0,
    baixo_risco: 0,
    curadoria: 0,
    direcao: 0,
  }
  var itens = []
  for (var ri = 0; ri < rows.length; ri++) {
    var row = rows[ri]
    var resultado = classificar(row)
    contadores[resultado.destino]++
    if (itens.length >= limiteItens) continue
    itens.push({
      data: texto(row, 'occurred_at').slice(0, 10) || null,
      fonte: texto(row, 'fonte') || 'comercial',
      canal: texto(row, 'canal') || null,
      destino: resultado.destino,
      motivos: resultado.motivos,
      empresa: texto(row, 'empresa_nome') || null,
      negocio: texto(row, 'negocio_ref') || null,
      responsavel: texto(row, 'responsavel') || null,
      resumo: limparTexto(texto(row, 'fato'), 420),
    })
  }

  return e.json(200, {
    ok: true,
    modo: 'shadow',
    parcial: hasMore,
    contadores: contadores,
    itens: itens,
    guardrails: {
      sem_mutacao: true,
      sem_envio: true,
      automatic_send_allowed: false,
      sem_promocao: true,
      exige_curadoria_humana: true,
    },
  })
})

routerAdd('POST', '/backend/v1/nexo/curadoria/casos/consolidar', function (e) {
  var CONFIRMACAO_APLICACAO = 'APLICAR_CONSOLIDACAO_CURADORIA_COMERCIAL'

  function texto(record, field) {
    if (!record) return ''
    try {
      return record.getString(field) || ''
    } catch (_) {
      return ''
    }
  }

  function valor(record, field) {
    if (!record) return null
    try {
      return record.get(field)
    } catch (_) {
      return null
    }
  }

  function normalizar(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/[áàâãä]/g, 'a')
      .replace(/[éèêë]/g, 'e')
      .replace(/[íìîï]/g, 'i')
      .replace(/[óòôõö]/g, 'o')
      .replace(/[úùûü]/g, 'u')
      .replace(/ç/g, 'c')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
  }

  function limparTexto(value, max) {
    var out = String(value || '')
      .replace(/<br\s*\/?\s*>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (max && out.length > max) out = out.slice(0, max - 1).trim() + '…'
    return out
  }

  function carregar(app, collectionName) {
    var out = []
    var offset = 0
    var limite = 500
    while (true) {
      var page = app.findRecordsByFilter(collectionName, "id != ''", '+id', limite, offset)
      for (var i = 0; i < page.length; i++) out.push(page[i])
      if (page.length < limite) return out
      offset += page.length
    }
  }

  function inclui(base, termos) {
    for (var i = 0; i < termos.length; i++) {
      if (base.indexOf(termos[i]) !== -1) return true
    }
    return false
  }

  function assuntoELimites(record) {
    var base = normalizar(
      [texto(record, 'fato'), texto(record, 'observacao'), texto(record, 'tipo_evento')].join(' '),
    )
    var sensiveis = []
    if (inclui(base, ['preco', 'desconto', 'reajuste', 'margem', 'comissao', 'condicao comercial']))
      sensiveis.push('preco_ou_desconto')
    if (inclui(base, ['contrato', 'clausula', 'multa', 'promessa', 'garantia']))
      sensiveis.push('contrato_ou_promessa_sensivel')
    if (inclui(base, ['lgpd', 'dado pessoal', 'dados pessoais', 'consentimento', 'vazamento']))
      sensiveis.push('lgpd_ou_dados_pessoais')
    if (inclui(base, ['politica comercial', 'regra comercial', 'mudanca de regra']))
      sensiveis.push('politica_comercial')
    if (inclui(base, ['ipcp', 'indicador', 'ranking', 'meta comercial']))
      sensiveis.push('indicador_ou_ipcp')
    if (inclui(base, ['fraude', 'denuncia', 'conflito de interesse', 'reclamacao grave']))
      sensiveis.push('integridade_ou_conflito')
    var risco = normalizar(texto(record, 'risco'))
    if (risco === 'alto' || risco === 'critico') sensiveis.push('risco_alto')

    var assunto = ''
    if (sensiveis.length) assunto = sensiveis[0]
    else if (inclui(base, ['prefere', 'preferencia', 'resumo objetivo', 'forma de comunicar']))
      assunto = 'preferencia_comunicacao'
    else if (inclui(base, ['objecao', 'resistencia', 'nao concorda'])) assunto = 'objecao_comercial'
    else if (inclui(base, ['prazo', 'data limite', 'vencimento', 'deadline']))
      assunto = 'prazo_ou_compromisso'
    else if (inclui(base, ['follow up', 'retorno', 'retomar contato'])) assunto = 'followup'
    else if (inclui(base, ['proposta', 'escopo', 'orcamento'])) assunto = 'proposta'
    else if (inclui(base, ['reuniao', 'agenda', 'encontro'])) assunto = 'reuniao'
    else {
      var tipo = normalizar(texto(record, 'tipo_evento')).replace(/\s+/g, '_')
      assunto = tipo && tipo !== 'mensagem' ? tipo.slice(0, 120) : 'sinal_comercial'
    }
    return { assunto: assunto, sensiveis: sensiveis }
  }

  function arrayUnico(values) {
    var out = []
    var seen = {}
    for (var i = 0; i < values.length; i++) {
      var value = String(values[i] || '').trim()
      if (value && !seen[value]) {
        seen[value] = true
        out.push(value)
      }
    }
    out.sort()
    return out
  }

  function lerArray(record, field) {
    var raw = valor(record, field)
    if (typeof raw === 'string') {
      try {
        raw = JSON.parse(raw)
      } catch (_) {
        raw = []
      }
    }
    return Array.isArray(raw) ? raw : []
  }

  function numero(record, field) {
    try {
      return Number(record.getInt(field) || 0)
    } catch (_) {
      return Number(texto(record, field) || 0)
    }
  }

  function deveReabrir(caso, novasEvidencias) {
    if (!novasEvidencias) return false
    var status = texto(caso, 'status')
    return (
      status === 'aprovado' ||
      status === 'rejeitado' ||
      status === 'retirado' ||
      status === 'sem_acao'
    )
  }

  function tituloAssunto(assunto) {
    var labels = {
      preferencia_comunicacao: 'Preferência de comunicação',
      objecao_comercial: 'Objeção comercial recorrente',
      prazo_ou_compromisso: 'Prazo ou compromisso comercial',
      followup: 'Padrão de follow-up',
      proposta: 'Aprendizado sobre proposta',
      reuniao: 'Aprendizado de reunião',
      preco_ou_desconto: 'Preço ou desconto — decisão executiva',
      contrato_ou_promessa_sensivel: 'Contrato ou promessa sensível',
      lgpd_ou_dados_pessoais: 'Proteção de dados e LGPD',
      politica_comercial: 'Política comercial',
      indicador_ou_ipcp: 'Indicador ou IPCP',
      integridade_ou_conflito: 'Integridade ou conflito',
    }
    return labels[assunto] || 'Sinal comercial para curadoria'
  }

  var actor = e.auth
  if (!actor || !actor.getBool('ativo_comercial'))
    return e.forbiddenError('Usuario comercial necessario')
  var slug = ''
  try {
    var perfil = $app.findRecordById('com_perfis', actor.getString('perfil_id'))
    if (!perfil.getBool('ativo')) return e.forbiddenError('Perfil comercial inativo')
    slug = perfil.getString('slug') || ''
  } catch (_) {
    return e.forbiddenError('Perfil comercial necessario')
  }
  if (slug !== 'superadministrador' && slug !== 'leitura-executiva')
    return e.forbiddenError('Perfil executivo necessario')

  var body = e.requestInfo().body || {}
  var dryRun = body.dry_run !== false
  if (!dryRun && slug !== 'superadministrador')
    return e.forbiddenError('Superadministrador necessario para aplicar consolidacao')
  if (!dryRun && String(body.confirmacao || '') !== CONFIRMACAO_APLICACAO)
    return e.json(400, { ok: false, error: 'CONFIRMACAO_NECESSARIA' })

  var ledgerRows = []
  try {
    ledgerRows = carregar($app, 'com_ledger_comercial')
  } catch (_) {
    return e.json(503, { ok: false, error: 'LEDGER_INDISPONIVEL' })
  }

  var grupos = {}
  var escoposPorRecorrencia = {}
  for (var li = 0; li < ledgerRows.length; li++) {
    var ledger = ledgerRows[li]
    if (texto(ledger, 'status') === 'descartado') continue
    var analise = assuntoELimites(ledger)
    var destinoOrigem = texto(ledger, 'destino_sugerido')
    var risco = normalizar(texto(ledger, 'risco'))
    var confianca = normalizar(texto(ledger, 'confianca'))
    var escopoRef = texto(ledger, 'negocio_ref') || texto(ledger, 'empresa_nome')
    var elegivel =
      analise.sensiveis.length > 0 ||
      destinoOrigem === 'curadoria' ||
      risco === 'medio' ||
      confianca === 'baixa' ||
      (texto(ledger, 'promocao_modo') === 'promover_baixo_risco' && !!escopoRef)
    if (!elegivel || !escopoRef) continue

    var escopoTipo = texto(ledger, 'negocio_ref') ? 'negocio' : 'empresa'
    var recorrenciaChave = String(
      $security.sha256(['curadoria-recorrencia-v1', analise.assunto].join('|')),
    )
    var fingerprint = String(
      $security.sha256(['curadoria-caso-v1', escopoTipo, escopoRef, analise.assunto].join('|')),
    )
    var evidenciaHash = String(
      $security.sha256(
        [
          'curadoria-evidencia-v1',
          texto(ledger, 'fonte'),
          texto(ledger, 'evidencia_ref') || ledger.id,
          texto(ledger, 'occurred_at'),
          limparTexto(texto(ledger, 'fato'), 2400),
        ].join('|'),
      ),
    )
    if (!grupos[fingerprint]) {
      grupos[fingerprint] = {
        fingerprint: fingerprint,
        recorrencia_chave: recorrenciaChave,
        assunto_chave: analise.assunto,
        escopo_tipo: escopoTipo,
        escopo_ref: escopoRef,
        empresa_nome: texto(ledger, 'empresa_nome'),
        contato_nome: texto(ledger, 'contato_nome'),
        negocio_numero: texto(ledger, 'negocio_ref'),
        negocio_titulo: '',
        responsavel_nome: texto(ledger, 'responsavel'),
        responsavel_id: texto(ledger, 'responsavel_id'),
        equipe_id: texto(ledger, 'equipe_id'),
        negocio_id: texto(ledger, 'negocio_id'),
        fontes: [],
        sensiveis: [],
        evidencias: [],
        resumos: [],
        first_seen_at: texto(ledger, 'occurred_at') || texto(ledger, 'created'),
        last_seen_at: texto(ledger, 'occurred_at') || texto(ledger, 'created'),
      }
    }
    var grupo = grupos[fingerprint]
    grupo.fontes.push(texto(ledger, 'fonte') || 'comercial')
    grupo.sensiveis = grupo.sensiveis.concat(analise.sensiveis)
    var resumo = limparTexto(texto(ledger, 'fato'), 1000)
    if (resumo) grupo.resumos.push(resumo)
    grupo.evidencias.push({
      hash: evidenciaHash,
      fonte_tipo: texto(ledger, 'fonte') || 'comercial',
      fonte_ref: texto(ledger, 'evidencia_ref') || ledger.id,
      resumo_factual: resumo,
      occurred_at: texto(ledger, 'occurred_at') || texto(ledger, 'created'),
    })
    var momento = texto(ledger, 'occurred_at') || texto(ledger, 'created')
    if (momento && (!grupo.first_seen_at || momento < grupo.first_seen_at))
      grupo.first_seen_at = momento
    if (momento && (!grupo.last_seen_at || momento > grupo.last_seen_at))
      grupo.last_seen_at = momento
    if (!escoposPorRecorrencia[recorrenciaChave]) escoposPorRecorrencia[recorrenciaChave] = {}
    escoposPorRecorrencia[recorrenciaChave][escopoTipo + '|' + escopoRef] = true
  }

  var listaGrupos = []
  for (var fp in grupos) {
    var itemGrupo = grupos[fp]
    itemGrupo.fontes = arrayUnico(itemGrupo.fontes)
    itemGrupo.sensiveis = arrayUnico(itemGrupo.sensiveis)
    var evidenciasUnicas = []
    var hashesVistos = {}
    for (var ei = 0; ei < itemGrupo.evidencias.length; ei++) {
      var ev = itemGrupo.evidencias[ei]
      if (hashesVistos[ev.hash]) continue
      hashesVistos[ev.hash] = true
      evidenciasUnicas.push(ev)
    }
    itemGrupo.evidencias = evidenciasUnicas
    itemGrupo.recorrencia_contagem = Object.keys(
      escoposPorRecorrencia[itemGrupo.recorrencia_chave] || {},
    ).length
    listaGrupos.push(itemGrupo)
  }
  listaGrupos.sort(function (a, b) {
    return a.fingerprint < b.fingerprint ? -1 : a.fingerprint > b.fingerprint ? 1 : 0
  })

  function estadoAtual(app) {
    var casos = carregar(app, 'com_nexo_curadoria_casos')
    var evidencias = carregar(app, 'com_nexo_curadoria_evidencias')
    var transicoes = carregar(app, 'com_nexo_curadoria_transicoes')
    var casoPorFingerprint = {}
    var evidenciasExistentes = {}
    var transicoesExistentes = {}
    for (var ci = 0; ci < casos.length; ci++)
      casoPorFingerprint[texto(casos[ci], 'fingerprint')] = casos[ci]
    for (var evi = 0; evi < evidencias.length; evi++)
      evidenciasExistentes[
        texto(evidencias[evi], 'caso_id') + '|' + texto(evidencias[evi], 'evidencia_hash')
      ] = true
    for (var ti = 0; ti < transicoes.length; ti++)
      transicoesExistentes[texto(transicoes[ti], 'transicao_chave')] = true
    return {
      caso_por_fingerprint: casoPorFingerprint,
      evidencias_existentes: evidenciasExistentes,
      transicoes_existentes: transicoesExistentes,
    }
  }

  function planejar(app) {
    var estado = estadoAtual(app)
    var result = { casos_novos: 0, casos_atualizados: 0, evidencias_novas: 0 }
    for (var gi = 0; gi < listaGrupos.length; gi++) {
      var grupo = listaGrupos[gi]
      var caso = estado.caso_por_fingerprint[grupo.fingerprint]
      if (!caso) {
        result.casos_novos++
        result.evidencias_novas += grupo.evidencias.length
        continue
      }
      var novas = 0
      for (var gei = 0; gei < grupo.evidencias.length; gei++) {
        if (!estado.evidencias_existentes[caso.id + '|' + grupo.evidencias[gei].hash]) novas++
      }
      var recorrenciaMudou = numero(caso, 'recorrencia_contagem') !== grupo.recorrencia_contagem
      if (novas || recorrenciaMudou || deveReabrir(caso, novas)) result.casos_atualizados++
      result.evidencias_novas += novas
    }
    return result
  }

  var preview = null
  try {
    preview = planejar($app)
  } catch (_) {
    return e.json(503, { ok: false, error: 'CURADORIA_INDISPONIVEL' })
  }
  if (dryRun) {
    return e.json(200, {
      ok: true,
      dry_run: true,
      casos_novos: preview.casos_novos,
      casos_atualizados: preview.casos_atualizados,
      evidencias_novas: preview.evidencias_novas,
      automatic_send_allowed: false,
    })
  }

  var criados = 0
  var atualizados = 0
  var evidenciasCriadas = 0
  var transicoesCriadas = 0
  try {
    $app.runInTransaction(function (tx) {
      var estado = estadoAtual(tx)
      for (var gi = 0; gi < listaGrupos.length; gi++) {
        var grupo = listaGrupos[gi]
        var caso = estado.caso_por_fingerprint[grupo.fingerprint]
        var novoCaso = !caso
        if (novoCaso) {
          caso = new Record(tx.findCollectionByNameOrId('com_nexo_curadoria_casos'))
          caso.set('fingerprint', grupo.fingerprint)
          caso.set('revisao', 1)
          caso.set('status', grupo.sensiveis.length ? 'aguardando_direcao' : 'aberto_curadoria')
          caso.set('fonte_principal', grupo.fontes[0] || 'comercial')
          caso.set('fontes', grupo.fontes)
          caso.set('escopo_tipo', grupo.escopo_tipo)
          caso.set('escopo_ref', grupo.escopo_ref)
          caso.set('empresa_nome', grupo.empresa_nome)
          caso.set('contato_nome', grupo.contato_nome)
          caso.set('negocio_numero', grupo.negocio_numero)
          caso.set('negocio_titulo', grupo.negocio_titulo)
          caso.set('responsavel_nome', grupo.responsavel_nome)
          caso.set('responsavel_id', grupo.responsavel_id)
          caso.set('equipe_id', grupo.equipe_id)
          caso.set('negocio_id', grupo.negocio_id)
          caso.set('assunto_chave', grupo.assunto_chave)
          caso.set('recorrencia_chave', grupo.recorrencia_chave)
          caso.set('titulo', tituloAssunto(grupo.assunto_chave))
          caso.set('resumo_factual', arrayUnico(grupo.resumos).slice(0, 3).join(' | '))
          caso.set(
            'motivo_curadoria',
            grupo.sensiveis.length
              ? 'O caso contém matéria sensível e exige decisão executiva.'
              : 'O caso reúne evidências comerciais rastreáveis para revisão humana.',
          )
          caso.set('regra_candidata', '')
          caso.set('evidencia_contagem', grupo.evidencias.length)
          caso.set('casos_independentes', grupo.recorrencia_contagem)
          caso.set('recorrencia_contagem', grupo.recorrencia_contagem)
          caso.set(
            'evidencia_hashes',
            grupo.evidencias.map(function (ev) {
              return ev.hash
            }),
          )
          caso.set('risco_classe', grupo.sensiveis.length ? 'alto' : 'medio')
          caso.set('alcada', grupo.sensiveis.length ? 'direcao' : 'gestao_comercial')
          caso.set('sensivel_motivos', grupo.sensiveis)
          caso.set('confianca', grupo.evidencias.length > 1 ? 'media' : 'baixa')
          caso.set('human_review_required', true)
          caso.set('automatic_promotion_allowed', false)
          caso.set('conhecimento_status', 'nao_publicado')
          caso.set('created_by', actor.id)
          caso.set('updated_by', actor.id)
          caso.set('first_seen_at', grupo.first_seen_at || new Date())
          caso.set('last_seen_at', grupo.last_seen_at || new Date())
          tx.save(caso)
          estado.caso_por_fingerprint[grupo.fingerprint] = caso
          criados++
        }

        var novasEvidencias = []
        for (var gei = 0; gei < grupo.evidencias.length; gei++) {
          var grupoEvidencia = grupo.evidencias[gei]
          var evidenciaKey = caso.id + '|' + grupoEvidencia.hash
          if (!estado.evidencias_existentes[evidenciaKey]) novasEvidencias.push(grupoEvidencia)
        }
        var reabertura = null
        var recorrenciaMudou = numero(caso, 'recorrencia_contagem') !== grupo.recorrencia_contagem
        var reabrirCaso = !novoCaso && deveReabrir(caso, novasEvidencias.length)
        if (!novoCaso && (novasEvidencias.length || recorrenciaMudou)) {
          var hashes = arrayUnico(
            lerArray(caso, 'evidencia_hashes').concat(
              novasEvidencias.map(function (ev) {
                return ev.hash
              }),
            ),
          )
          if (novasEvidencias.length) {
            caso.set('fontes', arrayUnico(lerArray(caso, 'fontes').concat(grupo.fontes)))
            caso.set('evidencia_hashes', hashes)
            caso.set('evidencia_contagem', hashes.length)
            caso.set('last_seen_at', grupo.last_seen_at || new Date())
          }
          caso.set('casos_independentes', grupo.recorrencia_contagem)
          caso.set('recorrencia_contagem', grupo.recorrencia_contagem)
          if (grupo.responsavel_id) caso.set('responsavel_id', grupo.responsavel_id)
          if (grupo.equipe_id) caso.set('equipe_id', grupo.equipe_id)
          if (grupo.negocio_id) caso.set('negocio_id', grupo.negocio_id)
          caso.set('resumo_factual', arrayUnico(grupo.resumos).slice(0, 3).join(' | '))
          caso.set(
            'confianca',
            hashes.length >= 3 || grupo.recorrencia_contagem >= 3
              ? 'alta'
              : hashes.length >= 2 || grupo.recorrencia_contagem >= 2
                ? 'media'
                : 'baixa',
          )
          var statusAnterior = texto(caso, 'status')
          var novaRevisao = numero(caso, 'revisao') + 1
          caso.set('revisao', novaRevisao)
          if (reabrirCaso) {
            var statusReaberto = grupo.sensiveis.length ? 'aguardando_direcao' : 'aberto_curadoria'
            caso.set('status', statusReaberto)
            caso.set('next_review_at', null)
            if (texto(caso, 'conhecimento_status') === 'ativo')
              caso.set('conhecimento_status', 'revisao_necessaria')
            reabertura = {
              status_anterior: statusAnterior,
              status_novo: statusReaberto,
              revisao: novaRevisao,
            }
            try {
              var operacoesAntigas = carregar(tx, 'com_nexo_curadoria_outbox')
              for (var oai = 0; oai < operacoesAntigas.length; oai++) {
                var operacaoAntiga = operacoesAntigas[oai]
                if (texto(operacaoAntiga, 'caso_id') !== caso.id) continue
                var statusOperacao = texto(operacaoAntiga, 'status')
                if (
                  statusOperacao !== 'pendente' &&
                  statusOperacao !== 'erro' &&
                  statusOperacao !== 'processando'
                )
                  continue
                operacaoAntiga.set('status', 'supersedido')
                operacaoAntiga.set('superseded_by', 'evidencia-revisao-' + String(novaRevisao))
                operacaoAntiga.set('processed_at', new Date())
                tx.save(operacaoAntiga)
              }
            } catch (_) {}
          }
          caso.set('updated_by', actor.id)
          tx.save(caso)
          atualizados++
        }

        for (var nei = 0; nei < novasEvidencias.length; nei++) {
          var nova = novasEvidencias[nei]
          var evidencia = new Record(tx.findCollectionByNameOrId('com_nexo_curadoria_evidencias'))
          evidencia.set('caso_id', caso.id)
          evidencia.set('fonte_tipo', nova.fonte_tipo)
          evidencia.set('fonte_ref', nova.fonte_ref)
          evidencia.set('evidencia_hash', nova.hash)
          evidencia.set('escopo_ref', grupo.escopo_ref)
          evidencia.set('resumo_factual', nova.resumo_factual)
          evidencia.set('metadados', { payload_bruto: false })
          evidencia.set('occurred_at', nova.occurred_at || new Date())
          tx.save(evidencia)
          estado.evidencias_existentes[caso.id + '|' + nova.hash] = true
          evidenciasCriadas++
        }

        if (novoCaso) {
          var statusNovo = texto(caso, 'status')
          var chaveTransicao = String(
            $security.sha256(
              ['curadoria-transicao-v1', grupo.fingerprint, 'inicial', statusNovo].join('|'),
            ),
          )
          if (!estado.transicoes_existentes[chaveTransicao]) {
            var transicao = new Record(tx.findCollectionByNameOrId('com_nexo_curadoria_transicoes'))
            transicao.set('caso_id', caso.id)
            transicao.set('transicao_chave', chaveTransicao)
            transicao.set('status_anterior', '')
            transicao.set('status_novo', statusNovo)
            transicao.set('ator_id', actor.id)
            transicao.set('motivo', 'Caso criado pela consolidação governada do Ledger Comercial.')
            transicao.set('metadados', { automatico: true, promocao: false })
            transicao.set('ocorreu_em', new Date())
            tx.save(transicao)
            estado.transicoes_existentes[chaveTransicao] = true
            transicoesCriadas++
          }
        } else if (reabertura) {
          var chaveReabertura = String(
            $security.sha256(
              [
                'curadoria-transicao-v1',
                grupo.fingerprint,
                'reabertura',
                String(reabertura.revisao),
                reabertura.status_novo,
              ].join('|'),
            ),
          )
          if (!estado.transicoes_existentes[chaveReabertura]) {
            var transicaoReabertura = new Record(
              tx.findCollectionByNameOrId('com_nexo_curadoria_transicoes'),
            )
            transicaoReabertura.set('caso_id', caso.id)
            transicaoReabertura.set('transicao_chave', chaveReabertura)
            transicaoReabertura.set('status_anterior', reabertura.status_anterior)
            transicaoReabertura.set('status_novo', reabertura.status_novo)
            transicaoReabertura.set('ator_id', actor.id)
            transicaoReabertura.set(
              'motivo',
              'Caso reaberto por nova evidência após o período de revisão.',
            )
            transicaoReabertura.set('metadados', {
              automatico: true,
              promocao: false,
              revisao: reabertura.revisao,
            })
            transicaoReabertura.set('ocorreu_em', new Date())
            tx.save(transicaoReabertura)
            estado.transicoes_existentes[chaveReabertura] = true
            transicoesCriadas++
          }
        }
      }
    })
  } catch (_) {
    return e.json(500, { ok: false, error: 'FALHA_CONSOLIDACAO_CURADORIA' })
  }

  return e.json(200, {
    ok: true,
    dry_run: false,
    casos_criados: criados,
    casos_atualizados: atualizados,
    evidencias_criadas: evidenciasCriadas,
    transicoes_criadas: transicoesCriadas,
    automatic_send_allowed: false,
    promocao_automatica_realizada: false,
  })
})

routerAdd('POST', '/backend/v1/nexo/curadoria/fontes/{source}/eventos/{eventId}', function (e) {
  function limparTexto(value, max) {
    var out = String(value || '')
      .replace(/<br\s*\/?\s*>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (max && out.length > max) out = out.slice(0, max)
    return out
  }

  function esc(value) {
    return String(value || '')
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
  }

  var source = String(e.request.pathValue('source') || '')
  var eventId = String(e.request.pathValue('eventId') || '')
  var secretNames = {
    activecampaign: 'NEXO_ACTIVE_CAMPAIGN_EVENT_INGEST_SECRET',
    reuniao_externa: 'NEXO_REUNIAO_EVENT_INGEST_SECRET',
  }
  if (!secretNames[source]) return e.json(400, { ok: false, error: 'FONTE_INVALIDA' })
  if (!/^[A-Za-z0-9._:-]{1,160}$/.test(eventId))
    return e.json(400, { ok: false, error: 'EVENTO_INVALIDO' })

  var body = e.requestInfo().body || {}
  var camposPermitidos = {
    occurred_at: true,
    business_ref: true,
    company: true,
    contact: true,
    responsible: true,
    event_type: true,
    summary: true,
    destination: true,
    risk: true,
    confidence: true,
  }
  for (var field in body) {
    if (!camposPermitidos[field]) return e.json(400, { ok: false, error: 'CAMPO_NAO_PERMITIDO' })
  }

  var summary = limparTexto(body.summary, 2000)
  var eventType = limparTexto(body.event_type, 80)
  var businessRef = limparTexto(body.business_ref, 240)
  var company = limparTexto(body.company, 240)
  var contact = limparTexto(body.contact, 240)
  var responsible = limparTexto(body.responsible, 160)
  var occurredAt = String(body.occurred_at || '')
  if (!summary || !eventType || (!businessRef && !company))
    return e.json(400, { ok: false, error: 'EVENTO_INCOMPLETO' })
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(occurredAt))
    return e.json(400, { ok: false, error: 'DATA_INVALIDA' })

  var destinos = {
    historico: true,
    pendencia: true,
    curadoria: true,
    escalar_direcao: true,
  }
  var riscos = { baixo: true, medio: true, alto: true }
  var confiancas = { baixa: true, media: true, alta: true }
  var destino = String(body.destination || 'historico')
  var risco = String(body.risk || 'medio')
  var confianca = String(body.confidence || 'media')
  if (!destinos[destino]) destino = 'historico'
  if (!riscos[risco]) risco = 'medio'
  if (!confiancas[confianca]) confianca = 'media'

  var payloadNormalizado = {
    occurred_at: occurredAt,
    business_ref: businessRef,
    company: company,
    contact: contact,
    responsible: responsible,
    event_type: eventType,
    summary: summary,
    destination: destino,
    risk: risco,
    confidence: confianca,
  }
  var payloadHash = String($security.sha256(JSON.stringify(payloadNormalizado)))
  var configuredSecret = ''
  var otherSecret = ''
  try {
    configuredSecret = String($secrets.get(secretNames[source]) || '')
    otherSecret = String(
      $secrets.get(
        source === 'activecampaign' ? secretNames.reuniao_externa : secretNames.activecampaign,
      ) || '',
    )
  } catch (_) {}
  if (!configuredSecret || !otherSecret)
    return e.json(503, { ok: false, error: 'FONTE_NAO_CONFIGURADA' })
  if (configuredSecret === otherSecret)
    return e.json(503, { ok: false, error: 'SEGREDOS_FONTES_NAO_DISTINTOS' })
  var providedSignature = ''
  try {
    providedSignature = String(e.request.header.get('X-PMAIS-Event-Signature') || '')
  } catch (_) {}
  var expectedSignature = String(
    $security.hs256(source + '.' + eventId + '.' + payloadHash, configuredSecret),
  )
  if (
    !providedSignature ||
    providedSignature.length !== expectedSignature.length ||
    providedSignature !== expectedSignature
  )
    return e.json(401, { ok: false, error: 'FONTE_NAO_AUTORIZADA' })

  var auditId = String($security.sha256(['ledger-fonte-comercial-v1', source, eventId].join('|')))
  var filtro = "audit_id = '" + esc(auditId) + "'"
  var existing = $app.findRecordsByFilter('com_ledger_comercial', filtro, '+id', 1, 0)
  if (existing.length) {
    if (nexoCuradoriaCasosTexto(existing[0], 'payload_hash') !== payloadHash)
      return e.json(409, { ok: false, error: 'EVENT_ID_PAYLOAD_CONFLICT' })
    return e.json(200, {
      ok: true,
      accepted: true,
      created: false,
      automatic_send_allowed: false,
      promocao_automatica_realizada: false,
    })
  }

  try {
    var record = new Record($app.findCollectionByNameOrId('com_ledger_comercial'))
    record.set('fonte', source)
    record.set(
      'canal',
      source === 'activecampaign' ? 'ActiveCampaign' : 'Reunião comercial externa',
    )
    record.set('origem', 'integracao_autenticada')
    record.set('contato_nome', contact)
    record.set('empresa_nome', company)
    record.set('negocio_ref', businessRef)
    record.set('responsavel', responsible)
    record.set('tipo_evento', eventType)
    record.set('fato', summary)
    record.set('evidencia_ref', source + ':' + eventId)
    record.set('destino_sugerido', destino)
    record.set('risco', risco)
    record.set('retencao', 'operacional')
    record.set('status', 'novo')
    record.set('confianca', confianca)
    record.set('promocao_modo', '')
    record.set('revisao_status', '')
    record.set('audit_id', auditId)
    record.set('payload_hash', payloadHash)
    record.set(
      'observacao',
      'Evento autenticado e sanitizado; payload bruto não foi persistido nesta camada.',
    )
    record.set('occurred_at', occurredAt)
    $app.save(record)
    var materialized = $app.findRecordsByFilter('com_ledger_comercial', filtro, '+id', 1, 0)
    if (!materialized.length) return e.json(500, { ok: false, error: 'EVENTO_NAO_MATERIALIZADO' })
  } catch (_) {
    try {
      var concurrent = $app.findRecordsByFilter('com_ledger_comercial', filtro, '+id', 1, 0)
      if (concurrent.length) {
        if (nexoCuradoriaCasosTexto(concurrent[0], 'payload_hash') !== payloadHash)
          return e.json(409, { ok: false, error: 'EVENT_ID_PAYLOAD_CONFLICT' })
        return e.json(200, {
          ok: true,
          accepted: true,
          created: false,
          automatic_send_allowed: false,
          promocao_automatica_realizada: false,
        })
      }
    } catch (_) {}
    return e.json(500, { ok: false, error: 'FALHA_AO_REGISTRAR_EVENTO' })
  }

  return e.json(202, {
    ok: true,
    accepted: true,
    created: true,
    automatic_send_allowed: false,
    promocao_automatica_realizada: false,
  })
})

function nexoCuradoriaCasosTexto(record, field) {
  if (!record) return ''
  try {
    return record.getString(field) || ''
  } catch (_) {
    return ''
  }
}

function nexoCuradoriaCasosNumero(record, field) {
  try {
    return Number(record.getInt(field) || 0)
  } catch (_) {
    return Number(nexoCuradoriaCasosTexto(record, field) || 0)
  }
}

function nexoCuradoriaCasosArray(record, field) {
  var raw = []
  try {
    raw = record.get(field) || []
  } catch (_) {}
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw)
    } catch (_) {
      raw = []
    }
  }
  return Array.isArray(raw) ? raw : []
}

function nexoCuradoriaCasosLimpar(value, max) {
  var out = String(value || '')
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (max && out.length > max) out = out.slice(0, max)
  return out
}

function nexoCuradoriaCasosPerfil(e) {
  var actor = e.auth
  if (!actor || !actor.getBool('ativo_comercial')) return null
  try {
    var collectionName = ''
    try {
      if (typeof actor.collection === 'function') collectionName = actor.collection().name || ''
      else if (actor.collection && typeof actor.collection === 'object')
        collectionName = actor.collection.name || ''
      else collectionName = String(actor.collection || '')
    } catch (_) {}
    if (collectionName !== 'users') return null
    var perfil = $app.findRecordById('com_perfis', actor.getString('perfil_id'))
    if (!perfil.getBool('ativo')) return null
    var slug = perfil.getString('slug') || ''
    if (
      slug !== 'superadministrador' &&
      slug !== 'leitura-executiva' &&
      slug !== 'gestor-comercial'
    )
      return null
    return {
      actor: actor,
      slug: slug,
      visao_executiva: slug === 'superadministrador' || slug === 'leitura-executiva',
      pode_escrever: slug === 'superadministrador' || slug === 'gestor-comercial',
      pode_decidir_direcao: slug === 'superadministrador',
    }
  } catch (_) {
    return null
  }
}

function nexoCuradoriaCasoNoEscopo(acesso, caso) {
  if (!acesso || !caso) return false
  if (acesso.visao_executiva) return true
  if (acesso.slug !== 'gestor-comercial') return false
  var actorId = acesso.actor.id
  var responsavelId = nexoCuradoriaCasosTexto(caso, 'responsavel_id')
  var equipeId = nexoCuradoriaCasosTexto(caso, 'equipe_id')
  var actorEquipeId = nexoCuradoriaCasosTexto(acesso.actor, 'equipe_id')
  if (responsavelId && responsavelId === actorId) return true
  if (equipeId && actorEquipeId && equipeId === actorEquipeId) return true
  if (!responsavelId) return false
  var negocioId = nexoCuradoriaCasosTexto(caso, 'negocio_id')
  var hoje = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10)
  try {
    var substituicoes = $app.findRecordsByFilter(
      'com_substituicoes',
      "titular_id = '" +
        responsavelId.replace(/\\/g, '\\\\').replace(/'/g, "\\'") +
        "' && (substituto_principal_id = '" +
        actorId.replace(/\\/g, '\\\\').replace(/'/g, "\\'") +
        "' || substituto_reserva_id = '" +
        actorId.replace(/\\/g, '\\\\').replace(/'/g, "\\'") +
        "')",
      '-created',
      500,
      0,
    )
    for (var i = 0; i < substituicoes.length; i++) {
      var sub = substituicoes[i]
      if (nexoCuradoriaCasosTexto(sub, 'titular_id') !== responsavelId) continue
      if (
        nexoCuradoriaCasosTexto(sub, 'substituto_principal_id') !== actorId &&
        nexoCuradoriaCasosTexto(sub, 'substituto_reserva_id') !== actorId
      )
        continue
      if (nexoCuradoriaCasosTexto(sub, 'cancelada_em')) continue
      var inicio = nexoCuradoriaCasosTexto(sub, 'data_inicio').slice(0, 10)
      var fim = nexoCuradoriaCasosTexto(sub, 'data_fim').slice(0, 10)
      if ((inicio && inicio > hoje) || (fim && fim < hoje)) continue
      if (nexoCuradoriaCasosTexto(sub, 'tipo_cobertura') === 'integral') return true
      if (negocioId && nexoCuradoriaCasosArray(sub, 'negocios_cobertos').indexOf(negocioId) >= 0)
        return true
    }
  } catch (_) {}
  return false
}

function nexoCuradoriaCasosCarregar(app, collectionName) {
  var out = []
  var offset = 0
  var limit = 500
  while (true) {
    var page = app.findRecordsByFilter(collectionName, "id != ''", '-updated,-id', limit, offset)
    for (var i = 0; i < page.length; i++) out.push(page[i])
    if (page.length < limit) return out
    offset += page.length
  }
}

function nexoCuradoriaCasoResposta(record) {
  return {
    id: record.id,
    revisao: nexoCuradoriaCasosNumero(record, 'revisao'),
    status: nexoCuradoriaCasosTexto(record, 'status'),
    fonte_principal: nexoCuradoriaCasosTexto(record, 'fonte_principal'),
    fontes: nexoCuradoriaCasosArray(record, 'fontes'),
    empresa_nome: nexoCuradoriaCasosTexto(record, 'empresa_nome') || null,
    contato_nome: nexoCuradoriaCasosTexto(record, 'contato_nome') || null,
    negocio_numero: nexoCuradoriaCasosTexto(record, 'negocio_numero') || null,
    negocio_titulo: nexoCuradoriaCasosTexto(record, 'negocio_titulo') || null,
    responsavel_nome: nexoCuradoriaCasosTexto(record, 'responsavel_nome') || null,
    assunto_chave: nexoCuradoriaCasosTexto(record, 'assunto_chave'),
    titulo: nexoCuradoriaCasosTexto(record, 'titulo'),
    resumo_factual: nexoCuradoriaCasosTexto(record, 'resumo_factual'),
    motivo_curadoria: nexoCuradoriaCasosTexto(record, 'motivo_curadoria'),
    regra_candidata: nexoCuradoriaCasosTexto(record, 'regra_candidata') || null,
    evidencia_contagem: nexoCuradoriaCasosNumero(record, 'evidencia_contagem'),
    recorrencia_contagem: nexoCuradoriaCasosNumero(record, 'recorrencia_contagem'),
    risco_classe: nexoCuradoriaCasosTexto(record, 'risco_classe'),
    alcada: nexoCuradoriaCasosTexto(record, 'alcada'),
    sensivel_motivos: nexoCuradoriaCasosArray(record, 'sensivel_motivos'),
    confianca: nexoCuradoriaCasosTexto(record, 'confianca'),
    human_review_required: record.getBool('human_review_required'),
    automatic_promotion_allowed: record.getBool('automatic_promotion_allowed'),
    entrevista_respostas: nexoCuradoriaCasosArray(record, 'entrevista_respostas'),
    entrevista_etapa: nexoCuradoriaCasosNumero(record, 'entrevista_etapa'),
    decisao_observacao: nexoCuradoriaCasosTexto(record, 'decisao_observacao') || null,
    conhecimento_status: nexoCuradoriaCasosTexto(record, 'conhecimento_status') || 'nao_publicado',
    last_seen_at: nexoCuradoriaCasosTexto(record, 'last_seen_at') || null,
    decisao_em: nexoCuradoriaCasosTexto(record, 'decisao_em') || null,
  }
}

function nexoCuradoriaCasoAlcada(record) {
  var assunto = nexoCuradoriaCasosTexto(record, 'assunto_chave')
  var risco = nexoCuradoriaCasosTexto(record, 'risco_classe')
  var sensiveis = nexoCuradoriaCasosArray(record, 'sensivel_motivos')
  var assuntosExecutivos = {
    preco_ou_desconto: true,
    contrato_ou_promessa_sensivel: true,
    lgpd_ou_dados_pessoais: true,
    politica_comercial: true,
    indicador_ou_ipcp: true,
    integridade_ou_conflito: true,
  }
  return sensiveis.length || risco === 'alto' || risco === 'critico' || assuntosExecutivos[assunto]
    ? 'direcao'
    : 'gestao_comercial'
}

routerAdd('POST', '/backend/v1/nexo/curadoria/casos/listar', function (e) {
  var acesso = nexoCuradoriaCasosPerfil(e)
  if (!acesso) return e.forbiddenError('Perfil de curadoria necessario')
  var body = e.requestInfo().body || {}
  var limite = Number(body.limite || 50)
  if (!isFinite(limite)) limite = 50
  limite = Math.max(1, Math.min(100, Math.floor(limite)))
  var casos = []
  try {
    casos = nexoCuradoriaCasosCarregar($app, 'com_nexo_curadoria_casos')
  } catch (_) {
    return e.json(503, { ok: false, error: 'CURADORIA_INDISPONIVEL' })
  }
  casos.sort(function (a, b) {
    var ad = nexoCuradoriaCasosTexto(a, 'last_seen_at')
    var bd = nexoCuradoriaCasosTexto(b, 'last_seen_at')
    if (ad !== bd) return ad < bd ? 1 : -1
    return a.id < b.id ? 1 : a.id > b.id ? -1 : 0
  })

  var visoes = {
    para_tratar: [],
    aguardando_decisao: [],
    conhecimento_aprovado: [],
    historico: [],
  }
  for (var i = 0; i < casos.length; i++) {
    var caso = casos[i]
    if (!nexoCuradoriaCasoNoEscopo(acesso, caso)) continue
    var status = nexoCuradoriaCasosTexto(caso, 'status')
    var alcada = nexoCuradoriaCasoAlcada(caso)
    var item = nexoCuradoriaCasoResposta(caso)
    if (
      ((acesso.visao_executiva && alcada === 'direcao') ||
        (!acesso.visao_executiva && alcada === 'gestao_comercial')) &&
      (status === 'aberto_curadoria' || status === 'em_entrevista') &&
      visoes.para_tratar.length < limite
    )
      visoes.para_tratar.push(item)
    if (
      !acesso.visao_executiva &&
      alcada === 'gestao_comercial' &&
      status === 'aguardando_gestao' &&
      visoes.aguardando_decisao.length < limite
    )
      visoes.aguardando_decisao.push(item)
    if (
      acesso.visao_executiva &&
      alcada === 'direcao' &&
      status === 'aguardando_direcao' &&
      visoes.aguardando_decisao.length < limite
    )
      visoes.aguardando_decisao.push(item)
    if (
      status === 'aprovado' &&
      (acesso.visao_executiva || alcada === 'gestao_comercial') &&
      visoes.conhecimento_aprovado.length < limite
    )
      visoes.conhecimento_aprovado.push(item)
    if (
      (status === 'rejeitado' || status === 'retirado' || status === 'sem_acao') &&
      (acesso.visao_executiva || alcada === 'gestao_comercial') &&
      visoes.historico.length < limite
    )
      visoes.historico.push(item)
  }

  return e.json(200, {
    ok: true,
    visoes: visoes,
    contadores: {
      para_tratar: visoes.para_tratar.length,
      aguardando_decisao: visoes.aguardando_decisao.length,
      conhecimento_aprovado: visoes.conhecimento_aprovado.length,
      historico: visoes.historico.length,
    },
    guardrails: {
      sem_payload_bruto: true,
      sem_ids_tecnicos_visiveis: true,
      automatic_send_allowed: false,
    },
  })
})

routerAdd('POST', '/backend/v1/nexo/curadoria/casos/{id}/transicionar', function (e) {
  var acesso = nexoCuradoriaCasosPerfil(e)
  if (!acesso || !acesso.pode_escrever)
    return e.forbiddenError('Perfil com alçada decisória necessario')
  var id = String(e.request.pathValue('id') || '')
  if (!/^[A-Za-z0-9._:-]{1,80}$/.test(id)) return e.json(400, { ok: false, error: 'CASO_INVALIDO' })
  var body = e.requestInfo().body || {}
  var acao = String(body.acao || '')
  var expectedRevision = Number(body.expected_revision || 0)
  var acoes = {
    salvar_rascunho: true,
    encaminhar_gestao: true,
    encaminhar_direcao: true,
    aprovar: true,
    rejeitar: true,
    retirar: true,
    reabrir: true,
  }
  if (!acoes[acao] || !Number.isInteger(expectedRevision) || expectedRevision < 1)
    return e.json(400, { ok: false, error: 'TRANSICAO_INVALIDA' })

  var regra = nexoCuradoriaCasosLimpar(body.regra_candidata, 4000)
  var observacao = nexoCuradoriaCasosLimpar(body.decisao_observacao, 2400)
  var etapa = Number(body.entrevista_etapa || 0)
  if (!isFinite(etapa)) etapa = 0
  etapa = Math.max(0, Math.min(10, Math.floor(etapa)))
  var respostasRecebidas = Array.isArray(body.entrevista_respostas) ? body.entrevista_respostas : []
  if (respostasRecebidas.length > 10)
    return e.json(400, { ok: false, error: 'ENTREVISTA_MUITO_EXTENSA' })
  var respostas = []
  for (var ri = 0; ri < respostasRecebidas.length; ri++)
    respostas.push(nexoCuradoriaCasosLimpar(respostasRecebidas[ri], 2000))

  var commandCanonical = JSON.stringify({
    acao: acao,
    regra: regra,
    observacao: observacao,
    respostas: respostas,
    revisao: expectedRevision,
  })
  var commandHash = String($security.sha256(commandCanonical))

  var transitionKey = String(
    $security.sha256(
      ['curadoria-caso-transicao-v1', id, String(expectedRevision), acao, acesso.actor.id].join(
        '|',
      ),
    ),
  )
  try {
    var transicoes = nexoCuradoriaCasosCarregar($app, 'com_nexo_curadoria_transicoes')
    for (var ti = 0; ti < transicoes.length; ti++) {
      if (nexoCuradoriaCasosTexto(transicoes[ti], 'transicao_chave') === transitionKey) {
        if (nexoCuradoriaCasosTexto(transicoes[ti], 'command_hash') !== commandHash)
          return e.json(409, { ok: false, error: 'REPLAY_DIVERGENTE' })
        return e.json(200, {
          ok: true,
          idempotent_replay: true,
          caso: nexoCuradoriaCasoResposta($app.findRecordById('com_nexo_curadoria_casos', id)),
          automatic_send_allowed: false,
        })
      }
    }
  } catch (_) {}

  var responseRecord = null
  try {
    $app.runInTransaction(function (tx) {
      var caso = tx.findRecordById('com_nexo_curadoria_casos', id)
      if (!nexoCuradoriaCasoNoEscopo(acesso, caso)) throw new Error('ESCOPO_INSUFICIENTE')
      var revisaoAtual = nexoCuradoriaCasosNumero(caso, 'revisao')
      if (revisaoAtual !== expectedRevision) throw new Error('REVISAO_DESATUALIZADA')
      var statusAnterior = nexoCuradoriaCasosTexto(caso, 'status')
      var conhecimentoStatusAnterior = nexoCuradoriaCasosTexto(caso, 'conhecimento_status')
      var alcada = nexoCuradoriaCasoAlcada(caso)
      caso.set('alcada', alcada)
      if (!acesso.pode_decidir_direcao && alcada === 'direcao')
        throw new Error('ALCADA_INSUFICIENTE')

      var statusNovo = statusAnterior
      if (acao === 'salvar_rascunho') {
        if (
          statusAnterior !== 'aberto_curadoria' &&
          statusAnterior !== 'em_entrevista' &&
          statusAnterior !== 'aguardando_gestao'
        )
          throw new Error('TRANSICAO_NAO_PERMITIDA')
        statusNovo = 'em_entrevista'
        caso.set('entrevista_respostas', respostas)
        caso.set('entrevista_etapa', etapa)
        if (regra) caso.set('regra_candidata', regra)
      } else if (acao === 'encaminhar_gestao') {
        if (alcada !== 'gestao_comercial') throw new Error('ALCADA_INSUFICIENTE')
        if (statusAnterior !== 'aberto_curadoria' && statusAnterior !== 'em_entrevista')
          throw new Error('TRANSICAO_NAO_PERMITIDA')
        caso.set('entrevista_respostas', respostas)
        caso.set('entrevista_etapa', etapa)
        if (regra) caso.set('regra_candidata', regra)
        statusNovo = 'aguardando_gestao'
      } else if (acao === 'encaminhar_direcao') {
        if (!acesso.pode_decidir_direcao && alcada === 'direcao')
          throw new Error('ALCADA_INSUFICIENTE')
        if (
          statusAnterior !== 'aberto_curadoria' &&
          statusAnterior !== 'em_entrevista' &&
          statusAnterior !== 'aguardando_gestao'
        )
          throw new Error('TRANSICAO_NAO_PERMITIDA')
        caso.set('entrevista_respostas', respostas)
        caso.set('entrevista_etapa', etapa)
        if (regra) caso.set('regra_candidata', regra)
        statusNovo = 'aguardando_direcao'
        caso.set('alcada', 'direcao')
      } else if (acao === 'aprovar') {
        if (!regra && !nexoCuradoriaCasosTexto(caso, 'regra_candidata'))
          throw new Error('REGRA_OBRIGATORIA')
        if (
          statusAnterior !== 'aberto_curadoria' &&
          statusAnterior !== 'em_entrevista' &&
          statusAnterior !== 'aguardando_gestao' &&
          statusAnterior !== 'aguardando_direcao'
        )
          throw new Error('TRANSICAO_NAO_PERMITIDA')
        if (statusAnterior === 'aguardando_direcao' && !acesso.pode_decidir_direcao)
          throw new Error('ALCADA_INSUFICIENTE')
        statusNovo = 'aprovado'
        if (regra) caso.set('regra_candidata', regra)
        caso.set('conhecimento_status', 'pendente_publicacao')
        caso.set('validado_por', acesso.actor.id)
        caso.set('decisao_em', new Date())
        caso.set('approved_at', new Date())
      } else if (acao === 'rejeitar') {
        if (
          statusAnterior !== 'aberto_curadoria' &&
          statusAnterior !== 'em_entrevista' &&
          statusAnterior !== 'aguardando_gestao' &&
          statusAnterior !== 'aguardando_direcao' &&
          statusAnterior !== 'aprovado'
        )
          throw new Error('TRANSICAO_NAO_PERMITIDA')
        statusNovo = 'rejeitado'
        caso.set(
          'conhecimento_status',
          nexoCuradoriaCasosTexto(caso, 'conhecimento_status') === 'ativo'
            ? 'pendente_retirada'
            : 'nao_publicado',
        )
        var nextReview = new Date(new Date().getTime() + 30 * 24 * 60 * 60 * 1000)
        caso.set('next_review_at', nextReview)
        caso.set('validado_por', acesso.actor.id)
        caso.set('decisao_em', new Date())
      } else if (acao === 'retirar') {
        if (statusAnterior !== 'aprovado') throw new Error('TRANSICAO_NAO_PERMITIDA')
        statusNovo = 'retirado'
        caso.set('conhecimento_status', 'pendente_retirada')
        caso.set('withdrawn_at', new Date())
      } else if (acao === 'reabrir') {
        if (
          statusAnterior !== 'rejeitado' &&
          statusAnterior !== 'retirado' &&
          statusAnterior !== 'sem_acao'
        )
          throw new Error('TRANSICAO_NAO_PERMITIDA')
        statusNovo = alcada === 'direcao' ? 'aguardando_direcao' : 'aberto_curadoria'
        caso.set('next_review_at', null)
      }

      if (observacao) caso.set('decisao_observacao', observacao)
      caso.set('status', statusNovo)
      caso.set('revisao', revisaoAtual + 1)
      caso.set('updated_by', acesso.actor.id)
      tx.save(caso)

      var transicao = new Record(tx.findCollectionByNameOrId('com_nexo_curadoria_transicoes'))
      transicao.set('caso_id', caso.id)
      transicao.set('transicao_chave', transitionKey)
      transicao.set('command_hash', commandHash)
      transicao.set('status_anterior', statusAnterior)
      transicao.set('status_novo', statusNovo)
      transicao.set('ator_id', acesso.actor.id)
      transicao.set('motivo', observacao || 'Transição governada da Curadoria Comercial.')
      transicao.set('metadados', {
        acao: acao,
        revisao_anterior: revisaoAtual,
        revisao_nova: revisaoAtual + 1,
      })
      transicao.set('ocorreu_em', new Date())
      tx.save(transicao)

      var outboxAcao = ''
      if (acao === 'aprovar') outboxAcao = 'publicar'
      if (
        acao === 'retirar' ||
        (acao === 'rejeitar' &&
          (statusAnterior === 'aprovado' || conhecimentoStatusAnterior === 'ativo'))
      )
        outboxAcao = 'retirar'
      if (outboxAcao) {
        var revisaoNova = revisaoAtual + 1
        var respostasConhecimento = nexoCuradoriaCasosArray(caso, 'entrevista_respostas')
        var conhecimentoRef = String(
          $security.sha256(
            [
              'nexo-curadoria-conhecimento-v1',
              nexoCuradoriaCasosTexto(caso, 'fingerprint') || caso.id,
            ].join('|'),
          ),
        )
        var atorAprovacaoId = String(
          $security.sha256(['curadoria-ator-v1', acesso.actor.id].join('|')),
        )
        var approvalConhecimento = {
          approval_id: transitionKey,
          case_ref: conhecimentoRef,
          case_revision: revisaoNova,
          actor_id: atorAprovacaoId,
          actor_profile: 'curadoria',
          authority: 'curadoria_conhecimento_comercial',
          action: outboxAcao,
          app_id: 'pmais_comercial',
        }
        var confiancaTexto = nexoCuradoriaCasosTexto(caso, 'confianca')
        var confiancaNumerica =
          confiancaTexto === 'alta' ? 0.9 : confiancaTexto === 'media' ? 0.6 : 0.3
        var payloadConhecimento = {
          schema_version: 'pmais_nexo_curadoria_conhecimento_v1',
          knowledge_ref: conhecimentoRef,
          action: outboxAcao,
          case_revision: revisaoNova,
          title: nexoCuradoriaCasosLimpar(nexoCuradoriaCasosTexto(caso, 'titulo'), 240),
          regra: nexoCuradoriaCasosLimpar(nexoCuradoriaCasosTexto(caso, 'regra_candidata'), 4000),
          exception: nexoCuradoriaCasosLimpar(respostasConhecimento[1], 2000),
          rationale: nexoCuradoriaCasosLimpar(
            nexoCuradoriaCasosTexto(caso, 'decisao_observacao') || respostasConhecimento[3],
            2000,
          ),
          subject: nexoCuradoriaCasosLimpar(nexoCuradoriaCasosTexto(caso, 'assunto_chave'), 240),
          scope_type: nexoCuradoriaCasosLimpar(nexoCuradoriaCasosTexto(caso, 'escopo_tipo'), 80),
          sources: nexoCuradoriaCasosArray(caso, 'fontes'),
          independent_cases: nexoCuradoriaCasosNumero(caso, 'recorrencia_contagem'),
          independent_businesses: nexoCuradoriaCasosNumero(caso, 'recorrencia_contagem'),
          independent_conversations: 0,
          confidence: confiancaNumerica,
          risk: nexoCuradoriaCasosLimpar(nexoCuradoriaCasosTexto(caso, 'risco_classe'), 80),
          approval: approvalConhecimento,
        }
        var payloadSerializado = JSON.stringify(payloadConhecimento)
        var idempotencyKeyOutbox = String(
          $security.sha256(
            ['curadoria-outbox-v1', caso.id, String(revisaoNova), outboxAcao].join('|'),
          ),
        )
        var operacoesAnteriores = nexoCuradoriaCasosCarregar(tx, 'com_nexo_curadoria_outbox')
        for (var oai = 0; oai < operacoesAnteriores.length; oai++) {
          var operacaoAnterior = operacoesAnteriores[oai]
          if (nexoCuradoriaCasosTexto(operacaoAnterior, 'caso_id') !== caso.id) continue
          var statusOperacaoAnterior = nexoCuradoriaCasosTexto(operacaoAnterior, 'status')
          if (
            statusOperacaoAnterior !== 'pendente' &&
            statusOperacaoAnterior !== 'erro' &&
            statusOperacaoAnterior !== 'processando'
          )
            continue
          operacaoAnterior.set('status', 'supersedido')
          operacaoAnterior.set('superseded_by', idempotencyKeyOutbox)
          operacaoAnterior.set('processed_at', new Date())
          tx.save(operacaoAnterior)
        }
        var outbox = new Record(tx.findCollectionByNameOrId('com_nexo_curadoria_outbox'))
        outbox.set('caso_id', caso.id)
        outbox.set('decisao_id', transicao.id)
        outbox.set('acao', outboxAcao)
        outbox.set('idempotency_key', idempotencyKeyOutbox)
        outbox.set('status', 'pendente')
        outbox.set('tentativas', 0)
        outbox.set('tentativas_ciclo', 0)
        outbox.set('retry_count', 0)
        outbox.set('last_error', '')
        outbox.set('payload_hash', String($security.sha256(payloadSerializado)))
        outbox.set('payload_json', payloadConhecimento)
        outbox.set('caso_revisao', revisaoNova)
        outbox.set('requested_at', new Date())
        tx.save(outbox)
      }
      responseRecord = caso
    })
  } catch (err) {
    var message = String(err && err.message ? err.message : err)
    if (message.indexOf('REVISAO_DESATUALIZADA') !== -1)
      return e.json(409, { ok: false, error: 'REVISAO_DESATUALIZADA' })
    if (message.indexOf('ALCADA_INSUFICIENTE') !== -1)
      return e.json(403, { ok: false, error: 'ALCADA_INSUFICIENTE' })
    if (message.indexOf('ESCOPO_INSUFICIENTE') !== -1)
      return e.json(403, { ok: false, error: 'ESCOPO_INSUFICIENTE' })
    if (message.indexOf('REGRA_OBRIGATORIA') !== -1)
      return e.json(400, { ok: false, error: 'REGRA_OBRIGATORIA' })
    if (message.indexOf('TRANSICAO_NAO_PERMITIDA') !== -1)
      return e.json(409, { ok: false, error: 'TRANSICAO_NAO_PERMITIDA' })
    return e.json(500, { ok: false, error: 'FALHA_TRANSICAO_CURADORIA' })
  }

  return e.json(200, {
    ok: true,
    idempotent_replay: false,
    caso: nexoCuradoriaCasoResposta(responseRecord),
    automatic_send_allowed: false,
    promocao_automatica_realizada: false,
  })
})

routerAdd('POST', '/backend/v1/nexo/curadoria/outbox/{id}/retry', function (e) {
  var acesso = nexoCuradoriaCasosPerfil(e)
  if (!acesso || acesso.slug !== 'superadministrador')
    return e.forbiddenError('Superadministrador necessario para retry da outbox')
  var id = String(e.request.pathValue('id') || '')
  if (!/^[A-Za-z0-9._:-]{1,80}$/.test(id))
    return e.json(400, { ok: false, error: 'OUTBOX_INVALIDA' })
  var body = e.requestInfo().body || {}
  var motivo = nexoCuradoriaCasosLimpar(body.motivo, 1000)
  if (motivo.length < 10) return e.json(400, { ok: false, error: 'MOTIVO_RETRY_OBRIGATORIO' })

  var responseRecord = null
  try {
    $app.runInTransaction(function (tx) {
      var item = tx.findRecordById('com_nexo_curadoria_outbox', id)
      var statusAnterior = nexoCuradoriaCasosTexto(item, 'status')
      if (statusAnterior !== 'erro' && statusAnterior !== 'falha_permanente')
        throw new Error('RETRY_NAO_PERMITIDO')
      var retryCount = nexoCuradoriaCasosNumero(item, 'retry_count') + 1
      item.set('status', 'pendente')
      item.set('tentativas_ciclo', 0)
      item.set('next_attempt_at', new Date())
      item.set('retry_count', retryCount)
      item.set('retry_requested_by', acesso.actor.id)
      item.set('retry_reason', motivo)
      item.set('last_error', '')
      tx.save(item)

      var auditoria = new Record(tx.findCollectionByNameOrId('com_nexo_curadoria_outbox_auditoria'))
      auditoria.set('outbox_id', item.id)
      auditoria.set('retry_count', retryCount)
      auditoria.set('ator_id', acesso.actor.id)
      auditoria.set('motivo', motivo)
      auditoria.set('status_anterior', statusAnterior)
      auditoria.set('requested_at', new Date())
      tx.save(auditoria)
      responseRecord = item
    })
  } catch (err) {
    if (String(err && err.message ? err.message : err).indexOf('RETRY_NAO_PERMITIDO') !== -1)
      return e.json(409, { ok: false, error: 'RETRY_NAO_PERMITIDO' })
    return e.json(500, { ok: false, error: 'FALHA_RETRY_OUTBOX' })
  }
  return e.json(200, {
    ok: true,
    status: nexoCuradoriaCasosTexto(responseRecord, 'status'),
    retry_count: nexoCuradoriaCasosNumero(responseRecord, 'retry_count'),
    automatic_send_allowed: false,
  })
})

routerAdd('POST', '/backend/v1/nexo/curadoria/outbox/processar', function (e) {
  var acesso = nexoCuradoriaCasosPerfil(e)
  if (!acesso || acesso.slug !== 'superadministrador')
    return e.forbiddenError('Superadministrador necessario para publicar conhecimento')

  var bodyRequest = e.requestInfo().body || {}
  var limite = Number(bodyRequest.limite || 10)
  if (!isFinite(limite)) limite = 10
  limite = Math.max(1, Math.min(25, Math.floor(limite)))

  function secretValue(name) {
    try {
      return $secrets.get(name) || ''
    } catch (_) {
      try {
        return $os.getenv(name) || ''
      } catch (_) {
        return ''
      }
    }
  }

  var gatewayBase = String(secretValue('PMAIS_AGENT_GATEWAY_URL') || '').replace(/\/+$/, '')
  var originMatch = gatewayBase.match(/^https?:\/\/[^/]+/i)
  gatewayBase = originMatch ? originMatch[0] : ''
  var gatewayKey = secretValue('PMAIS_CURADORIA_API_KEY')
  var gatewaySecret = secretValue('PMAIS_CURADORIA_HMAC_SECRET')
  var approvalSecret = secretValue('PMAIS_CURADORIA_APPROVAL_SECRET')
  if (!gatewayBase || !gatewayKey || !gatewaySecret || !approvalSecret)
    return e.json(503, { ok: false, error: 'GATEWAY_NAO_CONFIGURADO' })

  var pendentes = []
  var todas = []
  var emBackoffInicial = 0
  var bloqueadosOrdem = 0
  function statusTerminal(status) {
    return (
      status === 'processado' ||
      status === 'supersedido' ||
      status === 'invalidado' ||
      status === 'falha_permanente'
    )
  }
  try {
    todas = nexoCuradoriaCasosCarregar($app, 'com_nexo_curadoria_outbox')
  } catch (_) {
    return e.json(503, { ok: false, error: 'OUTBOX_INDISPONIVEL' })
  }
  todas.sort(function (a, b) {
    var ac = nexoCuradoriaCasosTexto(a, 'caso_id')
    var bc = nexoCuradoriaCasosTexto(b, 'caso_id')
    if (ac !== bc) return ac < bc ? -1 : 1
    var ar = nexoCuradoriaCasosNumero(a, 'caso_revisao')
    var br = nexoCuradoriaCasosNumero(b, 'caso_revisao')
    if (ar !== br) return ar - br
    var ad = nexoCuradoriaCasosTexto(a, 'requested_at')
    var bd = nexoCuradoriaCasosTexto(b, 'requested_at')
    if (ad !== bd) return ad < bd ? -1 : 1
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  })
  var casoComOperacaoAnterior = {}
  var agoraMs = new Date().getTime()
  for (var i = 0; i < todas.length; i++) {
    var statusOutbox = nexoCuradoriaCasosTexto(todas[i], 'status')
    if (statusTerminal(statusOutbox)) continue
    var leaseAtual = nexoCuradoriaCasosTexto(todas[i], 'claim_expires_at')
    var leaseAtualMs = leaseAtual ? new Date(leaseAtual).getTime() : 0
    var claimAtivo =
      statusOutbox === 'processando' &&
      leaseAtualMs &&
      isFinite(leaseAtualMs) &&
      leaseAtualMs > agoraMs
    var claimExpirado = statusOutbox === 'processando' && !claimAtivo
    var casoIdOutbox = nexoCuradoriaCasosTexto(todas[i], 'caso_id')
    if (casoComOperacaoAnterior[casoIdOutbox]) {
      bloqueadosOrdem++
      continue
    }
    casoComOperacaoAnterior[casoIdOutbox] = true
    if (claimAtivo) continue
    if (statusOutbox !== 'pendente' && statusOutbox !== 'erro' && !claimExpirado) continue
    var nextAttempt = nexoCuradoriaCasosTexto(todas[i], 'next_attempt_at')
    var nextAttemptMs = nextAttempt ? new Date(nextAttempt).getTime() : 0
    if (nextAttemptMs && isFinite(nextAttemptMs) && nextAttemptMs > agoraMs) {
      emBackoffInicial++
      continue
    }
    pendentes.push(todas[i])
  }
  pendentes.sort(function (a, b) {
    var ad = nexoCuradoriaCasosTexto(a, 'requested_at')
    var bd = nexoCuradoriaCasosTexto(b, 'requested_at')
    if (ad !== bd) return ad < bd ? -1 : 1
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  })
  pendentes = pendentes.slice(0, limite)

  var result = { processados: 0, falhas: 0, ignorados: 0, invalidados: 0 }
  for (var pi = 0; pi < pendentes.length; pi++) {
    var item = pendentes[pi]
    var claimToken = ''
    var claimedItem = null
    try {
      $app.runInTransaction(function (tx) {
        var atualClaim = tx.findRecordById('com_nexo_curadoria_outbox', item.id)
        var statusClaim = nexoCuradoriaCasosTexto(atualClaim, 'status')
        var claimExpira = nexoCuradoriaCasosTexto(atualClaim, 'claim_expires_at')
        var claimExpiraMs = claimExpira ? new Date(claimExpira).getTime() : 0
        var leaseExpirado =
          statusClaim === 'processando' &&
          (!claimExpiraMs || !isFinite(claimExpiraMs) || claimExpiraMs <= new Date().getTime())
        if (statusClaim !== 'pendente' && statusClaim !== 'erro' && !leaseExpirado)
          throw new Error('CLAIM_INDISPONIVEL')
        var nextClaim = nexoCuradoriaCasosTexto(atualClaim, 'next_attempt_at')
        if (nextClaim && new Date(nextClaim).getTime() > new Date().getTime())
          throw new Error('CLAIM_EM_BACKOFF')
        claimToken = String(
          $security.sha256(
            [
              'curadoria-outbox-claim-v1',
              atualClaim.id,
              String(Date.now()),
              acesso.actor.id,
              String(nexoCuradoriaCasosNumero(atualClaim, 'tentativas')),
            ].join('|'),
          ),
        )
        var claimedAt = new Date()
        atualClaim.set('status', 'processando')
        atualClaim.set('claim_token', claimToken)
        atualClaim.set('claimed_at', claimedAt)
        atualClaim.set('claim_expires_at', new Date(claimedAt.getTime() + 60 * 1000))
        tx.save(atualClaim)
        claimedItem = atualClaim
      })
    } catch (_) {
      result.ignorados++
      continue
    }
    item = claimedItem
    try {
      var preHttpValido = false
      $app.runInTransaction(function (tx) {
        var atualPreHttp = tx.findRecordById('com_nexo_curadoria_outbox', item.id)
        if (
          nexoCuradoriaCasosTexto(atualPreHttp, 'status') !== 'processando' ||
          nexoCuradoriaCasosTexto(atualPreHttp, 'claim_token') !== claimToken ||
          nexoCuradoriaCasosTexto(atualPreHttp, 'superseded_by')
        )
          return
        var casoAtualOutbox = tx.findRecordById(
          'com_nexo_curadoria_casos',
          nexoCuradoriaCasosTexto(atualPreHttp, 'caso_id'),
        )
        // Revalida o claim após ler o caso: uma supersessão pode intercalar nessa leitura.
        if (
          nexoCuradoriaCasosTexto(atualPreHttp, 'status') !== 'processando' ||
          nexoCuradoriaCasosTexto(atualPreHttp, 'claim_token') !== claimToken ||
          nexoCuradoriaCasosTexto(atualPreHttp, 'superseded_by')
        )
          return
        if (
          nexoCuradoriaCasosNumero(casoAtualOutbox, 'revisao') !==
          nexoCuradoriaCasosNumero(atualPreHttp, 'caso_revisao')
        ) {
          atualPreHttp.set('status', 'invalidado')
          atualPreHttp.set('last_error', 'REVISAO_SUPERADA')
          atualPreHttp.set('processed_at', new Date())
          atualPreHttp.set('claim_token', '')
          atualPreHttp.set('claim_expires_at', null)
          tx.save(atualPreHttp)
          result.invalidados++
          return
        }
        item = atualPreHttp
        preHttpValido = true
      })
      if (!preHttpValido) continue
      var payload = item.get('payload_json') || {}
      if (typeof payload === 'string') payload = JSON.parse(payload)
      if (!payload || typeof payload !== 'object' || Array.isArray(payload))
        throw new Error('PAYLOAD_INVALIDO')
      var payloadBody = JSON.stringify(payload)
      var payloadHash = String($security.sha256(payloadBody))
      if (payloadHash !== nexoCuradoriaCasosTexto(item, 'payload_hash'))
        throw new Error('PAYLOAD_HASH_DIVERGENTE')
      var timestamp = String(Math.floor(Date.now() / 1000))
      var signature = $security.hs256(timestamp + '.' + payloadBody, gatewaySecret)
      var approval = payload.approval || {}
      var approvalCanonical = JSON.stringify({
        action: approval.action,
        actor_id: approval.actor_id,
        actor_profile: approval.actor_profile,
        app_id: approval.app_id,
        approval_id: approval.approval_id,
        authority: approval.authority,
        case_ref: approval.case_ref,
        case_revision: approval.case_revision,
      })
      var approvalSignature = $security.hs256(approvalCanonical + '.' + payloadHash, approvalSecret)
      var response = $http.send({
        url: gatewayBase + '/v1/comercial/nexo/curadoria/conhecimento',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'x-pmais-api-key': gatewayKey,
          'x-pmais-timestamp': timestamp,
          'x-pmais-signature': signature,
          'x-pmais-idempotency-key': nexoCuradoriaCasosTexto(item, 'idempotency_key'),
          'x-pmais-payload-hash': payloadHash,
          'x-pmais-approval-signature': approvalSignature,
        },
        body: payloadBody,
        timeout: 30,
      })
      var responseJson = response.json || {}
      if (
        response.statusCode < 200 ||
        response.statusCode >= 300 ||
        !responseJson.ok ||
        !responseJson.readback_confirmed ||
        responseJson.payload_hash !== payloadHash ||
        responseJson.knowledge_ref !== payload.knowledge_ref ||
        responseJson.approval_id !== approval.approval_id ||
        responseJson.action !== payload.action ||
        Number(responseJson.case_revision) !== Number(payload.case_revision) ||
        !responseJson.actor ||
        responseJson.actor.actor_id !== approval.actor_id ||
        responseJson.actor.actor_profile !== approval.actor_profile ||
        responseJson.actor.authority !== approval.authority ||
        responseJson.actor.app_id !== approval.app_id ||
        !responseJson.audit_id ||
        !responseJson.version
      )
        throw new Error('GATEWAY_READBACK_INVALIDO')

      var confirmado = false
      $app.runInTransaction(function (tx) {
        var atual = tx.findRecordById('com_nexo_curadoria_outbox', item.id)
        var statusAtual = nexoCuradoriaCasosTexto(atual, 'status')
        if (
          statusAtual !== 'processando' ||
          nexoCuradoriaCasosTexto(atual, 'claim_token') !== claimToken ||
          nexoCuradoriaCasosTexto(atual, 'superseded_by')
        )
          return
        var caso = tx.findRecordById(
          'com_nexo_curadoria_casos',
          nexoCuradoriaCasosTexto(atual, 'caso_id'),
        )
        if (
          nexoCuradoriaCasosNumero(caso, 'revisao') !==
          nexoCuradoriaCasosNumero(atual, 'caso_revisao')
        ) {
          atual.set('status', 'invalidado')
          atual.set('last_error', 'REVISAO_SUPERADA_APOS_HTTP')
          atual.set('processed_at', new Date())
          atual.set('claim_token', '')
          atual.set('claim_expires_at', null)
          tx.save(atual)
          result.invalidados++
          return
        }
        atual.set('status', 'processado')
        atual.set('tentativas', nexoCuradoriaCasosNumero(atual, 'tentativas') + 1)
        atual.set('tentativas_ciclo', nexoCuradoriaCasosNumero(atual, 'tentativas_ciclo') + 1)
        atual.set('last_attempt_at', new Date())
        atual.set('next_attempt_at', null)
        atual.set('last_error', '')
        atual.set('audit_id', nexoCuradoriaCasosLimpar(responseJson.audit_id, 160))
        atual.set('target_version', nexoCuradoriaCasosLimpar(responseJson.version, 160))
        atual.set('processed_at', new Date())
        atual.set('claim_token', '')
        atual.set('claim_expires_at', null)
        tx.save(atual)

        caso.set(
          'conhecimento_status',
          nexoCuradoriaCasosTexto(atual, 'acao') === 'publicar' ? 'ativo' : 'retirado',
        )
        caso.set('conhecimento_audit_id', nexoCuradoriaCasosLimpar(responseJson.audit_id, 160))
        caso.set('conhecimento_versao', nexoCuradoriaCasosLimpar(responseJson.version, 160))
        tx.save(caso)
        confirmado = true
      })
      if (confirmado) result.processados++
      else result.ignorados++
    } catch (err) {
      var falhaConfirmada = false
      try {
        $app.runInTransaction(function (tx) {
          var itemAtual = tx.findRecordById('com_nexo_curadoria_outbox', item.id)
          if (
            nexoCuradoriaCasosTexto(itemAtual, 'status') !== 'processando' ||
            nexoCuradoriaCasosTexto(itemAtual, 'claim_token') !== claimToken ||
            nexoCuradoriaCasosTexto(itemAtual, 'superseded_by')
          )
            return
          var tentativas = nexoCuradoriaCasosNumero(itemAtual, 'tentativas') + 1
          var tentativasCiclo = nexoCuradoriaCasosNumero(itemAtual, 'tentativas_ciclo') + 1
          var agoraTentativa = new Date()
          itemAtual.set('tentativas', tentativas)
          itemAtual.set('tentativas_ciclo', tentativasCiclo)
          itemAtual.set('last_attempt_at', agoraTentativa)
          itemAtual.set('status', tentativasCiclo >= 5 ? 'falha_permanente' : 'erro')
          itemAtual.set(
            'next_attempt_at',
            tentativasCiclo >= 5
              ? null
              : new Date(
                  agoraTentativa.getTime() +
                    Math.min(3600, Math.pow(2, tentativasCiclo) * 30) * 1000,
                ),
          )
          itemAtual.set(
            'last_error',
            nexoCuradoriaCasosLimpar(err && err.message ? err.message : err, 400),
          )
          itemAtual.set('claim_token', '')
          itemAtual.set('claim_expires_at', null)
          tx.save(itemAtual)
          falhaConfirmada = true
        })
      } catch (_) {}
      if (falhaConfirmada) result.falhas++
      else result.ignorados++
    }
  }

  var pendentesRestantes = 0
  var emBackoff = 0
  try {
    var estadoFinal = nexoCuradoriaCasosCarregar($app, 'com_nexo_curadoria_outbox')
    var agoraFinal = new Date().getTime()
    for (var efi = 0; efi < estadoFinal.length; efi++) {
      var statusFinal = nexoCuradoriaCasosTexto(estadoFinal[efi], 'status')
      if (statusFinal !== 'pendente' && statusFinal !== 'erro') continue
      pendentesRestantes++
      var nextFinal = nexoCuradoriaCasosTexto(estadoFinal[efi], 'next_attempt_at')
      var nextFinalMs = nextFinal ? new Date(nextFinal).getTime() : 0
      if (nextFinalMs && isFinite(nextFinalMs) && nextFinalMs > agoraFinal) emBackoff++
    }
  } catch (_) {
    pendentesRestantes = Math.max(0, pendentes.length - result.processados)
    emBackoff = emBackoffInicial
  }
  return e.json(200, {
    ok: result.falhas === 0,
    processados: result.processados,
    falhas: result.falhas,
    ignorados: result.ignorados,
    invalidados: result.invalidados,
    bloqueados_ordem: bloqueadosOrdem,
    em_backoff: emBackoff,
    pendentes_restantes: pendentesRestantes,
    automatic_send_allowed: false,
  })
})
