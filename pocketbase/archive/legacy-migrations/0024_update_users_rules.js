migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('users')
    col.updateRule = "@request.auth.id != ''"
    app.save(col)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('users')
      col.updateRule = 'id = @request.auth.id'
      app.save(col)
    } catch (_) {}
  },
)
