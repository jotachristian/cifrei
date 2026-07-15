import {
  createPlaylist, createChord, linkChordToPlaylist, updateLinkMoment,
  findChordByYoutubeLink, getLink,
} from './database';

// ─────────────────────────────────────────────────────────────────────────────
// Parser de mensagem do WhatsApp pra criar playlist de missa.
//
// Cada linha vira uma "entry": momento (Entrada, Salmo...) + link YouTube
// opcional + nota opcional.
//
// Exemplo de entrada:
//
//   MISSA - CORPUS CHRISTI
//
//   ENTRADA: https://youtu.be/EFhnMsTUK60
//   ATO PENITENCIAL: https://youtu.be/ItfRKnIfxoc
//   ACLAMAÇÃO: (Melodia do "alguém do povo exclamar")
//
// Saida: { suggestedName: "Missa - Corpus Christi", entries: [...] }
// ─────────────────────────────────────────────────────────────────────────────

const YOUTUBE_RE =
  /(?:https?:\/\/)?(?:www\.|m\.|music\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})(?:[?&][^\s]*)?/i;

export interface ParsedEntry {
  moment: string; // ex: "Entrada", "Salmo" — normalizado em Title Case
  link: string;   // URL completa do YouTube ou ''
  note: string;   // texto auxiliar (ex: "Melodia do alguem do povo...")
}

export interface ParsedSetlist {
  suggestedName: string;
  entries: ParsedEntry[];
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(/\s+/)
    .map(w => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ')
    .trim();
}

function isMostlyUpper(s: string): boolean {
  const letters = s.replace(/[^A-Za-zÀ-ÿ]/g, '');
  if (letters.length < 3) return false;
  const upper = letters.replace(/[^A-ZÀ-Þ]/g, '');
  return upper.length / letters.length > 0.7;
}

function normalizeLink(raw: string): string {
  if (!raw) return '';
  return /^https?:\/\//i.test(raw) ? raw : 'https://' + raw;
}

export function parseWhatsAppSetlist(text: string): ParsedSetlist {
  const lines = text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0);

  let suggestedName = '';
  const entries: ParsedEntry[] = [];

  for (const line of lines) {
    const urlMatch = line.match(YOUTUBE_RE);
    const link = urlMatch ? normalizeLink(urlMatch[0]) : '';
    const withoutUrl = link ? line.replace(YOUTUBE_RE, '').trim() : line;

    // Separar momento de descricao por ":" ou "-"
    // Padroes aceitos: "ENTRADA:", "ENTRADA -", "ENTRADA "
    let moment = '';
    let note = '';
    const sepMatch = withoutUrl.match(/^([^:]+?)\s*:\s*(.*)$/);
    if (sepMatch) {
      moment = sepMatch[1].trim();
      note = sepMatch[2].trim();
    } else {
      const dashMatch = withoutUrl.match(/^([^-]+?)\s+-\s+(.*)$/);
      if (dashMatch) {
        moment = dashMatch[1].trim();
        note = dashMatch[2].trim();
      } else {
        moment = withoutUrl.trim();
      }
    }

    // Tira parenteses externos da nota
    note = note.replace(/^[\(\[]+/, '').replace(/[\)\]]+$/, '').trim();

    // Heuristica: linha em maiusculas, sem link e sem ":" e sem "-" como
    // separador no inicio → e o titulo da missa
    const looksLikeTitle =
      !link &&
      !sepMatch &&
      isMostlyUpper(line) &&
      !suggestedName;
    if (looksLikeTitle) {
      suggestedName = titleCase(line);
      continue;
    }

    // Sem momento detectado e sem link → ignora (linha decorativa)
    if (!moment && !link) continue;

    entries.push({
      moment: moment ? titleCase(moment) : '',
      link,
      note,
    });
  }

  return { suggestedName, entries };
}

// ─────────────────────────────────────────────────────────────────────────────
// Criacao no banco: dedup por link, vincula com moment.
// ─────────────────────────────────────────────────────────────────────────────

export interface ImportSummary {
  playlistId: string;
  playlistName: string;
  total: number;
  reused: number;    // musicas existentes vinculadas
  created: number;   // musicas novas criadas
}

export function createPlaylistFromWhatsApp(
  text: string,
  opts?: { nameOverride?: string }
): ImportSummary {
  const parsed = parseWhatsAppSetlist(text);
  const name = (opts?.nameOverride?.trim() || parsed.suggestedName || 'Nova missa').trim();

  const playlistId = createPlaylist(name, '');

  let reused = 0;
  let created = 0;

  parsed.entries.forEach((entry, idx) => {
    let chordId: string | null = null;

    if (entry.link) {
      const existing = findChordByYoutubeLink(entry.link);
      if (existing) {
        chordId = existing.id;
        reused++;
      }
    }

    if (!chordId) {
      // Nome inicial da musica = o momento (ex: "Entrada"). Usuario renomeia depois.
      const fallbackName = entry.moment || 'Musica ' + (idx + 1);
      // Esqueleto de secoes ja pronto pra ele so adicionar acordes.
      const skeleton = '[Intro]\n\n[Parte 1]\n\n[Refrão]\n\n[Parte 2]\n\n[Final]';
      chordId = createChord({
        name: fallbackName,
        artist: '',
        tone: 'C',
        lyrics: skeleton,
        externalLink: entry.link,
        note: entry.note,
      });
      created++;
    }

    linkChordToPlaylist(chordId, playlistId, {
      sortOrder: idx,
      moment: entry.moment,
    });
    // se a musica ja existia e foi reusada, garante que o moment desta playlist
    // esta atualizado (linkChordToPlaylist usa INSERT OR IGNORE)
    updateLinkMoment(chordId, playlistId, entry.moment);
  });

  return {
    playlistId,
    playlistName: name,
    total: parsed.entries.length,
    reused,
    created,
  };
}
