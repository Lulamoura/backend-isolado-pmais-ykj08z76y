migrate(
  function (app) {
    var nomes = [
      'com_whatsapp_eventos',
      'com_whatsapp_mensagens',
      'com_whatsapp_midias',
      'com_ledger_comercial',
      'com_whatsapp_vinculos',
    ]
    for (var i = 0; i < nomes.length; i++) {
      var collection = app.findCollectionByNameOrId(nomes[i])
      collection.listRule = null
      collection.viewRule = null
      app.save(collection)
    }
  },
  function (app) {
    // A reversão mantém as coleções fechadas para não reabrir acesso a conversas comerciais.
    var nomes = [
      'com_whatsapp_eventos',
      'com_whatsapp_mensagens',
      'com_whatsapp_midias',
      'com_ledger_comercial',
      'com_whatsapp_vinculos',
    ]
    for (var i = 0; i < nomes.length; i++) {
      var collection = app.findCollectionByNameOrId(nomes[i])
      collection.listRule = null
      collection.viewRule = null
      app.save(collection)
    }
  },
)
