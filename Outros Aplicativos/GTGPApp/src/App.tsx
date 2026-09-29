import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle, ArrowDownToLine, ArrowUpRight, BadgeCheck, Building2,
  ChartNoAxesCombined, ChevronLeft, ChevronRight, CircleHelp, CircleX,
  Database, ExternalLink, FileSpreadsheet, LayoutDashboard, MapPin,
  RefreshCw, Search, ShieldCheck, UsersRound,
} from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, Cell, LabelList, Pie, PieChart, XAxis, YAxis,
} from "recharts";
import { toast } from "sonner";
import {
  ChartContainer, ChartTooltip, ChartTooltipContent,
} from "@/components/ui/chart";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent,
  DropdownMenuGroup, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup,
  SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarInset,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider,
  SidebarSeparator, SidebarTrigger, useSidebar,
} from "@/components/ui/sidebar";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { createDataset, FIELD, fieldGroups, groupCount, numberValue, uniqueValues, valueFor } from "./domain";
import { loadDashboardData, previewMode } from "./dataSource";
import { downloadXlsx } from "./xlsx";
import type { AppDataset, Field, PersonRecord } from "./types";

type Page = "overview" | "people" | "evaluations" | "quality";

const NAV_ITEMS: Array<{ id: Page; label: string; icon: typeof LayoutDashboard }> = [
  { id: "overview", label: "Visão geral", icon: LayoutDashboard },
  { id: "people", label: "Pessoas", icon: UsersRound },
  { id: "evaluations", label: "Avaliações", icon: ChartNoAxesCombined },
  { id: "quality", label: "Qualidade dos dados", icon: ShieldCheck },
];

const VIEW_META: Record<Page, { title: string; description: string }> = {
  overview: { title: "Visão geral", description: "Acompanhe a composição da base, os ciclos e os pontos que precisam de atenção." },
  people: { title: "Pessoas", description: "Pesquise registros e consulte todos os campos cadastrados nas duas abas." },
  evaluations: { title: "Avaliações", description: "Veja a cobertura e os valores preenchidos em cada ciclo de avaliação." },
  quality: { title: "Qualidade dos dados", description: "Confira correspondências entre abas, matrículas e campos pendentes." },
};

const CHART_COLORS = ["#84bd00", "#123d2a", "#537d3b", "#a0b68b", "#d4a72c", "#678895"];
const DEFAULT_COLUMNS = [FIELD.name, FIELD.id, FIELD.program, FIELD.enquadre, FIELD.location, FIELD.score1, FIELD.potential1, FIELD.stage2];
const PAGE_SIZE = 25;
const numberFormat = new Intl.NumberFormat("pt-BR");

function displayPercent(value: number, total: number) {
  return total ? `${Math.round((value / total) * 100)}%` : "—";
}

function foldText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
}

function valueCount(people: PersonRecord[], key: string) {
  return people.filter((person) => valueFor(person, key) !== "").length;
}

function averageFor(people: PersonRecord[], key: string) {
  const values = people.map((person) => numberValue(valueFor(person, key))).filter((value): value is number => value !== null);
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function scoreDistribution(people: PersonRecord[], key: string) {
  const grouped = groupCount(people.filter((person) => valueFor(person, key) !== ""), key);
  return grouped.sort((left, right) => (numberValue(left.label) ?? -Infinity) - (numberValue(right.label) ?? -Infinity));
}

function updateTime(value: string) {
  if (value === "Amostra local") return "Dados de demonstração";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || "Ainda não sincronizado";
  return `Atualizado ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(date)}`;
}

function Stat({ label, value, note, tone = "default" }: { label: string; value: string; note: string; tone?: "default" | "attention" }) {
  return (
    <div className={`stat-item ${tone === "attention" ? "stat-attention" : ""}`}>
      <span className="stat-label">{label}</span>
      <strong className="stat-value">{value}</strong>
      <span className="stat-note">{note}</span>
    </div>
  );
}

function PanelTitle({ title, detail, action }: { title: string; detail?: string; action?: ReactNode }) {
  return (
    <div className="panel-title-row">
      <div>
        <h2 className="panel-title">{title}</h2>
        {detail && <p className="panel-detail">{detail}</p>}
      </div>
      {action}
    </div>
  );
}

function EmptyChart({ label }: { label: string }) {
  return <div className="empty-chart"><ChartNoAxesCombined size={20} /><span>{label}</span></div>;
}

function OverviewPage({ dataset, onNavigate, onSelect }: {
  dataset: AppDataset;
  onNavigate: (page: Page) => void;
  onSelect: (person: PersonRecord) => void;
}) {
  const { people, quality } = dataset;
  const hasRows = people.length > 0;
  const note1 = valueCount(people, FIELD.score1);
  const stage2 = valueCount(people, FIELD.stage2);
  const unmatched = quality.unmatchedAgentRows + quality.unmatchedBaseRows;
  const programData = groupCount(people, FIELD.program).slice(0, 7);
  const stageData = groupCount(people, FIELD.stage2).slice(0, 7);
  const sample = people.slice(0, 6);
  const programConfig = { count: { label: "Pessoas", color: "#84bd00" } };
  const stageConfig = { count: { label: "Pessoas", color: "#123d2a" } };

  return (
    <div className="page-stack">
      <section className="stats-band" aria-label="Resumo da base">
        <Stat label="Pessoas na base" value={numberFormat.format(quality.baseRows)} note="linhas em Base_Principal" />
        <Stat label="Nota 2026.1" value={`${numberFormat.format(note1)} / ${numberFormat.format(quality.baseRows)}`} note={`${displayPercent(note1, quality.baseRows)} com nota preenchida`} />
        <Stat label="Etapa 2026.2" value={`${numberFormat.format(stage2)} / ${numberFormat.format(quality.baseRows)}`} note={`${displayPercent(stage2, quality.baseRows)} com etapa preenchida`} />
        <Stat label="Revisar correspondência" value={numberFormat.format(unmatched)} note="linhas sem par na outra aba" tone={unmatched ? "attention" : "default"} />
      </section>

      {!hasRows ? <EmptyState dataset={dataset} /> : (
        <>
          <div className="chart-grid">
            <Card className="chart-panel">
              <CardHeader className="panel-card-header">
                <CardTitle>Distribuição por programa</CardTitle>
                <CardDescription>Quantidade de registros por programa vigente.</CardDescription>
              </CardHeader>
              <CardContent>
                {programData.length ? (
                  <ChartContainer config={programConfig} className="h-[280px] w-full aspect-auto">
                    <BarChart data={programData} layout="vertical" margin={{ left: 0, right: 20, top: 4, bottom: 4 }}>
                      <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                      <XAxis type="number" allowDecimals={false} hide domain={[0, "dataMax + 8"]} />
                      <YAxis type="category" dataKey="label" width={145} tickLine={false} axisLine={false} />
                      <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                      <Bar dataKey="count" fill="var(--color-count)" radius={[0, 4, 4, 0]} maxBarSize={24} isAnimationActive={false}>
                        <LabelList dataKey="count" position="right" fill="#274838" fontSize={11} fontWeight={600} />
                      </Bar>
                    </BarChart>
                  </ChartContainer>
                ) : <EmptyChart label="Sem programas preenchidos." />}
              </CardContent>
            </Card>
            <Card className="chart-panel">
              <CardHeader className="panel-card-header">
                <CardTitle>Etapas do ciclo 2026.2</CardTitle>
                <CardDescription>Etapa informada na base; espaços vazios permanecem visíveis.</CardDescription>
              </CardHeader>
              <CardContent>
                {stageData.length ? (
                  <ChartContainer config={stageConfig} className="h-[280px] w-full aspect-auto">
                    <BarChart data={stageData} layout="vertical" margin={{ left: 0, right: 20, top: 4, bottom: 4 }}>
                      <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                      <XAxis type="number" allowDecimals={false} hide domain={[0, "dataMax + 8"]} />
                      <YAxis type="category" dataKey="label" width={150} tickLine={false} axisLine={false} />
                      <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                      <Bar dataKey="count" fill="var(--color-count)" radius={[0, 4, 4, 0]} maxBarSize={24} isAnimationActive={false}>
                        <LabelList dataKey="count" position="right" fill="#274838" fontSize={11} fontWeight={600} />
                      </Bar>
                    </BarChart>
                  </ChartContainer>
                ) : <EmptyChart label="Sem etapas preenchidas." />}
              </CardContent>
            </Card>
          </div>

          <Card className="table-panel">
            <CardHeader className="panel-card-header panel-card-header-inline">
              <div>
                <CardTitle>Registros da base</CardTitle>
                <CardDescription>Uma amostra alfabética. Abra um perfil para consultar todos os campos.</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => onNavigate("people")}>
                Ver todas as pessoas <ArrowUpRight size={15} />
              </Button>
            </CardHeader>
            <PeoplePreview people={sample} onSelect={onSelect} />
          </Card>
        </>
      )}
    </div>
  );
}

function PeoplePreview({ people, onSelect }: { people: PersonRecord[]; onSelect: (person: PersonRecord) => void }) {
  return (
    <div className="table-scroll">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead><TableHead>Matrícula</TableHead><TableHead>Programa</TableHead><TableHead>Enquadre</TableHead><TableHead>Localidade</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {people.map((person) => (
            <TableRow key={person.id}>
              <TableCell><button className="person-link" onClick={() => onSelect(person)}>{valueFor(person, FIELD.name) || "Sem nome"}</button></TableCell>
              <TableCell>{person.matricula || "—"}</TableCell>
              <TableCell>{valueFor(person, FIELD.program) || "—"}</TableCell>
              <TableCell>{valueFor(person, FIELD.enquadre) || "—"}</TableCell>
              <TableCell>{valueFor(person, FIELD.location) || "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function PeoplePage({ dataset, onSelect }: { dataset: AppDataset; onSelect: (person: PersonRecord) => void }) {
  const [search, setSearch] = useState("");
  const [program, setProgram] = useState("all");
  const [location, setLocation] = useState("all");
  const [page, setPage] = useState(1);
  const [columns, setColumns] = useState<string[]>(DEFAULT_COLUMNS);
  const programs = useMemo(() => uniqueValues(dataset.people, FIELD.program), [dataset.people]);
  const locations = useMemo(() => uniqueValues(dataset.people, FIELD.location), [dataset.people]);
  const fieldByKey = useMemo(() => new Map(dataset.fields.map((field) => [field.key, field])), [dataset.fields]);
  const filtered = useMemo(() => {
    const term = foldText(search.trim());
    return dataset.people.filter((person) => {
      const searchText = foldText([
        valueFor(person, FIELD.name), person.matricula,
        valueFor(person, FIELD.job), valueFor(person, FIELD.program),
      ].join(" "));
      return (!term || searchText.includes(term))
        && (program === "all" || valueFor(person, FIELD.program) === program)
        && (location === "all" || valueFor(person, FIELD.location) === location);
    });
  }, [dataset.people, search, program, location]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const shown = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const availableColumns = columns.map((key) => fieldByKey.get(key)).filter((field): field is Field => Boolean(field));
  const updateFilter = (setter: (value: string) => void) => (value: string | null) => { setter(value ?? "all"); setPage(1); };

  if (!dataset.people.length) return <div className="page-stack"><EmptyState dataset={dataset} /></div>;

  return (
    <div className="page-stack">
      <div className="filter-toolbar">
        <label className="search-field">
          <Search size={16} aria-hidden="true" />
          <Input aria-label="Buscar por nome, matrícula ou cargo" value={search} onChange={(event) => updateFilter(setSearch)(event.target.value)} placeholder="Buscar nome, matrícula ou cargo" />
        </label>
        <Select value={program} onValueChange={updateFilter(setProgram)}>
          <SelectTrigger className="filter-select" aria-label="Filtrar por programa"><SelectValue placeholder="Programa" /></SelectTrigger>
          <SelectContent><SelectItem value="all">Todos os programas</SelectItem>{programs.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={location} onValueChange={updateFilter(setLocation)}>
          <SelectTrigger className="filter-select" aria-label="Filtrar por localidade"><SelectValue placeholder="Localidade" /></SelectTrigger>
          <SelectContent><SelectItem value="all">Todas as localidades</SelectItem>{locations.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent>
        </Select>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" className="column-button"><span>Colunas</span><Badge variant="secondary">{availableColumns.length}</Badge></Button>} />
          <DropdownMenuContent align="end" className="column-menu">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Campos na tabela</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <ScrollArea className="column-options">
                {dataset.fields.map((field) => (
                  <DropdownMenuCheckboxItem key={field.key} checked={columns.includes(field.key)} onCheckedChange={(checked) => {
                    setColumns((current) => checked ? [...current, field.key] : current.filter((key) => key !== field.key));
                  }}>{field.label}</DropdownMenuCheckboxItem>
                ))}
              </ScrollArea>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Card className="table-panel">
        <div className="table-summary">
          <span><strong>{numberFormat.format(filtered.length)}</strong> {filtered.length === 1 ? "pessoa" : "pessoas"}</span>
          <span>{availableColumns.length} campos visíveis · {dataset.fields.length} campos disponíveis</span>
        </div>
        <div className="table-scroll people-table-scroll">
          <Table>
            <TableHeader><TableRow>{availableColumns.map((field) => <TableHead key={field.key}>{field.label}</TableHead>)}</TableRow></TableHeader>
            <TableBody>
              {shown.length ? shown.map((person) => (
                <TableRow key={person.id}>
                  {availableColumns.map((field, index) => (
                    <TableCell key={field.key} className={index === 0 ? "first-table-cell" : ""}>
                      {index === 0
                        ? <button className="person-link" onClick={() => onSelect(person)}>{valueFor(person, field.key) || "Sem preenchimento"}</button>
                        : valueFor(person, field.key) || <span className="muted-value">—</span>}
                    </TableCell>
                  ))}
                </TableRow>
              )) : (
                <TableRow><TableCell colSpan={Math.max(1, availableColumns.length)} className="table-empty">Nenhuma pessoa corresponde aos filtros. Limpe a busca ou selecione outro filtro.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <div className="pagination-row">
          <span>Mostrando {filtered.length ? (page - 1) * PAGE_SIZE + 1 : 0}–{Math.min(page * PAGE_SIZE, filtered.length)} de {numberFormat.format(filtered.length)}</span>
          <div className="pagination-controls">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}><ChevronLeft size={15} /> Anterior</Button>
            <span className="page-count">{page} / {pageCount}</span>
            <Button variant="outline" size="sm" disabled={page >= pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))}>Próxima <ChevronRight size={15} /></Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function EvaluationPage({ dataset }: { dataset: AppDataset }) {
  const people = dataset.people;
  const note1Count = valueCount(people, FIELD.score1);
  const potential1Count = valueCount(people, FIELD.potential1);
  const note2Count = valueCount(people, FIELD.score2);
  const potential2Count = valueCount(people, FIELD.potential2);
  const stage2Count = valueCount(people, FIELD.stage2);
  const average = averageFor(people, FIELD.score1);
  const stageData = groupCount(people, FIELD.stage2).slice(0, 8);
  const scoreData = scoreDistribution(people, FIELD.score1);
  const potentialData = groupCount(people.filter((person) => valueFor(person, FIELD.potential1)), FIELD.potential1);
  const chartConfig = { count: { label: "Pessoas", color: "#84bd00" } };

  return (
    <div className="page-stack">
      <section className="cycle-band">
        <div className="cycle-block">
          <span className="cycle-name">Ciclo 2026.1</span>
          <strong>{numberFormat.format(note1Count)} <small>com nota</small></strong>
          <span>{numberFormat.format(potential1Count)} com potencial · {average === null ? "média indisponível" : `média ${average.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}`}</span>
        </div>
        <div className="cycle-block">
          <span className="cycle-name">Ciclo 2026.2</span>
          <strong>{numberFormat.format(stage2Count)} <small>com etapa</small></strong>
          <span>{numberFormat.format(note2Count)} com nota · {numberFormat.format(potential2Count)} com potencial</span>
        </div>
      </section>
      <Alert className="subtle-alert">
        <CircleHelp size={16} />
        <AlertTitle>Ausências ficam em branco</AlertTitle>
        <AlertDescription>Os gráficos consideram somente valores preenchidos. Um campo vazio não equivale a nota zero.</AlertDescription>
      </Alert>
      <div className="chart-grid">
        <Card className="chart-panel">
          <CardHeader className="panel-card-header"><CardTitle>Notas 2026.1</CardTitle><CardDescription>Distribuição dos valores informados.</CardDescription></CardHeader>
          <CardContent>
            {scoreData.length ? (
              <ChartContainer config={chartConfig} className="h-[270px] w-full aspect-auto">
                <BarChart data={scoreData} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} domain={[0, "dataMax + 8"]} />
                  <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                  <Bar dataKey="count" fill="var(--color-count)" radius={[4, 4, 0, 0]} maxBarSize={44} isAnimationActive={false}>
                    <LabelList dataKey="count" position="top" fill="#274838" fontSize={11} fontWeight={600} />
                  </Bar>
                </BarChart>
              </ChartContainer>
            ) : <EmptyChart label="Ainda não há notas preenchidas neste ciclo." />}
          </CardContent>
        </Card>
        <Card className="chart-panel">
          <CardHeader className="panel-card-header"><CardTitle>Potencial 2026.1</CardTitle><CardDescription>Distribuição das classificações preenchidas.</CardDescription></CardHeader>
          <CardContent>
            {potentialData.length ? (
              <>
                <ChartContainer config={chartConfig} className="h-[230px] w-full aspect-auto">
                  <PieChart>
                    <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                    <Pie data={potentialData} dataKey="count" nameKey="label" innerRadius={54} outerRadius={86} paddingAngle={2} isAnimationActive={false}>
                      {potentialData.map((item, index) => <Cell key={item.label} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
                    </Pie>
                  </PieChart>
                </ChartContainer>
                <div className="chart-legend" aria-label="Legenda do potencial 2026.1">
                  {potentialData.map((item, index) => (
                    <div className="chart-legend-item" key={item.label}>
                      <span className="chart-legend-dot" style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }} />
                      <span>{item.label}</span><strong>{numberFormat.format(item.count)}</strong>
                    </div>
                  ))}
                </div>
              </>
            ) : <EmptyChart label="Ainda não há potenciais preenchidos neste ciclo." />}
          </CardContent>
        </Card>
      </div>
      <Card className="chart-panel">
        <CardHeader className="panel-card-header"><CardTitle>Etapas 2026.2</CardTitle><CardDescription>Quantidade de pessoas em cada etapa preenchida.</CardDescription></CardHeader>
        <CardContent>
          {stageData.length ? (
            <ChartContainer config={{ count: { label: "Pessoas", color: "#123d2a" } }} className="h-[280px] w-full aspect-auto">
              <BarChart data={stageData} layout="vertical" margin={{ left: 0, right: 20, top: 4, bottom: 4 }}>
                <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                <XAxis type="number" allowDecimals={false} hide domain={[0, "dataMax + 8"]} />
                <YAxis type="category" dataKey="label" width={160} tickLine={false} axisLine={false} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill="var(--color-count)" radius={[0, 4, 4, 0]} maxBarSize={24} isAnimationActive={false}>
                  <LabelList dataKey="count" position="right" fill="#274838" fontSize={11} fontWeight={600} />
                </Bar>
              </BarChart>
            </ChartContainer>
          ) : <EmptyChart label="Ainda não há etapas preenchidas neste ciclo." />}
        </CardContent>
      </Card>
      <p className="source-note">A aba TB_Agente também fornece o último ciclo, nota, potencial e histórico registrados. Esses valores completos estão disponíveis no perfil de cada pessoa.</p>
    </div>
  );
}

function QualityPage({ dataset }: { dataset: AppDataset }) {
  const { people, quality } = dataset;
  const missingEvaluations = people.filter((person) => !valueFor(person, FIELD.score1)).length;
  const missingStages = people.filter((person) => !valueFor(person, FIELD.stage2)).length;
  const critical = quality.duplicateBaseIds + quality.duplicateAgentIds + quality.missingBaseIds + quality.missingAgentIds;
  const unmatched = quality.unmatchedBaseRows + quality.unmatchedAgentRows;
  const checks = [
    { label: "Matrículas em branco", count: quality.missingBaseIds + quality.missingAgentIds, kind: "error", detail: "Preencha a matrícula nas duas abas para habilitar o cruzamento." },
    { label: "Matrículas duplicadas", count: quality.duplicateBaseIds + quality.duplicateAgentIds, kind: "error", detail: "Cada matrícula deve aparecer uma vez por aba." },
    { label: "Sem correspondência entre abas", count: unmatched, kind: "warning", detail: "Confira se a matrícula existe tanto em Base_Principal quanto em TB_Agente." },
    { label: "Nome em branco", count: quality.blankNames, kind: "warning", detail: "O perfil continuará disponível pela matrícula, mas ficará mais difícil de localizar." },
    { label: "Sem nota 2026.1", count: missingEvaluations, kind: "info", detail: "Campo sem preenchimento; não é tratado como nota zero." },
    { label: "Sem etapa 2026.2", count: missingStages, kind: "info", detail: "Campo sem preenchimento; pode ser preenchido na planilha quando estiver disponível." },
  ];
  const hasRows = quality.baseRows + quality.agentRows > 0;

  return (
    <div className="page-stack">
      {!hasRows ? <EmptyState dataset={dataset} /> : (
        <>
          <div className={`quality-summary ${critical || unmatched ? "quality-needs-attention" : "quality-clear"}`}>
            {critical || unmatched ? <AlertTriangle size={19} /> : <BadgeCheck size={19} />}
            <div><strong>{critical || unmatched ? "A base precisa de revisão" : "Sem problemas de identificação"}</strong><span>{numberFormat.format(quality.baseRows)} linhas na base principal · {numberFormat.format(quality.agentRows)} na aba de agente</span></div>
            <Badge variant={critical || unmatched ? "destructive" : "secondary"}>{critical || unmatched ? `${critical + unmatched} itens` : "Conferida"}</Badge>
          </div>
          <Card className="quality-panel">
            <CardHeader className="panel-card-header"><CardTitle>Verificações da base</CardTitle><CardDescription>Contagens atualizadas junto com os dados da planilha.</CardDescription></CardHeader>
            <CardContent className="quality-list">
              {checks.map((check) => {
                const status = check.count === 0 ? "ok" : check.kind;
                const Icon = status === "error" ? CircleX : status === "warning" ? AlertTriangle : status === "info" ? CircleHelp : BadgeCheck;
                return (
                  <div className="quality-row" key={check.label}>
                    <span className={`quality-icon quality-${status}`}><Icon size={16} /></span>
                    <div className="quality-copy"><strong>{check.label}</strong><span>{check.detail}</span></div>
                    <span className="quality-count">{numberFormat.format(check.count)}</span>
                    <Badge className={`quality-badge quality-badge-${status}`} variant="outline">{check.count ? (status === "info" ? "Informativo" : "Revisar") : "OK"}</Badge>
                  </div>
                );
              })}
            </CardContent>
          </Card>
          <div className="join-note">
            <Database size={17} />
            <p>A matrícula é a chave usada para unir as abas. O painel preserva linhas sem par para que possam ser conferidas; elas não são descartadas.</p>
          </div>
        </>
      )}
    </div>
  );
}

function EmptyState({ dataset }: { dataset: AppDataset }) {
  return (
    <section className="empty-state">
      <div className="empty-icon"><FileSpreadsheet size={25} /></div>
      <h2>A planilha está pronta para receber os dados</h2>
      <p>Os registros serão exibidos aqui depois que você colar as linhas nas abas <strong>Base_Principal</strong> e <strong>TB_Agente</strong>. Mantenha a primeira linha de cabeçalhos.</p>
      {dataset.spreadsheetUrl && <Button render={<a href={dataset.spreadsheetUrl} target="_blank" rel="noreferrer" />}>Abrir planilha <ExternalLink size={15} /></Button>}
      <span className="empty-help">Consulte a aba Instruções dentro da planilha antes de colar os dados.</span>
    </section>
  );
}

function ProfileSheet({ person, dataset, open, onOpenChange }: {
  person: PersonRecord | null;
  dataset: AppDataset;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const groups = fieldGroups(dataset.fields);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="profile-sheet">
        <SheetHeader className="profile-header">
          <Badge variant="secondary" className="profile-badge">Perfil completo</Badge>
          <SheetTitle>{person ? valueFor(person, FIELD.name) || "Pessoa sem nome" : "Perfil"}</SheetTitle>
          <SheetDescription>{person?.matricula ? `Matrícula ${person.matricula}` : "Matrícula não preenchida"} · dados disponíveis nas abas de origem</SheetDescription>
          {person && <div className="profile-quickfacts"><span><Building2 size={14} />{valueFor(person, FIELD.program) || "Programa não informado"}</span><span><MapPin size={14} />{valueFor(person, FIELD.location) || "Localidade não informada"}</span></div>}
        </SheetHeader>
        <ScrollArea className="profile-scroll">
          {person && groups.map((group) => (
            <section className="detail-group" key={group.label}>
              <h3>{group.label}</h3>
              <dl className="detail-grid">
                {group.fields.map((field) => {
                  const value = valueFor(person, field.key);
                  return <div className={`detail-field ${field.key === FIELD.history || field.key === "observacao" ? "detail-field-wide" : ""}`} key={field.key}>
                    <dt>{field.label}</dt><dd className={value ? "" : "detail-missing"}>{value || "Sem preenchimento"}</dd>
                    <span className="detail-source">{field.source.length > 1 ? "Disponível nas duas abas" : `Aba ${field.source[0]}`}</span>
                  </div>;
                })}
              </dl>
            </section>
          ))}
        </ScrollArea>
        <div className="profile-footer"><span>{dataset.fields.length} campos disponíveis</span><span>Atualize os dados diretamente na planilha.</span></div>
      </SheetContent>
    </Sheet>
  );
}

function LoadingState() {
  return <div className="loading-state" aria-label="Carregando dados"><Skeleton className="h-24 w-full" /><div className="loading-grid"><Skeleton className="h-80 w-full" /><Skeleton className="h-80 w-full" /></div><Skeleton className="h-72 w-full" /></div>;
}

function AppNavigation({ page, onNavigate }: { page: Page; onNavigate: (page: Page) => void }) {
  const { isMobile, setOpenMobile } = useSidebar();
  return (
    <SidebarMenu>
      {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
        <SidebarMenuItem key={id}>
          <SidebarMenuButton isActive={page === id} tooltip={label} onClick={() => {
            onNavigate(id);
            if (isMobile) setOpenMobile(false);
          }}>
            <Icon /><span>{label}</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
}

export default function App() {
  const [page, setPage] = useState<Page>("overview");
  const [dataset, setDataset] = useState<AppDataset | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<PersonRecord | null>(null);

  const reload = useCallback(async (initial = false) => {
    if (initial) setLoading(true);
    else setRefreshing(true);
    setError("");
    try {
      const payload = await loadDashboardData();
      setDataset(createDataset(payload));
      if (!initial) toast.success(previewMode ? "Amostra sintética atualizada." : "Dados atualizados da planilha.");
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Não foi possível carregar as abas da planilha.";
      setError(message);
      if (!initial) toast.error(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void reload(true); }, [reload]);

  const current = VIEW_META[page];
  const recordTotal = dataset?.people.length ?? 0;
  const canExport = Boolean(dataset?.people.length);

  return (
    <TooltipProvider>
      <SidebarProvider defaultOpen>
        <Sidebar collapsible="icon" className="gt-sidebar">
          <SidebarHeader className="brand-header">
            <div className="brand-lockup"><span className="brand-mark">G</span><div className="brand-copy"><strong>GT / GP</strong><span>Painel de gestão</span></div></div>
          </SidebarHeader>
          <SidebarSeparator />
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Navegação</SidebarGroupLabel>
              <SidebarGroupContent>
                <AppNavigation page={page} onNavigate={setPage} />
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter className="sidebar-bottom">
            <div className="sidebar-data-status"><span className="status-dot" /><span>{previewMode ? "Demonstração sintética" : "Fonte: Google Sheets"}</span></div>
            {dataset?.spreadsheetUrl && <a className="sidebar-sheet-link" href={dataset.spreadsheetUrl} target="_blank" rel="noreferrer"><FileSpreadsheet size={15} /><span>Abrir planilha</span><ExternalLink size={13} /></a>}
            <div className="sidebar-footer-note">MVP · leitura e análise da base</div>
          </SidebarFooter>
        </Sidebar>
        <SidebarInset className="app-inset">
          <header className="app-toolbar">
            <div className="toolbar-leading"><SidebarTrigger /><span className="toolbar-divider" /><span className="toolbar-context">GT / GP</span></div>
            <div className="toolbar-trailing">
              {dataset && <span className="sync-label"><span className="status-dot" />{previewMode ? "Dados simulados" : updateTime(dataset.updatedAt)}</span>}
              <Button aria-label="Atualizar dados" variant="outline" size="sm" disabled={refreshing} onClick={() => void reload()}><RefreshCw size={15} className={refreshing ? "spin" : ""} /><span>Atualizar</span></Button>
              <Button aria-label="Exportar resultados como XLSX" size="sm" disabled={!canExport} onClick={() => dataset && downloadXlsx(dataset.fields, dataset.people)}><ArrowDownToLine size={15} /><span>Exportar XLSX</span></Button>
            </div>
          </header>
          <main className="main-content">
            <div className="page-heading">
              <div><h1>{current.title}</h1><p>{current.description}</p></div>
              {dataset && <Badge variant="outline" className={previewMode ? "demo-badge" : "connected-badge"}>{previewMode ? "Demonstração com dados sintéticos" : "Planilha conectada"}</Badge>}
            </div>
            {error && <Alert variant="destructive" className="load-error"><CircleX size={17} /><AlertTitle>Não foi possível carregar a planilha</AlertTitle><AlertDescription>{error}<Button variant="outline" size="sm" onClick={() => void reload()}>Tentar novamente</Button></AlertDescription></Alert>}
            {loading && !dataset ? <LoadingState /> : dataset && (
              <>
                {page === "overview" && <OverviewPage dataset={dataset} onNavigate={setPage} onSelect={setSelected} />}
                {page === "people" && <PeoplePage dataset={dataset} onSelect={setSelected} />}
                {page === "evaluations" && <EvaluationPage dataset={dataset} />}
                {page === "quality" && <QualityPage dataset={dataset} />}
              </>
            )}
            {!loading && !dataset && !error && <div className="empty-state"><h2>Aguardando a planilha</h2><p>Verifique a conexão e tente novamente.</p><Button onClick={() => void reload()}>Recarregar</Button></div>}
            {dataset && <footer className="page-footnote">A fonte editável é a planilha vinculada. O painel não altera os registros.</footer>}
          </main>
        </SidebarInset>
      </SidebarProvider>
      <ProfileSheet person={selected} dataset={dataset ?? { fields: [], people: [], quality: { baseRows: 0, agentRows: 0, duplicateBaseIds: 0, duplicateAgentIds: 0, missingBaseIds: 0, missingAgentIds: 0, unmatchedBaseRows: 0, unmatchedAgentRows: 0, blankNames: 0 }, spreadsheetUrl: "", updatedAt: "", sourceLabel: "" }} open={Boolean(selected)} onOpenChange={(open) => { if (!open) setSelected(null); }} />
      <Toaster position="bottom-right" />
    </TooltipProvider>
  );
}
