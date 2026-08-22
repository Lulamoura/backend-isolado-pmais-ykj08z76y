migrate(
  (app) => {
    const contatosCol = app.findCollectionByNameOrId('com_contatos')
    const col = app.findCollectionByNameOrId('com_negocios')
    if (!col.fields.getByName('contato_principal_id')) {
      col.fields.add(
        new RelationField({
          name: 'contato_principal_id',
          collectionId: contatosCol.id,
          maxSelect: 1,
        }),
      )
    }
    app.save(col)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('com_negocios')
      if (col.fields.getByName('contato_principal_id')) {
        col.fields.removeByName('contato_principal_id')
        app.save(col)
      }
    } catch (_) {}
  },
)
