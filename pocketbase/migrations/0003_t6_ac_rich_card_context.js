migrate(
  (app) => {
    const negocios = app.findCollectionByNameOrId('com_negocios')
    const fields = [
      new DateField({ name: 'crm_created_at', required: false }),
      new DateField({ name: 'crm_updated_at', required: false }),
      new DateField({ name: 'proxima_acao_em', required: false }),
      new TextField({ name: 'fase_crm', max: 160, required: false }),
      new TextField({ name: 'fonte_prospeccao', max: 200, required: false }),
    ]
    for (const field of fields) {
      if (!negocios.fields.getByName(field.name)) negocios.fields.add(field)
    }
    app.save(negocios)
  },
  (app) => {
    const negocios = app.findCollectionByNameOrId('com_negocios')
    for (const name of [
      'crm_created_at',
      'crm_updated_at',
      'proxima_acao_em',
      'fase_crm',
      'fonte_prospeccao',
    ]) {
      if (negocios.fields.getByName(name)) negocios.fields.removeByName(name)
    }
    app.save(negocios)
  },
)
