import { beforeEach, describe, expect, it, vi } from 'vitest'

const send = vi.hoisted(() => vi.fn())

vi.mock('@/lib/pocketbase/client', () => ({
  default: {
    send,
    authStore: { model: null },
    collection: vi.fn(),
  },
}))

import {
  listarCasosCuradoriaComercial,
  transicionarCasoCuradoriaComercial,
} from '@/services/nexo-curadoria'

describe('Curadoria Comercial Unificada', () => {
  beforeEach(() => {
    send.mockReset()
  })

  it('carrega as quatro visões pelo backend governado', async () => {
    const response = {
      ok: true,
      visoes: {
        para_tratar: [],
        aguardando_decisao: [],
        conhecimento_aprovado: [],
        historico: [],
      },
      contadores: {
        para_tratar: 0,
        aguardando_decisao: 0,
        conhecimento_aprovado: 0,
        historico: 0,
      },
      guardrails: {
        sem_payload_bruto: true,
        sem_ids_tecnicos_visiveis: true,
        automatic_send_allowed: false,
      },
    }
    send.mockResolvedValue(response)

    await expect(listarCasosCuradoriaComercial(40)).resolves.toEqual(response)
    expect(send).toHaveBeenCalledWith('/backend/v1/nexo/curadoria/casos/listar', {
      method: 'POST',
      body: { limite: 40 },
    })
  })

  it('envia transição com revisão esperada para impedir decisão sobre versão antiga', async () => {
    send.mockResolvedValue({
      ok: true,
      caso: { id: 'caso-1', revisao: 3, status: 'aprovado' },
      automatic_send_allowed: false,
      promocao_automatica_realizada: false,
    })

    await transicionarCasoCuradoriaComercial('caso-1', {
      acao: 'aprovar',
      expected_revision: 2,
      regra_candidata: 'Registrar o próximo passo ao final da reunião.',
      decisao_observacao: 'Validada pela gestão comercial.',
    })

    expect(send).toHaveBeenCalledWith('/backend/v1/nexo/curadoria/casos/caso-1/transicionar', {
      method: 'POST',
      body: {
        acao: 'aprovar',
        expected_revision: 2,
        regra_candidata: 'Registrar o próximo passo ao final da reunião.',
        decisao_observacao: 'Validada pela gestão comercial.',
      },
    })
  })
})
