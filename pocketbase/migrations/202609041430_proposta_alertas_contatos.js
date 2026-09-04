migrate(
  function (app) {
    var users = app.findCollectionByNameOrId('users')
    if (!users.fields.getByName('telefone')) {
      users.fields.add(new TextField({ name: 'telefone', max: 40, required: false }))
      app.save(users)
    }

    var versoes = app.findCollectionByNameOrId('com_proposta_versoes')
    if (!versoes.fields.getByName('responsavel_telefone_snapshot')) {
      versoes.fields.add(
        new TextField({ name: 'responsavel_telefone_snapshot', max: 40, required: false }),
      )
      app.save(versoes)
    }

    try {
      app.findCollectionByNameOrId('com_proposta_notificacao_leituras')
    } catch (_) {
      var leituras = new Collection({
        type: 'base',
        name: 'com_proposta_notificacao_leituras',
        createRule: null,
        updateRule: null,
        deleteRule: null,
        listRule: null,
        viewRule: null,
      })
      leituras.fields.add(
        new RelationField({
          name: 'usuario_id',
          collectionId: users.id,
          maxSelect: 1,
          cascadeDelete: true,
          required: true,
        }),
      )
      leituras.fields.add(
        new RelationField({
          name: 'evento_id',
          collectionId: app.findCollectionByNameOrId('com_proposta_eventos_publicos').id,
          maxSelect: 1,
          cascadeDelete: true,
          required: true,
        }),
      )
      leituras.fields.add(new DateField({ name: 'lida_em', required: true }))
      leituras.indexes = [
        'CREATE UNIQUE INDEX idx_com_proposta_notificacao_leitura ON com_proposta_notificacao_leituras (usuario_id, evento_id)',
      ]
      app.save(leituras)
    }

    var parametros = app.findCollectionByNameOrId('com_parametros')
    var defs = [
      [
        'proposta.sem_abertura_dias_uteis',
        '2',
        'inteiro',
        'Dias úteis completos antes do alerta de proposta sem abertura',
        'dias_uteis',
      ],
      [
        'proposta.notificar_responsavel_abertura',
        'true',
        'booleano',
        'Notificar o responsável quando a proposta for aberta',
        '',
      ],
      [
        'proposta.notificar_gestor_abertura',
        'true',
        'booleano',
        'Notificar gestores da equipe quando a proposta for aberta',
        '',
      ],
      [
        'proposta.notificar_superadmin_abertura',
        'true',
        'booleano',
        'Notificar SuperAdministradores quando a proposta for aberta',
        '',
      ],
    ]
    for (var i = 0; i < defs.length; i++) {
      try {
        app.findFirstRecordByData('com_parametros', 'chave', defs[i][0])
      } catch (_) {
        var parametro = new Record(parametros)
        parametro.set('chave', defs[i][0])
        parametro.set('valor', defs[i][1])
        parametro.set('tipo', defs[i][2])
        parametro.set('descricao', defs[i][3])
        parametro.set('unidade', defs[i][4])
        parametro.set('versao', 1)
        parametro.set('ativo', true)
        parametro.set('justificativa', 'Ajustes solicitados pelo time comercial em 04/09/2026')
        app.save(parametro)
      }
    }
  },
  function (app) {
    var keys = [
      'proposta.sem_abertura_dias_uteis',
      'proposta.notificar_responsavel_abertura',
      'proposta.notificar_gestor_abertura',
      'proposta.notificar_superadmin_abertura',
    ]
    for (var i = 0; i < keys.length; i++) {
      try {
        app.delete(app.findFirstRecordByData('com_parametros', 'chave', keys[i]))
      } catch (_) {}
    }
    try {
      app.delete(app.findCollectionByNameOrId('com_proposta_notificacao_leituras'))
    } catch (_) {}
    var versoes = app.findCollectionByNameOrId('com_proposta_versoes')
    if (versoes.fields.getByName('responsavel_telefone_snapshot')) {
      versoes.fields.removeByName('responsavel_telefone_snapshot')
      app.save(versoes)
    }
    var users = app.findCollectionByNameOrId('users')
    if (users.fields.getByName('telefone')) {
      users.fields.removeByName('telefone')
      app.save(users)
    }
  },
)
