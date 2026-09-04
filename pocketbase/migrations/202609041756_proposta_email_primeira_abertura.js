migrate(
  function (app) {
    var users = app.findCollectionByNameOrId('users')
    var envios = app.findCollectionByNameOrId('com_proposta_envios')
    if (!envios.fields.getByName('remetente_id')) {
      envios.fields.add(
        new RelationField({
          name: 'remetente_id',
          collectionId: users.id,
          maxSelect: 1,
          cascadeDelete: false,
          required: false,
        }),
      )
      app.save(envios)
    }

    try {
      app.findCollectionByNameOrId('com_proposta_abertura_emails')
    } catch (_) {
      var avisos = new Collection({
        type: 'base',
        name: 'com_proposta_abertura_emails',
        createRule: null,
        updateRule: null,
        deleteRule: null,
        listRule: null,
        viewRule: null,
      })
      avisos.fields.add(
        new RelationField({
          name: 'publicacao_id',
          collectionId: app.findCollectionByNameOrId('com_proposta_publicacoes').id,
          maxSelect: 1,
          cascadeDelete: true,
          required: true,
        }),
      )
      avisos.fields.add(
        new RelationField({
          name: 'evento_id',
          collectionId: app.findCollectionByNameOrId('com_proposta_eventos_publicos').id,
          maxSelect: 1,
          cascadeDelete: true,
          required: true,
        }),
      )
      avisos.fields.add(
        new RelationField({
          name: 'remetente_id',
          collectionId: users.id,
          maxSelect: 1,
          cascadeDelete: false,
          required: true,
        }),
      )
      avisos.fields.add(new EmailField({ name: 'destinatario', required: true }))
      avisos.fields.add(
        new SelectField({
          name: 'estado',
          values: ['enviando', 'enviado', 'falhou'],
          maxSelect: 1,
          required: true,
        }),
      )
      avisos.fields.add(
        new NumberField({ name: 'tentativa', min: 1, onlyInt: true, required: true }),
      )
      avisos.fields.add(new TextField({ name: 'provider_id', max: 300, required: false }))
      avisos.fields.add(new TextField({ name: 'erro_codigo', max: 200, required: false }))
      avisos.fields.add(new DateField({ name: 'enviado_em', required: false }))
      avisos.indexes = [
        'CREATE UNIQUE INDEX idx_com_proposta_abertura_email_publicacao ON com_proposta_abertura_emails (publicacao_id)',
        'CREATE INDEX idx_com_proposta_abertura_email_estado ON com_proposta_abertura_emails (estado, created)',
      ]
      app.save(avisos)
    }

    try {
      app.findFirstRecordByData(
        'com_parametros',
        'chave',
        'proposta.email_notificar_remetente_abertura',
      )
    } catch (_) {
      var parametro = new Record(app.findCollectionByNameOrId('com_parametros'))
      parametro.set('chave', 'proposta.email_notificar_remetente_abertura')
      parametro.set('valor', 'false')
      parametro.set('tipo', 'booleano')
      parametro.set('descricao', 'Enviar e-mail ao remetente na primeira abertura da proposta')
      parametro.set('unidade', '')
      parametro.set('versao', 1)
      parametro.set('ativo', true)
      parametro.set('justificativa', 'Implantação segura: ativação após homologação controlada')
      app.save(parametro)
    }
  },
  function (app) {
    try {
      app.delete(
        app.findFirstRecordByData(
          'com_parametros',
          'chave',
          'proposta.email_notificar_remetente_abertura',
        ),
      )
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('com_proposta_abertura_emails'))
    } catch (_) {}
    var envios = app.findCollectionByNameOrId('com_proposta_envios')
    if (envios.fields.getByName('remetente_id')) {
      envios.fields.removeByName('remetente_id')
      app.save(envios)
    }
  },
)
