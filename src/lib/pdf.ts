import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { fmtBRL, fmtDate } from "./format";

export interface DespesaRow {
  colaborador: string;
  tipo_despesa: string;
  cidade: string;
  uf: string;
  data_despesa: string;
  status: string;
  valor: number;
}

interface Args {
  dataInicio: string;
  dataFim: string;
  colaboradorFiltro?: string | null;
  despesas: DespesaRow[];
  total: number;
  concluidoEm?: string;
}

export function buildFechamentoPDF({ dataInicio, dataFim, colaboradorFiltro, despesas, total, concluidoEm }: Args) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFillColor(18, 33, 59); // #12213B
  doc.rect(0, 0, pageWidth, 72, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Hubvision", 40, 34);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text("Relatório de Fechamento", 40, 54);

  // Meta
  doc.setTextColor(18, 33, 59);
  doc.setFontSize(10);
  const metaY = 100;
  doc.text(`Período: ${fmtDate(dataInicio)} a ${fmtDate(dataFim)}`, 40, metaY);
  doc.text(`Colaborador: ${colaboradorFiltro || "Todos"}`, 40, metaY + 16);
  if (concluidoEm) doc.text(`Concluído em: ${concluidoEm}`, 40, metaY + 32);

  autoTable(doc, {
    startY: metaY + 52,
    head: [["Colaborador", "Tipo", "Cidade/UF", "Data", "Status", "Valor"]],
    body: despesas.map((d) => [
      d.colaborador,
      d.tipo_despesa,
      `${d.cidade}/${d.uf}`,
      fmtDate(d.data_despesa),
      d.status,
      fmtBRL(d.valor),
    ]),
    headStyles: { fillColor: [18, 33, 59], textColor: 255, fontStyle: "bold", fontSize: 9 },
    bodyStyles: { fontSize: 9, textColor: [30, 30, 30] },
    alternateRowStyles: { fillColor: [238, 241, 246] },
    columnStyles: { 5: { halign: "right", fontStyle: "bold" } },
    margin: { left: 40, right: 40 },
  });

  const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 16;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Quantidade de despesas: ${despesas.length}`, 40, finalY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(`Total: ${fmtBRL(total)}`, pageWidth - 40, finalY, { align: "right" });

  return doc;
}

export function pdfFilename(dataInicio: string, dataFim: string): string {
  return `fechamento-hubvision-${dataInicio}_a_${dataFim}.pdf`;
}

export async function sharePDF(doc: jsPDF, filename: string) {
  const blob = doc.output("blob");
  const file = new File([blob], filename, { type: "application/pdf" });
  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
  if (nav.canShare && nav.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return;
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
    }
  }
  doc.save(filename);
}

export function savePDF(doc: jsPDF, filename: string) {
  doc.save(filename);
}
