migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('com_negocio_historico')

    if (!col.fields.getByName('reagendamento_external_id')) {
      col.fields.add(
        new TextField({ name: 'reagendamento_external_id', required: false, max: 220 }),
      )
    }
    if (!col.fields.getByName('data_acao_anterior')) {
      col.fields.add(new DateField({ name: 'data_acao_anterior', required: false }))
    }
    if (!col.fields.getByName('data_acao_nova')) {
      col.fields.add(new DateField({ name: 'data_acao_nova', required: false }))
    }
    if (!col.fields.getByName('reagendada_em')) {
      col.fields.add(new DateField({ name: 'reagendada_em', required: false }))
    }

    col.addIndex(
      'idx_com_negocio_historico_reagendamento_external',
      true,
      'reagendamento_external_id',
      '',
    )
    col.addIndex(
      'idx_com_negocio_historico_reagendamento_data',
      false,
      'negocio_id, reagendada_em',
      '',
    )

    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('com_negocio_historico')

    col.removeIndex('idx_com_negocio_historico_reagendamento_external')
    col.removeIndex('idx_com_negocio_historico_reagendamento_data')

    const fieldNames = [
      'reagendamento_external_id',
      'data_acao_anterior',
      'data_acao_nova',
      'reagendada_em',
    ]
    fieldNames.forEach((name) => {
      if (col.fields.getByName(name)) {
        col.fields.removeByName(name)
      }
    })

    app.save(col)
  },
)
