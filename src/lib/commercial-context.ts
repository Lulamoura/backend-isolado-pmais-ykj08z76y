export interface CommercialContext {
  empresa: { id: string; nome: string | null } | null;
  contato: {
    id: string;
    nome: string | null;
    email: string | null;
    telefone: string | null;
  } | null;
  responsavel: { id: string; name: string | null } | null;
  valor_centavos: number;
  modalidade: string | null;
  fase_crm: string | null;
  fonte_prospeccao: string | null;
  proxima_acao_em: string | null;
  crm_created_at: string | null;
  crm_updated_at: string | null;
  origem_canal: string | null;
  somente_leitura: boolean;
}

export type ActionStatus = "vencida" | "hoje" | "futura" | "ausente";
export type CommercialSort =
  "proxima_acao" | "maior_valor" | "mais_antigo" | "atualizado";

const validDate = (value: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const actionStatus = (
  value: string | null,
  now = new Date(),
): ActionStatus => {
  const date = validDate(value);
  if (!date) return "ausente";
  const target = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  ).getTime();
  const today = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  return target < today ? "vencida" : target === today ? "hoje" : "futura";
};

export const ageInDays = (value: string | null, now = new Date()) => {
  const date = validDate(value);
  if (!date) return null;
  return Math.max(0, Math.floor((now.getTime() - date.getTime()) / 86_400_000));
};

export const formatDate = (value: string | null) => {
  const date = validDate(value);
  return date ? new Intl.DateTimeFormat("pt-BR").format(date) : "Não informada";
};

export const formatMoney = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    cents / 100,
  );

export interface ContextualItem {
  negocio: { titulo: string };
  contexto: CommercialContext;
}

export const filterAndSortCommercial = <T extends ContextualItem>(
  items: T[],
  search: string,
  owner: string,
  status: string,
  sort: CommercialSort,
) => {
  const term = search.trim().toLocaleLowerCase("pt-BR");
  return items
    .filter((item) => {
      const c = item.contexto;
      const haystack = [item.negocio.titulo, c.empresa?.nome, c.contato?.nome]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("pt-BR");
      return (
        (!term || haystack.includes(term)) &&
        (!owner || c.responsavel?.id === owner) &&
        (!status || actionStatus(c.proxima_acao_em) === status)
      );
    })
    .sort((a, b) => {
      if (sort === "maior_valor")
        return b.contexto.valor_centavos - a.contexto.valor_centavos;
      if (sort === "mais_antigo")
        return (
          (validDate(a.contexto.crm_created_at)?.getTime() ?? Infinity) -
          (validDate(b.contexto.crm_created_at)?.getTime() ?? Infinity)
        );
      if (sort === "atualizado")
        return (
          (validDate(b.contexto.crm_updated_at)?.getTime() ?? 0) -
          (validDate(a.contexto.crm_updated_at)?.getTime() ?? 0)
        );
      return (
        (validDate(a.contexto.proxima_acao_em)?.getTime() ?? Infinity) -
        (validDate(b.contexto.proxima_acao_em)?.getTime() ?? Infinity)
      );
    });
};
