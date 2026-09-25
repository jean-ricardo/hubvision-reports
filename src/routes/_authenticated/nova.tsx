import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Camera, Plus, LogOut, X, Upload, FileText } from "lucide-react";
import { toast } from "sonner";
import { TIPOS_DESPESA, UFS, STORAGE_BUCKET } from "@/lib/constants";
import { today } from "@/lib/format";
import { compressImage } from "@/lib/image";
import { useNavigate } from "@tanstack/react-router";
import logo from "@/assets/hviagem-logo.png";

export const Route = createFileRoute("/_authenticated/nova")({
  head: () => ({
    meta: [
      { title: "Nova despesa — Hubvision" },
      { name: "description", content: "Lance uma nova despesa corporativa Hubvision." },
      { property: "og:title", content: "Nova despesa — Hubvision" },
      { property: "og:description", content: "Registre despesas corporativas com foto da nota fiscal." },
    ],
  }),
  component: NovaDespesa,
});

function NovaDespesa() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const cameraInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const [colaboradorId, setColaboradorId] = useState<string>("");
  const [tipo, setTipo] = useState<string>("");
  const [uf, setUf] = useState<string>("PE");
  const [cidade, setCidade] = useState<string>("Recife");
  const [valor, setValor] = useState<string>("");
  const [dataDespesa, setDataDespesa] = useState<string>(today());
  const [descricao, setDescricao] = useState<string>("");
  const [photoFile, setPhotoFile] = useState<Blob | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [fileMeta, setFileMeta] = useState<{ name: string; type: string; ext: string } | null>(null);
  const [newDlgOpen, setNewDlgOpen] = useState(false);
  const [newName, setNewName] = useState("");

  const { data: colaboradores = [] } = useQuery({
    queryKey: ["colaboradores"],
    queryFn: async () => {
      const { data, error } = await supabase.from("colaboradores").select("*").order("nome");
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    return () => { if (photoPreview) URL.revokeObjectURL(photoPreview); };
  }, [photoPreview]);

  const handleFile = async (f: File) => {
    try {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
      if (f.type.startsWith("image/")) {
        const blob = await compressImage(f);
        setPhotoFile(blob);
        setPhotoPreview(URL.createObjectURL(blob));
        setFileMeta({ name: f.name, type: "image/jpeg", ext: "jpg" });
      } else if (f.type === "application/pdf") {
        if (f.size > 10 * 1024 * 1024) { toast.error("Arquivo muito grande (máx. 10 MB)"); return; }
        setPhotoFile(f);
        setPhotoPreview(null);
        setFileMeta({ name: f.name, type: "application/pdf", ext: "pdf" });
      } else {
        toast.error("Envie uma imagem ou PDF");
      }
    } catch {
      toast.error("Não foi possível processar o arquivo");
    }
  };

  const clearFile = () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoFile(null);
    setPhotoPreview(null);
    setFileMeta(null);
  };

  const createColab = useMutation({
    mutationFn: async (nome: string) => {
      const { data, error } = await supabase.from("colaboradores").insert({ nome }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["colaboradores"] });
      setColaboradorId(data.id);
      setNewDlgOpen(false);
      setNewName("");
      toast.success("Colaborador criado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const submit = useMutation({
    mutationFn: async () => {
      let foto_url: string | null = null;
      if (photoFile) {
        const path = `${crypto.randomUUID()}.${fileMeta?.ext ?? "jpg"}`;
        const { error: upErr } = await supabase.storage.from(STORAGE_BUCKET).upload(path, photoFile, {
          contentType: fileMeta?.type ?? "image/jpeg",
          upsert: false,
        });
        if (upErr) throw upErr;
        foto_url = path;
      }
      const { error } = await supabase.from("despesas").insert({
        colaborador_id: colaboradorId,
        tipo_despesa: tipo,
        uf,
        cidade: cidade.trim(),
        valor: parseFloat(valor.replace(",", ".")),
        data_despesa: dataDespesa,
        descricao: descricao.trim() || null,
        foto_url,
        status: "pendente",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Despesa lançada!");
      qc.invalidateQueries({ queryKey: ["despesas"] });
      navigate({ to: "/despesas" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canSubmit = colaboradorId && tipo && uf && cidade.trim() && valor && parseFloat(valor.replace(",", ".")) > 0;

  const logout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  return (
    <div className="px-4 pt-6 pb-4">
      <header className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <img src={logo} alt="Logo HViagem" width={1024} height={1024} className="size-10 object-contain" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Nova despesa</h1>
            <p className="text-sm text-muted-foreground">HViagem · Registre um lançamento</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={logout} aria-label="Sair">
          <LogOut className="size-4" />
        </Button>
      </header>

      <form
        onSubmit={(e) => { e.preventDefault(); if (canSubmit && !submit.isPending) submit.mutate(); }}
        className="space-y-5 rounded-2xl border border-border bg-card p-5 shadow-sm"
      >
        <div className="space-y-1.5">
          <Label>Colaborador</Label>
          <div className="flex gap-2">
            <Select value={colaboradorId} onValueChange={setColaboradorId}>
              <SelectTrigger className="flex-1"><SelectValue placeholder="Selecione um colaborador" /></SelectTrigger>
              <SelectContent>
                {colaboradores.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="button" variant="outline" size="icon" onClick={() => setNewDlgOpen(true)} aria-label="Novo colaborador">
              <Plus className="size-4" />
            </Button>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Tipo de despesa</Label>
          <Select value={tipo} onValueChange={setTipo}>
            <SelectTrigger><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
            <SelectContent>
              {TIPOS_DESPESA.map((t) => (<SelectItem key={t} value={t}>{t}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-[100px_1fr] gap-3">
          <div className="space-y-1.5">
            <Label>UF</Label>
            <Select value={uf} onValueChange={setUf}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-64">
                {UFS.map((u) => (<SelectItem key={u} value={u}>{u}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Cidade</Label>
            <Input value={cidade} onChange={(e) => setCidade(e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Valor (R$)</Label>
            <Input inputMode="decimal" placeholder="0,00" className="font-mono-ledger"
              value={valor} onChange={(e) => setValor(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Data</Label>
            <Input type="date" className="font-mono-ledger" value={dataDespesa} onChange={(e) => setDataDespesa(e.target.value)} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Descrição / Observações</Label>
          <Textarea rows={3} value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Opcional" />
        </div>

        <div className="space-y-1.5">
          <Label>Nota fiscal (foto ou arquivo)</Label>
          <input
            ref={cameraInput} type="file" accept="image/*" capture="environment" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
          />
          <input
            ref={fileInput} type="file" accept="image/*,application/pdf" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
          />
          {!fileMeta ? (
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => cameraInput.current?.click()}
                className="h-32 rounded-xl border-2 border-dashed border-border bg-muted/40 hover:bg-muted transition flex flex-col items-center justify-center gap-2 text-muted-foreground">
                <Camera className="size-7" />
                <span className="text-sm font-medium">Tirar foto</span>
              </button>
              <button type="button" onClick={() => fileInput.current?.click()}
                className="h-32 rounded-xl border-2 border-dashed border-border bg-muted/40 hover:bg-muted transition flex flex-col items-center justify-center gap-2 text-muted-foreground">
                <Upload className="size-7" />
                <span className="text-sm font-medium text-center px-2">Escolher arquivo ou foto</span>
                <span className="text-[11px]">Galeria · PDF</span>
              </button>
            </div>
          ) : (
            <div className="relative rounded-xl overflow-hidden border border-border">
              {photoPreview ? (
                <img src={photoPreview} alt="Prévia da nota" className="w-full max-h-64 object-contain bg-muted" />
              ) : (
                <div className="flex items-center gap-3 p-4 bg-muted">
                  <FileText className="size-8 text-muted-foreground shrink-0" />
                  <span className="text-sm font-medium truncate">{fileMeta.name}</span>
                </div>
              )}
              <div className="flex gap-2 p-2 bg-card border-t border-border">
                <Button type="button" variant="outline" size="sm" onClick={() => cameraInput.current?.click()}>Tirar foto</Button>
                <Button type="button" variant="outline" size="sm" onClick={() => fileInput.current?.click()}>Escolher arquivo</Button>
                <Button type="button" variant="ghost" size="sm" onClick={clearFile}>
                  <X className="size-4 mr-1" /> Remover
                </Button>
              </div>
            </div>
          )}
        </div>

        <Button type="submit" disabled={!canSubmit || submit.isPending} className="w-full h-12 text-base font-semibold">
          {submit.isPending ? "Enviando…" : "Lançar despesa"}
        </Button>
      </form>

      <Dialog open={newDlgOpen} onOpenChange={setNewDlgOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo colaborador</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nome completo" autoFocus />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNewDlgOpen(false)}>Cancelar</Button>
            <Button onClick={() => newName.trim() && createColab.mutate(newName.trim())} disabled={!newName.trim() || createColab.isPending}>
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

