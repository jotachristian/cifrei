import { createPlaylist, createChord, linkChordToPlaylist } from './database';

// ─────────────────────────────────────────────────────────────────────────────
// Formato do arquivo (.md ou .txt):
//
//   # Nome da Playlist          ← uma linha
//   > Descricao (opcional)
//
//   ## Nome da Musica           ← uma por musica
//   Artista: Hillsong           ← campos chave:valor (todos opcionais menos o titulo)
//   Tom: D
//   Link: https://...
//   Pos: 2
//
//   [Intro]
//   D    A    Bm   G
//   Voce me chama sobre as aguas
//   ...
//
//   ## Proxima Musica           ← inicia outra musica
//   ...
//
// Regras:
//   - 1 arquivo = 1 playlist
//   - Primeira linha "# ..." vence (resto e ignorado)
//   - Campos meta (Artista/Tom/Link/Pos) sao case-insensitive e ficam entre o
//     "## titulo" e a primeira linha de letra. Aceita acentos em "Posicao"/"Posicao".
//   - Linhas em branco entre meta e letra sao puladas.
//   - Tom padrao quando omitido: "C"
//   - Pos omitido -> ordem do arquivo
// ─────────────────────────────────────────────────────────────────────────────

export interface ParsedSong {
  name: string;
  artist: string;
  tone: string;
  link: string;
  sortOrder?: number;
  moment: string;
  lyrics: string;
}

export interface ParsedPlaylist {
  name: string;
  description: string;
  songs: ParsedSong[];
}

const META_KEYS: Record<string, keyof ParsedSong | 'pos'> = {
  // nome da musica (quando o "## ..." e usado como momento/secao)
  musica: 'name',
  'música': 'name',
  nome: 'name',
  titulo: 'name',
  'título': 'name',
  title: 'name',
  artista: 'artist',
  artist: 'artist',
  tom: 'tone',
  tone: 'tone',
  link: 'link',
  url: 'link',
  pos: 'pos',
  posicao: 'pos',
  'posição': 'pos',
};

// Linha separadora (regua horizontal): "----", "____", "====", "****", etc.
const isSeparator = (line: string) => /^\s*[-–—_*=]{3,}\s*$/.test(line);

export function parsePlaylistMd(input: string): ParsedPlaylist {
  // Remove BOM e normaliza quebras de linha
  const text = input.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const lines = text.split('\n');

  const playlist: ParsedPlaylist = { name: '', description: '', songs: [] };
  let current: ParsedSong | null = null;
  let lyricBuf: string[] = [];
  let mode: 'header' | 'meta' | 'lyrics' = 'header';

  const flushSong = () => {
    if (!current) return;
    // Tira blanks no inicio/fim mas preserva entre versos
    const lyrics = lyricBuf.join('\n').replace(/^\n+|\n+$/g, '');
    playlist.songs.push({ ...current, lyrics });
    current = null;
    lyricBuf = [];
  };

  for (const raw of lines) {
    const line = raw;

    // Reguas separadoras ("----", "====") sao decoracao -> ignora em qualquer modo
    if (isSeparator(line)) continue;

    // Cabecalho de musica: "## titulo"
    const songMatch = line.match(/^##\s+(.+?)\s*$/);
    if (songMatch) {
      flushSong();
      current = { name: songMatch[1], artist: '', tone: 'C', link: '', moment: '', lyrics: '' };
      mode = 'meta';
      continue;
    }

    // Antes da primeira musica: header da playlist
    if (!current) {
      const pMatch = line.match(/^#\s+(.+?)\s*$/);
      if (pMatch && !playlist.name) {
        playlist.name = pMatch[1];
        continue;
      }
      const dMatch = line.match(/^>\s*(.*)$/);
      if (dMatch) {
        playlist.description = playlist.description
          ? playlist.description + ' ' + dMatch[1].trim()
          : dMatch[1].trim();
        continue;
      }
      // Fallback: sem "# titulo", a 1a linha de texto vira o nome da playlist
      // e a 2a vira a descricao (formatos que nao usam markdown estrito).
      const t = line.trim();
      if (t === '') continue;
      if (!playlist.name) { playlist.name = t; continue; }
      if (!playlist.description) { playlist.description = t; continue; }
      continue;
    }

    // Dentro de uma musica
    if (mode === 'meta') {
      if (line.trim() === '') continue; // pula blanks ate achar primeira coisa
      const metaMatch = line.match(/^([A-Za-zÀ-ÿ]+)\s*:\s*(.*)$/);
      if (metaMatch) {
        const key = metaMatch[1].toLowerCase();
        const val = metaMatch[2].trim();
        const field = META_KEYS[key];
        if (field === 'name')   {
          // "## ..." vira o momento; o nome real vem de "Música:"/"Nome:"
          if (val) { if (current.name) current.moment = current.name; current.name = val; }
          continue;
        }
        if (field === 'artist') { current.artist = val; continue; }
        if (field === 'tone')   { current.tone = val || 'C'; continue; }
        if (field === 'link')   { current.link = val; continue; }
        if (field === 'pos')    {
          const n = parseInt(val, 10);
          if (!isNaN(n)) current.sortOrder = n;
          continue;
        }
        // chave nao reconhecida -> assume que ja e letra
      }
      mode = 'lyrics';
      lyricBuf.push(line);
      continue;
    }

    // mode === 'lyrics'
    lyricBuf.push(line);
  }
  flushSong();

  return playlist;
}

/**
 * Cria a playlist e suas cifras no banco. Sempre gera uma playlist nova
 * (nao tenta mesclar com existente de mesmo nome).
 */
export function importPlaylistFromMd(text: string): {
  playlistId: string;
  playlistName: string;
  songCount: number;
} {
  const parsed = parsePlaylistMd(text);
  if (!parsed.name) {
    throw new Error('Nao encontrei o titulo da playlist. Adicione uma linha comecando com "# " no inicio do arquivo.');
  }
  if (!parsed.songs.length) {
    throw new Error('Nenhuma musica encontrada. Cada musica deve comecar com uma linha "## ".');
  }

  const playlistId = createPlaylist(parsed.name, parsed.description);

  parsed.songs.forEach((song, idx) => {
    const chordId = createChord({
      name: song.name,
      artist: song.artist,
      tone: song.tone || 'C',
      lyrics: song.lyrics,
      externalLink: song.link,
    });
    linkChordToPlaylist(chordId, playlistId, {
      sortOrder: song.sortOrder ?? idx,
      moment: song.moment,
    });
  });

  return {
    playlistId,
    playlistName: parsed.name,
    songCount: parsed.songs.length,
  };
}
