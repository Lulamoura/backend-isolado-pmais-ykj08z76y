# Plano — Curadoria Comercial Unificada e Aprendizado Governado

> Criado em 2026-10-01. Status: execução.

## Objetivo

Conectar o contexto comercial real ao aprendizado governado do Nexo: corrigir o uso das conversas WhatsApp vinculadas, reconciliar o ledger histórico com segurança, criar uma triagem ampla baseada no Ledger Comercial e redesenhar a Curadoria para trabalhar com casos agregados de WhatsApp, CRM/ActiveCampaign, negócios, propostas, follow-ups, reuniões e ações do Nexo, sem envio automático nem promoção silenciosa de conhecimento sensível.

## Sucesso = critérios verificáveis

- [ ] O Nexo lê `direcao`/`texto` e todos os estados governados de vínculo produzidos pelo webhook.
- [ ] Conversas vinculadas alimentam a Ajuda do Nexo; negócios sem conversa e fontes indisponíveis continuam semanticamente distintos.
- [ ] O ledger histórico das conversas já vinculadas pode ser reconciliado por operação idempotente, com dry-run e sem sobrescrever decisões humanas.
- [ ] A consulta governada separa fato, candidato e conhecimento publicado e retorna estado inconclusivo quando alguma fonte necessária está indisponível.
- [ ] Casos de Curadoria possuem fonte, escopo, evidência, fingerprint, risco, alçada e histórico de transições.
- [ ] WhatsApp, ações do Nexo e eventos comerciais locais entram na mesma triagem; integrações futuras usam o mesmo envelope.
- [ ] Dinheiro, preço, desconto, contrato, promessa sensível, LGPD, política comercial, indicadores, IPCP, conflito e baixa confiança nunca seguem promoção automática de baixo risco.
- [ ] Entrevistas interrompidas continuam visíveis; gestores tratam alçadas de gestão e direção trata matérias executivas.
- [ ] Publicação e retirada no Segundo Cérebro são idempotentes, confirmadas e auditáveis.
- [ ] Captura permanece passiva, `automatic_send_allowed=false`, sem envio WhatsApp e sem escrita automática no CRM.
- [ ] Testes, TypeScript, build, diff-check, revisão independente e Preview real passam antes de qualquer pedido de Produção.

## Tarefas

### Fase 1 — Corrigir o caminho real WhatsApp → Ajuda do Nexo

- [x] **T1.1** — Ajustar os testes runtime para o schema real de mensagens e estados de vínculo.
  - Verificação: o teste falha pela incompatibilidade atual, não por erro de fixture.
  - Depende de: nenhuma.
- [x] **T1.2** — Corrigir os dois leitores backend de contexto WhatsApp.
  - Verificação: testes aceitam vínculos automático, manual e múltiplo; mapeiam direção e texto; rejeitam estados não governados e grupos.
  - Depende de: T1.1.
- [ ] **T1.3** — Validar contexto com um negócio vinculado e um sem conversa no runtime de Preview.
  - Verificação: respostas distintas, sem campos técnicos e sem envio.
  - Depende de: T1.2 e sincronização de Preview.

### Fase 2 — Proveniência, reconciliação e consulta governada

- [x] **T2.1** — Definir e testar o envelope estrutural de proveniência do WhatsApp nos eventos de aprendizado.
  - Verificação: fonte, janela, hashes/referências internas, escopo do negócio, evidência e flags de segurança persistidos sem payload bruto.
  - Depende de: T1.2.
- [x] **T2.2** — Implementar dry-run e aplicação idempotente de reconciliação do ledger para conversas já vinculadas.
  - Verificação: somente registros compatíveis são atualizados; decisões humanas e vínculos não mudam; segunda execução altera zero registros.
  - Depende de: T2.1.
- [x] **T2.3** — Corrigir a consulta `aprendizados_whatsapp_comercial`.
  - Verificação: não usa campos inexistentes, não depende de substring, diferencia fonte vazia/indisponível e separa aprovado de apenas decidido.
  - Depende de: T2.1.

### Fase 3 — Casos unificados de Curadoria

- [x] **T3.1** — Criar contrato e schema protegido de casos, evidências, transições e outbox.
  - Verificação: coleções não aceitam escrita direta do navegador; índices de idempotência e fingerprint existem; schema materializa no Preview.
  - Depende de: T2.3.
- [x] **T3.2** — Implementar triagem conservadora do ledger em shadow mode.
  - Verificação: produz relatório sem mutação com destinos `sem_acao`, `pendencia`, `baixo_risco`, `curadoria` e `direcao`; classes sensíveis sempre escalam.
  - Depende de: T3.1.
- [x] **T3.3** — Implementar criação/atualização idempotente de casos agregados.
  - Verificação: duplicatas convergem; assuntos distintos do mesmo negócio não se misturam; recorrência e cooldown funcionam.
  - Depende de: T3.2.
- [x] **T3.4** — Integrar os produtores existentes: WhatsApp, Nexo, negócio, proposta e follow-up.
  - Verificação: cada fonte gera o mesmo envelope factual; falha de uma fonte não apaga as demais.
  - Depende de: T3.3.
- [x] **T3.5** — Preparar contrato de entrada para ActiveCampaign e reuniões.
  - Verificação: eventos podem ser recebidos apenas por fonte autenticada/idempotente; ausência de fonte real é exibida como não integrada, não como zero.
  - Depende de: T3.3.

### Fase 4 — Workflow e interface da Curadoria

- [x] **T4.1** — Mover listagem e transições da Curadoria para rotas backend autorizadas.
  - Verificação: alçada é recalculada no servidor; perfis inválidos falham fechados; transições inválidas são rejeitadas.
  - Depende de: T3.3.
- [x] **T4.2** — Redesenhar a tela em quatro visões: Para tratar, Aguardando decisão, Conhecimento aprovado e Histórico.
  - Verificação: referências humanas, contagem por casos, sem IDs técnicos, estados vazios/erros parciais corretos.
  - Depende de: T4.1.
- [x] **T4.3** — Garantir retomada de entrevistas e distribuição por alçada.
  - Verificação: entrevista salva não desaparece; gestor vê sua fila; direção vê apenas o que exige direção ou revisão executiva.
  - Depende de: T4.1.

### Fase 5 — Publicação confiável no Segundo Cérebro

- [x] **T5.1** — Implementar outbox de publicação/retirada por decisão e revisão.
  - Verificação: aprovação local sem publicação fica visível como pendente; retry não duplica conhecimento.
  - Depende de: T4.1.
- [x] **T5.2** — Tornar o Gateway idempotente e atômico, com readback de versão/hash.
  - Verificação: mesma decisão/revisão gera um único item; falha intermediária preserva arquivo anterior; retirada é reversível.
  - Depende de: T5.1.
- [x] **T5.3** — Restringir promoção de baixo risco à política versionada.
  - Verificação: allowlist passa; qualquer classe sensível, conflito, baixa confiança ou escopo amplo falha fechada e vai para humano.
  - Depende de: T5.2.

### Fase 6 — Validação e implantação

- [x] **T6.1** — Executar testes direcionados e suíte completa.
  - Verificação: RED/GREEN registrados; testes, TypeScript, build, sintaxe e diff-check passam.
  - Depende de: T1–T5.
- [x] **T6.2** — Executar revisão independente de lógica, segurança, LGPD e semântica.
  - Verificação: nenhum erro lógico ou risco bloqueador pendente.
  - Depende de: T6.1.
- [ ] **T6.3** — Commitar, enviar ao GitHub e sincronizar somente o Preview pelo processo SKIP.
  - Verificação: `origin/main` confirmado, Preview com nova referência, Produção inalterada.
  - Depende de: T6.2.
- [ ] **T6.4** — Homologar no Preview com casos controlados e limpar resíduos.
  - Verificação: fluxos de caso comum, WhatsApp, sensível, entrevista interrompida, aprovação, falha de publicação e retirada passam; nenhum envio é realizado.
  - Depende de: T6.3.
- [ ] **T6.5** — Solicitar publicação separada a Lula.
  - Verificação: nenhuma publicação ocorre antes da autorização explícita.
  - Depende de: T6.4.

## Dependências externas

- SKIP Builder e runtime de Preview.
- PMais Agent Gateway e sua cópia de Preview isolada.
- Fontes reais de ActiveCampaign e reuniões; quando não existirem, somente o contrato autenticado será preparado.
- Publicação em Produção exclusivamente por autorização separada de Lula.

## Riscos

- **Mudança ampla demais em um único build:** dividir por fases e versões de Preview.
- **Dados compartilhados entre Preview e Produção:** schema/records somente com autorização e guardas exatas; começar por dry-run.
- **Falso aprendizado por texto isolado:** exigir recorrência, evidência e escopo; não promover mensagens individuais.
- **Sobrecarga humana:** casos agregados, cooldown, digest e alçadas.
- **Dados pessoais no conhecimento:** sanitização e proibição de payload bruto.
- **Drift SKIP/GitHub:** GitHub como fonte, leitura posterior e comparação funcional após cada sync.

## Estado atual

- Mapeamento técnico concluído.
- Arquitetura escolhida: Ledger Comercial como porta única e casos agregados de Curadoria.
- T1.1 validada em RED: o teste falhou porque somente um dos três vínculos governados era aceito.
- T1.2 validada em GREEN: o runtime agora lê `texto`/`direcao`, aceita vínculos automático, manual e múltiplo e mantém pendências fora do contexto.
- T2.1 validada em RED/GREEN: eventos de aprendizado agora preservam proveniência estrutural do WhatsApp, janela, hash, contagens e resumo factual sem payload bruto.
- T2.2 validada em RED/GREEN: reconciliação tem dry-run, confirmação explícita, guarda de estado exato, preservação de conflitos e segunda execução idempotente.
- T2.3 validada em RED/GREEN: a consulta usa proveniência estrutural, distingue publicação ativa de decisão e retorna estado inconclusivo quando fontes falham.
- T3.1–T3.5 validadas em RED/GREEN: schema privado, triagem em shadow mode, casos idempotentes com recorrência/cooldown, produtores locais e contrato autenticado de fontes externas.
- T4.1–T4.3 validadas em RED/GREEN: APIs autorizadas, quatro visões, entrevista retomável, alçadas e histórico humano sem IDs técnicos.
- T5.1–T5.3 validadas em RED/GREEN local: decisão cria outbox idempotente, pendência fica visível, o Gateway publica/retira com revisão, hash e readback atômico; promoção automática permanece fechada e toda publicação exige revisão humana.
- Suítes locais direcionadas, `npm test`, 176 testes frontend, lint, TypeScript, build, diff-check, compileall e 93 testes do Gateway passaram; a revisão independente final confirmou ausência de bloqueadores.
- Preview permanece inalterado e depende de autorização explícita separada para commit, GitHub e sincronização pelo processo SKIP.
- T1.3 depende do próximo Preview.
- Produção não será alterada nesta execução sem autorização separada.
