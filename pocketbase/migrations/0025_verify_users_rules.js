migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('users')

    col.listRule = "@request.auth.id != ''"
    col.viewRule = "@request.auth.id != ''"
    col.createRule = "@request.auth.id != ''"
    col.updateRule = "@request.auth.id != ''"
    col.deleteRule = 'id = @request.auth.id'

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
