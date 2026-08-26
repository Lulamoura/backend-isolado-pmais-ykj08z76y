migrate(
  (app) => {
    const negocios = app.findCollectionByNameOrId('com_negocios')
    if (!negocios.fields.getByName('qualificacao_responsavel_id'))
      negocios.fields.add(
        new RelationField({
          name: 'qualificacao_responsavel_id',
          collectionId: '_pb_users_auth_',
          maxSelect: 1,
          cascadeDelete: false,
          required: false,
        }),
      )
    if (!negocios.fields.getByName('qualificacao_assumida_em'))
      negocios.fields.add(new DateField({ name: 'qualificacao_assumida_em', required: false }))
    if (!negocios.fields.getByName('qualificacao_decidida_em'))
      negocios.fields.add(new DateField({ name: 'qualificacao_decidida_em', required: false }))
    negocios.indexes = Array.from(
      new Set([
        ...(negocios.indexes || []),
        'CREATE INDEX idx_com_negocios_qualificacao_responsavel ON com_negocios (qualificacao_responsavel_id, qualificacao)',
      ]),
    )
    app.save(negocios)
  },
  (app) => {
    const negocios = app.findCollectionByNameOrId('com_negocios')
    negocios.indexes = (negocios.indexes || []).filter(
      (index) => !index.includes('idx_com_negocios_qualificacao_responsavel'),
    )
    for (const name of [
      'qualificacao_responsavel_id',
      'qualificacao_assumida_em',
      'qualificacao_decidida_em',
    ])
      if (negocios.fields.getByName(name)) negocios.fields.removeByName(name)
    app.save(negocios)
  },
)
