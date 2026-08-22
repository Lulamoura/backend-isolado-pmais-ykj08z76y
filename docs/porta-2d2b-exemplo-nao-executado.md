# Porta 2D.2B — EXEMPLO NÃO EXECUTADO (v0.0.136)

> **classification: `EXEMPLO_NAO_EXECUTADO`**
> Este documento é um exemplo canônico **não executado**. Nenhuma rota foi
> chamada, nenhum round foi executado, nenhuma flag/lock/dado foi alterado e
> nenhuma chamada externa foi realizada para produzi-lo. Ele descreve fielmente
> as oito coleções reais e a sequência A1–D1 com os deltas finais aprovados.

## Coleções reais monitoradas (8)

| #   | Coleção                       | Delta esperado |
| --- | ----------------------------- | -------------- |
| 1   | `com_contatos`                | +1             |
| 2   | `com_negocios`                | +2             |
| 3   | `com_eventos_integracao`      | +5             |
| 4   | `com_execucoes_sincronizacao` | +4             |
| 5   | `com_vinculos_externos`       | +3             |
| 6   | `com_snapshots_negocio`       | +1             |
| 7   | `com_ocorrencias_qualidade`   | +1             |
| 8   | `com_auditoria`               | +0             |

Deltas finais aprovados (contatos, negócios, eventos_integracao,
execucoes_sincronizacao, vinculos_externos, snapshots_negocio,
ocorrencias_qualidade, auditoria):
**+1, +2, +5, +4, +3, +1, +1, +0** respectivamente.

## Matriz canônica A1–D1 (extraída do código)

| Ordem | Código                            | Método | Rota sanitizada                    | HTTP esperado | Observação                                       |
| ----- | --------------------------------- | ------ | ---------------------------------- | ------------- | ------------------------------------------------ |
| A1    | A1                                | POST   | /backend/v1/integracao/ac/webhook  | 503           | webhook disabled                                 |
| A2    | A2                                | GET    | /backend/v1/integracao/ac/webhook  | 405           | wrong method                                     |
| A3    | A3                                | POST   | /backend/v1/integracao/ac/webhook  | 400           | wrong content-type                               |
| A4    | A4                                | POST   | /backend/v1/integracao/ac/webhook  | 400           | missing data fields                              |
| A5    | A5                                | POST   | /backend/v1/integracao/ac/webhook  | 400           | malformed JSON                                   |
| A6    | A6                                | POST   | /backend/v1/integracao/ac/webhook  | 400           | oversized payload                                |
| A7    | A7                                | POST   | /backend/v1/integracao/ac/webhook  | 401           | missing_signature                                |
| A8    | A8                                | POST   | /backend/v1/integracao/ac/webhook  | 401           | invalid signature                                |
| B1    | B1_contato_criado                 | POST   | /backend/v1/integracao/ac/webhook  | 200           | contato criado                                   |
| B2    | B2_duplicidade_sem_efeito         | POST   | /backend/v1/integracao/ac/webhook  | 409           | duplicate=true                                   |
| B3    | B3_negocio_criado                 | POST   | /backend/v1/integracao/ac/webhook  | 200           | negócio criado                                   |
| B4    | B4_snapshot_e_atualizacao         | POST   | /backend/v1/integracao/ac/webhook  | 200           | delta de snapshot                                |
| B5    | B5_negocio_e_ocorrencia_qualidade | POST   | /backend/v1/integracao/ac/webhook  | 200           | delta de ocorrência                              |
| C1    | C1_rollback                       | POST   | /backend/v1/integracao/ac/rollback | 200           | success=true, idempotent=false                   |
| C2    | C2_repeticao_idempotente          | POST   | /backend/v1/integracao/ac/rollback | 200           | success=true, idempotent=true, rolled_back vazio |
| D1    | D1                                | POST   | /backend/v1/integracao/ac/webhook  | 503           | flag desativada                                  |

## Correlação esperada (exemplo não executado)

- **B1** — `TESTE-2D2B-FN-C1`: 1 contato + 1 evento + 1 execução + 1 vínculo
- **B3** — `TESTE-2D2B-FN-D1`: 1 negócio + 1 evento + 1 execução + 1 vínculo
- **B4** — `TESTE-2D2B-FN-D1` (update): 1 evento (deal_update) + 1 snapshot
- **B5** — `TESTE-2D2B-FN-D2`: 1 negócio + 1 evento + 1 execução + 1 vínculo + 1 ocorrência
- **C1** — rollback de `TESTE-2D2B-FN-D1`: 1 evento (rollback), restauração por snapshot
- **C2** — repetição idempotente: nenhum registro novo

## Decisão

**NÃO declarar GO neste exemplo.** A `classification` é
`EXEMPLO_NAO_EXECUTADO`. GO só pode existir após execução real, persistência
fail-closed das 16 etapas, releitura validada e classificação `PASS` pela rota
`GET /backend/v1/integracao/ac/evidence-porta-2d2b/:execId`.
