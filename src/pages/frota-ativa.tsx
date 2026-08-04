import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Car, TrendingUp, Wallet, Wrench, AlertTriangle, WifiOff, AlertOctagon, Wifi, X, Receipt } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { BuscaPlaca } from "@/components/shared/busca-placa";
import { SortableHead } from "@/components/shared/sortable-head";
import { RelatorioExport } from "@/components/shared/relatorio-export";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useSort } from "@/hooks/use-sort";
import { useCanWrite } from "@/hooks/use-can-write";
import { useGerarReceitaAluguel } from "@/hooks/use-finance";
import { useFrotaAtiva, GRUPO_LABEL, type FrotaVeiculo } from "@/hooks/use-frota-ativa";
import { formatCurrency, formatNumber, maskPlaca, soAlfa } from "@/lib/format";
import { ymAtual } from "@/lib/date";
import type { RelatorioTabelaData, RelColuna } from "@/lib/relatorio-tabela";

const TODOS = "__todos__";
const pct = (n: number) => `${Math.round(n * 100)}%`;

/** Rótulos curtos de status para a tabela (o rótulo completo vai no tooltip). */
const STATUS_CURTO: Record<string, string> = {
  locado: "Locado",
  carro_reserva: "Reserva",
  disponivel_para_locar: "Disponível",
  disponivel: "Disponível",
  em_manutencao_rapida: "Manut. rápida",
  em_manutencao_demorada: "Manut. demorada",
  manutencao: "Manutenção",
};

/** Select de filtro por coluna, com opção "Todos". */
function FiltroSelect({ label, value, onChange, options, render }: {
  label: string; value: string; onChange: (v: string) => void; options: string[]; render?: (v: string) => string;
}) {
  if (options.length === 0) return null;
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={`h-8 w-auto gap-1 text-xs ${value !== TODOS ? "border-primary text-primary" : ""}`}>
        <span className="text-muted-foreground">{label}:</span>
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="max-h-72">
        <SelectItem value={TODOS}>Todos</SelectItem>
        {options.map((o) => <SelectItem key={o} value={o}>{render ? render(o) : o}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

function StatusBadge({ label, cor, title }: { label: string; cor: string | null; title?: string }) {
  return (
    <Badge variant="secondary" className="gap-1 whitespace-nowrap px-1.5 py-0 text-[10px]" title={title}>
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: cor ?? "currentColor" }} />
      {label}
    </Badge>
  );
}

export default function FrotaAtivaPage() {
  const navigate = useNavigate();
  const [ym, setYm] = useState(ymAtual());
  const refMes = useMemo(() => { const [y, m] = ym.split("-").map(Number); return new Date(y, m - 1, 1); }, [ym]);
  const { linhas, totais, statusMap, isLoading } = useFrotaAtiva(refMes);
  const canWriteFin = useCanWrite("finance");
  const gerarReceita = useGerarReceitaAluguel();

  const [search, setSearch] = useState("");
  const [fStatus, setFStatus] = useState(TODOS);
  const [fGrupo, setFGrupo] = useState<string>(TODOS);
  const [fProprietario, setFProprietario] = useState(TODOS);
  const [fLocatario, setFLocatario] = useState(TODOS);
  const { sortKey, sortDir, toggle, useSorted } = useSort<FrotaVeiculo>("placa", "asc");

  const mesLabel = useMemo(() => {
    const s = refMes.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    return s.charAt(0).toUpperCase() + s.slice(1);
  }, [refMes]);

  const opcoes = useMemo(() => {
    const status = new Set<string>(), props = new Set<string>(), locs = new Set<string>();
    for (const l of linhas) {
      status.add(l.status);
      if (l.vehicle.proprietario_nome) props.add(l.vehicle.proprietario_nome);
      if (l.locatario) locs.add(l.locatario);
    }
    return {
      status: [...status].sort((a, b) => (statusMap.get(a)?.label ?? a).localeCompare(statusMap.get(b)?.label ?? b, "pt-BR")),
      proprietarios: [...props].sort((a, b) => a.localeCompare(b, "pt-BR")),
      locatarios: [...locs].sort((a, b) => a.localeCompare(b, "pt-BR")),
    };
  }, [linhas, statusMap]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const qa = soAlfa(search);
    return linhas.filter((l) => {
      const v = l.vehicle;
      const prop = v.proprietario_nome ?? "";
      const loc = l.locatario ?? "";
      const mSearch = !q || v.placa.toLowerCase().includes(q) || v.modelo.toLowerCase().includes(q) ||
        v.marca.toLowerCase().includes(q) || prop.toLowerCase().includes(q) || loc.toLowerCase().includes(q) ||
        (qa !== "" && soAlfa(v.placa).includes(qa));
      const mStatus = fStatus === TODOS || l.status === fStatus;
      const mGrupo = fGrupo === TODOS || l.grupo === fGrupo;
      const mProp = fProprietario === TODOS || prop === fProprietario;
      const mLoc = fLocatario === TODOS || loc === fLocatario;
      return mSearch && mStatus && mGrupo && mProp && mLoc;
    });
  }, [linhas, search, fStatus, fGrupo, fProprietario, fLocatario]);

  const sorted = useSorted(filtered, (l, k) => {
    switch (k) {
      case "placa": return l.vehicle.placa;
      case "modelo": return `${l.vehicle.marca} ${l.vehicle.modelo}`;
      case "status": return l.statusLabel;
      case "locatario": return l.locatario ?? "";
      case "contrato": return l.contrato?.numero ?? "";
      case "proj": return l.receitaProjMes;
      case "real": return l.receitaRealMes;
      case "custo": return l.custoManutMes;
      case "km": return l.kmMes;
      case "pend": return l.pendVencidas * 1000 + l.pendAbertas;
      case "rastr": return l.rastComunicando === null ? -1 : l.rastComunicando ? 1 : 0;
      case "ocorr": return l.ocorrAbertas;
      default: return "";
    }
  });

  const filtrosAtivos = fStatus !== TODOS || fGrupo !== TODOS || fProprietario !== TODOS || fLocatario !== TODOS || !!search;
  function limpar() { setSearch(""); setFStatus(TODOS); setFGrupo(TODOS); setFProprietario(TODOS); setFLocatario(TODOS); }
  const toggleGrupo = (g: string) => setFGrupo((cur) => (cur === g ? TODOS : g));

  // Agrupamento por locatário (aba).
  const porLocatario = useMemo(() => {
    const m = new Map<string, { locatario: string; veiculos: number; proj: number; real: number; debito: number; vencido: number }>();
    for (const l of filtered) {
      const nome = l.locatario ?? "— Sem locatário";
      const cur = m.get(nome) ?? { locatario: nome, veiculos: 0, proj: 0, real: 0, debito: 0, vencido: 0 };
      cur.veiculos += 1; cur.proj += l.receitaProjMes; cur.real += l.receitaRealMes;
      cur.debito += l.debitoAberto; cur.vencido += l.debitoVencido;
      m.set(nome, cur);
    }
    return [...m.values()].sort((a, b) => b.proj - a.proj);
  }, [filtered]);

  function buildRelatorio(): RelatorioTabelaData {
    const colunas: RelColuna[] = [
      { label: "Placa" }, { label: "Modelo" }, { label: "Status" }, { label: "Locatário" }, { label: "Contrato" },
      { label: "Receita proj.", align: "right" }, { label: "Receita real.", align: "right" }, { label: "Custo mês", align: "right" },
      { label: "KM mês", align: "right" }, { label: "Pend.", align: "right" }, { label: "Rastr." }, { label: "Ocorr.", align: "right" },
    ];
    const linhasRel = sorted.map((l) => [
      maskPlaca(l.vehicle.placa), `${l.vehicle.marca} ${l.vehicle.modelo}`, l.statusLabel, l.locatario ?? "—", l.contrato?.numero ?? "—",
      formatCurrency(l.receitaProjMes), formatCurrency(l.receitaRealMes), formatCurrency(l.custoManutMes),
      formatNumber(Math.round(l.kmMes)), l.pendVencidas > 0 ? `${l.pendAbertas} (${l.pendVencidas} venc.)` : String(l.pendAbertas),
      l.rastComunicando === null ? "—" : l.rastComunicando ? "OK" : "Sem comunicação", String(l.ocorrAbertas),
    ]);
    return {
      titulo: "Frota ativa", subtitulo: `${sorted.length} veículo(s) · ${mesLabel}`,
      filtros: [
        { label: "Busca", valor: search },
        { label: "Status", valor: fStatus === TODOS ? "Todos" : (statusMap.get(fStatus)?.label ?? fStatus) },
        { label: "Proprietário", valor: fProprietario === TODOS ? "Todos" : fProprietario },
        { label: "Locatário", valor: fLocatario === TODOS ? "Todos" : fLocatario },
      ],
      colunas, linhas: linhasRel,
      rodape: ["", "", "", "", "Total",
        formatCurrency(sorted.reduce((s, l) => s + l.receitaProjMes, 0)),
        formatCurrency(sorted.reduce((s, l) => s + l.receitaRealMes, 0)),
        formatCurrency(sorted.reduce((s, l) => s + l.custoManutMes, 0)),
        "", "", "", ""],
    };
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Frota Ativa"
        description={`Gestão dos veículos operacionais (locado, carro reserva, disponível, manutenção) · ${mesLabel}`}
        actions={
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Mês</label>
              <Input type="month" value={ym} onChange={(e) => setYm(e.target.value || ymAtual())} className="w-40" />
            </div>
            {canWriteFin && (
              <Button
                variant="outline"
                size="sm"
                disabled={gerarReceita.isPending}
                onClick={() => {
                  if (confirm(`Gerar os lançamentos de receita de aluguel dos contratos ativos para ${mesLabel}?\n\nUma semana por contrato (valor semanal), apenas para semanas já ocorridas. Não duplica lançamentos já existentes.`))
                    gerarReceita.mutate({ refMes });
                }}
                title="Lança a receita de aluguel semanal dos contratos ativos no mês (idempotente)"
              >
                <Receipt className="h-4 w-4" /> {gerarReceita.isPending ? "Gerando..." : "Gerar receita de aluguel"}
              </Button>
            )}
            <RelatorioExport build={buildRelatorio} nomeArquivo="frota-ativa" disabled={!sorted.length} />
          </div>
        }
      />

      {/* KPIs principais */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Frota ativa" value={totais.veiculos} hint={`${totais.porGrupo.locado} locados · ${totais.porGrupo.disponivel} disponíveis`} icon={<Car className="h-5 w-5" />} onClick={() => navigate("/veiculos")} />
        <StatCard title={`Receita projetada · ${mesLabel}`} value={formatCurrency(totais.receitaProjMes)} hint="Contratos ativos (semanal × mês)" tone="default" icon={<TrendingUp className="h-5 w-5" />} onClick={() => navigate("/contratos")} />
        <StatCard title={`Receita realizada · ${mesLabel}`} value={formatCurrency(totais.receitaRealMes)} hint={`Realização ${pct(totais.realizacaoPct)}`} tone={totais.realizacaoPct >= 0.9 ? "success" : "warning"} icon={<Wallet className="h-5 w-5" />} onClick={() => navigate("/receitas")} />
        <StatCard title={`Custos de manutenção · ${mesLabel}`} value={formatCurrency(totais.custoManutMes)} hint={`${totais.emManutencao} em manutenção`} tone="destructive" icon={<Wrench className="h-5 w-5" />} onClick={() => navigate("/despesas")} />
      </div>

      {/* Distribuição por status */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {(Object.keys(GRUPO_LABEL) as (keyof typeof GRUPO_LABEL)[]).map((g) => (
          <button key={g} type="button" onClick={() => toggleGrupo(g)} className="text-left">
            <Card className={`transition-colors hover:border-primary/40 hover:bg-accent/40 ${fGrupo === g ? "border-primary" : ""}`}><CardContent className="p-3">
              <p className="text-xs text-muted-foreground">{GRUPO_LABEL[g]}</p>
              <p className="text-lg font-bold">{totais.porGrupo[g]}</p>
            </CardContent></Card>
          </button>
        ))}
      </div>

      {/* Faixa de alertas (clicável) */}
      <div className="grid gap-3 sm:grid-cols-3">
        <button type="button" onClick={() => navigate("/pendencias")} className="text-left">
          <Card className={totais.pendVencidas > 0 ? "border-destructive/40" : ""}><CardContent className="flex items-center gap-3 p-3">
            <AlertTriangle className={`h-5 w-5 ${totais.pendVencidas > 0 ? "text-destructive" : "text-muted-foreground"}`} />
            <div><p className="text-lg font-bold">{totais.pendVencidas}</p><p className="text-xs text-muted-foreground">Pendências vencidas</p></div>
          </CardContent></Card>
        </button>
        <button type="button" onClick={() => navigate("/rastreamento")} className="text-left">
          <Card className={totais.semComunicacao > 0 ? "border-warning/40" : ""}><CardContent className="flex items-center gap-3 p-3">
            <WifiOff className={`h-5 w-5 ${totais.semComunicacao > 0 ? "text-warning" : "text-muted-foreground"}`} />
            <div><p className="text-lg font-bold">{totais.semComunicacao}</p><p className="text-xs text-muted-foreground">Rastreadores sem comunicar</p></div>
          </CardContent></Card>
        </button>
        <button type="button" onClick={() => navigate("/ocorrencias")} className="text-left">
          <Card className={totais.ocorrAbertas > 0 ? "border-warning/40" : ""}><CardContent className="flex items-center gap-3 p-3">
            <AlertOctagon className={`h-5 w-5 ${totais.ocorrAbertas > 0 ? "text-warning" : "text-muted-foreground"}`} />
            <div><p className="text-lg font-bold">{totais.ocorrAbertas}</p><p className="text-xs text-muted-foreground">Ocorrências abertas</p></div>
          </CardContent></Card>
        </button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="flex flex-col gap-2 border-b p-3 sm:flex-row sm:items-center sm:p-4">
            <BuscaPlaca value={search} onChange={setSearch} vehicles={linhas.map((l) => l.vehicle)} placeholder="Buscar por placa, modelo, proprietário ou locatário..." />
          </div>
          <div className="flex flex-wrap items-center gap-2 border-b bg-muted/20 p-3">
            <FiltroSelect label="Status" value={fStatus} onChange={setFStatus} options={opcoes.status} render={(s) => statusMap.get(s)?.label ?? s} />
            <FiltroSelect label="Proprietário" value={fProprietario} onChange={setFProprietario} options={opcoes.proprietarios} />
            <FiltroSelect label="Locatário" value={fLocatario} onChange={setFLocatario} options={opcoes.locatarios} />
            {filtrosAtivos && <Button variant="ghost" size="sm" onClick={limpar}><X className="h-4 w-4" /> Limpar</Button>}
            <span className="ml-auto text-xs text-muted-foreground">{sorted.length} de {linhas.length}</span>
          </div>

          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Carregando...</div>
          ) : linhas.length === 0 ? (
            <EmptyState message="Nenhum veículo na frota ativa" icon={<Car className="h-6 w-6" />} />
          ) : (
            <Tabs defaultValue="veiculos">
              <div className="border-b px-3 pt-2">
                <TabsList>
                  <TabsTrigger value="veiculos">Veículos</TabsTrigger>
                  <TabsTrigger value="locatarios">Por locatário</TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="veiculos" className="m-0">
                <div className="overflow-x-auto">
                  <Table className="text-xs [&_th]:h-9 [&_th]:whitespace-nowrap [&_th]:px-1 [&_th]:text-[11px] [&_td]:px-1 [&_td]:py-2">
                    <TableHeader>
                      <TableRow>
                        <SortableHead sortKey="placa" activeKey={sortKey} dir={sortDir} onSort={toggle}>Placa</SortableHead>
                        <SortableHead sortKey="modelo" activeKey={sortKey} dir={sortDir} onSort={toggle}>Modelo</SortableHead>
                        <SortableHead sortKey="status" activeKey={sortKey} dir={sortDir} onSort={toggle}>Status</SortableHead>
                        <SortableHead sortKey="locatario" activeKey={sortKey} dir={sortDir} onSort={toggle}>Locatário</SortableHead>
                        <SortableHead sortKey="contrato" activeKey={sortKey} dir={sortDir} onSort={toggle}>Contrato</SortableHead>
                        <SortableHead sortKey="proj" activeKey={sortKey} dir={sortDir} onSort={toggle} align="right">Rec. proj.</SortableHead>
                        <SortableHead sortKey="real" activeKey={sortKey} dir={sortDir} onSort={toggle} align="right">Rec. real.</SortableHead>
                        <SortableHead sortKey="custo" activeKey={sortKey} dir={sortDir} onSort={toggle} align="right">Custo</SortableHead>
                        <SortableHead sortKey="km" activeKey={sortKey} dir={sortDir} onSort={toggle} align="right">KM</SortableHead>
                        <SortableHead sortKey="pend" activeKey={sortKey} dir={sortDir} onSort={toggle}>Pend.</SortableHead>
                        <SortableHead sortKey="rastr" activeKey={sortKey} dir={sortDir} onSort={toggle}>Rastr.</SortableHead>
                        <SortableHead sortKey="ocorr" activeKey={sortKey} dir={sortDir} onSort={toggle} align="right">Ocorr.</SortableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sorted.map((l) => (
                        <TableRow key={l.vehicle.id} className="cursor-pointer" onClick={() => navigate(`/frota-ativa/${l.vehicle.id}`)}>
                          <TableCell className="whitespace-nowrap font-mono font-medium">{maskPlaca(l.vehicle.placa)}</TableCell>
                          <TableCell className="max-w-[104px] truncate" title={`${l.vehicle.marca} ${l.vehicle.modelo}`}>{l.vehicle.marca} {l.vehicle.modelo}</TableCell>
                          <TableCell><StatusBadge label={STATUS_CURTO[l.status] ?? l.statusLabel} cor={l.statusCor} title={l.statusLabel} /></TableCell>
                          <TableCell className="max-w-[96px] truncate" title={l.locatario ?? undefined}>{l.locatario ?? <span className="text-muted-foreground">—</span>}</TableCell>
                          <TableCell className="whitespace-nowrap font-mono">{l.contrato?.numero ?? <span className="text-muted-foreground">—</span>}</TableCell>
                          <TableCell className="whitespace-nowrap text-right tabular-nums">{l.receitaProjMes > 0 ? formatCurrency(l.receitaProjMes) : <span className="text-muted-foreground">—</span>}</TableCell>
                          <TableCell className="whitespace-nowrap text-right tabular-nums">{l.receitaRealMes > 0 ? formatCurrency(l.receitaRealMes) : <span className="text-muted-foreground">—</span>}</TableCell>
                          <TableCell className="whitespace-nowrap text-right tabular-nums">{l.custoManutMes > 0 ? formatCurrency(l.custoManutMes) : <span className="text-muted-foreground">—</span>}</TableCell>
                          <TableCell className="whitespace-nowrap text-right tabular-nums">{l.kmMes > 0 ? formatNumber(Math.round(l.kmMes)) : <span className="text-muted-foreground">—</span>}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              {l.pendVencidas > 0 && <Badge variant="destructive" className="px-1.5 py-0 text-[10px]">{l.pendVencidas}</Badge>}
                              {l.pendAbertas > 0 ? <Badge variant={l.pendVencidas > 0 ? "warning" : "secondary"} className="px-1.5 py-0 text-[10px]">{l.pendAbertas}</Badge> : (!l.pendVencidas && <span className="text-muted-foreground">—</span>)}
                            </div>
                          </TableCell>
                          <TableCell>
                            {l.rastComunicando === null ? <span className="text-muted-foreground">—</span>
                              : l.rastComunicando ? <Wifi className="h-4 w-4 text-success" /> : <WifiOff className="h-4 w-4 text-destructive" />}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{l.ocorrAbertas > 0 ? <Badge variant="warning" className="px-1.5 py-0 text-[10px]">{l.ocorrAbertas}</Badge> : <span className="text-muted-foreground">—</span>}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              <TabsContent value="locatarios" className="m-0">
                <div className="overflow-x-auto">
                  <Table className="text-xs [&_th]:h-9 [&_th]:whitespace-nowrap [&_th]:px-2 [&_th]:text-[11px] [&_td]:px-2 [&_td]:py-2">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Locatário</TableHead>
                        <TableHead className="text-right">Veículos</TableHead>
                        <TableHead className="text-right">Receita proj.</TableHead>
                        <TableHead className="text-right">Receita real.</TableHead>
                        <TableHead className="text-right">Débito aberto</TableHead>
                        <TableHead className="text-right">Vencido</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {porLocatario.map((g) => (
                        <TableRow key={g.locatario} className="cursor-pointer" onClick={() => navigate("/resumo-locatarios")}>
                          <TableCell className="max-w-[220px] truncate font-medium" title={g.locatario}>{g.locatario}</TableCell>
                          <TableCell className="text-right tabular-nums">{g.veiculos}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatCurrency(g.proj)}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatCurrency(g.real)}</TableCell>
                          <TableCell className="text-right tabular-nums">{g.debito > 0 ? formatCurrency(g.debito) : <span className="text-muted-foreground">—</span>}</TableCell>
                          <TableCell className={`text-right tabular-nums ${g.vencido > 0 ? "font-semibold text-destructive" : ""}`}>{g.vencido > 0 ? formatCurrency(g.vencido) : <span className="text-muted-foreground">—</span>}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
