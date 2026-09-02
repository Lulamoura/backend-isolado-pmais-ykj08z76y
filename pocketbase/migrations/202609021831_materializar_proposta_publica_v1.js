migrate(
  function (app) {
    var propostas = app.findCollectionByNameOrId('com_propostas')
    var versoes = app.findCollectionByNameOrId('com_proposta_versoes')

    // 1. Campos adicionais em com_propostas
    var propostaFields = [
      new RelationField({
        name: 'versao_publicada_id',
        collectionId: versoes.id,
        maxSelect: 1,
        cascadeDelete: false,
        required: false,
      }),
      new SelectField({
        name: 'publicacao_estado',
        values: ['nao_publicada', 'publicada', 'expirada', 'revogada'],
        maxSelect: 1,
        required: false,
      }),
      new DateField({ name: 'primeiro_acesso_em', required: false }),
      new DateField({ name: 'ultimo_acesso_em', required: false }),
      new NumberField({ name: 'total_acessos', min: 0, onlyInt: true, required: false }),
      new NumberField({ name: 'total_downloads', min: 0, onlyInt: true, required: false }),
      new SelectField({
        name: 'decisao_publica',
        values: ['pendente', 'aceita', 'recusada'],
        maxSelect: 1,
        required: false,
      }),
      new TextField({ name: 'decisao_publica_motivo', max: 1000, required: false }),
    ]
    var propostasChanged = false
    for (var i = 0; i < propostaFields.length; i++) {
      if (!propostas.fields.getByName(propostaFields[i].name)) {
        propostas.fields.add(propostaFields[i])
        propostasChanged = true
      }
    }
    if (propostasChanged) {
      app.save(propostas)
    }

    // 2. Campos adicionais e índice em com_proposta_versoes
    var versaoFields = [
      new FileField({
        name: 'arquivo_pdf',
        maxSelect: 1,
        maxSize: 20971520,
        mimeTypes: ['application/pdf'],
        protected: true,
        required: false,
      }),
      new TextField({ name: 'arquivo_sha256', max: 64, required: false }),
      new NumberField({ name: 'arquivo_bytes', min: 0, onlyInt: true, required: false }),
      new NumberField({ name: 'arquivo_paginas', min: 1, onlyInt: true, required: false }),
      new TextField({ name: 'cliente_snapshot', max: 300, required: false }),
      new TextField({ name: 'contato_snapshot', max: 300, required: false }),
      new EmailField({ name: 'email_snapshot', required: false }),
      new TextField({ name: 'telefone_snapshot', max: 40, required: false }),
      new TextField({ name: 'responsavel_snapshot', max: 300, required: false }),
      new SelectField({
        name: 'aprovacao_estado',
        values: ['nao_exigida', 'pendente', 'aprovada', 'reprovada'],
        maxSelect: 1,
        required: false,
      }),
      new RelationField({
        name: 'aprovada_por',
        collectionId: '_pb_users_auth_',
        maxSelect: 1,
        cascadeDelete: false,
        required: false,
      }),
      new DateField({ name: 'aprovada_em', required: false }),
      new TextField({ name: 'reprovacao_motivo', max: 1000, required: false }),
    ]
    var versoesChanged = false
    for (var j = 0; j < versaoFields.length; j++) {
      if (!versoes.fields.getByName(versaoFields[j].name)) {
        versoes.fields.add(versaoFields[j])
        versoesChanged = true
      }
    }
    var versaoShaIndex =
      'CREATE INDEX idx_com_proposta_versoes_sha256 ON com_proposta_versoes (arquivo_sha256)'
    if (!versoes.indexes || versoes.indexes.indexOf(versaoShaIndex) < 0) {
      versoes.indexes = (versoes.indexes || []).concat([versaoShaIndex])
      versoesChanged = true
    }
    if (versoesChanged) {
      app.save(versoes)
    }

    // 3. Coleção com_proposta_publicacoes
    var publicacoes
    try {
      publicacoes = app.findCollectionByNameOrId('com_proposta_publicacoes')
    } catch (_) {
      publicacoes = new Collection({
        type: 'base',
        name: 'com_proposta_publicacoes',
        createRule: null,
        updateRule: null,
        deleteRule: null,
        listRule: null,
        viewRule: null,
      })
      publicacoes.fields.add(
        new RelationField({
          name: 'proposta_id',
          collectionId: propostas.id,
          maxSelect: 1,
          cascadeDelete: false,
          required: true,
        }),
      )
      publicacoes.fields.add(
        new RelationField({
          name: 'versao_id',
          collectionId: versoes.id,
          maxSelect: 1,
          cascadeDelete: false,
          required: true,
        }),
      )
      publicacoes.fields.add(new TextField({ name: 'token_hash', max: 64, required: true }))
      publicacoes.fields.add(new TextField({ name: 'token_prefix', max: 12, required: true }))
      publicacoes.fields.add(new DateField({ name: 'publicada_em', required: true }))
      publicacoes.fields.add(new DateField({ name: 'expira_em', required: true }))
      publicacoes.fields.add(new DateField({ name: 'revogada_em', required: false }))
      publicacoes.fields.add(
        new RelationField({
          name: 'revogada_por',
          collectionId: '_pb_users_auth_',
          maxSelect: 1,
          cascadeDelete: false,
          required: false,
        }),
      )
      publicacoes.fields.add(
        new SelectField({
          name: 'estado',
          values: ['ativa', 'expirada', 'revogada'],
          maxSelect: 1,
          required: true,
        }),
      )
      publicacoes.fields.add(
        new AutodateField({
          name: 'created',
          onCreate: true,
          onUpdate: false,
        }),
      )
      publicacoes.fields.add(
        new AutodateField({
          name: 'updated',
          onCreate: true,
          onUpdate: true,
        }),
      )
      publicacoes.indexes = [
        'CREATE UNIQUE INDEX idx_com_proposta_publicacoes_token_hash ON com_proposta_publicacoes (token_hash)',
        "CREATE UNIQUE INDEX idx_com_proposta_publicacoes_ativa ON com_proposta_publicacoes (proposta_id) WHERE estado = 'ativa'",
        'CREATE INDEX idx_com_proposta_publicacoes_expira ON com_proposta_publicacoes (estado, expira_em)',
      ]
      app.save(publicacoes)
    }

    // 4. Coleção com_proposta_eventos_publicos
    try {
      app.findCollectionByNameOrId('com_proposta_eventos_publicos')
    } catch (_) {
      var eventos = new Collection({
        type: 'base',
        name: 'com_proposta_eventos_publicos',
        createRule: null,
        updateRule: null,
        deleteRule: null,
        listRule: null,
        viewRule: null,
      })
      eventos.fields.add(
        new RelationField({
          name: 'publicacao_id',
          collectionId: publicacoes.id,
          maxSelect: 1,
          cascadeDelete: false,
          required: true,
        }),
      )
      eventos.fields.add(
        new SelectField({
          name: 'tipo',
          values: [
            'pagina_acessada',
            'pdf_baixado',
            'duvida_iniciada',
            'aceite_confirmado',
            'recusa_confirmada',
          ],
          maxSelect: 1,
          required: true,
        }),
      )
      eventos.fields.add(new DateField({ name: 'ocorrido_em', required: true }))
      eventos.fields.add(new TextField({ name: 'chave_idempotencia', max: 128, required: true }))
      eventos.fields.add(
        new AutodateField({
          name: 'created',
          onCreate: true,
          onUpdate: false,
        }),
      )
      eventos.fields.add(
        new AutodateField({
          name: 'updated',
          onCreate: true,
          onUpdate: true,
        }),
      )
      eventos.indexes = [
        'CREATE UNIQUE INDEX idx_com_proposta_eventos_publicos_idem ON com_proposta_eventos_publicos (chave_idempotencia)',
        'CREATE INDEX idx_com_proposta_eventos_publicos_timeline ON com_proposta_eventos_publicos (publicacao_id, ocorrido_em)',
      ]
      app.save(eventos)
    }

    // 5. Coleção com_proposta_envios
    try {
      app.findCollectionByNameOrId('com_proposta_envios')
    } catch (_) {
      var envios = new Collection({
        type: 'base',
        name: 'com_proposta_envios',
        createRule: null,
        updateRule: null,
        deleteRule: null,
        listRule: null,
        viewRule: null,
      })
      envios.fields.add(
        new RelationField({
          name: 'proposta_id',
          collectionId: propostas.id,
          maxSelect: 1,
          cascadeDelete: false,
          required: true,
        }),
      )
      envios.fields.add(
        new RelationField({
          name: 'versao_id',
          collectionId: versoes.id,
          maxSelect: 1,
          cascadeDelete: false,
          required: true,
        }),
      )
      envios.fields.add(
        new RelationField({
          name: 'publicacao_id',
          collectionId: publicacoes.id,
          maxSelect: 1,
          cascadeDelete: false,
          required: true,
        }),
      )
      envios.fields.add(
        new SelectField({
          name: 'canal',
          values: ['email', 'whatsapp_assistido'],
          maxSelect: 1,
          required: true,
        }),
      )
      envios.fields.add(new EmailField({ name: 'destinatario', required: false }))
      envios.fields.add(new TextField({ name: 'assunto', max: 300, required: false }))
      envios.fields.add(new TextField({ name: 'mensagem_snapshot', max: 5000, required: false }))
      envios.fields.add(new EmailField({ name: 'reply_to', required: false }))
      envios.fields.add(
        new SelectField({
          name: 'estado',
          values: ['solicitado', 'enviando', 'enviado', 'falhou'],
          maxSelect: 1,
          required: true,
        }),
      )
      envios.fields.add(new TextField({ name: 'provider_id', max: 300, required: false }))
      envios.fields.add(new TextField({ name: 'erro_codigo', max: 200, required: false }))
      envios.fields.add(
        new NumberField({ name: 'tentativa', min: 1, onlyInt: true, required: true }),
      )
      envios.fields.add(new DateField({ name: 'enviado_em', required: false }))
      envios.fields.add(
        new TextField({ name: 'command_idempotency_key', max: 128, required: true }),
      )
      envios.fields.add(
        new AutodateField({
          name: 'created',
          onCreate: true,
          onUpdate: false,
        }),
      )
      envios.fields.add(
        new AutodateField({
          name: 'updated',
          onCreate: true,
          onUpdate: true,
        }),
      )
      envios.indexes = [
        'CREATE UNIQUE INDEX idx_com_proposta_envios_idem ON com_proposta_envios (command_idempotency_key)',
        'CREATE INDEX idx_com_proposta_envios_timeline ON com_proposta_envios (proposta_id, created)',
      ]
      app.save(envios)
    }

    // 6. Parâmetros proposta.*
    var parametros = app.findCollectionByNameOrId('com_parametros')
    var definitions = [
      [
        'proposta.aprovacao_interna_obrigatoria',
        'false',
        'booleano',
        'Aprovação interna antes da publicação',
      ],
      ['proposta.link_expiracao_dias', '30', 'inteiro', 'Validade padrão do link público'],
      ['proposta.pdf_tamanho_max_mb', '20', 'inteiro', 'Tamanho máximo do PDF'],
      ['proposta.email_habilitado', 'false', 'booleano', 'Gate do envio por Resend'],
      ['proposta.pagina_publica_habilitada', 'false', 'booleano', 'Gate da página pública'],
    ]
    for (var k = 0; k < definitions.length; k++) {
      try {
        app.findFirstRecordByData('com_parametros', 'chave', definitions[k][0])
      } catch (_) {
        var parametro = new Record(parametros)
        parametro.set('chave', definitions[k][0])
        parametro.set('valor', definitions[k][1])
        parametro.set('descricao', definitions[k][3])
        parametro.set('tipo', definitions[k][2])
        parametro.set('versao', 1)
        parametro.set('ativo', true)
        parametro.set('justificativa', 'Fundação inativa da proposta pública nativa V1')
        app.save(parametro)
      }
    }
  },
  function (app) {
    var names = ['com_proposta_envios', 'com_proposta_eventos_publicos', 'com_proposta_publicacoes']
    for (var i = 0; i < names.length; i++) {
      try {
        app.delete(app.findCollectionByNameOrId(names[i]))
      } catch (_) {}
    }

    var parameterKeys = [
      'proposta.aprovacao_interna_obrigatoria',
      'proposta.link_expiracao_dias',
      'proposta.pdf_tamanho_max_mb',
      'proposta.email_habilitado',
      'proposta.pagina_publica_habilitada',
    ]
    for (var j = 0; j < parameterKeys.length; j++) {
      try {
        app.delete(app.findFirstRecordByData('com_parametros', 'chave', parameterKeys[j]))
      } catch (_) {}
    }

    var propostas = app.findCollectionByNameOrId('com_propostas')
    var propostaFieldNames = [
      'versao_publicada_id',
      'publicacao_estado',
      'primeiro_acesso_em',
      'ultimo_acesso_em',
      'total_acessos',
      'total_downloads',
      'decisao_publica',
      'decisao_publica_motivo',
    ]
    for (var k = 0; k < propostaFieldNames.length; k++) {
      if (propostas.fields.getByName(propostaFieldNames[k]))
        propostas.fields.removeByName(propostaFieldNames[k])
    }
    app.save(propostas)

    var versoes = app.findCollectionByNameOrId('com_proposta_versoes')
    var versaoFieldNames = [
      'arquivo_pdf',
      'arquivo_sha256',
      'arquivo_bytes',
      'arquivo_paginas',
      'cliente_snapshot',
      'contato_snapshot',
      'email_snapshot',
      'telefone_snapshot',
      'responsavel_snapshot',
      'aprovacao_estado',
      'aprovada_por',
      'aprovada_em',
      'reprovacao_motivo',
    ]
    for (var m = 0; m < versaoFieldNames.length; m++) {
      if (versoes.fields.getByName(versaoFieldNames[m]))
        versoes.fields.removeByName(versaoFieldNames[m])
    }
    var retainedIndexes = []
    for (var n = 0; n < versoes.indexes.length; n++) {
      if (versoes.indexes[n].indexOf('idx_com_proposta_versoes_sha256') < 0)
        retainedIndexes.push(versoes.indexes[n])
    }
    versoes.indexes = retainedIndexes
    app.save(versoes)
  },
)
