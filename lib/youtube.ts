// Extrai o ID do video de uma URL do YouTube (varios formatos).
// Retorna null se nao bater.
export function extractYoutubeId(url: string): string | null {
  if (!url) return null;
  const m = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/i
  );
  return m ? m[1] : null;
}
