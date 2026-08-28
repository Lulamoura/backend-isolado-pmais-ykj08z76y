migrate(
  (app) => {
    try {
      app.findCollectionByNameOrId('com_notas_negocio')
      return
    } catch (_) {}
    const negocios = app.findCollectionByNameOrId('com_negocios')
    const collection = new Collection({
      type: 'base',
      name: 'com_notas_negocio',
      createRule: null,
      updateRule: null,
      deleteRule: null,
      listRule: null,
      viewRule: null,
    })
    collection.fields.add(
      new RelationField({
        name: 'negocio_id',
        collectionId: negocios.id,
        maxSelect: 1,
        cascadeDelete: false,
        required: true,
      }),
    )
    collection.fields.add(new TextField({ name: 'external_id', required: true, max: 80 }))
    collection.fields.add(new TextField({ name: 'texto', required: true, max: 20000 }))
    collection.fields.add(new TextField({ name: 'autor_external_id', required: false, max: 80 }))
    collection.fields.add(new TextField({ name: 'autor_nome', required: false, max: 200 }))
    collection.fields.add(new DateField({ name: 'criada_em', required: true }))
    collection.fields.add(new DateField({ name: 'alterada_em', required: false }))
    collection.fields.add(new TextField({ name: 'origem', required: true, max: 40 }))
    collection.indexes = [
      'CREATE UNIQUE INDEX idx_com_notas_negocio_external ON com_notas_negocio (external_id)',
      'CREATE INDEX idx_com_notas_negocio_negocio_data ON com_notas_negocio (negocio_id, criada_em)',
    ]
    app.save(collection)
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('com_notas_negocio'))
    } catch (_) {}
  },
)
