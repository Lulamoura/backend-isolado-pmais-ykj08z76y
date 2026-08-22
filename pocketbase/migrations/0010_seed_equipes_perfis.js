migrate(
  (app) => {
    const equipesCol = app.findCollectionByNameOrId('com_equipes')
    const perfisCol = app.findCollectionByNameOrId('com_perfis')

    const equipes = [
      {
        nome: 'Equipe Alpha [TESTE]',
        slug: 'equipe-alpha-teste',
        descricao: 'Equipe de testes Alpha',
        ativo: true,
      },
      {
        nome: 'Equipe Beta [TESTE]',
        slug: 'equipe-beta-teste',
        descricao: 'Equipe de testes Beta',
        ativo: true,
      },
    ]

    for (const e of equipes) {
      try {
        app.findFirstRecordByData('com_equipes', 'slug', e.slug)
      } catch (_) {
        const rec = new Record(equipesCol)
        rec.set('nome', e.nome)
        rec.set('slug', e.slug)
        rec.set('descricao', e.descricao)
        rec.set('ativo', e.ativo)
        app.save(rec)
      }
    }

    const perfis = [
      { nome: 'Administrador', slug: 'admin', descricao: 'Acesso total ao sistema', ativo: true },
      { nome: 'Gerente', slug: 'gerente', descricao: 'Gestao de equipe', ativo: true },
      {
        nome: 'Consultor',
        slug: 'consultor',
        descricao: 'Acesso a proprios registros',
        ativo: true,
      },
    ]

    for (const p of perfis) {
      try {
        app.findFirstRecordByData('com_perfis', 'slug', p.slug)
      } catch (_) {
        const rec = new Record(perfisCol)
        rec.set('nome', p.nome)
        rec.set('slug', p.slug)
        rec.set('descricao', p.descricao)
        rec.set('ativo', p.ativo)
        app.save(rec)
      }
    }
  },
  (app) => {
    try {
      app.findRecordsByFilter('com_perfis', '').forEach((r) => app.delete(r))
    } catch (_) {}
    try {
      app.findRecordsByFilter('com_equipes', '').forEach((r) => app.delete(r))
    } catch (_) {}
  },
)
