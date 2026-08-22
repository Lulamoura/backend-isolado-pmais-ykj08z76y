migrate(
  (app) => {
    var col = app.findCollectionByNameOrId('com_negocios')
    var statusField = col.fields.getByName('status')
    if (!statusField) {
      col.fields.add(
        new SelectField({
          name: 'status',
          required: false,
          values: ['ganho', 'perdido'],
          maxSelect: 1,
        }),
      )
      app.save(col)
    }
  },
  (app) => {},
)
