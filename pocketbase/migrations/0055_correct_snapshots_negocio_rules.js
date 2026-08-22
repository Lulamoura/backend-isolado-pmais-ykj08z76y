migrate(
  (app) => {
    var snapCol = app.findCollectionByNameOrId('com_snapshots_negocio')

    snapCol.listRule = "@request.auth.id != ''"
    snapCol.viewRule = "@request.auth.id != ''"
    snapCol.createRule = "@request.auth.id != ''"
    snapCol.updateRule = null
    snapCol.deleteRule = null

    app.save(snapCol)

    console.log('=== com_snapshots_negocio rules applied ===')
    console.log('listRule:   @request.auth.id != ' + "''")
    console.log('viewRule:   @request.auth.id != ' + "''")
    console.log('createRule: @request.auth.id != ' + "''")
    console.log('updateRule: null')
    console.log('deleteRule: null')
  },
  (app) => {
    var snapCol = app.findCollectionByNameOrId('com_snapshots_negocio')

    snapCol.listRule = "@request.auth.id != ''"
    snapCol.viewRule = "@request.auth.id != ''"
    snapCol.createRule = "@request.auth.id != ''"
    snapCol.updateRule = null
    snapCol.deleteRule = null

    app.save(snapCol)
  },
)
