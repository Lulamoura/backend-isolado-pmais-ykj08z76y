migrate(
  (app) => {
    const perfisCuradoria =
      "@request.auth.id != '' && (@request.auth.perfil_id.slug = 'superadministrador' || @request.auth.perfil_id.slug = 'gestor-comercial' || @request.auth.perfil_id.slug = 'leitura-executiva')"
    const perfisDecisaoSuperior =
      "@request.auth.id != '' && (@request.auth.perfil_id.slug = 'superadministrador' || @request.auth.perfil_id.slug = 'leitura-executiva')"

    const collection = new Collection({
      type: 'base',
      name: 'com_nexo_curadoria_decisoes',
      listRule: perfisDecisaoSuperior,
      viewRule: perfisDecisaoSuperior,
      createRule: perfisCuradoria,
      updateRule: perfisDecisaoSuperior,
      deleteRule: null,
    })

    collection.fields.add(new TextField({ name: 'evento_id', required: true, max: 80 }))
    collection.fields.add(new TextField({ name: 'entrevista_id', required: false, max: 80 }))
    collection.fields.add(new TextField({ name: 'external_id', required: false, max: 80 }))
    collection.fields.add(new TextField({ name: 'empresa_nome', required: false, max: 240 }))
    collection.fields.add(new TextField({ name: 'contato_nome', required: false, max: 240 }))
    collection.fields.add(new TextField({ name: 'negocio_titulo', required: false, max: 240 }))
    collection.fields.add(new TextField({ name: 'status', required: true, max: 80 }))
    collection.fields.add(new TextField({ name: 'nivel_decisao', required: true, max: 80 }))
    collection.fields.add(new BoolField({ name: 'escalar_direcao', required: false }))
    collection.fields.add(new TextField({ name: 'regra_proposta', required: true, max: 4000 }))
    collection.fields.add(new TextField({ name: 'excecao_condicao', required: false, max: 4000 }))
    collection.fields.add(
      new TextField({ name: 'responsavel_validacao', required: false, max: 1000 }),
    )
    collection.fields.add(new TextField({ name: 'impacto_json', required: true, max: 4000 }))
    collection.fields.add(
      new TextField({ name: 'origem_respostas_json', required: false, max: 4000 }),
    )
    collection.fields.add(new TextField({ name: 'usuario_id', required: false, max: 80 }))
    collection.fields.add(new TextField({ name: 'usuario_nome', required: false, max: 160 }))
    collection.fields.add(new DateField({ name: 'created_at', required: true }))
    collection.fields.add(new DateField({ name: 'updated_at', required: false }))

    collection.indexes = [
      'CREATE INDEX idx_com_nexo_curadoria_decisoes_status ON com_nexo_curadoria_decisoes (status, created_at)',
      'CREATE INDEX idx_com_nexo_curadoria_decisoes_nivel ON com_nexo_curadoria_decisoes (nivel_decisao, created_at)',
      'CREATE INDEX idx_com_nexo_curadoria_decisoes_external ON com_nexo_curadoria_decisoes (external_id, created_at)',
      "CREATE UNIQUE INDEX idx_com_nexo_curadoria_decisoes_unico_evento_aberto ON com_nexo_curadoria_decisoes (evento_id) WHERE status != 'rejeitada'",
      "CREATE UNIQUE INDEX idx_com_nexo_curadoria_decisoes_unico_external_aberto ON com_nexo_curadoria_decisoes (external_id) WHERE status != 'rejeitada' AND external_id != ''",
    ]

    app.save(collection)
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('com_nexo_curadoria_decisoes')
    app.delete(collection)
  },
)
