import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Check, ChevronDown, ChevronUp, Lock, Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { fmtBRL, fmtDate } from "@/lib/format";
import { STORAGE_BUCKET, TIPOS_DESPESA, UFS } from "@/lib/constants";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/despesas")({
  head: () => ({
    meta: [
      { title: "Despesas — Hubvision" },
      { name: "description", content: "Aprovações e lançamentos de despesas Hubvision." },
      { property: "og:title", content: "Despesas — Hubvision" },
      { property: "og:description", content: "Aprove, rejeite e acompanhe despesas corporativas." },
    ],
  }),
  component: DespesasPage,
});

interface Despesa {
  id: string;
  colaborador_id: string;
  tipo_despesa: string;
  uf: string;
  cidade: string;
  valor: number;
  data_despesa: string;
  descricao: string | null;
  foto_url: string | null;
  status: string;
  relatorio_id: string | null;
  created_by: string | null;
  created_at: string;
  colaboradores: { nome: string } | null;
  relatorios_fechamento: { status: string } | null;
}

function DespesasPage() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [colabFilter, setColabFilter] = useState<string>("todos");
  const [approvalMode, setApprovalMode] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editing, setEditing] = useState<Despesa | null>(null);

  const { data: userId } = useQuery({
    queryKey: ["auth", "user-id"],
    queryFn: async () => (await supabase.auth.getUser()).data.user?.id ?? null,
  });


  const { data: colaboradores = [] } = useQuery({
    queryKey: ["colaboradores"],
    queryFn: async () => {
      const { data, error } = await supabase.from("colaboradores").select("*").order("nome");
      if (error) throw error;
      return data;
    },
  });

  const { data: despesas = [], isLoading } = useQuery<Despesa[]>({
    queryKey: ["despesas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("despesas")
        .select("*, colaboradores(nome), relatorios_fechamento(status)")
        .order("data_despesa", { ascending: false });
      if (error) throw error;
      return data as unknown as Despesa[];
    },
  });

  const filtered = useMemo(() => {
    return despesas.filter((d) => {
      if (statusFilter !== "todos" && d.status !== statusFilter) return false;
      if (colabFilter !== "todos" && d.colaborador_id !== colabFilter) return false;
      return true;
    });
  }, [despesas, statusFilter, colabFilter]);

  const totals = useMemo(() => {
    let pending = 0, approved = 0;
    for (const d of despesas) {
      const v = Number(d.valor);
      if (d.status === "pendente") pending += v;
      else if (d.status === "aprovado") approved += v;
    }
    return { pending, approved };
  }, [despesas]);

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("despesas").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["despesas"] });
      qc.invalidateQueries({ queryKey: ["despesas", "pending-count"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteDespesa = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("despesas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["despesas"] });
      qc.invalidateQueries({ queryKey: ["despesas", "pending-count"] });
      toast.success("Excluída");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="px-4 pt-6 pb-4">
      <header className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight">Despesas</h1>
        <p className="text-sm text-muted-foreground">Todos os lançamentos da equipe</p>
      </header>

      <div className="grid grid-cols-2 gap-3 mb-5">
        <SummaryCard label="Pendente" value={totals.pending} tone="pending" />
        <SummaryCard label="Aprovado" value={totals.approved} tone="approved" />
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 flex-1 min-w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            <SelectItem value="pendente">Pendente</SelectItem>
            <SelectItem value="aprovado">Aprovado</SelectItem>
            <SelectItem value="rejeitado">Rejeitado</SelectItem>
            <SelectItem value="fechada">Fechada</SelectItem>
          </SelectContent>
        </Select>
        <Select value={colabFilter} onValueChange={setColabFilter}>
          <SelectTrigger className="h-9 flex-1 min-w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos colaboradores</SelectItem>
            {colaboradores.map((c) => (<SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>))}
          </SelectContent>
        </Select>
      </div>

      <label className="flex items-center gap-2 mb-4 text-sm select-none cursor-pointer">
        <Checkbox checked={approvalMode} onCheckedChange={(v) => setApprovalMode(!!v)} />
        <span className="font-medium">Modo aprovação</span>
      </label>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground text-sm">
          Nenhuma despesa encontrada.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((d) => (
            <DespesaCard
              key={d.id}
              d={d}
              expanded={expanded === d.id}
              onToggle={() => setExpanded(expanded === d.id ? null : d.id)}
              approvalMode={approvalMode}
              onApprove={() => updateStatus.mutate({ id: d.id, status: "aprovado" })}
              onReject={() => updateStatus.mutate({ id: d.id, status: "rejeitado" })}
              onDelete={() => { if (confirm("Excluir esta despesa?")) deleteDespesa.mutate(d.id); }}
              isOwner={!!userId && d.created_by === userId}
              onEdit={() => setEditing(d)}
            />
          ))}
        </div>
      )}

      <EditDespesaDialog
        despesa={editing}
        colaboradores={colaboradores}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          qc.invalidateQueries({ queryKey: ["despesas"] });
          qc.invalidateQueries({ queryKey: ["despesas", "pending-count"] });
          toast.success("Despesa atualizada");
        }}
      />
    </div>
  );
}

function EditDespesaDialog({
  despesa, colaboradores, onClose, onSaved,
}: {
  despesa: Despesa | null;
  colaboradores: { id: string; nome: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<null | {
    colaborador_id: string; tipo_despesa: string; uf: string; cidade: string;
    valor: string; data_despesa: string; descricao: string;
  }>(null);

  const current = despesa?.id;
  const [loadedFor, setLoadedFor] = useState<string | undefined>(undefined);
  if (current !== loadedFor) {
    setLoadedFor(current);
    setForm(
      despesa
        ? {
            colaborador_id: despesa.colaborador_id,
            tipo_despesa: despesa.tipo_despesa,
            uf: despesa.uf,
            cidade: despesa.cidade,
            valor: String(despesa.valor),
            data_despesa: despesa.data_despesa,
            descricao: despesa.descricao ?? "",
          }
        : null,
    );
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!despesa || !form) return;
      const valor = Number(form.valor.replace(",", "."));
      if (!Number.isFinite(valor) || valor <= 0) throw new Error("Informe um valor válido");
      const { error } = await supabase
        .from("despesas")
        .update({
          colaborador_id: form.colaborador_id,
          tipo_despesa: form.tipo_despesa,
          uf: form.uf,
          cidade: form.cidade.trim(),
          valor,
          data_despesa: form.data_despesa,
          descricao: form.descricao.trim() || null,
        })
        .eq("id", despesa.id);
      if (error) throw error;
    },
    onSuccess: onSaved,
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={!!despesa} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Editar despesa</DialogTitle></DialogHeader>
        {form && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Colaborador</Label>
              <Select value={form.colaborador_id} onValueChange={(v) => setForm({ ...form, colaborador_id: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {colaboradores.map((c) => (<SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={form.tipo_despesa} onValueChange={(v) => setForm({ ...form, tipo_despesa: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS_DESPESA.map((t) => (<SelectItem key={t} value={t}>{t}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1.5">
                <Label>UF</Label>
                <Select value={form.uf} onValueChange={(v) => setForm({ ...form, uf: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {UFS.map((u) => (<SelectItem key={u} value={u}>{u}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Cidade</Label>
                <Input value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label>Valor (R$)</Label>
                <Input inputMode="decimal" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Data</Label>
                <Input type="date" value={form.data_despesa} onChange={(e) => setForm({ ...form, data_despesa: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Textarea rows={3} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: number; tone: "pending" | "approved" }) {
  const bg = tone === "pending" ? "bg-[var(--color-status-pending-bg)]" : "bg-[var(--color-status-approved-bg)]";
  const fg = tone === "pending" ? "text-[var(--color-status-pending)]" : "text-[var(--color-status-approved)]";
  return (
    <div className={`rounded-2xl border border-border ${bg} p-4`}>
      <div className={`text-[11px] uppercase tracking-wider font-semibold ${fg}`}>{label}</div>
      <div className={`mt-1 text-xl font-mono-ledger font-semibold ${fg}`}>{fmtBRL(value)}</div>
    </div>
  );
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    pendente: "bg-[var(--color-status-pending-bg)] text-[var(--color-status-pending)]",
    aprovado: "bg-[var(--color-status-approved-bg)] text-[var(--color-status-approved)]",
    rejeitado: "bg-[var(--color-status-rejected-bg)] text-[var(--color-status-rejected)]",
    fechada: "bg-muted text-foreground/70",
  };
  return `inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${map[status] || ""}`;
}

function DespesaCard({
  d, expanded, onToggle, approvalMode, onApprove, onReject, onDelete, isOwner, onEdit,
}: {
  d: Despesa; expanded: boolean; onToggle: () => void; approvalMode: boolean;
  onApprove: () => void; onReject: () => void; onDelete: () => void;
  isOwner: boolean; onEdit: () => void;
}) {
  const locked = d.relatorio_id !== null;
  const [signed, setSigned] = useState<string | null>(null);

  const loadPhoto = async () => {
    if (!d.foto_url || signed) return;
    const { data } = await supabase.storage.from(STORAGE_BUCKET).createSignedUrl(d.foto_url, 3600);
    if (data?.signedUrl) setSigned(data.signedUrl);
  };

  return (
    <div className="rounded-[14px] border border-border bg-card overflow-hidden shadow-sm">
      <button type="button" onClick={onToggle} className="w-full text-left p-4 hover:bg-muted/40 transition">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm truncate">{d.tipo_despesa}</span>
              <span className={statusBadge(d.status)}>{d.status}</span>
              {locked && <Lock className="size-3 text-muted-foreground" aria-label="Bloqueada" />}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {d.colaboradores?.nome ?? "—"} · {d.cidade}/{d.uf} · <span className="font-mono-ledger">{fmtDate(d.data_despesa)}</span>
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="font-mono-ledger font-bold text-base">{fmtBRL(d.valor)}</div>
            <div className="mt-1 text-muted-foreground">
              {expanded ? <ChevronUp className="size-4 inline" /> : <ChevronDown className="size-4 inline" />}
            </div>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4">
          <hr className="receipt-divider" />
          {d.descricao && <p className="text-sm text-foreground/80 mb-3 whitespace-pre-wrap">{d.descricao}</p>}
          {d.foto_url && (
            <div className="mb-3">
              {signed ? (
                d.foto_url.endsWith(".pdf") ? (
                  <a href={signed} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-border bg-muted px-3 py-2 text-sm font-medium">
                    Abrir PDF da nota
                  </a>
                ) : (
                  <a href={signed} target="_blank" rel="noreferrer">
                    <img src={signed} alt="Nota fiscal" className="w-full max-h-72 object-contain rounded-lg border border-border bg-muted" />
                  </a>
                )
              ) : (
                <Button variant="outline" size="sm" onClick={loadPhoto}>Ver nota anexada</Button>
              )}
            </div>
          )}

          {locked ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground rounded-lg bg-muted p-2.5">
              <Lock className="size-3.5" />
              Incluída em relatório de fechamento concluído
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {approvalMode && (
                <>
                  <Button size="sm" onClick={onApprove} disabled={d.status === "aprovado"}
                    className="bg-[var(--color-status-approved)] hover:bg-[var(--color-status-approved)]/90 text-white">
                    <Check className="size-4 mr-1" /> Aprovar
                  </Button>
                  <Button size="sm" variant="outline" onClick={onReject} disabled={d.status === "rejeitado"}
                    className="border-[var(--color-status-rejected)] text-[var(--color-status-rejected)] hover:bg-[var(--color-status-rejected-bg)]">
                    <X className="size-4 mr-1" /> Rejeitar
                  </Button>
                </>
              )}
              {isOwner ? (
                <>
                  <Button size="sm" variant="outline" onClick={onEdit}>
                    <Pencil className="size-4 mr-1" /> Editar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={onDelete}>
                    <Trash2 className="size-4 mr-1" /> Excluir
                  </Button>
                </>
              ) : (
                !approvalMode && (
                  <p className="text-xs text-muted-foreground">
                    Apenas quem lançou esta despesa pode editar ou excluir.
                  </p>
                )
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

