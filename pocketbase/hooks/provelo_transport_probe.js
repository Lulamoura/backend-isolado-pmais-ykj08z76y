// Temporary Preview-only diagnostic. Remove after the transport comparison.
routerAdd(
  "POST",
  "/backend/v1/integracao/provelo/transport-probe",
  function (e) {
    var profile = "";
    try {
      profile = $app
        .findRecordById("com_perfis", e.auth.getString("perfil_id"))
        .getString("slug");
    } catch (_) {}
    if (!e.auth.getBool("ativo_comercial") || profile !== "superadministrador")
      return e.forbiddenError("SuperAdmin necessario");

    var lockKey = "provelo_transport_probe_20260831";
    try {
      $app.findFirstRecordByData("com_parametros", "chave", lockKey);
      return e.json(409, { error: "PROBE_JA_EXECUTADO" });
    } catch (_) {}

    var body = JSON.stringify({
      DealId: "999999999",
      Modalidade: "DIAGNOSTICO",
      Email: "transport-probe@example.invalid",
      Vendedor: "DIAG",
      ValorServico: "      0,01",
    });
    var response = $http.send({
      url: "https://webhook.site/08d2866b-a1b2-49c5-9625-884bacd6b7aa",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: body,
      timeout: 20,
    });

    var record = new Record($app.findCollectionByNameOrId("com_parametros"));
    record.set("chave", lockKey);
    record.set("valor", "executed");
    record.set("ativo", true);
    record.set(
      "descricao",
      "One-shot Provelo transport probe; temporary diagnostic",
    );
    record.set("tipo", "lock");
    record.set("versao", 1);
    $app.save(record);

    return e.json(200, {
      executed: true,
      status: response.statusCode,
      request_body_sha256: $security.sha256(body),
      request_body_length: body.length,
    });
  },
  $apis.requireAuth("users"),
  $apis.bodyLimit(1024),
);
