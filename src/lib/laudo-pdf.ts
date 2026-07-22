// Geração do laudo de vistoria em PDF real (para anexar em e-mail).
// jsPDF é carregado sob demanda para não pesar o bundle inicial.

export interface LaudoPdfData {
  tipoLabel: string;
  placa: string;
  modelo: string;
  km: string;
  combustivel: string;
  locatario: string;
  documento: string;
  vistoriador: string;
  data: string;
  avarias: string;
  fotos: { parte: string; avaria: boolean; observacao: string; dataUrl: string | null }[];
  checklist: { item: string; situacao: string; observacao?: string }[];
  assinatura: string | null;
}

/** Gera o PDF e devolve o conteúdo em base64 (para anexo) e um Blob. */
export async function gerarLaudoPdf(d: LaudoPdfData): Promise<{ base64: string; blob: Blob }> {
  const { jsPDF } = await import("jspdf");
  const { VIPCAR_LOGO } = await import("./laudo-logo");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210, M = 12, BOTTOM = 285;
  let y = M;

  // Cabeçalho: logo + título
  try { doc.addImage(VIPCAR_LOGO, "PNG", M, y, 18, 18); } catch { /* ignora */ }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("VIP CARS — Laudo de Vistoria", M + 22, y + 7);
  doc.setFontSize(11);
  doc.setTextColor(90);
  doc.text(d.tipoLabel, M + 22, y + 13);
  doc.setTextColor(20);
  y += 21;
  doc.setFillColor(201, 201, 201);
  doc.rect(M, y, W - 2 * M, 2, "F");
  y += 7;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  for (const l of [
    `Veículo: ${d.placa} ${d.modelo}    KM: ${d.km}    Combustível: ${d.combustivel}`,
    `Locatário: ${d.locatario} ${d.documento}    Vistoriador: ${d.vistoriador}`,
    `Data: ${d.data}`,
  ]) { doc.text(l, M, y); y += 5; }

  if (d.avarias) {
    y += 1;
    doc.setFont("helvetica", "bold"); doc.text("Avarias:", M, y);
    doc.setFont("helvetica", "normal");
    const split = doc.splitTextToSize(d.avarias, W - 2 * M - 18) as string[];
    doc.text(split, M + 18, y);
    y += 5 * split.length;
  }
  y += 3;

  // Fotos em grade de 3 colunas
  const cols = 3, gap = 4;
  const fw = (W - 2 * M - gap * (cols - 1)) / cols;
  const fh = fw * 0.72;
  let col = 0;
  const comFoto = d.fotos.filter((f) => f.dataUrl);
  comFoto.forEach((f, idx) => {
    if (y + fh + 8 > BOTTOM) { doc.addPage(); y = M; col = 0; }
    const x = M + col * (fw + gap);
    try { doc.addImage(f.dataUrl!, "JPEG", x, y, fw, fh); } catch { /* imagem inválida */ }
    doc.setFontSize(7);
    doc.setTextColor(f.avaria ? 220 : 60, f.avaria ? 40 : 60, f.avaria ? 40 : 60);
    doc.text(`${idx + 1}/${comFoto.length} - ${f.parte}${f.avaria ? " (AVARIA)" : ""}`, x, y + fh + 3, { maxWidth: fw });
    doc.setTextColor(20);
    col++;
    if (col >= cols) { col = 0; y += fh + 8; }
  });
  if (col > 0) { y += fh + 8; }

  // Checklist
  if (y + 30 > BOTTOM) { doc.addPage(); y = M; }
  doc.setFont("helvetica", "bold"); doc.setFontSize(10);
  doc.text("Checklist", M, y); y += 5;
  doc.setFont("helvetica", "normal"); doc.setFontSize(8);
  const ccols = 3, cw = (W - 2 * M) / ccols;
  let ci = 0;
  for (const c of d.checklist) {
    const x = M + ci * cw;
    doc.text(`${c.item}: ${c.situacao.toUpperCase()}`, x, y);
    ci++;
    if (ci >= ccols) { ci = 0; y += 5; if (y > BOTTOM) { doc.addPage(); y = M; } }
  }
  if (ci > 0) y += 5;

  // Assinatura
  if (d.assinatura) {
    if (y + 32 > BOTTOM) { doc.addPage(); y = M; }
    y += 3;
    doc.setFont("helvetica", "bold"); doc.setFontSize(9);
    doc.text("Assinatura do locatário", M, y); y += 3;
    try { doc.addImage(d.assinatura, "PNG", M, y, 60, 25); } catch { /* ignora */ }
  }

  const base64 = (doc.output("datauristring") as string).split(",")[1];
  const blob = doc.output("blob");
  return { base64, blob };
}
