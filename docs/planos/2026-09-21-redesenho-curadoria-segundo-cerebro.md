# Plano — Redesenho da Curadoria Nexo e Segundo Cérebro

> Criado em 2026-09-21. Status: planejamento.

## Objetivo

Redesenhar o fluxo da Curadoria Nexo para que a Ajuda do Nexo seja uso operacional e fonte de sinais, não gatilho automático de entrevista humana. A Curadoria deve receber apenas casos qualificados por divergência, quebra de regra, lacuna relevante, recorrência com potencial de aprendizado, exceção comercial ou possível impacto no IPCP, sempre com motivo objetivo ancorado no segundo cérebro.

## Princípio central

> A Curadoria não revisa todo uso da IA; ela valida tensões relevantes entre prática real, regra comercial e conhecimento consolidado antes de alimentar o segundo cérebro.

## Sucesso = critérios verificáveis

- [ ] Pedido comum de Ajuda do Nexo não aparece automaticamente em “Aguardando curadoria”.
- [ ] Toda interação de Ajuda do Nexo aciona avaliação do negócio — descrição, follow-ups, proposta, etapa e coerência com o segundo cérebro — e gera registro/sinal auditável.
- [ ] A fila de Curadoria exibe apenas casos em que essa avaliação identificou divergência, dúvida de procedimento, lacuna relevante, exceção ou impacto possível no IPCP.
- [ ] Cada caso em Curadoria apresenta motivo específico, verificável e ancorado em regra/prática do segundo cérebro.
- [ ] Motivo de Curadoria não replica resposta gerada, não usa justificativa genérica e não promete regra/playbook/aprendizado por padrão.
- [ ] Curadoria permite decidir: confirmar regra, criar regra, alterar regra, adicionar exceção/adendo, corrigir interpretação do Nexo, descartar caso isolado, escalar ou abrir revisão de IPCP.
- [ ] Quando houver impacto potencial no IPCP, é aberta revisão controlada, sem alteração automática do cálculo.
- [ ] Preview validado antes de qualquer Produção; Produção só após publicação pelo Lula e validação posterior.

## Modelo operacional proposto

### 1. Ajuda do Nexo — uso operacional e gatilho de avaliação

- Operador solicita ajuda.
- Nexo consulta o segundo cérebro e o contexto do negócio.
- Nexo responde ao operador.
- O pedido aciona uma avaliação do negócio, considerando descrição do CRM, follow-ups, proposta, etapa/fase e coerência com a base de conhecimento.
- O pedido e a resposta são registrados como sinal, mas não viram curadoria automaticamente.

### 2. Caixa de entrada de aprendizado

Registro silencioso dos sinais de uso do Nexo e da avaliação do negócio gerada a partir do pedido de ajuda.

Campos conceituais desejados:

- negócio;
- empresa/contato;
- ação solicitada;
- resposta gerada;
- contexto do CRM;
- notas disponíveis;
- regra/prática do segundo cérebro usada;
- confiança/limitações;
- sinais detectados;
- possível impacto no IPCP;
- status de triagem.

Estados sugeridos:

- `registrado` — apenas armazenado;
- `em_triagem` — aguardando análise da IA curadora/agente da área;
- `sem_acao` — uso comum, não vira aprendizado;
- `aprendizado_potencial` — sinal relevante, mas sem curadoria humana;
- `curadoria_necessaria` — exige entrevista/validação humana;
- `descartado` — caso isolado ou sem relevância;
- `promovido_segundo_cerebro` — aprendizado validado.

### 3. IA curadora / agente da área

Analisa a caixa de entrada e compara:

- prática real registrada no CRM/notas;
- resposta gerada pelo Nexo;
- regra/prática existente no segundo cérebro;
- contexto do negócio;
- recorrência em casos semelhantes;
- possível impacto no IPCP.

A IA curadora não deve abrir entrevista por volume. Deve abrir apenas quando houver tensão relevante.

### 4. Gatilhos para Curadoria humana

Um caso vai para Curadoria apenas quando houver ao menos um gatilho qualificado:

- divergência com regra/prática do segundo cérebro;
- quebra de regra percebida no processo comercial;
- dúvida comercial que impeça orientação segura;
- lacuna crítica no CRM/notas;
- conflito entre casos semelhantes;
- recorrência que sugira novo padrão;
- exceção comercial relevante;
- possível alteração de regra;
- possível impacto no IPCP;
- falha/fallback de IA que comprometa confiança.

### 5. Curadoria humana

A tela de Curadoria deve mostrar:

- motivo objetivo;
- regra/prática relacionada;
- evidência do CRM/notas;
- pergunta de validação direcionada;
- opções de decisão.

A entrevista deve ser objetiva e vinculada ao motivo. Não deve pedir revisão genérica de toda resposta do Nexo.

### 6. Atualização do segundo cérebro

Após decisão validada, o caso pode:

- confirmar regra existente;
- gerar nova regra;
- alterar regra;
- criar exceção/adendo;
- corrigir interpretação do Nexo;
- ser descartado como caso isolado.

Só conhecimento validado deve alimentar o segundo cérebro.

### 7. Revisão de IPCP

Se a decisão afetar critério usado no IPCP, abrir revisão controlada de cálculo.

A Curadoria não altera IPCP automaticamente.

## Fases de implementação

### Fase 1 — Contrato conceitual e mapeamento do estado atual

- [x] Mapear onde a Ajuda do Nexo grava eventos de aprendizado hoje.
  - Verificação: `pocketbase/hooks/com_propostas_operacao.js` grava em `com_nexo_aprendizado_eventos` pela função `nexoCapturarAprendizadoApp`.
- [x] Mapear onde a Curadoria lê a fila hoje.
  - Verificação: `src/services/nexo-curadoria.ts` lê `com_nexo_aprendizado_eventos` para montar “Aguardando curadoria”.
- [x] Identificar onde `human_review_required` força entrada automática.
  - Verificação: `nexoCapturarAprendizadoApp` marcava todos os pedidos com `human_review_required = true`.

### Fase 2 — Separar “sinal” de “curadoria”

- [x] Alterar registro de Ajuda do Nexo para criar sinal/entrada de aprendizado sem pendência humana automática.
  - Verificação: `human_review_required` agora depende de `avaliacaoNegocio.curadoria_necessaria`, não é mais sempre `true`.
- [x] Preservar rastreabilidade e auditoria do pedido.
  - Verificação: registro mantém negócio, ação, resposta, contexto, data, auditoria e passa a guardar avaliação do negócio.

### Fase 3 — Criar classificação de triagem

- [x] Definir campos de triagem e status.
  - Verificação: registros passam a ter `triagem_status`, `avaliacao_negocio_resumo` e `gatilhos_curadoria`.
- [x] Implementar critérios determinísticos iniciais seguros.
  - Verificação: apenas fallback/falha de IA ou sinal explícito do modelo entram como `curadoria_necessaria` nesta primeira estrutura.
- [~] Preparar camada para análise generativa futura da IA curadora.
  - Verificação: avaliação estruturada foi criada; análise generativa/comparação profunda com segundo cérebro ainda será fase posterior.

### Fase 4 — Reformular fila da Curadoria

- [x] A fila passa a listar apenas registros com `curadoria_necessaria`.
  - Verificação: filtro da fila usa `triagem_status = 'curadoria_necessaria' && human_review_required = true`.
- [~] Exibir motivo específico e evidências.
  - Verificação: card usa `motivo_curadoria`; próxima fase deve enriquecer regra/prática do segundo cérebro e evidências específicas.
- [x] Manter botão de Notas e descrição CRM já ajustados.
  - Verificação: card preserva contexto completo sem voltar a resumir notas.

### Fase 5 — Decisão e atualização do conhecimento

- [ ] Ajustar entrevista para decidir destino do conhecimento.
  - Verificação: opções incluem confirmar, criar, alterar, adendar, corrigir Nexo, descartar, escalar, revisar IPCP.
- [ ] Bloquear alimentação automática do segundo cérebro sem validação.
  - Verificação: aprendizado só muda de status após decisão.

### Fase 6 — IPCP

- [ ] Identificar decisões de Curadoria com possível impacto no IPCP.
  - Verificação: decisão gera pendência de revisão de cálculo, não alteração direta.
- [ ] Manter trilha de auditoria da revisão.
  - Verificação: motivo, regra afetada e impacto previsto ficam registrados.

### Fase 7 — Preview, homologação e Produção

- [ ] Rodar contratos e build local.
  - Verificação: testes específicos, TypeScript e build passam.
- [ ] Sincronizar GitHub -> SKIP Preview.
  - Verificação: Preview reflete o novo fluxo.
- [ ] Validar com casos reais e simulados.
  - Verificação: pedido comum não entra na Curadoria; caso qualificado entra com motivo específico.
- [ ] Pedir publicação ao Lula.
  - Verificação: Produção só validada após Lula publicar.

## Riscos e mitigação

- Risco: esconder casos que deveriam ser curados.
  - Mitigação: começar com caixa de entrada auditável e relatórios de sinais, sem apagar nada.

- Risco: critério generativo criar motivos frágeis.
  - Mitigação: primeira versão usa critérios determinísticos conservadores e motivo baseado em evidência.

- Risco: Curadoria continuar burocrática.
  - Mitigação: fila só aceita `curadoria_necessaria`; pedidos comuns ficam fora.

- Risco: impacto indevido no IPCP.
  - Mitigação: Curadoria só abre revisão; cálculo nunca muda automaticamente.

- Risco: quebrar fluxo já usado no comercial.
  - Mitigação: implementar por fases no Preview e preservar Ajuda do Nexo operacional.

## Próxima ação recomendada

Validar a primeira estrutura no Preview: pedido comum de Ajuda do Nexo deve gerar sinal com avaliação do negócio e `triagem_status = registrado`, sem aparecer em “Aguardando curadoria”. Um caso com fallback/falha ou sinal explícito deve entrar como `curadoria_necessaria`.

## Estado atual

- Estrutura inicial implementada: avaliação do negócio, status de triagem, gatilhos de curadoria e filtro da fila por `curadoria_necessaria`.
- Ainda pendente: criar/aperfeiçoar a camada da IA curadora que compara a prática real com regras do segundo cérebro e produz motivos ancorados em regra/prática específica.
