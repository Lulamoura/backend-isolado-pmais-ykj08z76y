migrate(
  (app) => {
    const empresasCol = app.findCollectionByNameOrId('com_empresas')
    const negociosCol = app.findCollectionByNameOrId('com_negocios')
    const adminUser = app.findAuthRecordByEmail(
      '_pb_users_auth_',
      'luiz.moura@pmaisservicos.com.br',
    )
    const equipeAlpha = app.findFirstRecordByData('com_equipes', 'slug', 'equipe-alpha-teste')

    const empresas = [
      {
        nome: 'Tech Solutions LTDA [TESTE]',
        cnpj: '12345678000190',
        email: 'contato@techsolutions.test',
        telefone: '(11) 3333-4444',
        status: 'ativo',
        endereco: 'Av. Paulista 1000',
        cidade: 'Sao Paulo',
        estado: 'SP',
      },
      {
        nome: 'Consultoria XYZ [TESTE]',
        cnpj: '98765432000110',
        email: 'info@xyz.test',
        telefone: '(21) 2222-3333',
        status: 'prospecto',
        endereco: 'Rua das Flores 500',
        cidade: 'Rio de Janeiro',
        estado: 'RJ',
      },
    ]

    const empresaIds = []
    for (const e of empresas) {
      try {
        app.findFirstRecordByData('com_empresas', 'cnpj', e.cnpj)
      } catch (_) {
        const rec = new Record(empresasCol)
        rec.set('nome', e.nome)
        rec.set('cnpj', e.cnpj)
        rec.set('email', e.email)
        rec.set('telefone', e.telefone)
        rec.set('status', e.status)
        rec.set('equipe_id', equipeAlpha.id)
        rec.set('responsavel_id', adminUser.id)
        rec.set('endereco', e.endereco)
        rec.set('cidade', e.cidade)
        rec.set('estado', e.estado)
        app.save(rec)
      }
    }

    const techSolutions = app.findFirstRecordByData('com_empresas', 'cnpj', '12345678000190')
    const consultoriaXYZ = app.findFirstRecordByData('com_empresas', 'cnpj', '98765432000110')

    const negocios = [
      {
        titulo: 'Implementacao de CRM [TESTE]',
        empresa: techSolutions,
        valor: 50000,
        status: 'em_andamento',
        descricao: 'Implementacao de sistema CRM [TESTE]',
      },
      {
        titulo: 'Consultoria de Processos [TESTE]',
        empresa: consultoriaXYZ,
        valor: 15000,
        status: 'aberto',
        descricao: 'Consultoria de processos comerciais [TESTE]',
      },
    ]

    for (const n of negocios) {
      try {
        app.findFirstRecordByFilter('com_negocios', "titulo = '" + n.titulo + "'")
      } catch (_) {
        const rec = new Record(negociosCol)
        rec.set('titulo', n.titulo)
        rec.set('empresa_id', n.empresa.id)
        rec.set('equipe_id', equipeAlpha.id)
        rec.set('responsavel_id', adminUser.id)
        rec.set('valor', n.valor)
        rec.set('status', n.status)
        rec.set('descricao', n.descricao)
        app.save(rec)
      }
    }
  },
  (app) => {
    try {
      app.findRecordsByFilter('com_negocios', '').forEach((r) => app.delete(r))
    } catch (_) {}
    try {
      app.findRecordsByFilter('com_empresas', '').forEach((r) => app.delete(r))
    } catch (_) {}
  },
)
