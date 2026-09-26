# Roteiro de homologação — WhatsApp Comercial/Uazapi

Status: pronto para uso quando os telefones da equipe estiverem disponíveis.

## Objetivo

Validar, em Preview, se o App Comercial recebe e organiza corretamente os eventos reais da Uazapi sem expor a funcionalidade para usuários comuns e sem envio automático de mensagens.

## Antes de começar

- Confirmar quais números comerciais participarão do teste.
- Confirmar a instância Uazapi correta de cada número.
- Confirmar o segredo do webhook no ambiente Preview.
- Confirmar que o acesso à tela **WhatsApp Comercial** está restrito à Administração.
- Manter Produção fora do teste.

## Participantes

Preencher no dia do teste:

- Responsável PMais pelo número 1:
- Responsável PMais pelo número 2:
- Responsável PMais pelo número 3:
- Validador no App Comercial:
- Horário de início:
- Horário de encerramento:

## Sequência mínima de testes

### 1. Mensagem recebida

- Enviar uma mensagem privada para o número comercial.
- Confirmar no App Comercial que houve novo evento/mensagem.
- Evidência esperada: mensagem recebida, conversa privada, sem grupo.

### 2. Mensagem enviada pela operadora

- A operadora responde pelo celular ou WhatsApp Web normal.
- Confirmar no App Comercial que a mensagem enviada também aparece.
- Evidência esperada: direção enviada/operadora preservada para contexto comercial.

### 3. Áudio

- Cliente/testador envia um áudio curto.
- Confirmar que aparece como mídia pendente/transcrição pendente.
- Evidência esperada: áudio reconhecido mesmo quando o provedor informar tipo incompleto.

### 4. Imagem

- Enviar uma imagem simples.
- Confirmar que aparece como mídia recebida/pendente.

### 5. Documento

- Enviar um PDF simples sem informação sensível.
- Confirmar que aparece como documento/mídia pendente.

### 6. Grupo

- Se for seguro fazer no número escolhido, enviar uma mensagem em grupo.
- Confirmar que o App não trata grupo como conversa comercial comum.
- Se o número real não puder entrar em grupo, marcar este item como pendente justificado.

### 7. Desconexão/reconexão

- Validar no painel Uazapi ou por evento se a instância está conectada.
- Se houver janela segura, testar reconexão.
- Não forçar desconexão em número sensível ou operacional sem autorização.

### 8. Duplicidade

- Repetir um evento controlado ou observar reentrega do provedor.
- Confirmar que não cria registros comerciais duplicados indevidos.

## Critérios de aprovação da etapa

A etapa pode ser considerada homologada quando:

- mensagens recebidas aparecem no Preview;
- mensagens enviadas pela operadora aparecem no Preview;
- áudio é identificado como mídia para transcrição;
- imagem/documento entram como mídia;
- grupos não entram como conversa comercial comum;
- não há envio automático pelo App Comercial/Nexo;
- tela fica na Administração;
- nenhum token ou dado sensível aparece para usuário comum;
- os testes foram feitos em Preview, não em Produção.

## O que continua proibido nesta etapa

- Publicar Produção sem autorização específica.
- Ativar resposta automática livre.
- Usar conversas reais para perfil comportamental antes de massa homologada.
- Expor dados técnicos ou mensagens sensíveis em telas de uso comum.
- Transformar conversa bruta em conhecimento operacional sem curadoria.

## Resultado do teste

Preencher após execução:

- Aprovado:
- Aprovado com ressalvas:
- Reprovado:
- Ressalvas:
- Próxima decisão necessária:
