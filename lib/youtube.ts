// Extrai o ID do vídeo de uma URL do YouTube ou YouTube Music (vários formatos).
// Suporta: youtu.be, youtube.com/watch, music.youtube.com, music.youtube/, shorts, embed, live e ID direto.
export function extractYoutubeId(url: string): string | null {
  if (!url) return null;
  const clean = url.trim();
  const directMatch = clean.match(/^[A-Za-z0-9_-]{11}$/);
  if (directMatch) return directMatch[0];
  const m = clean.match(
    /(?:music\.youtube(?:\.com)?\/(?:watch\?.*v=|embed\/|shorts\/|live\/|)|youtube\.com\/(?:watch\?.*v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/i
  );
  return m ? m[1] : null;
}

// Converte qualquer URL do YouTube para URL do YouTube Music
export function toYoutubeMusicUrl(url: string): string {
  const id = extractYoutubeId(url);
  if (!id) return url;
  return `https://music.youtube.com/watch?v=${id}`;
}

// Obtém a imagem da capa/thumbnail em alta qualidade (16:9 widescreen sem barras pretas) diretamente dos servidores CDN do YouTube
export function getYoutubeThumbnailUrl(urlOrId: string): string | null {
  const id = extractYoutubeId(urlOrId);
  if (!id) return null;
  return `https://i.ytimg.com/vi/${id}/hq720.jpg`;
}

// Busca IDs de vídeos no YouTube a partir do nome da música/artista
export async function searchYoutubeIds(query: string): Promise<string[]> {
  if (!query || !query.trim()) return [];
  try {
    const cleanQuery = query.trim();
    const res = await fetch(`https://www.youtube.com/results?search_query=${encodeURIComponent(cleanQuery)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });
    if (!res.ok) return [];
    const html = await res.text();
    const ids: string[] = [];
    const regex = /"videoId":"([A-Za-z0-9_-]{11})"/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(html)) !== null) {
      if (!ids.includes(match[1])) {
        ids.push(match[1]);
      }
    }
    return ids;
  } catch (err) {
    console.warn('Erro ao buscar vídeos no YouTube:', err);
    return [];
  }
}

// Busca capa de música via YouTube / YT Music
export async function searchYoutubeCover(
  query: string,
  resultIndex: number = 0
): Promise<{ id: string; coverUrl: string; musicUrl: string } | null> {
  const ids = await searchYoutubeIds(query);
  if (ids.length === 0) return null;
  const selectedId = ids[resultIndex % ids.length];
  return {
    id: selectedId,
    coverUrl: `https://i.ytimg.com/vi/${selectedId}/hq720.jpg`,
    musicUrl: `https://music.youtube.com/watch?v=${selectedId}`,
  };
}
