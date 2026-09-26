const crypto = require('crypto')

const BASE_TIME = '2026-09-28T09:00:00.000Z'
const INSTANCE_NAME = 'Homologacao Comercial PMais'
const OWNER = '5581000000000'
const PRIVATE_CHAT_ID = '5581999990001@s.whatsapp.net'
const GROUP_CHAT_ID = '5581999990001-1234567890@g.us'

function at(minutes) {
  const date = new Date(BASE_TIME)
  date.setMinutes(date.getMinutes() + minutes)
  return date.toISOString()
}

function id(label) {
  return crypto.createHash('sha256').update(`pmais-uazapi-${label}`).digest('hex').slice(0, 32).toUpperCase()
}

function envelope({ label, eventType = 'messages', fromMe = false, isGroup = false, messageType = 'Conversation', mediaType = 'text', text = '', content = {}, minutes = 0 }) {
  const messageId = id(label)
  const chatId = isGroup ? GROUP_CHAT_ID : PRIVATE_CHAT_ID
  return {
    EventType: eventType,
    instanceName: INSTANCE_NAME,
    owner: OWNER,
    token: '[REDACTED_TEST_TOKEN]',
    message: {
      messageid: messageId,
      key: {
        id: messageId,
        fromMe,
        remoteJid: chatId,
      },
      chatid: chatId,
      fromMe,
      isGroup,
      messageType,
      mediaType,
      text,
      content,
      timestamp: at(minutes),
    },
  }
}

const payloads = [
  envelope({
    label: 'recebida-texto',
    text: 'Bom dia, gostaria de entender a proposta de terceirização para limpeza e portaria.',
    minutes: 0,
  }),
  envelope({
    label: 'enviada-operador',
    fromMe: true,
    text: 'Bom dia. Vou organizar as informações e retorno com os próximos passos.',
    minutes: 3,
  }),
  envelope({
    label: 'audio-cliente',
    messageType: 'AudioMessage',
    mediaType: '',
    text: '',
    content: {
      mimetype: 'audio/ogg; codecs=opus',
      fileLength: '48291',
      seconds: 18,
      url: 'https://example.invalid/uazapi/temp/audio.ogg?token=[REDACTED]',
      mediaKey: '[REDACTED_MEDIA_KEY]',
    },
    minutes: 6,
  }),
  envelope({
    label: 'imagem-cliente',
    messageType: 'ImageMessage',
    mediaType: 'image',
    content: {
      mimetype: 'image/jpeg',
      fileName: 'fachada-unidade.jpg',
      url: 'https://example.invalid/uazapi/temp/fachada.jpg?token=[REDACTED]',
    },
    minutes: 9,
  }),
  envelope({
    label: 'documento-cliente',
    messageType: 'DocumentMessage',
    mediaType: 'document',
    content: {
      mimetype: 'application/pdf',
      fileName: 'escopo-preliminar.pdf',
      url: 'https://example.invalid/uazapi/temp/escopo.pdf?token=[REDACTED]',
    },
    minutes: 12,
  }),
  envelope({
    label: 'grupo-bloqueado',
    isGroup: true,
    text: 'Mensagem de grupo que deve ser ignorada na etapa inicial.',
    minutes: 15,
  }),
  envelope({
    label: 'duplicidade-recebida-texto',
    text: 'Bom dia, gostaria de entender a proposta de terceirização para limpeza e portaria.',
    minutes: 16,
  }),
  {
    EventType: 'messages_update',
    instanceName: INSTANCE_NAME,
    owner: OWNER,
    message: {
      messageid: id('recebida-texto'),
      status: 'READ',
      chatid: PRIVATE_CHAT_ID,
      fromMe: false,
      isGroup: false,
      timestamp: at(20),
    },
  },
]

function summary() {
  return payloads.map((payload) => ({
    eventType: payload.EventType,
    messageId: payload.message?.messageid,
    fromMe: payload.message?.fromMe === true,
    isGroup: payload.message?.isGroup === true,
    messageType: payload.message?.messageType || 'status',
    mediaType: payload.message?.mediaType || '',
  }))
}

if (require.main === module) {
  const mode = process.argv[2] || 'summary'
  if (mode === 'json') {
    process.stdout.write(`${JSON.stringify(payloads, null, 2)}\n`)
  } else {
    process.stdout.write(`${JSON.stringify(summary(), null, 2)}\n`)
  }
}

module.exports = { payloads, summary }
