// T6.1 — inventário global e simulação segura da quarentena pré-operacional.
// Este hook é deliberadamente somente leitura. A execução da quarentena será
// implementada em outro gate, depois da aprovação explícita do dry-run.

routerAdd(
  'POST',
  '/backend/v1/admin/quarentena-testes/dry-run',
  (e) => {
    var ator = e.auth
    if (!ator) return e.unauthorizedError('Autenticacao necessaria')
    if (!ator.getBool('ativo_comercial')) return e.forbiddenError('Usuario comercial inativo')

    var perfil = ''
    try {
      perfil = $app.findRecordById('com_perfis', ator.getString('perfil_id')).getString('slug')
    } catch (_) {}
    if (perfil !== 'superadministrador') return e.forbiddenError('SuperAdmin necessario')

    var body
    try {
      body = JSON.parse(toString(e.request.body))
    } catch (_) {
      return e.json(400, { error: 'JSON_INVALIDO' })
    }
    var chaves = Object.keys(body || {}).sort()
    if (chaves.join(',') !== 'modo,negocio_ids') return e.json(400, { error: 'CAMPOS_INVALIDOS' })
    if (body.modo !== 'dry_run' || !Array.isArray(body.negocio_ids))
      return e.json(400, { error: 'MODO_DRY_RUN_OBRIGATORIO' })

    var aprovados = [
      '1gb8b13wky2gvdl',
      '2ism1gf4puqkmom',
      '6lz4lyhbjdh03hx',
      'axg5oe5y1ifox4g',
      'b2oro8l2t78egwk',
      'io77eusp8lu37qu',
      'joyy0k54kbd3bby',
      'kw6c565jj6j6soh',
      'l7pox1ouowsddzj',
      'lbhg291qzuy3xc9',
      'lqdxphf44mrshvj',
      'ni9s9kyijme7azj',
      'xjfnb5w6oh8l0d9',
    ]
    var recebidos = body.negocio_ids.slice().sort()
    if (recebidos.length !== aprovados.length || recebidos.join(',') !== aprovados.join(','))
      return e.json(400, {
        error: 'LISTA_FORA_DO_GATE',
        esperado: aprovados.length,
        recebido: recebidos.length,
      })

    function filtroIds(campo, ids) {
      var partes = []
      for (var i = 0; i < ids.length; i++) partes.push(campo + "='" + ids[i] + "'")
      return '(' + partes.join(' || ') + ')'
    }
    function contar(colecao, filtro) {
      try {
        return $app.findRecordsByFilter(colecao, filtro || '', '', 5000, 0).length
      } catch (_) {
        return null
      }
    }

    var itens = [],
      ativos = 0,
      abertos = 0,
      ganhos = 0,
      perdidos = 0,
      versoes = []
    for (var i = 0; i < aprovados.length; i++) {
      var n
      try {
        n = $app.findRecordById('com_negocios', aprovados[i])
      } catch (_) {
        return e.json(409, { error: 'NEGOCIO_DO_GATE_AUSENTE', negocio_id: aprovados[i] })
      }
      var titulo = n.getString('titulo'),
        resultado = n.getString('resultado'),
        inativo = n.getBool('inativo')
      if (titulo.indexOf('[TESTE]') === -1)
        return e.json(409, { error: 'MARCADOR_TESTE_AUSENTE', negocio_id: n.id })
      if (!inativo) ativos++
      if (!resultado) abertos++
      else if (resultado === 'ganho') ganhos++
      else if (resultado === 'perdido') perdidos++
      versoes.push(n.id + ':' + n.getString('updated'))
      itens.push({
        negocio_id: n.id,
        titulo: titulo,
        resultado: resultado || 'aberto',
        inativo_atual: inativo,
        updated_esperado: n.getString('updated'),
        acao_proposta: inativo ? 'manter_inativo' : 'inativar',
      })
    }

    var propostaIds = [],
      propostas = []
    try {
      propostas = $app.findRecordsByFilter(
        'com_propostas',
        filtroIds('negocio_id', aprovados),
        '',
        5000,
        0,
      )
      for (var p = 0; p < propostas.length; p++) propostaIds.push(propostas[p].id)
    } catch (_) {}

    var totalGlobal = contar('com_negocios', ''),
      ativosGlobal = contar('com_negocios', 'inativo=false')
    return e.json(200, {
      modo: 'dry_run',
      somente_leitura: true,
      mutacoes_executadas: 0,
      auditorias_criadas: 0,
      gate: {
        quantidade_aprovada: aprovados.length,
        fingerprint_versoes: $security.sha256(versoes.sort().join('|')),
      },
      antes: {
        negocios_globais: totalGlobal,
        negocios_ativos_globais: ativosGlobal,
        alvos: aprovados.length,
        alvos_ativos: ativos,
        abertos: abertos,
        ganhos: ganhos,
        perdidos: perdidos,
      },
      depois_previsto: {
        negocios_globais: totalGlobal,
        negocios_ativos_globais: ativosGlobal === null ? null : Math.max(0, ativosGlobal - ativos),
        alvos_inativos: aprovados.length,
      },
      preservar: {
        atividades: contar('com_atividades', filtroIds('negocio_id', aprovados)),
        propostas: propostas.length,
        proposta_versoes: propostaIds.length
          ? contar('com_proposta_versoes', filtroIds('proposta_id', propostaIds))
          : 0,
        qualificacao_historico: contar(
          'com_qualificacao_historico',
          filtroIds('negocio_id', aprovados),
        ),
        recuperacao_agendas: contar(
          'com_recuperacao_agendas',
          filtroIds('negocio_perdido_id', aprovados),
        ),
        auditoria: 'preservar_integralmente',
        idempotencia: 'preservar_integralmente',
      },
      itens: itens,
      proximo_gate: 'AUTORIZACAO_EXPLICITA_PARA_IMPLEMENTAR_EXECUCAO',
    })
  },
  $apis.requireAuth(),
)
