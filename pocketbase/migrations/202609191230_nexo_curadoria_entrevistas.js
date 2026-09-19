migrate(
  (app) => {
    const perfisCuradoria =
      "@request.auth.id != '' && (@request.auth.perfil_id.slug = 'superadministrador' || @request.auth.perfil_id.slug = 'gestor' || @request.auth.perfil_id.slug = 'gestor-comercial' || @request.auth.perfil_id.slug = 'leitura-executiva')"

    const collection = new Collection({
      type: 'base',
      name: 'com_nexo_curadoria_entrevistas',
      listRule: perfisCuradoria,
      viewRule: perfisCuradoria,
      createRule: perfisCuradoria,
      updateRule: null,
      deleteRule: null,
    })

    collection.fields.add(new TextField({ name: 'evento_id', required: true, max: 80 }))
    collection.fields.add(new TextField({ name: 'external_id', required: false, max: 80 }))
    collection.fields.add(new TextField({ name: 'empresa_nome', required: false, max: 240 }))
    collection.fields.add(new TextField({ name: 'contato_nome', required: false, max: 240 }))
    collection.fields.add(new TextField({ name: 'negocio_titulo', required: false, max: 240 }))
    collection.fields.add(new TextField({ name: 'status', required: true, max: 80 }))
    collection.fields.add(new TextField({ name: 'perguntas_json', required: true, max: 4000 }))
    collection.fields.add(new TextField({ name: 'respostas_json', required: true, max: 4000 }))
    collection.fields.add(new TextField({ name: 'resumo_contexto', required: false, max: 4000 }))
    collection.fields.add(new TextField({ name: 'usuario_id', required: false, max: 80 }))
    collection.fields.add(new TextField({ name: 'usuario_nome', required: false, max: 160 }))
    collection.fields.add(new DateField({ name: 'created_at', required: true }))

    collection.indexes = [
      'CREATE INDEX idx_com_nexo_curadoria_entrevistas_evento ON com_nexo_curadoria_entrevistas (evento_id, created_at)',
      'CREATE INDEX idx_com_nexo_curadoria_entrevistas_status ON com_nexo_curadoria_entrevistas (status, created_at)',
      'CREATE INDEX idx_com_nexo_curadoria_entrevistas_external ON com_nexo_curadoria_entrevistas (external_id, created_at)',
    ]

    app.save(collection)
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('com_nexo_curadoria_entrevistas')
    app.delete(collection)
  },
)
