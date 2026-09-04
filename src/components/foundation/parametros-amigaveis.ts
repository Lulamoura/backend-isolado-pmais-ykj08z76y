export type ParametroControle = 'booleano' | 'numero' | 'selecao'

export interface ParametroOpcao {
  valor: string
  rotulo: string
}

export interface ParametroAmigavel {
  chave: string
  titulo: string
  descricao: string
  controle: ParametroControle
  unidade?: string
  recomendado?: string
  alerta?: string
  opcoes?: ParametroOpcao[]
}

export interface GrupoParametrosAmigaveis {
  id: string
  titulo: string
  descricao: string
  parametros: ParametroAmigavel[]
}

const booleano = (
  chave: string,
  titulo: string,
  descricao: string,
  extras: Pick<ParametroAmigavel, 'alerta' | 'recomendado'> = {},
): ParametroAmigavel => ({ chave, titulo, descricao, controle: 'booleano', ...extras })

const numero = (
  chave: string,
  titulo: string,
  descricao: string,
  unidade: string,
  recomendado?: string,
): ParametroAmigavel => ({
  chave,
  titulo,
  descricao,
  controle: 'numero',
  unidade,
  recomendado,
})

export const GRUPOS_PARAMETROS_AMIGAVEIS: GrupoParametrosAmigaveis[] = [
  {
    id: 'propostas',
    titulo: 'Propostas',
    descricao: 'Publicação, envio, acesso do cliente e limites dos documentos.',
    parametros: [
      booleano(
        'proposta.pagina_publica_habilitada',
        'Página pública de propostas',
        'Permite que clientes acessem propostas publicadas pelo link recebido.',
        { alerta: 'Ao desligar, os links públicos deixam de funcionar.' },
      ),
      booleano(
        'proposta.email_habilitado',
        'Envio de proposta por e-mail',
        'Permite enviar ao cliente o e-mail com o link da proposta.',
        { alerta: 'Ao desligar, novos e-mails de proposta não serão enviados.' },
      ),
      booleano(
        'proposta.email_notificar_remetente_abertura',
        'Avisar o remetente na primeira abertura',
        'Envia um único e-mail ao usuário que publicou a proposta quando o cliente a abrir pela primeira vez.',
        { recomendado: 'Ligado' },
      ),
      booleano(
        'proposta.identificacao_visitante_obrigatoria',
        'Identificar quem abriu a proposta',
        'Solicita a identificação do visitante antes de exibir o conteúdo da proposta.',
      ),
      booleano(
        'proposta.aprovacao_interna_obrigatoria',
        'Exigir aprovação antes da publicação',
        'Impede a publicação até que a proposta tenha a aprovação interna exigida.',
      ),
      numero(
        'proposta.link_expiracao_dias',
        'Validade do link da proposta',
        'Define por quantos dias o link público poderá ser acessado.',
        'dias',
        '30 dias',
      ),
      numero(
        'proposta.pdf_tamanho_max_mb',
        'Tamanho máximo do PDF',
        'Limita o tamanho do arquivo PDF anexado à proposta.',
        'MB',
        '20 MB',
      ),
      numero(
        'proposta.sem_abertura_dias_uteis',
        'Alertar proposta ainda não aberta após',
        'Inclui na Operação do Dia propostas enviadas que continuam sem abertura.',
        'dias úteis',
        '2 dias úteis',
      ),
    ],
  },
  {
    id: 'notificacoes',
    titulo: 'Notificações de abertura',
    descricao: 'Defina quem acompanha a abertura das propostas no sistema.',
    parametros: [
      booleano(
        'proposta.notificar_responsavel_abertura',
        'Notificar o responsável pelo negócio',
        'Mostra a abertura para o usuário responsável pelo negócio.',
        { recomendado: 'Ligado' },
      ),
      booleano(
        'proposta.notificar_gestor_abertura',
        'Notificar gestores da equipe',
        'Mostra a abertura para os gestores da equipe do responsável.',
      ),
      booleano(
        'proposta.notificar_superadmin_abertura',
        'Notificar superadministradores',
        'Mostra a abertura para todos os usuários SuperAdmin.',
      ),
    ],
  },
  {
    id: 'prazos',
    titulo: 'Prazos comerciais',
    descricao: 'Prazos usados nos alertas e na priorização da Operação do Dia.',
    parametros: [
      numero(
        'sla.lead_dias_uteis',
        'Prazo para tratar novo prospect',
        'Tempo disponível para realizar a primeira tratativa de um novo prospect.',
        'dias úteis',
      ),
      numero(
        'sla.proposta_dias_uteis',
        'Prazo para produzir a proposta',
        'Tempo disponível para concluir a produção da proposta.',
        'dias úteis',
      ),
      numero(
        'sla.negociacao_dias_uteis',
        'Prazo para acompanhar a negociação',
        'Intervalo até o primeiro acompanhamento de uma negociação.',
        'dias úteis',
      ),
      numero(
        'sla.alerta_antecedencia_dias_uteis',
        'Antecedência dos alertas',
        'Quantos dias úteis antes do vencimento o sistema começa a alertar.',
        'dias úteis',
      ),
    ],
  },
  {
    id: 'padroes',
    titulo: 'Padrões comerciais',
    descricao: 'Valores aplicados automaticamente ao criar usuários ou negócios.',
    parametros: [
      {
        chave: 'comercial.etapa_padrao',
        titulo: 'Etapa inicial de novos negócios',
        descricao: 'Etapa em que um novo negócio entra no pipeline comercial.',
        controle: 'selecao',
        recomendado: 'Prospects',
        opcoes: [
          { valor: 'prospects', rotulo: 'Prospects' },
          { valor: 'producao_proposta', rotulo: 'Produção de proposta' },
          { valor: 'negociacao', rotulo: 'Negociação' },
        ],
      },
      {
        chave: 'comercial.escopo_padrao',
        titulo: 'Visibilidade inicial dos negócios',
        descricao: 'Define quais negócios um novo usuário visualiza por padrão.',
        controle: 'selecao',
        recomendado: 'Somente os próprios negócios',
        opcoes: [
          { valor: 'proprios', rotulo: 'Somente os próprios negócios' },
          { valor: 'equipe', rotulo: 'Negócios da equipe' },
          { valor: 'todos', rotulo: 'Todos os negócios' },
        ],
      },
      {
        chave: 'comercial.moeda',
        titulo: 'Moeda dos valores comerciais',
        descricao: 'Moeda usada para exibir valores de negócios e propostas.',
        controle: 'selecao',
        recomendado: 'Real brasileiro',
        opcoes: [{ valor: 'BRL', rotulo: 'Real brasileiro (R$)' }],
      },
    ],
  },
]

export const CHAVES_AMIGAVEIS = new Set(
  GRUPOS_PARAMETROS_AMIGAVEIS.flatMap((grupo) =>
    grupo.parametros.map((parametro) => parametro.chave),
  ),
)
