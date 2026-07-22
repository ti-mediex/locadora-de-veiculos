// Carimba a foto da vistoria com o local (parte do veículo) e a data/hora,
// gravando o texto na própria imagem (como no laudo Vex). Também reduz a
// resolução para um tamanho razoável de upload.

function carregarImagem(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

export async function carimbarFoto(file: File, parte: string, quando = new Date()): Promise<File> {
  const url = URL.createObjectURL(file);
  try {
    const img = await carregarImagem(url);
    const maxW = 1280;
    const scale = Math.min(1, maxW / (img.width || maxW));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round((img.width || maxW) * scale);
    canvas.height = Math.round((img.height || maxW) * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const fs = Math.max(13, Math.round(canvas.width * 0.026));
    const pad = Math.round(fs * 0.45);
    const alturaFaixa = fs * 2 + pad * 3;
    // Faixa escura semitransparente no rodapé
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, canvas.height - alturaFaixa, canvas.width, alturaFaixa);
    ctx.textAlign = "right";
    ctx.textBaseline = "alphabetic";
    // Local (parte) do veículo
    ctx.fillStyle = "#ffffff";
    ctx.font = `bold ${fs}px Arial, sans-serif`;
    ctx.fillText(parte.toUpperCase(), canvas.width - pad, canvas.height - fs - pad);
    // Data e hora
    ctx.font = `${Math.round(fs * 0.85)}px Arial, sans-serif`;
    ctx.fillText(quando.toLocaleString("pt-BR"), canvas.width - pad, canvas.height - pad);

    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.85));
    if (!blob) return file;
    const nome = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], nome, { type: "image/jpeg" });
  } catch {
    return file;
  } finally {
    URL.revokeObjectURL(url);
  }
}
