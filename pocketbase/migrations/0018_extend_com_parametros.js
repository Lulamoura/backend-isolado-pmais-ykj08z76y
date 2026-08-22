migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('com_parametros')

    if (!col.fields.getByName('tipo')) {
      col.fields.add(new TextField({ name: 'tipo', max: 50 }))
    }
    if (!col.fields.getByName('unidade')) {
      col.fields.add(new TextField({ name: 'unidade', max: 50 }))
    }
    if (!col.fields.getByName('regra_validacao')) {
      col.fields.add(new TextField({ name: 'regra_validacao', max: 500 }))
    }
    if (!col.fields.getByName('inicio_vigencia')) {
      col.fields.add(new DateField({ name: 'inicio_vigencia' }))
    }
    if (!col.fields.getByName('fim_vigencia')) {
      col.fields.add(new DateField({ name: 'fim_vigencia' }))
    }
    if (!col.fields.getByName('autor_id')) {
      col.fields.add(
        new RelationField({ name: 'autor_id', collectionId: '_pb_users_auth_', maxSelect: 1 }),
      )
    }
    if (!col.fields.getByName('data_hora')) {
      col.fields.add(new DateField({ name: 'data_hora' }))
    }
    if (!col.fields.getByName('justificativa')) {
      col.fields.add(new TextField({ name: 'justificativa', max: 1000 }))
    }

    app.save(col)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('com_parametros')
      const fieldsToRemove = [
        'tipo',
        'unidade',
        'regra_validacao',
        'inicio_vigencia',
        'fim_vigencia',
        'autor_id',
        'data_hora',
        'justificativa',
      ]
      fieldsToRemove.forEach((fn) => {
        if (col.fields.getByName(fn)) col.fields.removeByName(fn)
      })
      app.save(col)
    } catch (_) {}
  },
)
