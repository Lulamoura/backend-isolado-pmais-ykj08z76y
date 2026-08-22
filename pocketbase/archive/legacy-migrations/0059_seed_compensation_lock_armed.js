migrate(
  (app) => {
    var LOCK_KEY = 'ac_diag_compensacao_dependencias_lock'

    try {
      app.findFirstRecordByData('com_parametros', 'chave', LOCK_KEY)
      return
    } catch (_) {}

    var col = app.findCollectionByNameOrId('com_parametros')
    var rec = new Record(col)
    rec.set('chave', LOCK_KEY)
    rec.set('valor', 'armed')
    rec.set('descricao', 'Compensation dependencias single-execution lock (armed — not consumed)')
    rec.set('versao', 1)
    rec.set('ativo', true)
    rec.set('tipo', 'lock')
    app.save(rec)

    console.log('0059: seeded compensation lock in armed state')
  },
  (app) => {
    console.log('0059 DOWN: no-op (lock seed not reverted)')
  },
)
