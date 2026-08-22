migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('users')
    const perfisCol = app.findCollectionByNameOrId('com_perfis')
    const equipesCol = app.findCollectionByNameOrId('com_equipes')

    if (!col.fields.getByName('perfil_id')) {
      col.fields.add(
        new RelationField({
          name: 'perfil_id',
          collectionId: perfisCol.id,
          cascadeDelete: false,
          maxSelect: 1,
        }),
      )
    }

    if (!col.fields.getByName('equipe_id')) {
      col.fields.add(
        new RelationField({
          name: 'equipe_id',
          collectionId: equipesCol.id,
          cascadeDelete: false,
          maxSelect: 1,
        }),
      )
    }

    if (!col.fields.getByName('ativo_comercial')) {
      col.fields.add(
        new BoolField({
          name: 'ativo_comercial',
        }),
      )
    }

    app.save(col)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('users')
      if (col.fields.getByName('perfil_id')) col.fields.removeByName('perfil_id')
      if (col.fields.getByName('equipe_id')) col.fields.removeByName('equipe_id')
      if (col.fields.getByName('ativo_comercial')) col.fields.removeByName('ativo_comercial')
      app.save(col)
    } catch (_) {}
  },
)
