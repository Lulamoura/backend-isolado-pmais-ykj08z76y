// T6.2 — sonda mínima do runtime PocketBase.
// Não autentica, não lê dados e não executa qualquer mutação.

routerAdd('GET', '/backend/v1/t6-2/runtime-probe-v6', function (e) {
  return e.json(200, {
    probe_version: 't62-runtime-probe-v6',
    handler_alcancado: true,
    somente_leitura: true,
    mutacoes_executadas: 0,
  })
})
