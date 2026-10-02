migrate(
  function (app) {
    var decisoes = app.findCollectionByNameOrId('com_nexo_curadoria_decisoes')
    decisoes.createRule = null
    decisoes.updateRule = null
    decisoes.deleteRule = null
    app.save(decisoes)
  },
  function (_) {},
)
