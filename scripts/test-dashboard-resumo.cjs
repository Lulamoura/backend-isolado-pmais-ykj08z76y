#!/usr/bin/env node
'use strict'

var fs = require('fs')
var path = require('path')
var vm = require('vm')

var hookPath = path.join(__dirname, '..', 'pocketbase', 'hooks', 'com_dashboard_resumo.js')
var src = fs.readFileSync(hookPath, 'utf8')
var pageSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'pages', 'Index.tsx'), 'utf8')
var startMarker = '/* ──── BLOCO DE TESTES ESTÁTICOS ──── */'
var endMarker = '/* ──── FIM DO BLOCO DE TESTES ESTÁTICOS ──── */'
var start = src.indexOf(startMarker)
var end = src.indexOf(endMarker, start)
if (start < 0 || end <= start) throw new Error('Bloco de testes estáticos ausente')

var functionNames = [
  'isCivilDate',
  'nextCivilDate',
  'civilStartUtc',
  'isRecordId',
  'validarQuery',
  'bindingVigente',
  'maxScope',
  'classificarResultado',
  'percentual',
  'agregarNegocios',
  'comporFiltro',
]
var functions = ''
for (var i = 0; i < functionNames.length; i++) {
  var marker = '    function ' + functionNames[i] + '('
  var fnStart = src.indexOf(marker)
  if (fnStart < 0) throw new Error('Função ausente: ' + functionNames[i])
  var brace = src.indexOf('{', fnStart)
  var depth = 0
  var fnEnd = -1
  for (var j = brace; j < src.length; j++) {
    if (src[j] === '{') depth++
    if (src[j] === '}') {
      depth--
      if (depth === 0) {
        fnEnd = j + 1
        break
      }
    }
  }
  if (fnEnd < 0) throw new Error('Função sem fechamento: ' + functionNames[i])
  functions += src.substring(fnStart, fnEnd) + '\n'
}
var block = src.substring(start, end + endMarker.length)
var sandbox = {
  console: console,
  Date: Date,
  isNaN: isNaN,
  isFinite: isFinite,
  Math: Math,
  Number: Number,
}
vm.createContext(sandbox)
vm.runInContext(functions + '\n' + block, sandbox, { filename: 'dashboard-resumo-static.js' })
var x = sandbox.__testExports

var passed = 0
var failed = 0
function assert(name, condition, detail) {
  if (condition) {
    passed++
    console.log('TEST PASS: ' + name)
  } else {
    failed++
    console.log('TEST FAIL: ' + name + (detail ? ' — ' + detail : ''))
  }
}
function same(actual, expected) {
  return JSON.stringify(actual) === JSON.stringify(expected)
}

assert('A1 aceita data civil válida', x.isCivilDate('2026-02-28') === true)
assert('A2 rejeita dia impossível', x.isCivilDate('2026-02-30') === false)
assert('A3 rejeita timestamp', x.isCivilDate('2026-02-28T00:00:00Z') === false)
assert('A4 calcula próximo dia na virada do mês', x.nextCivilDate('2026-08-31') === '2026-09-01')
assert(
  'A5 início civil Recife corresponde a 03:00Z',
  x.civilStartUtc('2026-08-19') === '2026-08-19 03:00:00.000Z',
)

assert('B1 aceita id PocketBase', x.isRecordId('abc123def456ghi') === true)
assert('B2 rejeita id fora do contrato', x.isRecordId('abc') === false)
assert('B3 query vazia aplica defaults', x.validarQuery({}).params.incluir_inativos === false)
assert('B4 rejeita chave desconhecida', x.validarQuery({ surpresa: '1' }).valido === false)
assert(
  'B5 rejeita período invertido',
  x.validarQuery({ inicio: '2026-09-02', fim: '2026-09-01' }).valido === false,
)
assert(
  'B6 rejeita booleano não estrito',
  x.validarQuery({ incluir_inativos: '1' }).valido === false,
)
assert(
  'B7 aceita filtros completos',
  x.validarQuery({
    inicio: '2026-01-01',
    fim: '2026-12-31',
    equipe_id: 'abc123def456ghi',
    responsavel_id: 'xyz123def456abc',
    modalidade: 'evento',
    incluir_inativos: 'true',
  }).valido === true,
)

assert(
  'C1 binding aceita limites inclusivos',
  x.bindingVigente('2026-08-19', '2026-08-19', '2026-08-19') === true,
)
assert(
  'C2 binding rejeita início futuro',
  x.bindingVigente('2026-08-20', '', '2026-08-19') === false,
)
assert('C3 escopo preserva o mais forte', x.maxScope('equipe', 'proprios') === 'equipe')
assert('C4 escopo promove para todos', x.maxScope('equipe', 'todos') === 'todos')

assert(
  'D1 resultado canônico prefere ganho',
  x.classificarResultado({ resultado: 'ganho', status: 'perdido' }) === 'ganho',
)
assert(
  'D2 status legado é fallback',
  x.classificarResultado({ resultado: '', status: 'perdido' }) === 'perdido',
)
assert(
  'D3 desqualificado não vira perdido',
  x.classificarResultado({ resultado: 'desqualificado', status: 'perdido' }) === 'desqualificado',
)
assert(
  'D4 estado sem terminal é aberto',
  x.classificarResultado({ resultado: '', status: '' }) === 'aberto',
)
assert('D5 percentual retorna N/D', x.percentual(1, 0) === null)
assert('D6 percentual usa duas casas', x.percentual(1, 3) === 33.33)

var resumo = x.agregarNegocios([
  {
    resultado: '',
    status: '',
    qualificacao: 'pendente',
    etapa: 'prospects',
    modalidade: '',
    valor: 0,
    origem_canal: '',
    responsavel_id: '',
  },
  {
    resultado: 'ganho',
    status: '',
    qualificacao: 'qualificada',
    etapa: 'negociacao',
    modalidade: 'evento',
    valor: 10001,
    origem_canal: 'site',
    responsavel_id: 'u1',
  },
  {
    resultado: 'perdido',
    status: '',
    qualificacao: 'qualificada',
    etapa: 'negociacao',
    modalidade: 'recorrente',
    valor: 20001,
    origem_canal: 'evento',
    responsavel_id: 'u2',
    fechamento_motivo: 'Preço',
  },
  {
    resultado: 'desqualificado',
    status: '',
    qualificacao: 'desqualificada',
    etapa: 'prospects',
    modalidade: 'serv_eventual',
    valor: 1,
    origem_canal: '',
    responsavel_id: '',
  },
])
assert(
  'E1 totaliza situações separadas',
  same(resumo.situacao, { abertos: 1, ganhos: 1, perdidos: 1, desqualificados: 1 }),
)
assert('E2 exclui zero e um centavo das somas', resumo.valores.total_precificado_centavos === 30002)
assert('E3 conta marcador de um centavo', resumo.valores.negocios_marcador_um_centavo === 1)
assert('E4 conta valor zero', resumo.valores.negocios_valor_zero === 1)
assert('E5 calcula ticket precificado', resumo.valores.ticket_medio_precificado_centavos === 15001)
assert('E6 calcula ticket ganho', resumo.valores.ticket_medio_ganho_centavos === 10001)
assert(
  'E7 conversão global inclui desqualificados decididos',
  resumo.conversoes.global_percentual === 33.33,
)
assert(
  'E8 taxa de qualificação usa decisões explícitas',
  resumo.conversoes.qualificacao_percentual === 66.67,
)
assert(
  'E9 não inventa conversão de propostas',
  resumo.conversoes.propostas_percentual === null &&
    resumo.conversoes.propostas_status === 'indisponivel_sem_evento_comprovado',
)
assert('E10 calcula cobertura de origem', resumo.cobertura.origem.percentual === 50)
assert('E11 calcula cobertura de responsável', resumo.cobertura.responsavel.percentual === 50)
assert('E12 calcula cobertura de modalidade', resumo.cobertura.modalidade.percentual === 75)
assert(
  'E13 conversão qualitativa usa somente valor ganho sobre decisões comerciais',
  resumo.conversoes.qualitativa_percentual === 33.33 &&
    resumo.conversoes.decisoes_valor_centavos === 30002,
)
assert(
  'E14 perdas por motivo não misturam desqualificações',
  same(resumo.perdas_por_motivo, [{ motivo: 'Preço', quantidade: 1, valor_centavos: 20001 }]),
)
assert(
  'E15 negócios fora de Prospect são qualificados mesmo sem marcação legada',
  x.agregarNegocios([{ etapa: 'negociacao', qualificacao: '', valor: 100, modalidade: 'evento' }])
    .qualificacao.qualificadas === 1,
)
assert(
  'E16 totaliza quantidade e valor por modalidade',
  same(resumo.modalidades, [
    { modalidade: 'recorrente', quantidade: 1, valor_centavos: 20001 },
    { modalidade: 'evento', quantidade: 1, valor_centavos: 10001 },
    { modalidade: 'serv_eventual', quantidade: 1, valor_centavos: 0 },
  ]),
)

var filtro = x.comporFiltro(
  {
    inicio: '2026-08-01',
    fim: '2026-08-31',
    equipe_id: '',
    responsavel_id: '',
    modalidade: 'recorrente',
    incluir_inativos: false,
  },
  'equipe',
  'actor1234567890',
  ['team12345678901', 'team12345678902'],
)
assert('F1 filtro exclui inativos por padrão', filtro.indexOf('inativo = false') !== -1)
assert(
  'F2 filtro usa início Recife',
  filtro.indexOf("created >= '2026-08-01 03:00:00.000Z'") !== -1,
)
assert('F3 filtro usa fim exclusivo', filtro.indexOf("created < '2026-09-01 03:00:00.000Z'") !== -1)
assert(
  'F4 filtro de equipe é parentetizado',
  filtro.indexOf("(equipe_id = 'team12345678901' || equipe_id = 'team12345678902')") !== -1,
)
assert(
  'F5 escopo próprios limita responsável',
  x
    .comporFiltro({ incluir_inativos: true }, 'proprios', 'abc123def456ghi', [])
    .indexOf("responsavel_id = 'abc123def456ghi'") !== -1,
)
assert('F6 filtro limita modalidade', filtro.indexOf("modalidade = 'recorrente'") !== -1)
assert(
  'F6 equipe vazia falha fechada',
  x
    .comporFiltro({ incluir_inativos: true }, 'equipe', 'abc123def456ghi', [])
    .indexOf("id = '__sem_equipe__'") !== -1,
)

assert(
  'G1 hook declara somente GET',
  /routerAdd\(\s*'GET',\s*'\/backend\/v1\/dashboard\/resumo'/.test(src),
)
assert('G2 hook exige autenticação', src.indexOf('$apis.requireAuth()') !== -1)
assert('G3 hook governa dashboard.view', src.indexOf('dashboard.view') !== -1)
assert(
  'G4 hook pagina em lotes',
  src.indexOf('batchSize = 500') !== -1 && src.indexOf('offset += batchSize') !== -1,
)
assert('G5 hook não grava dados', !/\$app\.save|runInTransaction|new Record\s*\(/.test(src))
assert('G6 hook não chama rede externa', !/\$http\.|fetch\s*\(|request\s*\(/.test(src))
assert('G7 contrato documenta centavos', src.indexOf('Valores monetarios estao em centavos') !== -1)
assert(
  'G8 opções de filtro respeitam o escopo do dashboard',
  src.indexOf('opcoesFiltro(scope, e.auth, equipeIds)') !== -1 &&
    src.indexOf('opcoes_filtro: opcoes') !== -1,
)
assert(
  'G9 tela não consulta a coleção administrativa de usuários',
  pageSrc.indexOf("from '@/services/users'") === -1 &&
    pageSrc.indexOf('data.opcoes_filtro.responsaveis') !== -1,
)

console.log('\nRESULTADO: ' + passed + ' passou, ' + failed + ' falhou')
if (failed) process.exit(1)
