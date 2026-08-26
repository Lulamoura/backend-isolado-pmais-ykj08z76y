// T4.6 — Ganho, Perda e reativação transacionais e auditáveis.
;(function () {
  routerAdd(
    'GET',
    '/backend/v1/fechamentos/fila',
    (e) => {
      function fechamentoPerfil(user) {
        try {
          return $app.findRecordById('com_perfis', user.getString('perfil_id')).getString('slug')
        } catch (_) {
          return ''
        }
      }
      function fechamentoPodeAcessar(user, perfil, negocio) {
        if (perfil === 'superadministrador' || perfil === 'leitura-executiva') return true
        if (negocio.getString('responsavel_id') === user.id) return true
        if (perfil === 'negociacao-propria') return false
        return (
          !!user.getString('equipe_id') &&
          negocio.getString('equipe_id') === user.getString('equipe_id')
        )
      }
      function diasUteisEntre(inicio, fim) {
        var a = new Date(inicio),
          b = new Date(fim),
          total = 0
        a.setHours(12, 0, 0, 0)
        b.setHours(12, 0, 0, 0)
        while (a < b) {
          a.setDate(a.getDate() + 1)
          if (a.getDay() !== 0 && a.getDay() !== 6) total++
        }
        return total
      }
      function fechamentoContexto(negocio) {
        function relacionado(collection, id, fields) {
          if (!id) return null
          try {
            var record = $app.findRecordById(collection, id),
              result = { id: record.id }
            for (var ri = 0; ri < fields.length; ri++)
              result[fields[ri]] = record.getString(fields[ri]) || null
            return result
          } catch (_) {
            return null
          }
        }
        var somenteLeitura = false
        var externalId = null
        try {
          externalId = $app
            .findFirstRecordByFilter(
              'com_vinculos_externos',
              "sistema_origem='activecampaign' && external_type='business' && record_id='" +
                negocio.id +
                "'",
            )
            .getString('external_id')
        } catch (_) {}
        try {
          var parametro = $app.findFirstRecordByData(
            'com_parametros',
            'chave',
            'ac_preoperation_read_only',
          )
          somenteLeitura = parametro.getBool('ativo') && parametro.getString('valor') === 'true'
        } catch (_) {}
        return {
          external_id: externalId,
          empresa: relacionado('com_empresas', negocio.getString('empresa_id'), ['nome']),
          contato: relacionado('com_contatos', negocio.getString('contato_principal_id'), [
            'nome',
            'email',
            'telefone',
          ]),
          responsavel: relacionado('users', negocio.getString('responsavel_id'), ['name']),
          valor_centavos: Number(negocio.get('valor') || 0),
          modalidade: negocio.getString('modalidade') || null,
          fase_crm: negocio.getString('fase_crm') || null,
          fonte_prospeccao: negocio.getString('fonte_prospeccao') || null,
          proxima_acao_em: negocio.getString('proxima_acao_em') || null,
          crm_created_at: negocio.getString('crm_created_at') || null,
          crm_updated_at: negocio.getString('crm_updated_at') || null,
          origem_canal: negocio.getString('origem_canal') || null,
          somente_leitura: somenteLeitura && negocio.getString('origem_canal') === 'activecampaign',
        }
      }
      var ator = e.auth
      if (!ator || !ator.getBool('ativo_comercial'))
        return e.forbiddenError('Usuario comercial necessario')
      var perfil = fechamentoPerfil(ator),
        itens = []
      var negocios = $app.findRecordsByFilter('com_negocios', 'inativo = false', '-updated', 100, 0)
      for (var i = 0; i < negocios.length; i++) {
        var n = negocios[i]
        if (!fechamentoPodeAcessar(ator, perfil, n)) continue
        if (
          !n.getString('resultado') &&
          ['producao_proposta', 'negociacao'].indexOf(n.getString('etapa')) < 0
        )
          continue
        var emitida = false,
          aceita = false,
          propostaEstado = null,
          tentativas = [],
          agenda = null
        try {
          var p = $app.findFirstRecordByData('com_propostas', 'negocio_id', n.id)
          var vs = $app.findRecordsByFilter(
            'com_proposta_versoes',
            "proposta_id='" + p.id + "'",
            '-numero',
            1,
            0,
          )
          if (vs.length) {
            propostaEstado = vs[0].getString('estado') || null
            emitida = ['enviada', 'aceita', 'recusada'].indexOf(vs[0].getString('estado')) >= 0
            aceita = vs[0].getString('estado') === 'aceita'
          }
        } catch (_) {}
        try {
          tentativas = $app.findRecordsByFilter(
            'com_atividades',
            "negocio_id='" + n.id + "' && tipo='tentativa_contato' && estado='realizada'",
            'realizada_em',
            100,
            0,
          )
        } catch (_) {}
        try {
          agenda = $app.findFirstRecordByFilter(
            'com_recuperacao_agendas',
            "negocio_perdido_id='" + n.id + "' && estado='ativa'",
          )
        } catch (_) {}
        var janela =
          tentativas.length > 1
            ? diasUteisEntre(
                tentativas[0].getString('realizada_em'),
                tentativas[tentativas.length - 1].getString('realizada_em'),
              )
            : 0
        if (!n.getString('resultado') && !emitida) continue
        if (n.getString('resultado') === 'desqualificado') continue
        itens.push({
          negocio: {
            id: n.id,
            titulo: n.getString('titulo'),
            etapa: n.getString('etapa'),
            resultado: n.getString('resultado') || null,
            fechamento_motivo: n.getString('fechamento_motivo') || null,
            fechamento_data: n.getString('fechamento_data') || null,
            responsavel_id: n.getString('responsavel_id') || null,
            updated: n.getString('updated'),
            data_periodo:
              n.getString('fechamento_data') ||
              n.getString('crm_updated_at') ||
              n.getString('updated'),
          },
          proposta_emitida: emitida,
          proposta_aceita: aceita,
          proposta_estado: propostaEstado,
          elegivel_fechamento: Boolean(n.getString('resultado')) || emitida,
          contexto: fechamentoContexto(n),
          tentativas_contato: tentativas.length,
          janela_tentativas_dias_uteis: janela,
          agenda: agenda
            ? {
                id: agenda.id,
                data_alvo: agenda.getString('data_alvo'),
                data_acionamento: agenda.getString('data_alvo'),
                antecedencia_dias: agenda.getInt('antecedencia_dias'),
                estado: agenda.getString('estado'),
              }
            : null,
        })
      }
      return e.json(200, { itens: itens })
    },
    $apis.requireAuth(),
  )

  routerAdd(
    'POST',
    '/backend/v1/fechamentos/decidir',
    (e) => {
      function fechamentoPerfil(user) {
        try {
          return $app.findRecordById('com_perfis', user.getString('perfil_id')).getString('slug')
        } catch (_) {
          return ''
        }
      }
      function fechamentoPodeAcessar(user, perfil, negocio) {
        if (perfil === 'superadministrador' || perfil === 'leitura-executiva') return true
        if (negocio.getString('responsavel_id') === user.id) return true
        if (perfil === 'negociacao-propria') return false
        return (
          !!user.getString('equipe_id') &&
          negocio.getString('equipe_id') === user.getString('equipe_id')
        )
      }
      function salvarAuditoria(app, ator, perfil, negocio, chave, evidencia) {
        var a = new Record(app.findCollectionByNameOrId('com_auditoria'))
        a.set('collection_name', 'com_negocios')
        a.set('record_id', negocio.id)
        a.set('acao', 'update')
        a.set('usuario_id', ator.id)
        a.set('comando', 'fechamento_' + evidencia.decisao)
        a.set('command_idempotency_key', chave)
        a.set('evento_em', new Date())
        a.set('justificativa', evidencia.justificativa || 'Decisão comercial')
        a.set('perfil', perfil)
        a.set('escopo', 'fechamento')
        a.set('origem', 'server-side')
        a.set('evidencia_estruturada', evidencia)
        a.set('snapshot_hash', $security.sha256(JSON.stringify(evidencia)))
        a.set('snapshot_hash_versao', '1')
        app.save(a)
      }
      var ator = e.auth,
        body = new DynamicModel({
          negocio_id: '',
          decisao: '',
          motivo: '',
          evidencia_formal: '',
          valor_efetivo_centavos: 0,
          data_alvo_recuperacao: '',
          antecedencia_dias: 60,
          updated_esperado: '',
          command_idempotency_key: '',
          justificativa: '',
        })
      if (fechamentoPerfil(ator) === 'leitura-executiva')
        return e.json(403, { error: 'SOMENTE_LEITURA' })
      e.bindBody(body)
      if (!ator || !ator.getBool('ativo_comercial'))
        return e.forbiddenError('Usuario comercial necessario')
      if (!body.command_idempotency_key) return e.badRequestError('IDEMPOTENCY_KEY_OBRIGATORIA')
      var motivos = [
          'preco',
          'fechou_com_outra_empresa',
          'perdeu_contato',
          'desistiu',
          'nao_atendido',
        ],
        comando = 'fechamento_decidir',
        payload = {
          negocio_id: body.negocio_id,
          decisao: body.decisao,
          motivo: body.motivo || null,
          evidencia_formal: body.evidencia_formal || null,
          valor_efetivo_centavos: Number(body.valor_efetivo_centavos || 0),
          data_alvo_recuperacao: body.data_alvo_recuperacao || null,
          antecedencia_dias: Number(body.antecedencia_dias || 60),
          updated_esperado: body.updated_esperado,
        },
        hash = $security.sha256(JSON.stringify(payload))
      try {
        var known = $app.findRecordsByFilter(
          'com_idempotencia',
          "ator_id='" +
            ator.id +
            "' && comando='" +
            comando +
            "' && command_idempotency_key='" +
            body.command_idempotency_key +
            "'",
          '',
          1,
          0,
        )
        if (known.length) {
          if (known[0].getString('payload_hash') !== hash) return e.json(409, { error: 'CONFLICT' })
          if (known[0].getString('estado') !== 'concluido')
            return e.json(409, { error: 'CONCORRENTE' })
          return e.json(
            200,
            Object.assign({ replay: true }, JSON.parse(known[0].getString('resultado'))),
          )
        }
      } catch (_) {}
      var negocio
      try {
        negocio = $app.findRecordById('com_negocios', body.negocio_id)
      } catch (_) {
        return e.notFoundError('NEGOCIO_NAO_ENCONTRADO')
      }
      var perfil = fechamentoPerfil(ator)
      try {
        var preop = $app.findFirstRecordByData(
          'com_parametros',
          'chave',
          'ac_preoperation_read_only',
        )
        if (
          preop.getBool('ativo') &&
          preop.getString('valor') === 'true' &&
          negocio.getString('origem_canal') === 'activecampaign'
        )
          return e.json(423, { error: 'PREOPERACAO_SOMENTE_LEITURA' })
      } catch (_) {}
      if (!fechamentoPodeAcessar(ator, perfil, negocio)) return e.forbiddenError('FORA_DO_ESCOPO')
      if (negocio.getString('resultado')) return e.badRequestError('NEGOCIO_TERMINAL_IMUTAVEL')
      if (body.updated_esperado !== negocio.getString('updated'))
        return e.json(409, { error: 'STALE_WRITE' })
      if (body.decisao === 'ganho') {
        var versao = null
        try {
          var proposta = $app.findFirstRecordByData('com_propostas', 'negocio_id', negocio.id)
          var versoes = $app.findRecordsByFilter(
            'com_proposta_versoes',
            "proposta_id='" + proposta.id + "'",
            '-numero',
            1,
            0,
          )
          if (versoes.length) versao = versoes[0]
        } catch (_) {}
        if (!versao || ['enviada', 'aceita'].indexOf(versao.getString('estado')) < 0)
          return e.badRequestError('PROPOSTA_EMITIDA_OBRIGATORIA')
        if (!body.evidencia_formal) return e.badRequestError('EVIDENCIA_GANHO_OBRIGATORIA')
        if (!(body.valor_efetivo_centavos > 0))
          return e.badRequestError('VALOR_EFETIVO_OBRIGATORIO')
      } else if (body.decisao === 'perdido') {
        if (motivos.indexOf(body.motivo) < 0) return e.badRequestError('MOTIVO_PERDA_INVALIDO')
        if (body.motivo === 'perdeu_contato') {
          var ts = $app.findRecordsByFilter(
            'com_atividades',
            "negocio_id='" + negocio.id + "' && tipo='tentativa_contato' && estado='realizada'",
            'realizada_em',
            100,
            0,
          )
          if (ts.length < 5) return e.badRequestError('TENTATIVAS_CONTATO_INSUFICIENTES')
          var inicio = new Date(ts[0].getString('realizada_em')),
            fim = new Date(ts[ts.length - 1].getString('realizada_em')),
            dias = 0
          while (inicio < fim) {
            inicio.setDate(inicio.getDate() + 1)
            if (inicio.getDay() !== 0 && inicio.getDay() !== 6) dias++
          }
          if (dias < 10) return e.badRequestError('JANELA_CONTATO_INSUFICIENTE')
        }
      } else return e.badRequestError('DECISAO_INVALIDA')
      var resposta
      $app.runInTransaction(function (tx) {
        negocio = tx.findRecordById('com_negocios', body.negocio_id)
        negocio.set('etapa', '')
        negocio.set('resultado', body.decisao)
        negocio.set('fechamento_data', new Date())
        if (body.decisao === 'ganho')
          negocio.set('fechamento_valor_efetivo_centavos', body.valor_efetivo_centavos)
        else negocio.set('fechamento_motivo', body.motivo)
        tx.save(negocio)
        var agenda = null
        if (body.decisao === 'perdido' && body.data_alvo_recuperacao) {
          agenda = new Record(tx.findCollectionByNameOrId('com_recuperacao_agendas'))
          agenda.set('negocio_perdido_id', negocio.id)
          agenda.set('data_alvo', body.data_alvo_recuperacao)
          agenda.set('antecedencia_dias', body.antecedencia_dias || 60)
          agenda.set('responsavel_id', negocio.getString('responsavel_id'))
          agenda.set('estado', 'ativa')
          agenda.set('autor_id', ator.id)
          agenda.set('creation_idempotency_key', body.command_idempotency_key + ':agenda')
          tx.save(agenda)
        }
        salvarAuditoria(tx, ator, perfil, negocio, body.command_idempotency_key, {
          decisao: body.decisao,
          motivo: body.motivo || null,
          evidencia_formal: body.evidencia_formal || null,
          valor_efetivo_centavos: body.valor_efetivo_centavos || null,
          justificativa: body.justificativa,
        })
        resposta = {
          negocio_id: negocio.id,
          resultado: body.decisao,
          agenda_id: agenda ? agenda.id : null,
        }
        var idem = new Record(tx.findCollectionByNameOrId('com_idempotencia'))
        idem.set('command_idempotency_key', body.command_idempotency_key)
        idem.set('comando', comando)
        idem.set('ator_id', ator.id)
        idem.set('payload_hash', hash)
        idem.set('estado', 'concluido')
        idem.set('codigo_retorno', '200')
        idem.set('resultado', resposta)
        idem.set('registros_afetados', agenda ? [negocio.id, agenda.id] : [negocio.id])
        idem.set('executor_id', 'pb-primary')
        idem.set('lease_ate', new Date(Date.now() + 300000))
        idem.set('tentativa', 1)
        idem.set('claim_version', 1)
        idem.set('inicio_em', new Date())
        idem.set('conclusao_em', new Date())
        tx.save(idem)
      })
      return e.json(200, Object.assign({ replay: false }, resposta))
    },
    $apis.requireAuth(),
  )

  routerAdd(
    'POST',
    '/backend/v1/fechamentos/reativar',
    (e) => {
      try {
        var perfilRestrito = $app.findRecordById('com_perfis', e.auth.getString('perfil_id'))
        if (perfilRestrito.getString('slug') === 'negociacao-propria')
          return e.json(403, { error: 'ACAO_NAO_AUTORIZADA' })
      } catch (_) {}
      function fechamentoPerfil(user) {
        try {
          return $app.findRecordById('com_perfis', user.getString('perfil_id')).getString('slug')
        } catch (_) {
          return ''
        }
      }
      function fechamentoPodeAcessar(user, perfil, negocio) {
        if (perfil === 'superadministrador' || perfil === 'leitura-executiva') return true
        if (negocio.getString('responsavel_id') === user.id) return true
        return (
          !!user.getString('equipe_id') &&
          negocio.getString('equipe_id') === user.getString('equipe_id')
        )
      }
      var ator = e.auth,
        body = new DynamicModel({
          negocio_perdido_id: '',
          agenda_id: '',
          updated_esperado: '',
          command_idempotency_key: '',
        })
      if (fechamentoPerfil(ator) === 'leitura-executiva')
        return e.json(403, { error: 'SOMENTE_LEITURA' })
      e.bindBody(body)
      if (!ator || !ator.getBool('ativo_comercial'))
        return e.forbiddenError('Usuario comercial necessario')
      if (!body.command_idempotency_key) return e.badRequestError('IDEMPOTENCY_KEY_OBRIGATORIA')
      var comando = 'fechamento_reativar',
        payload = {
          negocio_perdido_id: body.negocio_perdido_id,
          agenda_id: body.agenda_id,
          updated_esperado: body.updated_esperado,
        },
        hash = $security.sha256(JSON.stringify(payload))
      try {
        var known = $app.findRecordsByFilter(
          'com_idempotencia',
          "ator_id='" +
            ator.id +
            "' && comando='" +
            comando +
            "' && command_idempotency_key='" +
            body.command_idempotency_key +
            "'",
          '',
          1,
          0,
        )
        if (known.length) {
          if (known[0].getString('payload_hash') !== hash) return e.json(409, { error: 'CONFLICT' })
          if (known[0].getString('estado') !== 'concluido')
            return e.json(409, { error: 'CONCORRENTE' })
          return e.json(
            200,
            Object.assign({ replay: true }, JSON.parse(known[0].getString('resultado'))),
          )
        }
      } catch (_) {}
      var original = $app.findRecordById('com_negocios', body.negocio_perdido_id),
        perfil = fechamentoPerfil(ator)
      try {
        var preopReativacao = $app.findFirstRecordByData(
          'com_parametros',
          'chave',
          'ac_preoperation_read_only',
        )
        if (
          preopReativacao.getBool('ativo') &&
          preopReativacao.getString('valor') === 'true' &&
          original.getString('origem_canal') === 'activecampaign'
        )
          return e.json(423, { error: 'PREOPERACAO_SOMENTE_LEITURA' })
      } catch (_) {}
      if (!fechamentoPodeAcessar(ator, perfil, original)) return e.forbiddenError('FORA_DO_ESCOPO')
      if (original.getString('resultado') !== 'perdido')
        return e.badRequestError('NEGOCIO_TERMINAL_IMUTAVEL')
      if (body.updated_esperado !== original.getString('updated'))
        return e.json(409, { error: 'STALE_WRITE' })
      var resposta
      $app.runInTransaction(function (tx) {
        var agenda = tx.findRecordById('com_recuperacao_agendas', body.agenda_id)
        if (agenda.getString('estado') !== 'ativa') throw new BadRequestError('AGENDA_INATIVA')
        var novo = new Record(tx.findCollectionByNameOrId('com_negocios'))
        novo.set('titulo', original.getString('titulo') + ' — Reativação')
        novo.set('empresa_id', original.getString('empresa_id'))
        novo.set('responsavel_id', original.getString('responsavel_id'))
        novo.set('equipe_id', original.getString('equipe_id'))
        novo.set('etapa', 'prospects')
        novo.set('resultado', '')
        novo.set('inativo', false)
        novo.set('tipo_entrada', 'pendente')
        novo.set('qualificacao', 'pendente')
        novo.set('negocio_original_id', original.id)
        novo.set('prospectivo', true)
        tx.save(novo)
        agenda.set('estado', 'concluida_por_reativacao')
        agenda.set('negocio_novo_id', novo.id)
        tx.save(agenda)
        resposta = {
          negocio_original_id: original.id,
          negocio_novo_id: novo.id,
          agenda_id: agenda.id,
        }
        var idem = new Record(tx.findCollectionByNameOrId('com_idempotencia'))
        idem.set('command_idempotency_key', body.command_idempotency_key)
        idem.set('comando', comando)
        idem.set('ator_id', ator.id)
        idem.set('payload_hash', hash)
        idem.set('estado', 'concluido')
        idem.set('codigo_retorno', '200')
        idem.set('resultado', resposta)
        idem.set('registros_afetados', [original.id, novo.id, agenda.id])
        idem.set('executor_id', 'pb-primary')
        idem.set('lease_ate', new Date(Date.now() + 300000))
        idem.set('tentativa', 1)
        idem.set('claim_version', 1)
        idem.set('inicio_em', new Date())
        idem.set('conclusao_em', new Date())
        tx.save(idem)
        var a = new Record(tx.findCollectionByNameOrId('com_auditoria'))
        a.set('collection_name', 'com_negocios')
        a.set('record_id', novo.id)
        a.set('acao', 'create')
        a.set('usuario_id', ator.id)
        a.set('comando', 'fechamento_reativacao')
        a.set('command_idempotency_key', body.command_idempotency_key)
        a.set('evento_em', new Date())
        a.set('perfil', perfil)
        a.set('escopo', 'fechamento')
        a.set('origem', 'server-side')
        a.set('evidencia_estruturada', resposta)
        a.set('snapshot_hash', $security.sha256(JSON.stringify(resposta)))
        a.set('snapshot_hash_versao', '1')
        tx.save(a)
      })
      return e.json(200, Object.assign({ replay: false }, resposta))
    },
    $apis.requireAuth(),
  )
})()
