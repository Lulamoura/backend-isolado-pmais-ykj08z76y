migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('com_parametros')

    const params = [
      {
        chave: 'sistema.nome',
        valor: 'PMais CRM',
        descricao: 'Nome do sistema [TESTE]',
        versao: 1,
        ativo: true,
      },
      {
        chave: 'sistema.versao',
        valor: '1.0.0',
        descricao: 'Versao do sistema [TESTE]',
        versao: 1,
        ativo: true,
      },
      {
        chave: 'comercial.status_padrao',
        valor: 'aberto',
        descricao: 'Status padrao para novos negocios [TESTE]',
        versao: 1,
        ativo: true,
      },
      {
        chave: 'comercial.moeda',
        valor: 'BRL',
        descricao: 'Moeda padrao [TESTE]',
        versao: 1,
        ativo: true,
      },
      {
        chave: 'comercial.escopo_padrao',
        valor: 'proprios',
        descricao: 'Escopo padrao para novos usuarios [TESTE]',
        versao: 1,
        ativo: true,
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
        rec.set('versao', p.versao)
        rec.set('ativo', p.ativo)
        app.save(rec)
      }
    }
  },
  (app) => {
    try {
      app.findRecordsByFilter('com_parametros', '').forEach((r) => app.delete(r))
    } catch (_) {}
  },
)
