// G39-I2-R1 — Correção aditiva de compatibilidade e acesso (build 0.0.181).
// Incremental, idempotente e reversível. Não altera tipos, opções, relações,
// nomes, índices ou qualquer outro atributo além dos explicitados abaixo.
// Não faz backfill, update, create ou delete de registros.
//
// Efeitos:
//  1. com_negocios: afrouxar `required` para false em:
//       - tipo_entrada (select: pendente | pre_qualificada)
//       - qualificacao (select: pendente | qualificada | desqualificada)
//       - prospectivo (bool)
//  2. com_qualificacao_historico: restringir list/view a superadministrador.
//       - listRule/viewRule -> @request.auth.id != '' && @request.auth.perfil_id.slug = 'superadministrador'
//       - createRule/updateRule/deleteRule PRESERVADOS (server-side only / API desabilitada).
//
// down(): restaura literalmente o estado do build 0.0.180:
//  - required = true em tipo_entrada, qualificacao e prospectivo
//  - listRule/viewRule de com_qualificacao_historico -> @request.auth.id != ''
//  - demais regras sem alteração.
migrate(
  (app) => {
    // ----------------------------------------------------------------
    // 1. com_negocios — afrouxar `required` (false) nos três campos.
    // ----------------------------------------------------------------
    var negocios = app.findCollectionByNameOrId('com_negocios')

    var te = negocios.fields.getByName('tipo_entrada')
    if (te) te.required = false

    var qu = negocios.fields.getByName('qualificacao')
    if (qu) qu.required = false

    var pr = negocios.fields.getByName('prospectivo')
    if (pr) pr.required = false

    app.save(negocios)

    // ----------------------------------------------------------------
    // 2. com_qualificacao_historico — list/view só superadministrador.
    //    create/update/delete PRESERVADOS (já server-side only).
    // ----------------------------------------------------------------
    var hist = app.findCollectionByNameOrId('com_qualificacao_historico')

    var SUPERADMIN_ONLY =
      "@request.auth.id != '' && @request.auth.perfil_id.slug = 'superadministrador'"

    hist.listRule = SUPERADMIN_ONLY
    hist.viewRule = SUPERADMIN_ONLY
    // createRule / updateRule / deleteRule não tocados.

    app.save(hist)
  },
  (app) => {
    // ----------------------------------------------------------------
    // down() — restaura literalmente o estado do build 0.0.180.
    // ----------------------------------------------------------------

    // 1. com_negocios — required = true nos três campos.
    var negocios = app.findCollectionByNameOrId('com_negocios')

    var te = negocios.fields.getByName('tipo_entrada')
    if (te) te.required = true

    var qu = negocios.fields.getByName('qualificacao')
    if (qu) qu.required = true

    var pr = negocios.fields.getByName('prospectivo')
    if (pr) pr.required = true

    app.save(negocios)

    // 2. com_qualificacao_historico — list/view para qualquer autenticado.
    var hist = app.findCollectionByNameOrId('com_qualificacao_historico')

    hist.listRule = "@request.auth.id != ''"
    hist.viewRule = "@request.auth.id != ''"
    // create/update/delete não tocados.

    app.save(hist)
  },
)
