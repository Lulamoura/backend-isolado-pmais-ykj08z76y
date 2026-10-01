# Fila de ambiguidades da Integração WhatsApp

## Objetivo

Adicionar, na própria tela **Integração WhatsApp**, uma fila operacional para que uma pessoa analise o contexto de uma conversa ambígua e confirme seu vínculo com um ou mais negócios, sem impor um negócio principal artificial.

## Interface aprovada

- A fila aparece na própria página, com o título **Ambiguidades para decisão**.
- Cada item mostra apenas informações operacionais: contato, empresa, operador comercial, última interação e trechos recentes da conversa.
- Os negócios candidatos exibem título/necessidade, número comercial quando disponível, etapa e valor.
- A escolha usa seleção múltipla e exige ao menos um negócio.
- A decisão aceita até 80 negócios, limite compatível com o campo persistido. Acima disso, a tela bloqueia a confirmação e orienta apoio administrativo, sem oferecer uma seleção que falharia ao salvar.
- A confirmação atualiza a fila sem recarregar a página inteira e apresenta retorno de sucesso ou falha.
- IDs internos, chaves técnicas, probes e datas ISO não aparecem.
- As datas seguem `pt-BR` no fuso `America/Recife`.

## Regras de vínculo

- Uma escolha gera `vinculado_manual` quando há um negócio e `vinculado_multiplo` quando há dois ou mais.
- Em vínculo múltiplo, `negocio_id` fica vazio e `negocio_ids` guarda todos os escolhidos; não há negócio principal artificial.
- Só negócios abertos atualmente associados ao contato ou à empresa podem ser escolhidos.
- A gravação só ocorre se o vínculo ainda estiver em `ambiguidade_negocio_aberto`; mudanças concorrentes falham fechadas.
- A origem é registrada como decisão humana e mensagens futuras não recalculam nem substituem essa decisão.
- O fluxo continua em captura passiva e não cria qualquer chamada de envio de WhatsApp.

## Acesso e escopo

- Apenas `superadministrador` e `gestor-comercial` ativos podem abrir a fila e registrar decisão.
- O gestor só recebe ambiguidades cujos negócios atuais estejam integralmente dentro de sua equipe ou responsabilidade; indicadores e resumos globais não são entregues a esse perfil.
- O perfil técnico `integracao` recebe somente saúde agregada e não recebe mensagens, contatos, empresas, negócios, ambiguidades ou últimas interações.
- As coleções que armazenam eventos, mensagens, mídias, vínculos e fatos comerciais não permitem leitura direta pela API; o acesso passa por endpoints específicos com autorização.
- Carregamento inicial e atualização manual retiram o estado anterior da tela até a nova consulta terminar, evitando fila vazia ou cards antigos apresentados como atuais.

## Ajustes visuais

Remover da interface os alertas:

- **Sem envio automático**;
- **Dados parciais no monitoramento**.

A remoção é apenas visual. O backend continua retornando `automatic_send_allowed=false` e `modo=captura_passiva`.

## Validação

- Teste renderizado da fila e da seleção múltipla.
- Teste comportamental do endpoint de decisão humana, incluindo autorização, candidatos válidos, concorrência e vínculo múltiplo sem principal.
- Testes existentes de captura passiva, idempotência e vínculo múltiplo.
- Build local, revisão independente, sincronização GitHub → SKIP e inspeção do Preview.
- Nenhuma publicação em Produção sem autorização explícita.
