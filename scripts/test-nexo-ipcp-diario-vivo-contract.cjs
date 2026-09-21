const fs = require('node:fs')
const assert = require('node:assert/strict')

const hookPath = 'pocketbase/hooks/com_ipcp_diario.js'
assert.ok(fs.existsSync(hookPath), 'hook IPCP diário deve existir')

const hook = fs.readFileSync(hookPath, 'utf8')
const routeStart = hook.indexOf("'/backend/v1/nexo/ipcp/diario'")
assert.notEqual(routeStart, -1, 'deve expor GET /backend/v1/nexo/ipcp/diario para o Nexo')
const routeSource = hook.slice(Math.max(0, routeStart - 500), routeStart + 40000)

assert.match(
  routeSource,
  /routerAdd\(\s*'GET',\s*'\/backend\/v1\/nexo\/ipcp\/diario'/,
  'rota deve ser GET',
)
assert.match(routeSource, /\$apis\.requireAuth\('users'\)/, 'rota deve exigir autenticação users')
assert.match(
  routeSource,
  /contrato:\s*'nexo_ipcp_diario_v1'/,
  'deve declarar contrato estável do Nexo',
)
assert.match(routeSource, /read_only:\s*true/, 'deve declarar read_only=true')
assert.match(routeSource, /sem_mutacao:\s*true/, 'deve declarar sem_mutacao=true')
assert.match(
  routeSource,
  /fonte_dados:\s*'com_ipcp_snapshots'/,
  'deve ler a fonte viva controlada com_ipcp_snapshots',
)
assert.match(
  routeSource,
  /findRecordsByFilter\(\s*'com_ipcp_snapshots'/,
  'deve consultar snapshots IPCP vivos',
)
assert.match(
  routeSource,
  /buscarSnapshotsIpcp\(effectiveScope, ''\)/,
  'visão de equipe deve tentar snapshot consolidado quando não houver snapshot amarrado ao responsável',
)
assert.match(
  routeSource,
  /effectiveScope === 'todos'[\s\S]{0,220}buscarSnapshotsIpcp\('equipe', '__todos__'\)[\s\S]{0,220}buscarSnapshotsIpcp\('equipe', ''\)/,
  'visão Todos deve reutilizar a base consolidada diária, incluindo compatibilidade com consolidado antigo em equipe sem filtro de responsável',
)
assert.match(
  routeSource,
  /effectiveScope === 'proprio'[\s\S]{0,520}buscarSnapshotsIpcp\('equipe', responsavelId\)/,
  'perfil individual deve reutilizar histórico diário gravado como equipe + mesmo responsável quando ainda não houver snapshot proprio',
)
assert.match(
  routeSource,
  /escopoSnapshotEfetivo = 'equipe'[\s\S]{0,180}responsavelSnapshotEfetivo = responsavelId/,
  'fallback do perfil individual deve sinalizar que o histórico comparável veio do snapshot de equipe do próprio operador',
)
assert.match(
  routeSource,
  /effectiveScope|escopo_efetivo/,
  'deve resolver escopo efetivo por perfil',
)
assert.match(routeSource, /canViewTeam|podeVerEquipe/, 'deve proteger visão de equipe')
assert.match(routeSource, /canViewAll|podeVerTodos/, 'deve proteger visão todos')
assert.match(routeSource, /fallback_openai_bloqueado:\s*true/, 'deve bloquear fallback OpenAI')
assert.match(routeSource, /sem_crm_write:\s*true/, 'deve declarar ausência de escrita no CRM')
assert.match(routeSource, /sem_app_write:\s*true/, 'deve declarar ausência de escrita no app')
assert.match(routeSource, /sem_envio:\s*true/, 'deve declarar ausência de envio externo')
assert.match(
  routeSource,
  /payload|resumo|recomendacoes|evidencias/,
  'deve retornar resumo/evidências para o Nexo sem payload técnico bruto',
)
assert.match(
  routeSource,
  /JSON\.parse\(raw|JSON\.parse\(String\(raw\)/,
  'rota do Nexo deve decodificar payload JSON salvo no PocketBase',
)
assert.match(
  routeSource,
  /calcularPacoteIpcpDiarioVivo/,
  'rota do Nexo deve recalcular a leitura viva por escopo no GET',
)
assert.match(
  routeSource,
  /calcularQualidadeRegistroComercial/,
  'rota viva deve aplicar qualidade do registro comercial no bloco Registros e Aprendizados',
)
assert.match(
  routeSource,
  /function filtroResponsavelOperacional\(scope, responsavelId\)/,
  'rota viva deve ter filtro operacional dedicado para responsável selecionado',
)
assert.match(
  routeSource,
  /scope === 'equipe' && responsavelId[\s\S]{0,180}responsavel_id = '/,
  'escopo equipe com responsavel_id deve recalcular atividades, SLAs, propostas e fechamentos para o responsável selecionado',
)
assert.match(
  routeSource,
  /var filtroOperacional = filtroResponsavelOperacional\(scope, responsavelId\)/,
  'cálculo vivo deve aplicar o filtro do responsável nas coleções operacionais',
)
assert.match(
  routeSource,
  /function filtroPorNegocios\(campo, negocios\)/,
  'cálculo vivo deve montar filtros por negócios da carteira para coleções relacionadas',
)
assert.match(
  routeSource,
  /function negocioComputavelIpcp\(rec\)/,
  'análise gerencial deve separar negócios computáveis antes de calcular o IPCP',
)
assert.match(
  routeSource,
  /responsavel_id[\s\S]{0,500}modalidade[\s\S]{0,500}valor/,
  'negócio só deve entrar no cálculo do IPCP quando tiver responsável, modalidade e valor',
)
assert.match(
  routeSource,
  /var negociosComputaveis = negociosComputaveisIpcp\(negocios\)/,
  'cálculo vivo deve usar somente negócios com pré-requisitos de IPCP',
)
assert.match(
  routeSource,
  /filtroPorNegocios\('negocio_id', negociosComputaveis\)/,
  'coleções operacionais devem ficar alinhadas aos negócios computáveis do escopo',
)
assert.match(
  routeSource,
  /empresa:\s*nomeRelacionado\('com_empresas'/,
  'Negócios em atenção devem preservar Empresa no payload',
)
assert.match(
  routeSource,
  /contato:\s*nomeRelacionado\('com_contatos'/,
  'Negócios em atenção devem preservar Contato no payload',
)
assert.match(
  routeSource,
  /com_vinculos_externos[\s\S]{0,1000}record_id='[\s\S]{0,1000}external_id/,
  'Nº do negócio deve tentar vínculo externo antes de qualquer fallback',
)
assert.doesNotMatch(
  routeSource,
  /negocioHumanoId\(rec\)[\s\S]*return\s+rec\.id/,
  'Nº do negócio não pode cair para o ID técnico do PocketBase',
)
assert.match(
  routeSource,
  /link:\s*'\/pipeline\?negocio=' \+ encodeURIComponent\(item\.id\)/,
  'link deve continuar usando o ID técnico apenas internamente, nunca como Nº do negócio',
)
assert.match(
  routeSource,
  /var calculadoEm = snapshot[\s\S]{0,180}snapshot\.getString\('updated'\)[\s\S]{0,120}: null/,
  'Base exibida deve usar data/hora do snapshot disponível; sem snapshot não deve inventar hora da consulta',
)
assert.match(
  routeSource,
  /calculado_ao_vivo:\s*!snapshotAtualDoDia/,
  'rota deve diferenciar cálculo ao vivo de snapshot diário para não rotular consulta como Base diária',
)
assert.match(
  routeSource,
  /snapshot_do_dia:\s*snapshotAtualDoDia/,
  'rota deve informar se o snapshot encontrado é da data-base solicitada',
)
assert.match(
  routeSource,
  /pacoteVivoResponsavelId = responsavelId === '__todos__' \? '' : responsavelId/,
  'leitura Todos deve usar snapshot __todos__ sem filtrar cálculo vivo por um responsável técnico',
)
assert.match(
  routeSource,
  /com_notas_negocio[\s\S]{0,2500}decisor|decisor[\s\S]{0,2500}com_notas_negocio/,
  'qualidade do registro deve considerar notas comerciais com decisor/contexto, não só próxima ação',
)
assert.match(
  routeSource,
  /var negociosAtencaoResposta =[\s\S]{0,220}snapshotAtualDoDia && payload\.negocios_atencao[\s\S]{0,220}pacoteVivo\.negocios_atencao/,
  'rota deve usar negócios do snapshot diário quando há snapshot do dia e leitura viva apenas quando o atual é ao vivo',
)
assert.match(
  routeSource,
  /snapshotAnteriorComparavel\(snapshot, snapshots\)/,
  'quando há snapshot do dia, evolução deve comparar com snapshot anterior do mesmo escopo/responsável',
)
assert.match(
  routeSource,
  /snapshotBaseAnteriorQuandoAtualAoVivo\(snapshot\)/,
  'quando o atual ainda é calculado ao vivo, evolução deve usar o último snapshot como Anterior em vez de primeira leitura',
)
assert.match(
  routeSource,
  /pacote_completo/,
  'rota do Nexo deve sinalizar pacote completo quando disponível',
)
assert.doesNotMatch(
  routeSource,
  /\$app\.save|\.save\(|\$app\.delete|\.delete\(|\$http\.send\(/,
  'rota viva do Nexo não pode salvar, apagar ou chamar externo',
)
assert.doesNotMatch(
  routeSource,
  /findRecordsByFilter\([^,]+,[^,]+,[^,]+,\s*(500|1000|5000)/,
  'rota deve ter limite conservador de leitura',
)

console.log('nexo-ipcp-diario-vivo contract: PASS')
