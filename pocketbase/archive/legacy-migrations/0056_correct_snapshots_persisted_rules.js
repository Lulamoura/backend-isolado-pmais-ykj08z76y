migrate(
  (app) => {
    var snapCol = app.findCollectionByNameOrId('com_snapshots_negocio')

    // === PRE-WRITE READ: Read the five current literal rules from persisted state ===
    console.log('=== PRE-WRITE READ: com_snapshots_negocio persisted rules (BEFORE) ===')
    console.log('listRule:   ' + snapCol.listRule)
    console.log('viewRule:   ' + snapCol.viewRule)
    console.log('createRule: ' + snapCol.createRule)
    console.log('updateRule: ' + snapCol.updateRule)
    console.log('deleteRule: ' + snapCol.deleteRule)

    // === TARGET RULES ===
    var targetList =
      "@request.auth.id != '' && (@request.auth.perfil_id.slug = 'superadministrador' || @request.auth.perfil_id.slug = 'integracao')"
    var targetView =
      "@request.auth.id != '' && (@request.auth.perfil_id.slug = 'superadministrador' || @request.auth.perfil_id.slug = 'integracao')"
    var targetCreate =
      "@request.auth.id != '' && @request.auth.perfil_id.slug = 'superadministrador'"

    console.log('=== TARGET RULES ===')
    console.log('listRule:   ' + targetList)
    console.log('viewRule:   ' + targetView)
    console.log('createRule: ' + targetCreate)
    console.log('updateRule: null')
    console.log('deleteRule: null')

    // === APPLY TARGET RULES TO COLLECTION OBJECT ===
    snapCol.listRule = targetList
    snapCol.viewRule = targetView
    snapCol.createRule = targetCreate
    snapCol.updateRule = null
    snapCol.deleteRule = null

    // === SAVE (validates expressions with the real PocketBase rule parser) ===
    try {
      app.save(snapCol)
      console.log('=== SAVE: SUCCESS — PocketBase parser accepted all expressions ===')
    } catch (err) {
      console.log('=== FAIL: PocketBase parser rejected an expression ===')
      console.log('Literal error: ' + String(err))
      throw err
    }

    // === POST-APPLY RE-READ: Read the five literal rules from persisted state (AFTER) ===
    var reSnap = app.findCollectionByNameOrId('com_snapshots_negocio')
    console.log('=== POST-APPLY RE-READ: com_snapshots_negocio persisted rules (AFTER) ===')
    console.log('listRule:   ' + reSnap.listRule)
    console.log('viewRule:   ' + reSnap.viewRule)
    console.log('createRule: ' + reSnap.createRule)
    console.log('updateRule: ' + reSnap.updateRule)
    console.log('deleteRule: ' + reSnap.deleteRule)

    // === BEFORE/AFTER COMPARISON ===
    console.log('=== BEFORE/AFTER COMPARISON ===')
    console.log('listRule:   BEFORE=[' + snapCol.listRule + ']  AFTER=[' + reSnap.listRule + ']')
    console.log('viewRule:   BEFORE=[' + snapCol.viewRule + ']  AFTER=[' + reSnap.viewRule + ']')
    console.log(
      'createRule: BEFORE=[' + snapCol.createRule + ']  AFTER=[' + reSnap.createRule + ']',
    )
    console.log(
      'updateRule: BEFORE=[' + snapCol.updateRule + ']  AFTER=[' + reSnap.updateRule + ']',
    )
    console.log(
      'deleteRule: BEFORE=[' + snapCol.deleteRule + ']  AFTER=[' + reSnap.deleteRule + ']',
    )

    // === VERIFICATION: Check exact match against target ===
    var fail = false

    if (reSnap.listRule !== targetList) {
      console.log('FAIL: listRule does NOT match target')
      console.log('  Expected: ' + targetList)
      console.log('  Got:      ' + reSnap.listRule)
      fail = true
    }
    if (reSnap.viewRule !== targetView) {
      console.log('FAIL: viewRule does NOT match target')
      console.log('  Expected: ' + targetView)
      console.log('  Got:      ' + reSnap.viewRule)
      fail = true
    }
    if (reSnap.createRule !== targetCreate) {
      console.log('FAIL: createRule does NOT match target')
      console.log('  Expected: ' + targetCreate)
      console.log('  Got:      ' + reSnap.createRule)
      fail = true
    }
    if (reSnap.updateRule !== null) {
      console.log('FAIL: updateRule does NOT match target (expected null)')
      console.log('  Got: ' + reSnap.updateRule)
      fail = true
    }
    if (reSnap.deleteRule !== null) {
      console.log('FAIL: deleteRule does NOT match target (expected null)')
      console.log('  Got: ' + reSnap.deleteRule)
      fail = true
    }

    if (fail) {
      console.log('=== VERIFICATION RESULT: FAIL — Rules do NOT match target. Stopping. ===')
    } else {
      console.log('=== VERIFICATION RESULT: PASS — All five rules match target exactly ===')
    }

    console.log(
      '=== Migration 0056 complete. Porta 2B NOT declared approved. Porta 2C NOT started. ===',
    )
  },
  (app) => {
    // === DOWN: Revert com_snapshots_negocio to the state before this migration (0055 state) ===
    var snapCol = app.findCollectionByNameOrId('com_snapshots_negocio')

    snapCol.listRule = "@request.auth.id != ''"
    snapCol.viewRule = "@request.auth.id != ''"
    snapCol.createRule = "@request.auth.id != ''"
    snapCol.updateRule = null
    snapCol.deleteRule = null

    app.save(snapCol)

    console.log('=== DOWN: com_snapshots_negocio rules reverted to pre-0056 state ===')
    console.log('listRule:   ' + snapCol.listRule)
    console.log('viewRule:   ' + snapCol.viewRule)
    console.log('createRule: ' + snapCol.createRule)
    console.log('updateRule: ' + snapCol.updateRule)
    console.log('deleteRule: ' + snapCol.deleteRule)
  },
)
