import {
  BarChart3,
  BriefcaseBusiness,
  CalendarClock,
  ClipboardCheck,
  FileCheck2,
  LayoutDashboard,
  Layers,
  ListChecks,
  Settings2,
  ShieldCheck,
  Trophy,
} from "lucide-react";

export type NavigationEntry = {
  label: string;
  path: string;
  icon: typeof LayoutDashboard;
};

export const MAIN_MODULES: NavigationEntry[] = [
  { label: "Operação do Dia", path: "/", icon: LayoutDashboard },
  { label: "Pipeline Comercial", path: "/pipeline", icon: BriefcaseBusiness },
  { label: "Análises", path: "/analises", icon: BarChart3 },
  { label: "Administração", path: "/foundation", icon: Layers },
];

export const PIPELINE_PATHS = [
  "/pipeline",
  "/qualificacao",
  "/propostas",
  "/fechamentos",
  "/ordens-execucao",
];

export const ADMIN_PATHS = ["/foundation", "/slas", "/substituicoes"];

export const PIPELINE_TABS: NavigationEntry[] = [
  { label: "Visão geral", path: "/pipeline", icon: BriefcaseBusiness },
  { label: "Qualificação", path: "/qualificacao", icon: ListChecks },
  { label: "Propostas", path: "/propostas", icon: FileCheck2 },
  { label: "Fechamentos", path: "/fechamentos", icon: Trophy },
  {
    label: "Ordens de Execução",
    path: "/ordens-execucao",
    icon: ClipboardCheck,
  },
];

export const ADMIN_TABS: NavigationEntry[] = [
  { label: "Sistema", path: "/foundation", icon: Settings2 },
  { label: "SLAs e alertas", path: "/slas", icon: CalendarClock },
  { label: "Substituições", path: "/substituicoes", icon: ShieldCheck },
];

export function modulePathFor(pathname: string): string {
  if (
    PIPELINE_PATHS.some(
      (path) => pathname === path || pathname.startsWith(`${path}/`),
    )
  ) {
    return "/pipeline";
  }
  if (pathname === "/analises" || pathname.startsWith("/analises/"))
    return "/analises";
  if (
    ADMIN_PATHS.some(
      (path) => pathname === path || pathname.startsWith(`${path}/`),
    )
  ) {
    return "/foundation";
  }
  if (pathname === "/atividades" || pathname.startsWith("/atividades/"))
    return "/";
  return "/";
}
