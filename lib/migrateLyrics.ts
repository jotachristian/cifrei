import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  documentDirectory, makeDirectoryAsync, writeAsStringAsync, getInfoAsync,
} from 'expo-file-system/legacy';
import { getAllChords, updateChordLyricsAndNote } from './database';
import { exportAllData } from './backup';

// ─────────────────────────────────────────────────────────────────────────────
// Migracao v1 — separa letra de acordes/secoes no formato legado.
//
// Antes: lyrics era um texto so contendo linhas de acorde + linhas de letra +
// secoes [Intro]. Isso veio do uso original do app.
//
// Depois: lyrics fica so com acordes e secoes; letra vai pro novo campo note.
// Decisao validada com o usuario em 2026-06-08. Ele quer ver so acordes na missa.
//
// Roda uma vez por instalacao (flag em AsyncStorage). Antes de rodar, dump JSON
// em documentDirectory/backups/ — usuario ja fez backup manual, isso e cinto+
// suspensorio.
// ─────────────────────────────────────────────────────────────────────────────

const MIGRATION_FLAG = 'cifrei_lyrics_migrated_v1';

// ── detector de linha (espelha components/ChordDisplay.tsx) ─────────────────

const SUFFIX = '(?:m|M|maj|Maj|dim|°|º|aug|\\+|sus[24]?|add\\d+|[b#]\\d+|\\d+|\\([b#\\d,\\s]+\\))';
const CHORD_TOKEN = new RegExp(`^[A-G][b#]?${SUFFIX}*(?:\\/[A-G][b#]?${SUFFIX}*)?$`);

function tokensAreAllChords(s: string): boolean {
  const t = s.trim();
  if (!t) return false;
  return t.split(/\s+/).every(tok => CHORD_TOKEN.test(tok));
}

function unwrapChordBrackets(line: string): string | null {
  const m = line.match(/^(\s*)\[(.*)\](\s*)$/);
  if (!m) return null;
  const [, lead, inner, trail] = m;
  if (!tokensAreAllChords(inner)) return null;
  return lead + ' ' + inner + ' ' + trail;
}

function isChordLine(line: string): boolean {
  if (unwrapChordBrackets(line) !== null) return true;
  return tokensAreAllChords(line);
}

function isSectionLine(line: string): boolean {
  const t = line.trim();
  if (!/^\[.+\]$/.test(t)) return false;
  return unwrapChordBrackets(line) === null;
}

// ── conversor ────────────────────────────────────────────────────────────────

/**
 * Pega texto no formato legado e devolve { lyrics, note }.
 *  - lyrics: so secoes + linhas de acorde (mantem espacamento entre blocos)
 *  - note:   so letra. Secoes sao replicadas como cabecalho pra dar contexto.
 *
 * Pares (chord-line + lyric-line) sao desmembrados: acorde vai pro lyrics,
 * letra logo abaixo vai pro note.
 */
export function convertLegacyLyrics(text: string): { lyrics: string; note: string } {
  if (!text) return { lyrics: '', note: '' };
  const lines = text.replace(/\r\n?/g, '\n').split('\n');

  const lyricsOut: string[] = [];
  const noteOut: string[] = [];

  const pushBlankIfNeeded = (arr: string[]) => {
    if (arr.length && arr[arr.length - 1] !== '') arr.push('');
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      pushBlankIfNeeded(lyricsOut);
      pushBlankIfNeeded(noteOut);
      i++; continue;
    }

    if (isSectionLine(line)) {
      lyricsOut.push(line);
      noteOut.push(line); // mesmo rotulo nos dois, pra navegacao casar
      i++; continue;
    }

    if (isChordLine(line)) {
      lyricsOut.push(line);
      const next = lines[i + 1];
      const hasLyricBelow =
        next !== undefined && next.trim() !== '' &&
        !isChordLine(next) && !isSectionLine(next);
      if (hasLyricBelow) {
        noteOut.push(next);
        i += 2;
      } else {
        i += 1;
      }
      continue;
    }

    // linha de letra solta (sem acorde acima)
    noteOut.push(line);
    i++;
  }

  const trim = (s: string) => s.replace(/^\n+|\n+$/g, '').replace(/\n{3,}/g, '\n\n');
  return { lyrics: trim(lyricsOut.join('\n')), note: trim(noteOut.join('\n')) };
}

// ── runner ───────────────────────────────────────────────────────────────────

async function writeBackupBeforeMigration(): Promise<string | null> {
  try {
    const base = documentDirectory;
    if (!base) return null;
    const dir = base + 'backups/';
    const info = await getInfoAsync(dir);
    if (!info.exists) {
      await makeDirectoryAsync(dir, { intermediates: true });
    }
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const path = dir + `pre-lyrics-migration-${ts}.json`;
    const data = exportAllData();
    await writeAsStringAsync(path, JSON.stringify(data, null, 2));
    return path;
  } catch (e) {
    console.warn('[migrateLyrics] backup falhou:', e);
    return null;
  }
}

export async function runLyricsMigrationIfNeeded(): Promise<{
  ran: boolean; converted?: number; total?: number; backupPath?: string | null;
}> {
  const done = await AsyncStorage.getItem(MIGRATION_FLAG);
  if (done) return { ran: false };

  const backupPath = await writeBackupBeforeMigration();

  const all = getAllChords();
  let converted = 0;
  for (const c of all) {
    // pula chords que ja tem note preenchida — assumimos que ja foram convertidas
    // ou criadas no formato novo
    if (c.note && c.note.length > 0) continue;
    const { lyrics, note } = convertLegacyLyrics(c.lyrics || '');
    if (lyrics !== (c.lyrics || '') || note !== '') {
      updateChordLyricsAndNote(c.id, lyrics, note);
      converted++;
    }
  }

  await AsyncStorage.setItem(MIGRATION_FLAG, new Date().toISOString());
  console.log(`[migrateLyrics] convertidas ${converted}/${all.length}. Backup em ${backupPath ?? '(sem backup)'}`);
  return { ran: true, converted, total: all.length, backupPath };
}
