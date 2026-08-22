const fs = require('fs')
const path = require('path')

const layout = fs.readFileSync(path.join(process.cwd(), 'src/components/Layout.tsx'), 'utf8')
const button = fs.readFileSync(path.join(process.cwd(), 'src/components/ui/button.tsx'), 'utf8')

const tests = [
  ['menu recolhível por ícones', layout.includes('collapsible="icon"')],
  ['controle de recolher e expandir', layout.includes('<SidebarTrigger')],
  ['atalho de teclado e estado persistente', layout.includes('<SidebarProvider>')],
  [
    'identidade visual slate e indigo',
    layout.includes('bg-slate-900') &&
      layout.includes('!bg-indigo-600') &&
      layout.includes("backgroundColor: '#4f46e5'"),
  ],
  [
    'chave junto ao usuário',
    layout.includes('KeyRound') && layout.includes('aria-label="Alterar minha senha"'),
  ],
  [
    'troca da própria senha',
    layout.includes('<ChangePasswordDialog') && layout.includes('requireOldPassword'),
  ],
  ['navegação móvel integrada', layout.includes('setOpenMobile(false)')],
  [
    'botão principal indigo e secundário slate',
    button.includes('bg-indigo-600 text-white') && button.includes('border-slate-200'),
  ],
]

let passed = 0
for (const [name, ok] of tests) {
  console.log(`TEST ${ok ? 'PASS' : 'FAIL'}: ${name}`)
  if (ok) passed += 1
}

console.log(`\nRESULTADO: ${passed}/${tests.length} aprovados`)
if (passed !== tests.length) process.exit(1)
