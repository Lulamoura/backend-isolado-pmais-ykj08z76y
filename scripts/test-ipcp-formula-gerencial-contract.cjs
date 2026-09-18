const fs = require('node:fs')
const assert = require('node:assert/strict')

const formulaFiles = [
  'pocketbase/hooks/com_ipcp_diario.js',
  'pocketbase/hooks/com_nexo_central_operacional.js',
]
for (const file of formulaFiles) assert.ok(fs.existsSync(file), `${file} deve existir`)

const hook = formulaFiles
  .map((file) => fs.readFileSync(file, 'utf8'))
  .join('\n/* --- arquivo IPCP --- */\n')

const deprecatedPatterns = [
  /4\s*\+\s*\n\s*Math\.min\(7,\s*valorAberto\s*\/\s*200000\)[\s\S]{0,120}propostaPorAberto/,
  /clampLocal\(4\s*\+\s*Math\.min\(7,\s*valorAberto\s*\/\s*200000\)\s*\+\s*propostaPorAberto/,
  /propostaPorAberto[\s\S]{0,120}valorEstrategico/,
  /valorEstrategico[\s\S]{0,220}propostaPorAberto/,
  /valor_estrategico:\s*roundLocal\([\s\S]{0,160}propostaPorAberto/,
]
for (const pattern of deprecatedPatterns) {
  assert.doesNotMatch(
    hook,
    pattern,
    'Valor Estratégico não pode manter fórmula antiga nem premiar proposta por aberto',
  )
}

assert.match(
  hook,
  /IPCP_ALTO_VALOR_REFERENCIA_REAIS\s*=\s*10000/,
  'fórmula deve declarar referência de alto valor aprovada em R$ 10.000,00',
)
assert.match(
  hook,
  /IPCP_ALTO_VALOR_REFERENCIA\s*=\s*IPCP_ALTO_VALOR_REFERENCIA_REAIS \* 100/,
  'fórmula deve comparar alto valor na unidade armazenada em centavos',
)
assert.match(
  hook,
  /IPCP_MIN_DECIDIDOS_CONFIANCA_TOTAL\s*=\s*5/,
  'Resultado Comercial deve declarar mínimo de 5 negócios decididos para confiança cheia',
)
assert.match(
  hook,
  /function\s+negocioRecorrenteIpcp\(rec\)/,
  'fórmula deve identificar negócios recorrentes pela modalidade',
)
assert.match(
  hook,
  /function\s+negocioAltoValorIpcp\(valor\)/,
  'fórmula deve identificar alto valor por parâmetro canônico',
)
assert.match(
  hook,
  /function\s+calcularResultadoComercialIpcp\(ganhos, perdidos\)/,
  'Resultado Comercial deve usar helper com fator de confiança por volume decidido',
)
assert.match(
  hook,
  /function\s+calcularResultadoComercialIpcp\(ganhos, perdidos\)[\s\S]{0,160}var\s+totalDecididos\s*=\s*ganhos \+ perdidos[\s\S]{0,160}var\s+conversao\s*=\s*totalDecididos \? ganhos \/ totalDecididos : 0/,
  'Resultado Comercial deve calcular total decidido e conversão dentro do helper',
)
assert.match(
  hook,
  /confiancaDecididos\s*=\s*Math\.min\(1,\s*totalDecididos\s*\/\s*IPCP_MIN_DECIDIDOS_CONFIANCA_TOTAL\)/,
  'conversão deve ser reduzida quando houver menos de 5 decididos',
)
assert.match(
  hook,
  /12\s*\+\s*conversao\s*\*\s*10\s*\*\s*confiancaDecididos/,
  'conversão deve aplicar fator de confiança antes de pontuar Resultado Comercial',
)
assert.match(
  hook,
  /function\s+calcularValorEstrategicoIpcp\(/,
  'Valor Estratégico deve usar helper canônico',
)
assert.match(
  hook,
  /recorrenciaCarteiraAberta\s*=\s*Math\.min\(\s*3,/,
  'recorrência da carteira aberta deve pontuar até 3 pontos',
)
assert.match(
  hook,
  /valorFinanceiroCarteiraAberta\s*=\s*Math\.min\(1,/,
  'valor financeiro da carteira aberta deve pontuar até 1 ponto',
)
assert.match(
  hook,
  /recorrenteAltoValor\s*=\s*Math\.min\(\s*5,/,
  'recorrente + alto valor deve pontuar até 5 pontos',
)
assert.match(
  hook,
  /valorGanhoEstrategico\s*=\s*Math\.min\(\s*5,/,
  'valor ganho recorrente ou de alto valor deve pontuar até 5 pontos',
)
assert.match(
  hook,
  /maturidadeComercialQualificada\s*=\s*Math\.min\(\s*1,/,
  'maturidade comercial qualificada deve pontuar até 1 ponto',
)
assert.match(
  hook,
  /recorrenciaCarteiraAberta \+[\s\S]{0,220}maturidadeComercialQualificada,[\s\S]{0,80}0,[\s\S]{0,80}15/,
  'Valor Estratégico deve ser limitado entre 0 e 15 pontos pela nova composição',
)
assert.doesNotMatch(
  hook,
  /valorEstrategico\s*=\s*round1\(\s*clamp\(\s*4\s*\+/,
  'Valor Estratégico não pode começar com base fixa 4 da fórmula anterior',
)

assert.match(
  hook,
  /var negociosComputaveis = negociosComputaveisIpcp\(negocios\)[\s\S]{0,500}filtroPorNegocios\('negocio_id', negociosComputaveis\)/,
  'processamento manual/cron deve calcular IPCP sobre os mesmos negócios computáveis e relações por negócio da leitura viva',
)
assert.match(
  hook,
  /var negociosComputaveisRows = \[\][\s\S]{0,240}negocioComputavelIpcpTelegram/,
  'fallback Telegram/Nexo deve separar negócios computáveis antes de recalcular IPCP',
)
assert.match(
  hook,
  /for \(var gi = 0; gi < negociosComputaveisRows\.length; gi\+\+\)/,
  'fallback Telegram/Nexo deve aplicar a fórmula apenas sobre negócios computáveis',
)
assert.match(
  hook,
  /filtroNegociosRelacionadosTelegram\s*=\s*filtroPorNegociosIpcpTelegram\([\s\S]{0,120}negociosComputaveisRows[\s\S]{0,260}com_atividades[\s\S]{0,220}filtroNegociosRelacionadosTelegram/,
  'fallback Telegram/Nexo deve buscar atividades pelo negócio computável, não por responsavel_id amplo',
)
assert.match(
  hook,
  /propostasCarteiraRows\s*=\s*\$app\.findRecordsByFilter\([\s\S]{0,180}com_propostas[\s\S]{0,180}filtroNegociosRelacionadosTelegram[\s\S]{0,360}com_proposta_envios[\s\S]{0,240}filtroPorPropostasIpcpTelegram\('proposta_id', propostasCarteiraRows\)/,
  'fallback Telegram/Nexo deve buscar envios por propostas da carteira computável',
)
assert.doesNotMatch(
  hook,
  /var filtroOperacional = responsavelId[\s\S]{0,360}com_proposta_envios/,
  'fallback Telegram/Nexo não pode misturar atividades/propostas amplas por responsavel_id no recálculo IPCP',
)

console.log('OK: contrato IPCP fórmula gerencial protegido')
