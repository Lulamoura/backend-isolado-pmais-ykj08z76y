# Pacote de simulação — WhatsApp Comercial/Uazapi

Status: apoio à homologação, sem substituir teste real com os telefones.

## Objetivo

Permitir que a etapa técnica seja validada com massa controlada antes da equipe usar os aparelhos reais.

Este pacote cobre os cenários mínimos que o App Comercial precisa reconhecer na integração Uazapi.

## Cenários simulados

1. Mensagem recebida de cliente em conversa privada.
2. Mensagem enviada pela operadora no telefone/WhatsApp Web.
3. Áudio de cliente, tratado como mídia para transcrição.
4. Imagem recebida.
5. Documento PDF recebido.
6. Mensagem de grupo, bloqueada na etapa inicial.
7. Duplicidade de mensagem, para validar deduplicação.
8. Evento de atualização de status/leitura.

## Onde está

Arquivo gerador:

`scripts/uazapi-simulated-payloads.cjs`

Comandos úteis:

```bash
node scripts/uazapi-simulated-payloads.cjs
node scripts/uazapi-simulated-payloads.cjs json
```

## Regras preservadas

- Não há token real.
- Não há mensagem real de cliente.
- URLs temporárias são exemplos inválidos.
- Grupo deve continuar fora da captura operacional inicial.
- Mensagem enviada pela operadora deve ser preservada para reconstruir contexto comercial.
- Áudio deve seguir política de transcrição preferencial, sem acúmulo permanente de mídia.

## Uso recomendado

Usar este pacote para validar contratos, tela administrativa e preparação do fluxo antes da homologação com aparelhos reais.

A homologação real só deve ser marcada como concluída depois de uma instância Uazapi real escrever eventos no Preview/runtime e a equipe confirmar os cenários definidos no roteiro.
