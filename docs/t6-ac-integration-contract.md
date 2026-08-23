# T6.AC — Contrato ActiveCampaign → Aplicativo Comercial PMais

Status: contrato local, sem ativação ou dados reais
Autoridade na fase 1: ActiveCampaign para identidade/captação e estado espelhado; Aplicativo para operação canônica posterior à ingestão.

## Entidades e chaves

| Entidade    | Chave externa       | Registro canônico | Regra                                                                                              |
| ----------- | ------------------- | ----------------- | -------------------------------------------------------------------------------------------------- |
| Empresa     | `organization.id`   | `com_empresas`    | Um vínculo externo único; ausência de ID gera ocorrência e nenhuma escrita                         |
| Contato     | `contact.id`        | `com_contatos`    | Um vínculo externo único; e-mail não substitui a chave externa                                     |
| Negócio     | `deal.id`           | `com_negocios`    | Um vínculo externo único; exige empresa, contato e responsável resolvidos ou ocorrência bloqueante |
| Responsável | código `Vendedor N` | `users`           | Resolve por `com_vinculos_externos`; `Vendedor 3`/desconhecido nunca é inferido                    |

## Autoridade por campo

| Grupo                                   | ActiveCampaign                        | Aplicativo                                                | Conflito                                                          |
| --------------------------------------- | ------------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------- |
| IDs externos                            | Autoridade                            | Somente vínculo                                           | AC prevalece; vínculo é imutável sem ação administrativa          |
| Nome da empresa e contato               | Autoridade enquanto AC oficial        | Espelho normalizado                                       | Divergência volta a ser corrigida no AC                           |
| E-mail e telefone                       | Autoridade enquanto AC oficial        | Espelho normalizado                                       | Valor vazio explícito exige evento versionado; ausência não apaga |
| Título, origem, captado por, modalidade | Autoridade de entrada                 | Espelho normalizado                                       | Alias ausente gera ocorrência                                     |
| Responsável inicial                     | Autoridade via `Vendedor N`           | Espelho pelo usuário mapeado                              | Não mapeado bloqueia negócio                                      |
| Etapa importada                         | Autoridade de entrada/paralelo        | Normalização canônica                                     | Etapa desconhecida gera ocorrência e não avança                   |
| Qualificação, atividades e próxima ação | Não reescrever automaticamente        | Autoridade do aplicativo                                  | Evento AC não apaga trilha operacional                            |
| Propostas/versões                       | Referência do estado legado/paralelo  | Autoridade operacional do aplicativo                      | Mudança incompatível gera ocorrência                              |
| Ganho/perda/OE                          | Sinal comparativo enquanto AC oficial | Autoridade transacional do aplicativo após comando válido | Divergência não é resolvida silenciosamente                       |

## Envelope canônico assinado

```json
{
  "schema_version": "1",
  "event_id": "ac:<entidade>:<id>:<versao-ou-timestamp-estavel>",
  "source": "activecampaign",
  "entity_type": "company|contact|business",
  "entity_id": "identificador-externo",
  "action": "upsert|archive",
  "occurred_at": "ISO-8601 UTC",
  "source_version": "versao monotona ou updated_timestamp",
  "correlation_id": "execucao do relay/reconciliador",
  "data": {},
  "links": {
    "company_id": "",
    "contact_id": "",
    "owner_code": ""
  }
}
```

Cabeçalhos obrigatórios:

- `Content-Type: application/json`;
- `X-AC-Signature`: HMAC-SHA256 do corpo bruto;
- `X-Correlation-Id`: igual ao envelope;
- tamanho máximo de 256 KiB.

## Idempotência e ordem

- Chave idempotente: SHA-256 de `source|event_id`.
- Replay exato retorna HTTP 200 com o resultado canônico original e `replay=true`.
- Para cada entidade, guardar `source_version` e `occurred_at` aplicados.
- Evento com versão inferior retorna HTTP 200, `stale=true`, sem escrita.
- Mesma versão com hash diferente gera ocorrência crítica e HTTP 409.
- Cursor de reconciliação só avança após lote integral concluído.

## Atomicidade

Cada evento é uma única transação contendo:

1. lock/idempotência;
2. validação de empresa, contato, negócio, aliases e responsável;
3. snapshot anterior quando aplicável;
4. criação/atualização canônica e vínculos;
5. evento, execução e auditoria;
6. liberação/conclusão.

Qualquer falha reverte alterações comerciais e não avança versão/cursor.

## Reconciliação manual

### Pré-carga oficial

- o recorte é calculado no momento do dry-run, sem quantidade fixa;
- inclui somente o pipeline `Propostas Qualificadas`, `status=aberto` e etapa `Negociação`;
- responsável vem do campo personalizado `Responsável` (`Vendedor N`), nunca do proprietário técnico `Comercial PMais`;
- empresa, contato, valor, modalidade e próxima ação são conferidos antes da execução;
- valor zero/R$ 0,01, responsável desconhecido e vínculo ausente geram quarentena;
- ganho, perda, Prospect e qualquer outra etapa ficam fora da carga inicial.

### Simular

- Superadministrador autenticado;
- consulta incremental desde cursor confirmado;
- não grava registros comerciais;
- retorna contagens `create/update/unchanged/stale/conflict/error`;
- retorna fingerprint do plano, cursor inicial/final candidato e validade curta.

### Executar

- exige fingerprint vigente, confirmação literal e chave idempotente;
- refaz a leitura e recusa se o estado/fingerprint mudou;
- lock global impede concorrência;
- executa páginas limitadas e registra progresso;
- cursor só é confirmado no sucesso integral;
- replay retorna o mesmo relatório.

## Entrada manual

- Operador Comercial, Gestor Comercial e Negociação própria: HTTP 403 no endpoint de entrada manual enquanto `activecampaign_authoritative=true`.
- Interface não apresenta a ação para esses perfis.
- Superadministrador: somente contingência, com justificativa, confirmação e auditoria; fora do fluxo normal.
- Treinamento cria `[TESTE]` pelo envelope/relay sintético, não por digitação dupla.

## Pré-operação e treinamento

- registros reais pré-carregados usam `origem_canal=activecampaign` e ficam somente leitura enquanto `ac_preoperation_read_only=true`;
- a API direta de atualização de `com_negocios` permanece fechada; mutações passam exclusivamente por comandos auditados;
- o webhook e a reconciliação podem atualizar o espelho a partir da fonte oficial;
- participantes usam a carteira real para leitura, filtros e dashboard;
- exercícios mutantes usam apenas eventos `test:` com marcador `[TESTE]` e correlação `t6-ac8-*`;
- a liberação operacional exige gate específico no go-live.

## Arquivamento e ausência

- Ausência em resposta incremental nunca significa exclusão.
- `archive` explícito não apaga; inativa somente quando o contrato da entidade permitir e preserva auditoria.
- Negócio terminal não é reaberto por evento externo; divergência vira ocorrência.
- Registros não mapeados, aliases desconhecidos e `Vendedor 3` permanecem em ocorrência até decisão humana.

## Dados e segurança

- Payload persistido deve ser minimizado e sanitizado; segredo nunca é armazenado.
- Logs registram IDs técnicos, evento, status e hash, sem telefone/e-mail completos.
- Segredos permanecem no backend/1Password.
- Hooks diagnósticos históricos ficam desativados e fora da navegação operacional.

## Critérios de teste

1. criação empresa → contato → negócio;
2. atualização sucessiva legítima;
3. replay exato;
4. evento obsoleto;
5. mesma versão/hash divergente;
6. alias desconhecido;
7. responsável não mapeado/Vendedor 3;
8. falha no meio sem escrita parcial;
9. duas reconciliações simultâneas;
10. dry-run obsoleto;
11. cursor não avança em falha;
12. Operador recebe 403 na Entrada manual;
13. Superadministrador sem justificativa recebe 400;
14. reconciliação recupera evento omitido sem duplicar;
15. zero segredo/PII em logs e respostas.
