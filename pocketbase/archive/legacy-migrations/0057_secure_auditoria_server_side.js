migrate(
  (app) => {
    var col = app.findCollectionByNameOrId('com_auditoria')

    console.log('=== 0057: com_auditoria persisted rules (BEFORE) ===')
    console.log('listRule:   ' + col.listRule)
    console.log('viewRule:   ' + col.viewRule)
    console.log('createRule: ' + col.createRule)
    console.log('updateRule: ' + col.updateRule)
    console.log('deleteRule: ' + col.deleteRule)

    col.createRule = null
    col.updateRule = null
    col.deleteRule = null

    app.save(col)

    var reRead = app.findCollectionByNameOrId('com_auditoria')
    console.log('=== 0057: com_auditoria persisted rules (AFTER) ===')
    console.log('listRule:   ' + reRead.listRule)
    console.log('viewRule:   ' + reRead.viewRule)
    console.log('createRule: ' + reRead.createRule)
    console.log('updateRule: ' + reRead.updateRule)
    console.log('deleteRule: ' + reRead.deleteRule)

    var pass = true
    if (reRead.listRule !== "@request.auth.id != ''") {
      console.log('FAIL: listRule changed')
      pass = false
    }
    if (reRead.viewRule !== "@request.auth.id != ''") {
      console.log('FAIL: viewRule changed')
      pass = false
    }
    if (reRead.createRule !== null) {
      console.log('FAIL: createRule is not null')
      pass = false
    }
    if (reRead.updateRule !== null) {
      console.log('FAIL: updateRule is not null')
      pass = false
    }
    if (reRead.deleteRule !== null) {
      console.log('FAIL: deleteRule is not null')
      pass = false
    }
    if (pass) {
      console.log('=== 0057: VERIFICATION PASS ===')
    } else {
      console.log('=== 0057: VERIFICATION FAIL ===')
    }
  },
  (app) => {
    var col = app.findCollectionByNameOrId('com_auditoria')
    col.createRule = "@request.auth.id != ''"
    col.updateRule = null
    col.deleteRule = null
    app.save(col)
    console.log("=== 0057 DOWN: createRule restored to @request.auth.id != '' ===")
  },
)
