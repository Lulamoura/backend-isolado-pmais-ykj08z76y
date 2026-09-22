const fs = require('fs')
const assert = require('assert')

const layout = fs.readFileSync('src/components/Layout.tsx', 'utf8')
const app = fs.readFileSync('src/App.tsx', 'utf8')
const navigation = fs.readFileSync('src/lib/navigation.ts', 'utf8')
const packageJson = fs.readFileSync('package.json', 'utf8')

assert.match(navigation, /Curadoria Nexo/, 'menu principal deve declarar Curadoria Nexo')
assert.match(navigation, /\/nexo\/curadoria/, 'menu deve apontar para /nexo/curadoria')
assert.match(
  navigation,
  /MessageSquareText|MessagesSquare|BookOpenCheck/,
  'menu deve usar ícone próprio de curadoria',
)

assert.match(
  layout,
  /CURADORIA_NEXO_ALLOWLIST/,
  'Layout deve ter allowlist explícita para curadoria',
)
assert.match(
  layout,
  /'superadministrador'[\s\S]{0,120}'gestor-comercial'[\s\S]{0,120}'leitura-executiva'/,
  'Curadoria Nexo deve ficar para SuperAdmin, Gestor Comercial e Leitura Executiva',
)
assert.doesNotMatch(
  layout,
  /CURADORIA_NEXO_ALLOWLIST[\s\S]{0,140}'gestor'[,\n\r]/,
  'Curadoria Nexo não deve liberar o perfil genérico gestor',
)
assert.match(
  layout,
  /podeVerCuradoriaNexo/,
  'Layout deve calcular visibilidade do canal de curadoria',
)
assert.match(
  layout,
  /curadoriaNexoPendencias/,
  'Layout deve expor indicador de pendências da curadoria',
)
assert.match(
  layout,
  /aria-label=\{`Curadoria Nexo: \$\{curadoriaNexoPendencias\} pendência\(s\) para tratar`\}/,
  'indicador deve ser acessível e explicar pendências',
)
assert.match(
  layout,
  /item\.path === '\/nexo\/curadoria'/,
  'indicador deve estar preso ao item Curadoria Nexo',
)

assert.match(app, /NexoCuradoria/, 'App deve importar a página NexoCuradoria')
assert.match(app, /path="\/nexo\/curadoria"/, 'App deve registrar rota exclusiva de curadoria')
assert.match(app, /NexoCuradoriaRoute/, 'rota deve ter gate específico para usuários habilitados')

const pagePath = 'src/pages/NexoCuradoria.tsx'
const servicePath = 'src/services/nexo-curadoria.ts'
const migrationPath = 'pocketbase/migrations/202609191230_nexo_curadoria_entrevistas.js'
assert.ok(fs.existsSync(pagePath), 'deve existir página NexoCuradoria')
assert.ok(fs.existsSync(servicePath), 'deve existir serviço da curadoria Nexo')
assert.ok(
  fs.existsSync(migrationPath),
  'deve existir migração da coleção de entrevistas de curadoria',
)
const page = fs.readFileSync(pagePath, 'utf8')
const service = fs.readFileSync(servicePath, 'utf8')
const migration = fs.readFileSync(migrationPath, 'utf8')
assert.match(page, /Iniciar curadoria/, 'página deve ter botão para iniciar curadoria')
assert.match(page, /Começar entrevista/, 'página deve ter botão para começar a entrevista')
assert.match(
  page,
  /setEtapaEntrevista\(1\)/,
  'botão Começar entrevista deve avançar para a primeira etapa',
)
assert.match(
  page,
  /Pergunta \{etapaEntrevista\} de \{perguntasEntrevista.length\}/,
  'entrevista deve exibir progresso de perguntas',
)
assert.match(page, /Próxima pergunta/, 'entrevista deve permitir avançar pergunta a pergunta')
assert.match(page, /Enviar para revisão/, 'entrevista deve encerrar com envio para revisão')
assert.match(
  page,
  /salvarEntrevistaCuradoriaNexo/,
  'envio final deve gravar a entrevista estruturada',
)
assert.match(
  page,
  /pendenciaSelecionada/,
  'entrevista deve estar vinculada a uma pendência da curadoria',
)
assert.match(
  page,
  /Entrevista enviada para revisão/,
  'página deve confirmar envio real para revisão',
)
assert.match(page, /entrevista guiada/i, 'página deve explicar que é entrevista guiada')
assert.match(
  page,
  /conhecimento operacional/i,
  'página deve usar conhecimento operacional como termo adequado ao time',
)
assert.doesNotMatch(
  page,
  /segundo cérebro/i,
  'página não deve expor o termo segundo cérebro para o time',
)
assert.match(
  page,
  /Entrevistas para alinhamento de processos comerciais/,
  'governança deve usar linguagem operacional',
)
assert.match(
  page,
  /Espaço para ajuda aberta em decisões estratégicas e operacionais/,
  'canal guiado deve indicar ajuda aberta para decisão',
)
assert.match(page, /Aguardando curadoria/, 'página deve listar pendências de curadoria')
assert.match(
  page,
  /Notas do negócio/,
  'pendência de curadoria deve oferecer botão de Notas para abrir histórico completo',
)
assert.match(
  page,
  /Motivo da curadoria/,
  'card de curadoria deve explicar por que o caso foi para curadoria',
)
assert.match(
  page,
  /listarNotasCuradoriaNexo/,
  'botão Notas da curadoria deve carregar as notas completas pelo contexto do Nexo',
)
assert.match(
  page,
  /textoContextoSemResumoDeNotas/,
  'card de curadoria deve ocultar resumo parcial de notas e deixar o histórico no botão Notas',
)
assert.match(
  page,
  /consultas agrupadas neste negócio/,
  'página deve sinalizar quando várias consultas viraram uma entrevista consolidada',
)
assert.match(
  page,
  /Entrevistar sobre este negócio/,
  'entrevista deve ser global por negócio, não repetida por cada consulta',
)
assert.match(
  page,
  /Qual orientação comercial única deve valer para este negócio ou situação consolidada/,
  'entrevista deve ser mais global e objetiva para consultas agrupadas',
)
assert.match(
  page,
  /max-h-56 overflow-y-auto whitespace-pre-wrap break-words/,
  'pendência de curadoria deve mostrar o material completo com rolagem, sem cortar o conteúdo',
)
assert.doesNotMatch(
  page,
  /line-clamp-2[\s\S]{0,180}\{item\.contexto_resumo\}/,
  'pendência de curadoria não deve truncar o material solicitado',
)
assert.match(page, /empresa_nome/, 'página deve priorizar nome da empresa na citação do negócio')
assert.match(page, /contato_nome/, 'página deve priorizar contato na citação do negócio')
assert.doesNotMatch(
  page,
  /Digite aqui qualquer coisa para treinar o Nexo/i,
  'página não pode incentivar canal livre sem padrão',
)

assert.match(
  service,
  /buscarEntrevistaExistenteCuradoriaNexo/,
  'serviço deve consultar entrevistas já abertas antes de listar pendência',
)
assert.match(
  service,
  /filtrarEventosAguardandoCuradoria/,
  'resumo de curadoria deve filtrar somente eventos realmente aguardando entrevista',
)
assert.match(
  service,
  /motivoCuradoriaPadrao/,
  'serviço deve descrever o motivo da curadoria inclusive para registros antigos',
)

assert.match(
  service,
  /triagem_status = 'curadoria_necessaria'/,
  'fila deve listar somente sinais classificados como curadoria necessária',
)
assert.doesNotMatch(
  service,
  /Origem determinística: pedido de ajuda registrado no canal/,
  'pedido de ajuda não deve mais ser tratado como motivo determinístico de curadoria',
)
assert.doesNotMatch(
  service,
  /orientação única para o caso/,
  'motivo consolidado não deve sugerir resposta única para canais distintos',
)
assert.doesNotMatch(
  service,
  /Curadoria solicitada porque a orientação pode virar regra, playbook ou aprendizado operacional/,
  'motivo não deve usar justificativa genérica de regra ou aprendizado operacional',
)
assert.match(
  service,
  /listarNotasCuradoriaNexo/,
  'serviço da curadoria deve expor carregamento do histórico completo de notas do negócio',
)
assert.match(
  service,
  /buscarContextoNegocioCuradoriaNexo/,
  'serviço da curadoria deve buscar contexto atualizado do negócio para descrição e notas',
)
assert.match(
  service,
  /notas_followups: contexto\.notas_followups \|\| \[\]/,
  'resumo da curadoria deve carregar notas completas junto da pendência para o botão Notas',
)
assert.match(
  page,
  /notasIniciais=\{item\.notas_followups \|\| \[\]\}/,
  'botão Notas deve usar o histórico já carregado no resumo da curadoria',
)
assert.match(
  service,
  /campos_crm\?\.detalhamento_proposta/,
  'curadoria deve usar detalhamento da proposta do CRM quando a descrição principal vier vazia',
)
assert.match(
  service,
  /Descrição: não informada/,
  'curadoria deve corrigir a descrição não informada quando houver descrição no CRM',
)
assert.match(
  service,
  /consolidarEventosAguardandoCuradoria/,
  'resumo de curadoria deve consolidar múltiplas consultas do mesmo negócio em uma pendência única',
)
assert.match(
  service,
  /chaveCuradoriaEvento/,
  'consolidação deve agrupar por negócio quando houver external_id',
)
assert.match(
  service,
  /pendencias: itensConsolidados\.length/,
  'contador da curadoria deve refletir o total consolidado, não apenas o limite solicitado pelo menu',
)
assert.match(
  service,
  /itens: itensConsolidados\.slice\(0, limit\)/,
  'lista visual pode respeitar limite sem quebrar o contador total da notificação',
)
assert.match(
  service,
  /!decisaoOuEntrevistaExistente\(decisao, entrevista\)/,
  'evento já entrevistado ou escalado não deve continuar na fila aguardando curadoria',
)
assert.doesNotMatch(
  service,
  /decisaoTerminal/,
  'fila aguardando curadoria não deve depender apenas de decisão terminal',
)
assert.match(
  service,
  /com_nexo_curadoria_entrevistas/,
  'serviço deve gravar em coleção própria de entrevistas',
)
assert.match(
  service,
  /salvarEntrevistaCuradoriaNexo/,
  'serviço deve expor função de salvar entrevista',
)
assert.match(service, /evento_id/, 'entrevista deve referenciar o evento de curadoria')
assert.match(
  service,
  /respostas_json/,
  'entrevista deve persistir perguntas e respostas estruturadas',
)
assert.match(
  service,
  /status[\s\S]{0,80}aguardando_revisao/,
  'entrevista deve nascer aguardando revisão',
)
assert.match(
  migration,
  /com_nexo_curadoria_entrevistas/,
  'migração deve criar coleção de entrevistas',
)
assert.match(
  migration,
  /createRule:\s*perfisCuradoria/,
  'usuários habilitados devem poder criar entrevistas',
)
assert.match(migration, /gestor-comercial/, 'regra de criação deve incluir gestor-comercial')
assert.match(
  migration,
  /updateRule:\s*null/,
  'entrevistas não devem aceitar atualização direta pelo cliente',
)
assert.match(
  migration,
  /deleteRule:\s*null/,
  'entrevistas não devem aceitar exclusão direta pelo cliente',
)

const decisaoMigrationPath = 'pocketbase/migrations/202609191330_nexo_curadoria_decisoes.js'
assert.ok(
  fs.existsSync(decisaoMigrationPath),
  'deve existir migração da coleção de decisões superiores',
)
const decisaoMigration = fs.readFileSync(decisaoMigrationPath, 'utf8')
assert.doesNotMatch(
  page,
  /Canal de decisão superior/,
  'card informativo sem ação não deve ocupar a tela principal',
)
assert.doesNotMatch(
  page,
  /Regras propostas para validação sobem para gestão ou direção/,
  'texto explicativo sem ação não deve interromper o fluxo operacional',
)
assert.match(
  page,
  /Decisões aguardando validação superior/,
  'página deve listar decisões aguardando validação superior',
)
const ordemAguardando = page.indexOf('Aguardando curadoria')
const ordemDecisaoSuperior = page.indexOf('Decisões aguardando validação superior')
const ordemIpcp = page.indexOf('Proposta de alteração da fórmula IPCP')
assert.ok(
  ordemAguardando >= 0 &&
    ordemDecisaoSuperior > ordemAguardando &&
    ordemIpcp > ordemDecisaoSuperior,
  'ordem principal deve ser Aguardando curadoria → Decisões aguardando validação superior → Proposta de alteração da fórmula IPCP',
)
assert.match(
  page,
  /revisaoTerminal \? 'border-emerald-200 p-3' : 'border-amber-200 p-4'/,
  'proposta IPCP encerrada deve ficar compacta na tela',
)
assert.match(
  page,
  /Ações bloqueadas para evitar nova alteração/,
  'card IPCP encerrado deve resumir bloqueio de novas ações',
)
assert.match(
  page,
  /Versão governada ativa para os próximos cálculos diários/,
  'card IPCP encerrado deve resumir aplicação da fórmula governada',
)
assert.match(page, /Histórico de decisões/, 'página deve ter botão/modal de histórico de decisões')
assert.match(
  page,
  /Proposta de alteração da fórmula IPCP/,
  'página deve ter painel específico de proposta de alteração da fórmula IPCP',
)
assert.match(
  page,
  /Pendente de decisão/,
  'proposta de alteração IPCP deve usar status pendente de decisão',
)
assert.doesNotMatch(
  page,
  /Pendente para Lula\/direção/,
  'UI não deve exibir Pendente para Lula/direção',
)
assert.match(
  page,
  /Aprovar e aplicar alteração de fórmula/,
  'revisão IPCP deve permitir aprovação explícita e aplicação governada da alteração de fórmula',
)
assert.match(
  page,
  /Fórmula aplicada/,
  'revisão IPCP aprovada deve continuar visível como fórmula aplicada',
)
assert.match(
  page,
  /alteracao_formula_aprovada/,
  'aprovação da alteração deve gravar status estruturado',
)
assert.match(
  page,
  /setRevisoesIpcpPendentes[\s\S]{0,220}\[atualizada, \.\.\.semAtual\]/,
  'aprovar alteração de fórmula não deve remover imediatamente a proposta da seção',
)
assert.match(page, /Ajuste as condições da regra/, 'revisão IPCP deve abrir ajuste das condições')
assert.match(
  page,
  /abrirAjusteRevisaoIpcp/,
  'botão de ajuste IPCP deve abrir modal visível de ajuste',
)
assert.match(
  page,
  /Ajustar condições da regra IPCP/,
  'modal de ajuste IPCP deve ficar visível ao decisor',
)
assert.match(
  page,
  /Regra e condições a ajustar/,
  'modal deve permitir alterar a regra e as condições',
)
assert.match(
  page,
  /salvarAjusteRevisaoIpcp/,
  'ajuste IPCP deve salvar motivo/condições antes de atualizar status',
)
assert.match(
  page,
  /ajuste_solicitado/,
  'Pedir ajuste deve registrar status estruturado de ajuste solicitado',
)
assert.match(page, /Ajuste solicitado/, 'Pedir ajuste deve deixar status visível para o decisor')
assert.match(
  page,
  /Rejeitar alteração da fórmula/,
  'revisão IPCP deve permitir rejeitar alteração da fórmula',
)
assert.match(
  page,
  /setCondicoesAjusteIpcp\(decisao\.regra_proposta \|\| decisao\.ipcp_revisao_motivo \|\| ''\)/,
  'modal de ajuste IPCP deve vir preenchida primeiro com a regra aprovada',
)
assert.match(
  page,
  /Alteração aplicada com segurança/,
  'UI deve mostrar aprovação aplicada em linguagem humana',
)
assert.match(
  page,
  /Versão ativa/,
  'UI deve mostrar a versão ativa sem expor apenas dado técnico isolado',
)
assert.match(
  page,
  /Aprovada por/,
  'UI deve mostrar responsável humano pela aprovação quando disponível',
)
assert.match(
  page,
  /Decisão encerrada/,
  'UI deve informar que a proposta aprovada ou rejeitada está encerrada',
)
assert.match(page, /revisaoIpcpTerminal/, 'UI deve tratar aprovação/rejeição como estado terminal')
assert.match(
  page,
  /versão governada da fórmula IPCP/,
  'UI deve deixar claro que aprovar aplica versão governada da fórmula',
)
assert.match(
  page,
  /obterHistoricoDecisoesSuperioresCuradoriaNexo/,
  'página deve carregar histórico de decisões superiores',
)
assert.match(page, /decisoesHistorico/, 'página deve manter estado do histórico de decisões')
assert.match(page, /setHistoricoAberto\(true\)/, 'tela principal deve abrir histórico por botão')
assert.match(
  page,
  /<Dialog open=\{Boolean\(historicoAberto\)\}/,
  'histórico resumido deve ficar dentro de modal',
)
assert.match(page, /Ver detalhes/, 'histórico deve ficar resumido e abrir detalhes sob demanda')
assert.match(
  page,
  /Detalhe da decisão superior/,
  'histórico completo deve ficar em modal de detalhe',
)
assert.match(
  page,
  /Retirar do uso operacional/,
  'histórico deve permitir rejeitar decisão já aprovada',
)
assert.match(
  page,
  /Revisar decisão/,
  'histórico deve permitir ajustar decisão já aprovada ou rejeitada',
)
assert.match(
  page,
  /sai do uso operacional/,
  'UI deve explicar consequência de rejeitar decisão aprovada',
)
assert.match(
  page,
  /Ação necessária/,
  'card de decisão deve deixar clara a ação necessária ao decisor',
)
assert.match(page, /Motivo da escalada/, 'card de decisão deve explicar motivo da escalada')
assert.match(page, /Aprovar/, 'decisor deve ver ação de aprovar')
assert.match(page, /Ajustar/, 'decisor deve ver ação de ajustar')
assert.match(page, /Rejeitar/, 'decisor deve ver ação de rejeitar')
assert.match(
  page,
  /aprovarDecisaoSuperior/,
  'botão Aprovar deve executar atualização real da decisão',
)
assert.match(page, /ajustarDecisaoSuperior/, 'botão Ajustar deve abrir ajuste real da decisão')
assert.match(
  page,
  /rejeitarDecisaoSuperior/,
  'botão Rejeitar deve executar atualização real da decisão',
)
assert.match(
  page,
  /salvarAjusteDecisaoSuperior/,
  'ajuste de decisão existente deve ser salvo sem criar nova resposta do zero',
)
assert.match(
  page,
  /Ajuste da decisão superior/,
  'página deve ter formulário de ajuste da decisão existente',
)
assert.match(page, /Decisão rejeitada/, 'página deve explicar resultado do botão Rejeitar')
assert.match(
  page,
  /Decisão aprovada para uso operacional/,
  'página deve explicar resultado do botão Aprovar',
)
assert.match(page, /decisoesSuperiores/, 'página deve manter estado da fila superior')
assert.match(
  page,
  /obterDecisoesSuperioresCuradoriaNexo/,
  'página deve carregar decisões superiores do serviço',
)
assert.match(page, /resumoDecisaoSuperior/, 'página deve montar citação humana da decisão superior')
assert.match(
  page,
  /Encaminhar para decisão superior/,
  'entrevista deve permitir encaminhar regra candidata para decisão superior',
)
assert.match(
  page,
  /Já existe decisão superior para este caso/,
  'página deve avisar quando já existe decisão para o caso',
)
assert.match(
  page,
  /Ajustar decisão existente/,
  'caso já respondido deve permitir ajuste, não nova resposta do zero',
)
assert.match(
  page,
  /decisaoExistenteParaPendencia/,
  'página deve detectar decisão existente para a pendência',
)
assert.match(
  page,
  /salvandoDecisaoSuperior \|\|\s*decisaoSuperiorSalva \|\|\s*Boolean\(decisaoExistenteParaPendencia\)/,
  'botão de encaminhamento deve bloquear duplicidade',
)
assert.match(page, /classificarImpactoDecisaoNexo/, 'página deve classificar impacto da decisão')
assert.match(
  page,
  /funil|risco|perda|indicador|política comercial/i,
  'página deve indicar critérios de escalonamento comercial',
)
assert.match(
  service,
  /com_nexo_curadoria_decisoes/,
  'serviço deve gravar decisões superiores em coleção própria',
)
assert.match(
  service,
  /salvarDecisaoSuperiorCuradoriaNexo/,
  'serviço deve expor função de salvar decisão superior',
)
assert.match(
  service,
  /atualizarDecisaoSuperiorCuradoriaNexo/,
  'serviço deve expor função de atualizar aprovação, ajuste ou rejeição',
)
assert.match(
  service,
  /aprovada_uso_operacional/,
  'serviço deve aceitar status de aprovação operacional',
)
assert.match(service, /rejeitada/, 'serviço deve aceitar status de rejeição')
assert.match(
  page,
  /decisoesRelacionadas/,
  'Aguardando curadoria deve preservar leitura de decisões relacionadas fora da fila aberta',
)
assert.match(
  page,
  /\[\.\.\.decisoesSuperiores, \.\.\.decisoesRelacionadas\]/,
  'card de curadoria deve usar decisão relacionada em revisão para ajuste em vez de resposta do zero',
)
assert.match(
  service,
  /filtrarEventosAguardandoCuradoria/,
  'serviço deve retirar da fila de curadoria casos já entrevistados ou escalados',
)
assert.match(
  service,
  /buscarEntrevistaExistenteCuradoriaNexo/,
  'entrevista já respondida deve encerrar a pendência aberta de curadoria',
)
assert.doesNotMatch(
  service,
  /status != 'rejeitada'/,
  'decisão rejeitada não deve reabrir resposta do zero para o mesmo caso',
)
assert.match(
  service,
  /buscarDecisaoSuperiorExistenteCuradoriaNexo/,
  'serviço deve buscar decisão existente antes de gravar nova',
)
assert.match(
  service,
  /throw new Error\('DECISAO_SUPERIOR_DUPLICADA'\)/,
  'serviço deve bloquear duplicidade decisória',
)
assert.match(
  service,
  /obterDecisoesSuperioresCuradoriaNexo/,
  'serviço deve listar decisões superiores para o decisor',
)
assert.match(
  service,
  /obterHistoricoDecisoesSuperioresCuradoriaNexo/,
  'serviço deve listar histórico de decisões superiores',
)
assert.match(service, /decisaoHomologacao/, 'serviço deve reconhecer registros de homologação')
assert.match(
  service,
  /!decisaoHomologacao/,
  'listas visíveis devem ocultar registros de homologação do histórico e filas',
)
assert.match(
  service,
  /sincronizarDecisaoSegundoCerebroCuradoriaNexo/,
  'serviço deve acionar sincronização governada com o segundo cérebro',
)
assert.match(
  service,
  /obterRevisoesIpcpPendentesCuradoriaNexo/,
  'serviço deve listar revisões IPCP pendentes para decisores',
)
assert.match(
  service,
  /atualizarRevisaoIpcpCuradoriaNexo/,
  'serviço deve atualizar revisão IPCP por rota backend protegida',
)
assert.match(
  service,
  /decisaoPodeImpactarIpcp/,
  'serviço deve identificar decisões com possível impacto no IPCP',
)
assert.match(service, /ipcp_revisao_status/, 'decisão deve registrar status da revisão IPCP')
assert.match(
  service,
  /\/backend\/v1\/nexo\/curadoria\/decisoes\/\$\{id\}\/segundo-cerebro/,
  'serviço deve usar rota backend protegida para segundo cérebro',
)
assert.match(
  service,
  /aprovada_uso_operacional' \|\| status = 'rejeitada/,
  'histórico deve incluir aprovadas e rejeitadas',
)
assert.match(
  service,
  /status = 'aguardando_revisao'/,
  'listagem deve buscar decisões aguardando revisão',
)
assert.match(service, /nivel_decisao/, 'decisão deve registrar nível gestor ou direção')
assert.match(service, /regra_proposta/, 'decisão deve registrar regra proposta')
assert.match(service, /impacto_json/, 'decisão deve registrar impacto estruturado')
assert.match(
  service,
  /status[\s\S]{0,80}aguardando_revisao/,
  'decisão deve nascer aguardando revisão',
)
assert.match(
  decisaoMigration,
  /com_nexo_curadoria_decisoes/,
  'migração deve criar coleção de decisões superiores',
)
assert.match(
  decisaoMigration,
  /perfisDecisaoSuperior/,
  'decisão superior deve ter regra própria de perfil',
)
assert.match(decisaoMigration, /superadministrador/, 'decisão superior deve incluir SuperAdmin')
assert.match(
  decisaoMigration,
  /leitura-executiva/,
  'decisão superior deve incluir Leitura Executiva',
)
assert.doesNotMatch(
  decisaoMigration,
  /perfisDecisaoSuperior[\s\S]{0,220}gestor-comercial/,
  'decisão superior não deve incluir Gestor Comercial',
)
assert.match(decisaoMigration, /nivel_decisao/, 'coleção deve ter nível de decisão')
assert.match(
  decisaoMigration,
  /escalar_direcao/,
  'coleção deve permitir marcação de escalonamento para direção',
)
assert.match(
  decisaoMigration,
  /decisao_observacao/,
  'decisão deve armazenar observação da aprovação/rejeição/ajuste',
)
assert.match(
  decisaoMigration,
  /segundo_cerebro_status/,
  'decisão deve armazenar status da ligação com o conhecimento operacional',
)
assert.match(
  decisaoMigration,
  /segundo_cerebro_audit_id/,
  'decisão deve armazenar auditoria da ligação com o conhecimento operacional',
)
assert.match(
  decisaoMigration,
  /segundo_cerebro_atualizado_em/,
  'decisão deve armazenar data da última ligação com o conhecimento operacional',
)
assert.match(
  decisaoMigration,
  /ipcp_revisao_status/,
  'decisão deve armazenar status da revisão IPCP',
)
assert.match(
  decisaoMigration,
  /ipcp_revisao_blocos/,
  'decisão deve armazenar blocos IPCP possivelmente afetados',
)
assert.match(
  decisaoMigration,
  /ipcp_revisao_notificado_em/,
  'decisão deve armazenar data de notificação IPCP',
)
assert.match(
  decisaoMigration,
  /listRule:\s*perfisDecisaoSuperior/,
  'somente decisão superior deve listar decisões superiores',
)
assert.match(
  decisaoMigration,
  /viewRule:\s*perfisDecisaoSuperior/,
  'somente decisão superior deve visualizar decisões superiores',
)
assert.match(
  decisaoMigration,
  /updateRule:\s*perfisDecisaoSuperior/,
  'somente decisão superior deve atualizar decisão',
)
assert.match(
  decisaoMigration,
  /CREATE UNIQUE INDEX idx_com_nexo_curadoria_decisoes_unico_evento_aberto/,
  'schema deve bloquear mais de uma decisão aberta por evento',
)
assert.match(
  decisaoMigration,
  /CREATE UNIQUE INDEX idx_com_nexo_curadoria_decisoes_unico_external_aberto/,
  'schema deve bloquear mais de uma decisão aberta por negócio',
)
assert.match(
  decisaoMigration,
  /deleteRule:\s*null/,
  'decisões superiores não devem aceitar exclusão direta pelo cliente',
)

assert.match(
  packageJson,
  /test-nexo-curadoria-ui-contract\.cjs/,
  'npm test deve encadear contrato da curadoria Nexo',
)

const hook = fs.readFileSync('pocketbase/hooks/com_propostas_operacao.js', 'utf8')
const centralHook = fs.readFileSync('pocketbase/hooks/com_nexo_central_operacional.js', 'utf8')

assert.match(
  hook,
  /campos\.descricao_negocio \|\| negocio\.descricao_negocio \|\| campos\.detalhamento_proposta/,
  'contexto do Nexo deve usar detalhamento do CRM como fallback para descrição do negócio',
)
assert.match(
  hook,
  /Notas\/follow-ups: consulte o botão Notas do negócio/,
  'curadoria deve orientar leitura do histórico completo pelo botão Notas, sem resumo parcial de notas',
)
assert.match(
  hook,
  /motivo_curadoria/,
  'evento de aprendizado deve persistir o motivo da curadoria',
)
assert.match(
  hook,
  /avaliacao_negocio_resumo/,
  'evento de aprendizado deve registrar avaliação do negócio acionada pelo pedido de ajuda',
)
assert.match(
  hook,
  /gatilhos_curadoria/,
  'evento de aprendizado deve registrar gatilhos qualificados quando houver curadoria',
)
assert.match(
  hook,
  /nexoMotivoCuradoriaAprendizado/,
  'hook deve gerar motivo de curadoria a partir do canal determinístico da solicitação',
)

assert.match(
  hook,
  /triagem_status/,
  'evento de ajuda do Nexo deve gravar status de triagem do sinal',
)
assert.match(
  hook,
  /nexoAvaliarNegocioParaAprendizado/,
  'pedido de ajuda deve acionar avaliação do negócio antes de decidir curadoria',
)
assert.match(
  hook,
  /human_review_required', Boolean\(avaliacaoNegocio\.curadoria_necessaria\)/,
  'pedido comum de ajuda não deve criar curadoria automaticamente',
)

assert.match(
  hook,
  /avaliacao_curadoria/,
  'Ajuda do Nexo deve pedir e processar avaliação estruturada da IA curadora',
)
assert.match(
  hook,
  /regra_pratica_relacionada/,
  'avaliação da IA curadora deve registrar regra ou prática relacionada quando houver curadoria',
)
assert.match(
  hook,
  /evidencia_curadoria/,
  'avaliação da IA curadora deve registrar evidência objetiva da divergência/lacuna/exceção',
)
assert.match(
  hook,
  /impacto_ipcp_potencial/,
  'avaliação da IA curadora deve sinalizar impacto potencial no IPCP sem alterar cálculo',
)
assert.match(
  hook,
  /Somente marque curadoria_necessaria como true/,
  'prompt deve impedir que todo pedido de ajuda vire curadoria automática',
)
assert.match(
  hook,
  /nexoNormalizarAvaliacaoCuradoria/,
  'hook deve normalizar avaliação da IA curadora antes de gravar o sinal',
)
assert.match(
  hook,
  /avaliacaoCuradoria\.curadoria_necessaria/,
  'human_review_required deve depender da avaliação da IA curadora, não do simples uso da ajuda',
)
assert.doesNotMatch(
  hook,
  /evento\.set\('human_review_required', true\)/,
  'hook não deve marcar todo pedido de ajuda como curadoria humana obrigatória',
)
assert.doesNotMatch(
  hook,
  /diagnóstico:|perguntas abertas:|risco apontado:|aprendizado operacional|playbook/,
  'motivo persistido não deve replicar conteúdo gerado nem justificar como regra/playbook',
)
assert.doesNotMatch(
  hook,
  /'Follow-ups\/notas: ' \+\s*nexoResumoNotasFollowupsCuradoria\(contextoSeguro\.notas_followups \|\| \[\]\)/,
  'contexto da curadoria não deve gravar uma seleção parcial de follow-ups como se fosse histórico suficiente',
)

assert.match(
  hook,
  /\/backend\/v1\/nexo\/curadoria\/decisoes\/\{id\}\/segundo-cerebro/,
  'hook deve expor rota protegida de ligação com segundo cérebro',
)
assert.match(
  hook,
  /\/v1\/comercial\/nexo\/curadoria\/decisao/,
  'hook deve chamar endpoint governado do PMais Agent Gateway',
)
assert.match(
  hook,
  /PMAIS_AGENT_GATEWAY_HMAC_SECRET/,
  'hook deve assinar chamada ao Gateway sem expor segredo',
)
assert.match(
  hook,
  /ipcp_revisao_status/,
  'sincronização deve marcar revisão IPCP pendente quando houver impacto',
)
assert.match(
  hook,
  /\/backend\/v1\/nexo\/curadoria\/decisoes\/\{id\}\/ipcp-revisao/,
  'hook deve expor rota protegida para tratar revisão IPCP',
)
assert.match(
  hook,
  /alteracao_formula_aprovada/,
  'hook deve aceitar aprovação explícita de alteração de fórmula IPCP',
)
assert.match(
  centralHook,
  /ipcp_revisoes_pendentes/,
  'consulta técnica Nexo deve expor revisões IPCP pendentes',
)
assert.match(
  centralHook,
  /nexo_ipcp_revisoes_pendentes_v1/,
  'consulta técnica deve ter contrato específico de revisão IPCP',
)
assert.match(
  centralHook,
  /formula_ipcp_exige_aprovacao_lula_direcao/,
  'consulta técnica deve preservar governança de aprovação Lula/direção',
)

console.log('nexo-curadoria-ui contract: PASS')
