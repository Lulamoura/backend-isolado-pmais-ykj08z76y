migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('com_negocio_historico')

    if (!col.fields.getByName('etapa_anterior')) {
      col.fields.add(
        new SelectField({
          name: 'etapa_anterior',
          required: false,
          values: ['prospects', 'producao_proposta', 'negociacao'],
          maxSelect: 1,
        }),
      )
    }

    if (!col.fields.getByName('etapa_novo')) {
      col.fields.add(
        new SelectField({
          name: 'etapa_novo',
          required: false,
          values: ['prospects', 'producao_proposta', 'negociacao'],
          maxSelect: 1,
        }),
      )
    }

    app.save(col)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('com_negocio_historico')
      if (col.fields.getByName('etapa_anterior')) {
        col.fields.removeByName('etapa_anterior')
      }
      if (col.fields.getByName('etapa_novo')) {
        col.fields.removeByName('etapa_novo')
      }
      app.save(col)
    } catch (_) {}
  },
)
