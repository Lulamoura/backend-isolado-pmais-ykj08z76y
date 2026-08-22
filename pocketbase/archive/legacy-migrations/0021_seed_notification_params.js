migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('com_parametros')
    const adminUser = app.findAuthRecordByEmail(
      '_pb_users_auth_',
      'luiz.moura@pmaisservicos.com.br',
    )

    const params = [
      {
        chave: 'notificacao.prazo_alerta_dias',
        valor: '3',
        descricao: 'Prazo em dias para alertar antes do vencimento [TESTE]',
        tipo: 'numero',
        unidade: 'dias',
        regra_validacao: 'valor inteiro maior que 0',
        versao: 1,
        ativo: true,
        justificativa: 'Parametro inicial de notificacao [TESTE]',
        autor_id: adminUser.id,
      },
      {
        chave: 'notificacao.prazo_escalonamento_dias',
        valor: '7',
        descricao: 'Prazo em dias para escalonar apos vencimento [TESTE]',
        tipo: 'numero',
        unidade: 'dias',
        regra_validacao: 'valor inteiro maior que 0',
        versao: 1,
        ativo: true,
        justificativa: 'Parametro inicial de escalonamento [TESTE]',
        autor_id: adminUser.id,
      },
      {
        chave: 'notificacao.regra_escalonamento',
        valor: 'auto',
        descricao: 'Regra de escalonamento de notificacoes [TESTE]',
        tipo: 'texto',
        unidade: '',
        regra_validacao: 'valor: auto | manual',
        versao: 1,
        ativo: true,
        justificativa: 'Parametro inicial de regra [TESTE]',
        autor_id: adminUser.id,
      },
    ]

    for (const p of params) {
      try {
        app.findFirstRecordByData('com_parametros', 'chave', p.chave)
      } catch (_) {
        const rec = new Record(col)
        rec.set('chave', p.chave)
        rec.set('valor', p.valor)
        rec.set('descricao', p.descricao)
        rec.set('tipo', p.tipo)
        rec.set('unidade', p.unidade)
        rec.set('regra_validacao', p.regra_validacao)
        rec.set('versao', p.versao)
        rec.set('ativo', p.ativo)
        rec.set('justificativa', p.justificativa)
        rec.set('autor_id', p.autor_id)
        app.save(rec)
      }
    }
  },
  (app) => {
    try {
      const records = app.findRecordsByFilter('com_parametros', "chave ~ 'notificacao.'")
      records.forEach((r) => app.delete(r))
    } catch (_) {}
  },
)
