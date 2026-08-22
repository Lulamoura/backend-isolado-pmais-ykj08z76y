// Reconciliação da cadeia histórica 0068/0069 para instalações limpas.
//
// A migration 0069 pode ser validada pelo SKIP antes de a coleção criada em
// 0068 estar disponível. Ela agora tolera essa ausência transitória. Esta
// migration posterior exige que a coleção exista e aplica novamente a regra
// restritiva, evitando que uma instalação limpa termine com leitura ampla.
//
// Não cria, atualiza ou remove registros. Não altera campos, relações ou
// índices. Em bases já migradas, apenas reaplica idempotentemente as regras.
migrate(
  (app) => {
    var hist = app.findCollectionByNameOrId('com_qualificacao_historico')
    var SUPERADMIN_ONLY =
      "@request.auth.id != '' && @request.auth.perfil_id.slug = 'superadministrador'"

    hist.listRule = SUPERADMIN_ONLY
    hist.viewRule = SUPERADMIN_ONLY
    app.save(hist)
  },
  (app) => {
    // Hardening deliberadamente preservado no rollback: remover esta
    // reconciliação não deve ampliar acesso a histórico comercial sensível.
    var hist = app.findCollectionByNameOrId('com_qualificacao_historico')
    var SUPERADMIN_ONLY =
      "@request.auth.id != '' && @request.auth.perfil_id.slug = 'superadministrador'"

    hist.listRule = SUPERADMIN_ONLY
    hist.viewRule = SUPERADMIN_ONLY
    app.save(hist)
  },
)
