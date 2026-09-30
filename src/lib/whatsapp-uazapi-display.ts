const RECIFE_TIME_ZONE = 'America/Recife'

function normalizarData(value: unknown): Date | null {
  if (typeof value !== 'string' || !value.trim()) return null
  const texto = value.trim()
  const iso = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(texto) ? texto.replace(' ', 'T') : texto
  const data = new Date(iso)
  return Number.isNaN(data.getTime()) ? null : data
}

export function formatarDataHoraRecife(value: unknown): string {
  const data = normalizarData(value)
  if (!data) return 'Não informada'
  const partes = new Intl.DateTimeFormat('pt-BR', {
    timeZone: RECIFE_TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(data)
  const valor = (tipo: Intl.DateTimeFormatPartTypes) =>
    partes.find((parte) => parte.type === tipo)?.value || ''
  return `${valor('day')}/${valor('month')}/${valor('year')} às ${valor('hour')}:${valor('minute')}`
}

export function ehOperadorComercial(label: unknown): boolean {
  if (typeof label !== 'string' || !label.trim()) return false
  const normalizado = label.trim().toLocaleLowerCase('pt-BR')
  return !(
    normalizado.includes('monitoramento') ||
    normalizado.includes('forwarder') ||
    normalizado.includes('redirect') ||
    normalizado.includes('probe')
  )
}

function rotuloPorMapa(value: unknown, mapa: Record<string, string>, fallback: string): string {
  if (typeof value !== 'string' || !value.trim()) return fallback
  const chave = value.trim()
  return mapa[chave] || fallback
}

export function rotuloEventoWhatsApp(value: unknown): string {
  return rotuloPorMapa(
    value,
    {
      messages: 'Mensagem recebida',
      messages_update: 'Atualização de mensagem',
      connection: 'Atualização da conexão',
    },
    'Atividade recebida',
  )
}

export function rotuloDirecao(value: unknown): string {
  return rotuloPorMapa(
    value,
    {
      enviada_operadora: 'Enviada pela equipe comercial',
      recebida: 'Recebida do contato',
    },
    'Direção não informada',
  )
}

export function rotuloMidia(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return 'Sem mídia'
  const normalizado = value.trim().toLocaleLowerCase('pt-BR')
  if (normalizado.includes('audio')) return 'Áudio'
  if (normalizado.includes('image') || normalizado.includes('imagem')) return 'Imagem'
  if (normalizado.includes('video') || normalizado.includes('vídeo')) return 'Vídeo'
  if (normalizado.includes('document')) return 'Documento'
  return 'Arquivo'
}

export function rotuloEstadoOperacional(value: unknown): string {
  return rotuloPorMapa(
    value,
    {
      recebido: 'Recebido',
      capturada: 'Capturada',
      ignorado_grupo: 'Grupo ignorado pela política',
      pendente: 'Aguardando processamento',
      pendente_transcricao: 'Aguardando transcrição',
      transcrito: 'Transcrição concluída',
      concluido: 'Concluído',
      nao_aplicavel: 'Não se aplica',
      baixado: 'Arquivo recebido',
      erro: 'Falha no processamento',
    },
    'Situação não informada',
  )
}
