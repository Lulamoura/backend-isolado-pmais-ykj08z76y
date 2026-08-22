migrate(
  (app) => {
    var col = app.findCollectionByNameOrId('com_negocios')
    if (!col.fields.getByName('modalidade'))
      col.fields.add(
        new SelectField({ name: 'modalidade', values: ['pontual', 'recorrente'], maxSelect: 1 }),
      )
    if (!col.fields.getByName('necessidade'))
      col.fields.add(new TextField({ name: 'necessidade', max: 2000 }))
    if (!col.fields.getByName('localizacao'))
      col.fields.add(new TextField({ name: 'localizacao', max: 300 }))
    if (!col.fields.getByName('dimensao_estimada'))
      col.fields.add(new TextField({ name: 'dimensao_estimada', max: 300 }))
    if (!col.fields.getByName('prazo_cliente'))
      col.fields.add(new DateField({ name: 'prazo_cliente' }))
    app.save(col)
  },
  (app) => {
    var col = app.findCollectionByNameOrId('com_negocios')
    ;['modalidade', 'necessidade', 'localizacao', 'dimensao_estimada', 'prazo_cliente'].forEach(
      function (name) {
        if (col.fields.getByName(name)) col.fields.removeByName(name)
      },
    )
    app.save(col)
  },
)
