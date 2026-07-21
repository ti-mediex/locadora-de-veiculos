// Extração de texto de PDF no navegador, com o pdf.js carregado sob demanda
// (mantém a biblioteca fora do bundle inicial).
export async function extrairTextoPdf(file: File): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist");
  const pdfWorkerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
  let texto = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    texto += content.items.map((it) => ("str" in it ? it.str : "")).join(" ") + "\n";
  }
  return texto;
}
