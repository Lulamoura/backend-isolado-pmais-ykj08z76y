migrate(
  function (app) {
    try {
      app.findCollectionByNameOrId('com_configuracoes_arquivos')
      return
    } catch (_) {}

    var collection = new Collection({
      id: 'cfgbannercoll01',
      name: 'com_configuracoes_arquivos',
      type: 'base',
      listRule: null,
      viewRule: null,
      createRule: null,
      updateRule: null,
      deleteRule: null,
    })
    collection.fields.add(new TextField({ name: 'chave', max: 120, required: true }))
    collection.fields.add(
      new FileField({
        name: 'arquivo',
        maxSelect: 1,
        maxSize: 5242880,
        mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
        protected: false,
        required: true,
      }),
    )
    collection.fields.add(new TextField({ name: 'arquivo_sha256', max: 64, required: true }))
    collection.fields.add(new NumberField({ name: 'arquivo_bytes', min: 1, required: true }))
    collection.fields.add(new TextField({ name: 'arquivo_mime', max: 80, required: true }))
    collection.fields.add(
      new RelationField({
        name: 'atualizado_por',
        collectionId: '_pb_users_auth_',
        maxSelect: 1,
        cascadeDelete: false,
        required: true,
      }),
    )
    collection.fields.add(new TextField({ name: 'justificativa', max: 1000, required: true }))
    collection.fields.add(new AutodateField({ name: 'created', onCreate: true, onUpdate: false }))
    collection.fields.add(new AutodateField({ name: 'updated', onCreate: true, onUpdate: true }))
    collection.indexes = [
      'CREATE UNIQUE INDEX idx_com_configuracoes_arquivos_chave ON com_configuracoes_arquivos (chave)',
    ]
    app.save(collection)
  },
  function (app) {
    try {
      app.delete(app.findCollectionByNameOrId('com_configuracoes_arquivos'))
    } catch (_) {}
  },
)
