migrate(
  function (app) {
    var propostas = app.findCollectionByNameOrId('com_propostas')
    if (!propostas.fields.getByName('mensagem_email_rascunho')) {
      propostas.fields.add(
        new TextField({ name: 'mensagem_email_rascunho', max: 10000, required: false }),
      )
      app.save(propostas)
    }
  },
  function (app) {
    var propostas = app.findCollectionByNameOrId('com_propostas')
    if (propostas.fields.getByName('mensagem_email_rascunho')) {
      propostas.fields.removeByName('mensagem_email_rascunho')
      app.save(propostas)
    }
  },
)
