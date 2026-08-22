migrate(
  (app) => {
    var col = app.findCollectionByNameOrId('com_usuarios_equipes')

    if (!col.fields.getByName('ativo')) {
      col.fields.add(new BoolField({ name: 'ativo' }))
      app.save(col)
    }

    app
      .db()
      .newQuery('UPDATE com_usuarios_equipes SET ativo = 1 WHERE ativo = 0 OR ativo IS NULL')
      .execute()

    col.addIndex('idx_com_usuarios_equipes_ativo', false, 'ativo', '')
    col.addIndex('idx_com_usuarios_equipes_usuario_ativo', false, 'usuario_id, ativo', '')
    app.save(col)
  },
  (app) => {
    try {
      var col = app.findCollectionByNameOrId('com_usuarios_equipes')
      col.removeIndex('idx_com_usuarios_equipes_ativo')
      col.removeIndex('idx_com_usuarios_equipes_usuario_ativo')
      if (col.fields.getByName('ativo')) {
        col.fields.removeByName('ativo')
      }
      app.save(col)
    } catch (_) {}
  },
)
