migrate(
  (app) => {
    const negocios = app.findCollectionByNameOrId('com_negocios')
    if (!negocios.fields.getByName('etapa_entrou_em'))
      negocios.fields.add(new DateField({ name: 'etapa_entrou_em', required: false }))
    app.save(negocios)
  },
  (app) => {
    const negocios = app.findCollectionByNameOrId('com_negocios')
    if (negocios.fields.getByName('etapa_entrou_em'))
      negocios.fields.removeByName('etapa_entrou_em')
    app.save(negocios)
  },
)
