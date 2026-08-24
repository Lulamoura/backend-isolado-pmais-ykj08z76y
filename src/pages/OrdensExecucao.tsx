import { useCallback, useEffect, useMemo, useState } from "react";
import { ClipboardCheck, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CommercialContextCard } from "@/components/CommercialContextCard";
import { formatDate } from "@/lib/commercial-context";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  listarOrdensExecucao,
  novaChaveOE,
  registrarOrdemExecucao,
  type ItemOE,
  type ResponsavelOE,
} from "@/services/ordens-execucao";

export default function OrdensExecucao() {
  const [itens, setItens] = useState<ItemOE[]>([]);
  const [responsaveis, setResponsaveis] = useState<ResponsavelOE[]>([]);
  const [loading, setLoading] = useState(true);
  const [numero, setNumero] = useState<Record<string, string>>({});
  const [dataEnvio, setDataEnvio] = useState<Record<string, string>>({});
  const [responsavel, setResponsavel] = useState<Record<string, string>>({});
  const hoje = new Date().toISOString().slice(0, 10);
  const inicioPadrao = new Date(Date.now() - 89 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const [periodoInicio, setPeriodoInicio] = useState(inicioPadrao);
  const [periodoFim, setPeriodoFim] = useState(hoje);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const resposta = await listarOrdensExecucao();
      setItens(resposta.itens);
      setResponsaveis(resposta.responsaveis_envio);
    } catch (_) {
      toast.error("Não foi possível carregar as Ordens de Execução.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => void carregar(), [carregar]);
  const itensVisiveis = useMemo(
    () =>
      itens.filter((item) => {
        const data = item.negocio.data_periodo?.slice(0, 10) || "";
        return (
          (!periodoInicio || data >= periodoInicio) &&
          (!periodoFim || data <= periodoFim)
        );
      }),
    [itens, periodoInicio, periodoFim],
  );

  const registrar = async (item: ItemOE) => {
    try {
      await registrarOrdemExecucao({
        negocio_id: item.negocio.id,
        oe_numero: numero[item.negocio.id],
        oe_data_envio: dataEnvio[item.negocio.id],
        oe_responsavel_envio_id: responsavel[item.negocio.id],
        updated_esperado: item.negocio.updated,
        command_idempotency_key: novaChaveOE(item.negocio.id),
        justificativa: "Registro da referência da OE pelo Comercial",
      });
      toast.success("Ordem de Execução registrada.");
      await carregar();
    } catch (_) {
      toast.error("A Ordem de Execução não pôde ser registrada.");
    }
  };

  return (
    <div className="container mx-auto max-w-6xl space-y-6 px-4 py-8">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Ordens de Execução
          </h1>
          <p className="text-sm text-slate-500">
            Referência do ERP após o ganho comercial
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => void carregar()}
          disabled={loading}
        >
          <RefreshCw className="mr-2 h-4 w-4" /> Atualizar
        </Button>
      </div>
      <div className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-2">
        <Input
          type="date"
          aria-label="Período inicial"
          value={periodoInicio}
          max={periodoFim}
          onChange={(e) => setPeriodoInicio(e.target.value)}
        />
        <Input
          type="date"
          aria-label="Período final"
          value={periodoFim}
          min={periodoInicio}
          onChange={(e) => setPeriodoFim(e.target.value)}
        />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {itensVisiveis.map((item) => {
          const concluida =
            item.estado_operacional === "em_processo_de_entrega";
          return (
            <Card key={item.negocio.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">
                      {item.negocio.titulo}
                    </CardTitle>
                    {item.negocio.external_id && (
                      <p className="mt-1 text-xs font-medium text-muted-foreground">
                        Negócio AC #{item.negocio.external_id}
                      </p>
                    )}
                    <CardDescription>Negócio ganho</CardDescription>
                  </div>
                  <Badge variant={concluida ? "default" : "secondary"}>
                    {concluida ? "Em processo de entrega" : "Aguardando OE"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <CommercialContextCard
                  contexto={item.contexto}
                  etapa="ganho"
                  showNextAction={false}
                  showReadOnlyNotice={false}
                />
                <div className="rounded-md border bg-slate-50 p-3 text-sm">
                  <p className="font-medium text-slate-900">
                    Decisão registrada no CRM em{" "}
                    {formatDate(
                      item.negocio.fechamento_data ||
                        item.contexto.crm_updated_at,
                    )}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {concluida
                      ? "OE registrada; acompanhe abaixo o envio para execução."
                      : "Próxima providência: registrar a referência da OE, a data e o responsável pelo envio."}
                  </p>
                </div>
                {concluida && item.oe ? (
                  <dl className="grid gap-2 text-sm text-slate-600">
                    <div>
                      <dt className="font-medium text-slate-900">
                        Número da OE
                      </dt>
                      <dd>{item.oe.numero}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-slate-900">
                        Data de envio
                      </dt>
                      <dd>{item.oe.data_envio}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-slate-900">
                        Responsável pelo envio
                      </dt>
                      <dd>
                        {item.oe.responsavel_envio?.name || "Não identificado"}
                      </dd>
                    </div>
                  </dl>
                ) : (
                  <>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Número da OE</Label>
                        <Input
                          value={numero[item.negocio.id] || ""}
                          onChange={(event) =>
                            setNumero((atual) => ({
                              ...atual,
                              [item.negocio.id]: event.target.value,
                            }))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Data de envio</Label>
                        <Input
                          type="date"
                          value={dataEnvio[item.negocio.id] || ""}
                          onChange={(event) =>
                            setDataEnvio((atual) => ({
                              ...atual,
                              [item.negocio.id]: event.target.value,
                            }))
                          }
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Responsável pelo envio</Label>
                      <Select
                        value={responsavel[item.negocio.id]}
                        onValueChange={(value) =>
                          setResponsavel((atual) => ({
                            ...atual,
                            [item.negocio.id]: value,
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o responsável" />
                        </SelectTrigger>
                        <SelectContent>
                          {responsaveis.map((usuario) => (
                            <SelectItem key={usuario.id} value={usuario.id}>
                              {usuario.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      disabled={
                        !numero[item.negocio.id]?.trim() ||
                        !dataEnvio[item.negocio.id] ||
                        !responsavel[item.negocio.id]
                      }
                      onClick={() => void registrar(item)}
                    >
                      <ClipboardCheck className="mr-2 h-4 w-4" /> Registrar OE
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
