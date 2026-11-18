/**
 * cifraClubService.ts
 * Serviço para importar cifras do Cifra Club automaticamente.
 *
 * Estratégia: faz fetch da página HTML do Cifra Club com User-Agent
 * do app Android deles (que retorna 200), extrai acordes e letra
 * dos divs `kvMV` e monta a cifra formatada no padrão do app.
 */

export interface CifraClubResult {
  name: string;       // nome da música
  artist: string;     // artista
  tone: string;       // tom (ex: "E", "Am")
  lyrics: string;     // cifra completa formatada
}

/**
 * Extrai os slugs de artista e música de uma URL do Cifra Club.
 * Ex: "https://www.cifraclub.com.br/catolicas/te-amarei/" → { artist: "catolicas", song: "te-amarei" }
 */
export function parseCifraClubUrl(url: string): { artist: string; song: string } | null {
  const clean = url.trim().replace(/\?.*$/, '').replace(/#.*$/, '');
  const match = clean.match(/cifraclub\.com(?:\.br)?\/([^/]+)\/([^/]+)\/?$/);
  if (!match) return null;
  return { artist: match[1], song: match[2] };
}

/**
 * Remove tags HTML de uma string.
 */
function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, '');
}

/**
 * Converte os divs kvMV do HTML do Cifra Club em linhas de cifra formatada.
 * Cada div representa uma linha; quando há `<b data-chord-name>`, é linha de acordes.
 */
function extractCifraFromHtml(html: string): string {
  const divRegex = /<div class="kvMV">([\s\S]*?)<\/div>/g;
  const lines: string[] = [];
  let match;

  while ((match = divRegex.exec(html)) !== null) {
    const inner = match[1]
      .replace(/\u200b/g, '')
      .replace(/​/g, '');

    // Cada kvMV tem sublinhas separadas por \n
    // Linha com <b data-chord-name> = acordes, linha sem = letra/seção
    const subLines = inner.split('\n');

    for (const sub of subLines) {
      if (!sub.trim()) continue; // pula linhas vazias internas

      if (sub.includes('data-chord-name')) {
        // Linha de acordes: extrai texto dos atributos, preservando espaços de alinhamento
        const chordLine = sub
          .replace(/<b[^>]*data-chord-original-text="([^"]+)"[^>]*>[\s\S]*?<\/b>/g, '$1')
          .replace(/<[^>]+>/g, '')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&');
        lines.push(chordLine.trimEnd());
      } else {
        // Linha de letra ou marcador de seção [Intro], [Refrão] etc.
        const textLine = sub
          .replace(/<[^>]+>/g, '')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .trimEnd();
        lines.push(textLine);
      }
    }

    // Linha em branco entre divs (separa estrofes)
    lines.push('');
  }

  return lines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Extrai o tom da música do HTML.
 * Busca pelo botão do seletor de tom do Cifra Club.
 */
function extractTone(html: string): string {
  // Padrão mais específico: data-anchor="--chord-tone">ACORDE</button>
  const anchorMatch = html.match(/data-anchor="--chord-tone"[^>]*>([A-G][#b]?m?)<\/button>/);
  if (anchorMatch) return anchorMatch[1];

  // Fallback: "Tom: X" genérico
  const genericMatch = html.match(/Tom[\s\S]{0,50}?>\s*([A-G][#b]?m?)\s*</);
  return genericMatch ? genericMatch[1] : 'C';
}

/**
 * Extrai nome da música e artista do JSON-LD embutido na página.
 */
function extractMetadata(html: string): { name: string; artist: string } {
  // Tenta JSON-LD primeiro (mais confiável)
  const ldMatch = html.match(/application\/ld\+json">([\s\S]*?)<\/script>/);
  if (ldMatch) {
    try {
      const ld = JSON.parse(ldMatch[1]);
      const rawName: string = ld.name || '';
      const artistName: string = ld.byArtist?.name || '';

      // O name no LD costuma ser "Artista - Música"
      let songName = rawName;
      if (artistName && rawName.startsWith(artistName)) {
        songName = rawName.slice(artistName.length).replace(/^[\s-]+/, '').trim();
      }

      return {
        name: songName || rawName,
        artist: artistName,
      };
    } catch {
      // fallback abaixo
    }
  }

  // Fallback: og:title "Música - Artista - Cifra Club"
  const ogMatch = html.match(/property="og:title" content="([^"]+)"/);
  if (ogMatch) {
    const parts = ogMatch[1].replace('- Cifra Club', '').split(' - ').map((s) => s.trim());
    if (parts.length >= 2) {
      return { name: parts[0], artist: parts[1] };
    }
    return { name: parts[0] || '', artist: '' };
  }

  // Fallback final: h1
  const h1 = html.match(/<h1[^>]*>([^<]+)<\/h1>/);
  return { name: h1 ? h1[1].trim() : '', artist: '' };
}

/**
 * Faz o fetch da página do Cifra Club e retorna a cifra parseada.
 * Usa o User-Agent do app Android do Cifra Club para evitar bloqueio de bot.
 *
 * @param url URL completa da cifra no Cifra Club
 */
export async function importFromCifraClub(url: string): Promise<CifraClubResult> {
  const parsed = parseCifraClubUrl(url);
  if (!parsed) {
    throw new Error('URL inválida. Use uma URL do Cifra Club no formato:\nhttps://www.cifraclub.com.br/artista/musica/');
  }

  const fetchUrl = `https://www.cifraclub.com.br/${parsed.artist}/${parsed.song}/`;

  let html: string;
  try {
    const response = await fetch(fetchUrl, {
      headers: {
        'User-Agent': 'CifraClub/9.0.6 (Android 10; Linux; Mobile)',
        'X-Requested-With': 'com.buscape.cifraclub',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Música não encontrada no Cifra Club. Verifique o link.');
      }
      throw new Error(`Erro ao acessar o Cifra Club (HTTP ${response.status}). Verifique sua conexão.`);
    }

    html = await response.text();
  } catch (err: any) {
    if (err.message && (err.message.includes('Música') || err.message.includes('Erro'))) {
      throw err;
    }
    throw new Error('Não foi possível conectar ao Cifra Club. Verifique sua conexão com a internet.');
  }

  // Verifica se tem conteúdo de cifra
  if (!html.includes('kvMV')) {
    throw new Error('Não foi possível encontrar a cifra nesta página. Certifique-se de que o link é de uma página de cifra.');
  }

  const { name, artist } = extractMetadata(html);
  const tone = extractTone(html);
  const lyrics = extractCifraFromHtml(html);

  if (!lyrics.trim()) {
    throw new Error('A cifra foi encontrada, mas não foi possível extrair o conteúdo. Tente novamente.');
  }

  return { name, artist, tone, lyrics };
}
