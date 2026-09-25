import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CheckCircle2, Download, Share2 } from "lucide-react";
import { toast } from "sonner";
import { fmtBRL, fmtDate, firstDayOfMonth, today } from "@/lib/format";
import { buildFechamentoPDF, pdfFilename, savePDF, sharePDF, type DespesaRow } from "@/lib/pdf";

export const Route = createFileRoute("/_authenticated/fechamento")({
  head: () => ({
    meta: [
      { title: "Fechamento — Hubvision" },
      { name: "description", content: "Feche períodos de despesas e gere relatórios PDF." },
      { property: "og:title", content: "Fechamento — Hubvision" },
      { property: "og:description", content: "Gere e compartilhe relatórios de prestação de contas." },
    ],
  }),
  component: FechamentoPage,
});

interface DespesaLite {
  id: string; valor: number; data_despesa: string; tipo_despesa: string;
  cidade: string; uf: string; status: string; colaborador_id: string;
  colaboradores: { nome: string } | null;
}

interface Relatorio {
  id: string; data_inicio: string; data_fim: string; colaborador_filtro: string | null;
  total: number; quantidade: number; status: string; created_at: string;
}

function FechamentoPage() {
  const [tab, setTab] = useState<"novo" | "historico">("novo");

  return (
    <div className="px-4 pt-6 pb-4">
      <header className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight">Fechamento</h1>
        <p className="text-sm text-muted-foreground">Gere relatórios do período</p>
      </header>

      <div className="inline-flex p-1 rounded-full bg-muted mb-5">
        {[
          { k: "novo", label: "Novo fechamento" },
          { k: "historico", label: "Histórico" },
        ].map((t) => (
          <button key={t.k} onClick={() => setTab(t.k as "novo" | "historico")}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
              tab === t.k ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground"
            }`}>{t.label}</button>
        ))}
      </div>

      {tab === "novo" ? <NovoFechamento /> : <Historico />}
    </div>
  );
}

function NovoFechamento() {
  const qc = useQueryClient();
  const [dataInicio, setDataInicio] = useState(firstDayOfMonth());
  const [dataFim, setDataFim] = useState(today());
  const [colabFilter, setColabFilter] = useState<string>("todos");
  const [concluded, setConcluded] = useState<{ inicio: string; fim: string; colab: string | null; rows: DespesaRow[]; total: number } | null>(null);

  const { data: colaboradores = [] } = useQuery({
    queryKey: ["colaboradores"],
    queryFn: async () => {
      const { data, error } = await supabase.from("colaboradores").select("*").order("nome");
      if (error) throw error;
      return data;
    },
  });

  const { data: despesas = [] } = useQuery<DespesaLite[]>({
    queryKey: ["despesas", "fechamento", dataInicio, dataFim, colabFilter],
    queryFn: async () => {
      let q = supabase
        .from("despesas")
        .select("id, valor, data_despesa, tipo_despesa, cidade, uf, status, colaborador_id, colaboradores(nome)")
        .is("relatorio_id", null)
        .gte("data_despesa", dataInicio)
        .lte("data_despesa", dataFim)
        .order("data_despesa", { ascending: true });
      if (colabFilter !== "todos") q = q.eq("colaborador_id", colabFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data as unknown as DespesaLite[];
    },
  });

  const total = useMemo(() => despesas.reduce((a, d) => a + Number(d.valor), 0), [despesas]);

  const conclude = useMutation({
    mutationFn: async () => {
      const colabNome = colabFilter === "todos" ? null : colaboradores.find((c) => c.id === colabFilter)?.nome ?? null;
      const { data: rel, error } = await supabase.from("relatorios_fechamento").insert({
        data_inicio: dataInicio,
        data_fim: dataFim,
        colaborador_filtro: colabNome,
        total,
        quantidade: despesas.length,
        status: "concluido",
      }).select().single();
      if (error) throw error;
      const ids = despesas.map((d) => d.id);
      if (ids.length) {
        const { error: upErr } = await supabase.from("despesas").update({ relatorio_id: rel.id, status: "fechada" }).in("id", ids);
        if (upErr) throw upErr;
      }
      return { rel, colabNome };
    },
    onSuccess: ({ colabNome }) => {
      qc.invalidateQueries({ queryKey: ["despesas"] });
      qc.invalidateQueries({ queryKey: ["relatorios"] });
      qc.invalidateQueries({ queryKey: ["despesas", "pending-count"] });
      setConcluded({
        inicio: dataInicio, fim: dataFim, colab: colabNome,
        rows: despesas.map((d) => ({
          colaborador: d.colaboradores?.nome ?? "—",
          tipo_despesa: d.tipo_despesa,
          cidade: d.cidade, uf: d.uf,
          data_despesa: d.data_despesa,
          status: d.status,
          valor: Number(d.valor),
        })),
        total,
      });
      toast.success("Fechamento concluído!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (concluded) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
        <div className="mx-auto size-14 rounded-full bg-[var(--color-status-approved-bg)] flex items-center justify-center">
          <CheckCircle2 className="size-7 text-[var(--color-status-approved)]" />
        </div>
        <h3 className="mt-4 text-lg font-semibold">Fechamento concluído</h3>
        <p className="text-sm text-muted-foreground">
          {fmtDate(concluded.inicio)} a {fmtDate(concluded.fim)} · {concluded.rows.length} despesas
        </p>
        <div className="mt-3 text-3xl font-mono-ledger font-bold">{fmtBRL(concluded.total)}</div>

        <PDFButtons
          onGet={() => buildFechamentoPDF({
            dataInicio: concluded.inicio, dataFim: concluded.fim, colaboradorFiltro: concluded.colab,
            despesas: concluded.rows, total: concluded.total, concluidoEm: new Date().toLocaleString("pt-BR"),
          })}
          filename={pdfFilename(concluded.inicio, concluded.fim)}
        />

        <Button variant="outline" className="mt-3 w-full" onClick={() => setConcluded(null)}>
          Iniciar novo fechamento
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Data inicial</Label>
            <Input type="date" className="font-mono-ledger" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Data final</Label>
            <Input type="date" className="font-mono-ledger" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Colaborador (opcional)</Label>
          <Select value={colabFilter} onValueChange={setColabFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {colaboradores.map((c) => (<SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--color-gold)]/60 bg-[var(--color-gold-soft)]/60 p-5">
        <div className="text-[11px] uppercase tracking-wider font-semibold text-[var(--color-ink)]/70">Prévia do período</div>
        <div className="mt-1 flex items-baseline justify-between gap-3">
          <div>
            <div className="text-3xl font-mono-ledger font-bold text-[var(--color-ink)]">{fmtBRL(total)}</div>
            <div className="text-xs text-[var(--color-ink)]/70">{despesas.length} despesa(s) elegíveis</div>
          </div>
        </div>
      </div>

      {despesas.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-2">Prévia</div>
          <ul className="divide-y divide-border">
            {despesas.slice(0, 40).map((d) => (
              <li key={d.id} className="py-2 flex items-center justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <div className="truncate font-medium">{d.tipo_despesa}</div>
                  <div className="text-xs text-muted-foreground">
                    {d.colaboradores?.nome} · <span className="font-mono-ledger">{fmtDate(d.data_despesa)}</span>
                  </div>
                </div>
                <div className="font-mono-ledger font-semibold">{fmtBRL(d.valor)}</div>
              </li>
            ))}
          </ul>
          {despesas.length > 40 && (
            <p className="text-xs text-muted-foreground pt-2">…e mais {despesas.length - 40}</p>
          )}
        </div>
      )}

      <Button
        className="w-full h-12 text-base font-semibold"
        disabled={conclude.isPending || despesas.length === 0}
        onClick={() => { if (confirm("Concluir fechamento? As despesas ficarão bloqueadas.")) conclude.mutate(); }}
      >
        {conclude.isPending ? "Processando…" : "Concluir fechamento"}
      </Button>
    </div>
  );
}

function Historico() {
  const { data: relatorios = [], isLoading } = useQuery<Relatorio[]>({
    queryKey: ["relatorios"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("relatorios_fechamento")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Relatorio[];
    },
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando…</p>;
  if (relatorios.length === 0)
    return (
      <div className="rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground text-sm">
        Nenhum fechamento concluído ainda.
      </div>
    );

  return (
    <div className="space-y-3">
      {relatorios.map((r) => <HistoricoCard key={r.id} r={r} />)}
    </div>
  );
}

function HistoricoCard({ r }: { r: Relatorio }) {
  const fetchRows = async (): Promise<DespesaRow[]> => {
    const { data, error } = await supabase
      .from("despesas")
      .select("valor, data_despesa, tipo_despesa, cidade, uf, status, colaboradores(nome)")
      .eq("relatorio_id", r.id)
      .order("data_despesa", { ascending: true });
    if (error) throw error;
    return (data as unknown as Array<{ valor: number; data_despesa: string; tipo_despesa: string; cidade: string; uf: string; status: string; colaboradores: { nome: string } | null }>).map((d) => ({
      colaborador: d.colaboradores?.nome ?? "—",
      tipo_despesa: d.tipo_despesa, cidade: d.cidade, uf: d.uf,
      data_despesa: d.data_despesa, status: d.status, valor: Number(d.valor),
    }));
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold font-mono-ledger">
            {fmtDate(r.data_inicio)} → {fmtDate(r.data_fim)}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {r.colaborador_filtro || "Todos"} · {r.quantidade} despesa(s)
          </div>
        </div>
        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-[var(--color-status-approved-bg)] text-[var(--color-status-approved)]">
          {r.status}
        </span>
      </div>
      <div className="mt-2 text-2xl font-mono-ledger font-bold">{fmtBRL(r.total)}</div>
      <PDFButtons
        onGet={async () => {
          const rows = await fetchRows();
          return buildFechamentoPDF({
            dataInicio: r.data_inicio, dataFim: r.data_fim,
            colaboradorFiltro: r.colaborador_filtro, despesas: rows, total: Number(r.total),
            concluidoEm: new Date(r.created_at).toLocaleString("pt-BR"),
          });
        }}
        filename={pdfFilename(r.data_inicio, r.data_fim)}
      />
    </div>
  );
}

function PDFButtons({ onGet, filename }: { onGet: () => Promise<import("jspdf").jsPDF> | import("jspdf").jsPDF; filename: string }) {
  const [busy, setBusy] = useState<"share" | "save" | null>(null);
  const run = async (mode: "share" | "save") => {
    setBusy(mode);
    try {
      const doc = await onGet();
      if (mode === "share") await sharePDF(doc, filename);
      else savePDF(doc, filename);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="mt-4 grid grid-cols-2 gap-2">
      <Button variant="outline" onClick={() => run("share")} disabled={busy !== null}>
        <Share2 className="size-4 mr-1.5" /> Compartilhar
      </Button>
      <Button onClick={() => run("save")} disabled={busy !== null}>
        <Download className="size-4 mr-1.5" /> Salvar
      </Button>
    </div>
  );
}

