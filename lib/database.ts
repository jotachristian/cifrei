import * as SQLite from 'expo-sqlite';

let _db: SQLite.SQLiteDatabase | null = null;

function db(): SQLite.SQLiteDatabase {
  if (!_db) _db = SQLite.openDatabaseSync('cifrei.db');
  return _db;
}

function tableHasColumn(table: string, col: string): boolean {
  const rows = db().getAllSync<{ name: string }>(`PRAGMA table_info(${table})`);
  return rows.some(r => r.name === col);
}

export function initDatabase(): void {
  // schema novo (sem playlist_id/sort_order em chords — agora vivem em playlist_chords)
  db().execSync(`
    CREATE TABLE IF NOT EXISTS playlists (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      sort_order INTEGER DEFAULT 0,
      created_at INTEGER DEFAULT (strftime('%s','now')*1000)
    );
    CREATE TABLE IF NOT EXISTS chords (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      artist TEXT DEFAULT '',
      tone TEXT DEFAULT 'C',
      lyrics TEXT DEFAULT '',
      external_link TEXT DEFAULT '',
      tone_offset INTEGER DEFAULT 0,
      note TEXT DEFAULT '',
      created_at INTEGER DEFAULT (strftime('%s','now')*1000)
    );
    CREATE TABLE IF NOT EXISTS playlist_chords (
      playlist_id TEXT NOT NULL,
      chord_id TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      moment TEXT DEFAULT '',
      created_at INTEGER DEFAULT (strftime('%s','now')*1000),
      PRIMARY KEY (playlist_id, chord_id)
    );
    CREATE INDEX IF NOT EXISTS idx_pc_playlist ON playlist_chords(playlist_id);
    CREATE INDEX IF NOT EXISTS idx_pc_chord    ON playlist_chords(chord_id);
  `);

  // migracoes idempotentes pra DBs criados em versoes anteriores
  try { db().execSync('ALTER TABLE chords ADD COLUMN tone_offset INTEGER DEFAULT 0'); } catch { /* ja existe */ }
  try { db().execSync('ALTER TABLE chords ADD COLUMN note TEXT DEFAULT \'\''); } catch { /* ja existe */ }

  // Se o DB ja existia com playlist_id/sort_order, garante backfill antes de
  // remover as colunas. INSERT OR IGNORE deixa idempotente.
  if (tableHasColumn('chords', 'playlist_id')) {
    db().execSync(`
      INSERT OR IGNORE INTO playlist_chords (playlist_id, chord_id, sort_order, moment)
      SELECT playlist_id, id, COALESCE(sort_order,0), ''
      FROM chords
      WHERE playlist_id IS NOT NULL AND playlist_id <> ''
    `);
    rebuildChordsTableWithoutLegacy();
  } else if (tableHasColumn('chords', 'sort_order')) {
    // tinha sort_order mas nao playlist_id (estado intermediario improvavel) — rebuild mesmo assim
    rebuildChordsTableWithoutLegacy();
  }
}

/**
 * Padrao recomendado pelo SQLite pra remover colunas: cria tabela nova,
 * copia dados das colunas que ficam, dropa antiga, renomeia.
 * Removidas: playlist_id, sort_order (migradas pra playlist_chords).
 */
function rebuildChordsTableWithoutLegacy(): void {
  db().execSync(`
    BEGIN TRANSACTION;
    CREATE TABLE chords_new (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      artist TEXT DEFAULT '',
      tone TEXT DEFAULT 'C',
      lyrics TEXT DEFAULT '',
      external_link TEXT DEFAULT '',
      tone_offset INTEGER DEFAULT 0,
      note TEXT DEFAULT '',
      created_at INTEGER DEFAULT (strftime('%s','now')*1000)
    );
    INSERT INTO chords_new (id, name, artist, tone, lyrics, external_link, tone_offset, note, created_at)
      SELECT id, name, artist, tone, lyrics, external_link,
             COALESCE(tone_offset,0), COALESCE(note,''), created_at
      FROM chords;
    DROP TABLE chords;
    ALTER TABLE chords_new RENAME TO chords;
    COMMIT;
  `);
}

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export interface Playlist {
  id: string; name: string; description: string;
  sort_order: number; created_at: number;
}

export interface Chord {
  id: string; name: string; artist: string; tone: string;
  lyrics: string; external_link: string;
  tone_offset: number; note: string;
  created_at: number;
}

// Resultado da busca: cifra + nomes das playlists em que aparece (concatenados)
export interface ChordWithPlaylist extends Chord { playlist_name: string; }

// Chord como aparece dentro de uma playlist (com dados do vinculo)
export interface ChordInPlaylist extends Chord {
  moment: string;          // do vinculo playlist_chords
  link_sort_order: number; // sort_order do vinculo
}

export interface PlaylistChordLink {
  playlist_id: string; chord_id: string;
  sort_order: number; moment: string; created_at: number;
}

// ─── playlists ──────────────────────────────────────────────────────────────

export function getPlaylists(): Playlist[] {
  return db().getAllSync<Playlist>(
    'SELECT * FROM playlists ORDER BY created_at DESC, sort_order DESC'
  );
}

export function getPlaylist(id: string): Playlist | null {
  return db().getFirstSync<Playlist>('SELECT * FROM playlists WHERE id=?', [id]) ?? null;
}

export function createPlaylist(name: string, description: string): string {
  const id = genId();
  const row = db().getFirstSync<{ n: number }>(
    'SELECT COALESCE(MAX(sort_order)+1,0) as n FROM playlists'
  );
  db().runSync(
    'INSERT INTO playlists (id,name,description,sort_order) VALUES (?,?,?,?)',
    [id, name, description, row?.n ?? 0]
  );
  return id;
}

export function updatePlaylist(id: string, name: string, description: string): void {
  db().runSync('UPDATE playlists SET name=?,description=? WHERE id=?', [name, description, id]);
}

/**
 * Deleta uma playlist e seus vinculos. As cifras NAO sao deletadas —
 * elas podem estar vinculadas a outras playlists ou ser usadas standalone.
 */
export function deletePlaylist(id: string): void {
  db().runSync('DELETE FROM playlist_chords WHERE playlist_id=?', [id]);
  db().runSync('DELETE FROM playlists WHERE id=?', [id]);
}

// ─── chords ────────────────────────────────────────────────────────────────

export function getChord(id: string): Chord | null {
  return db().getFirstSync<Chord>('SELECT * FROM chords WHERE id=?', [id]) ?? null;
}

export function getAllChords(): Chord[] {
  return db().getAllSync<Chord>('SELECT * FROM chords');
}

export function findChordByYoutubeLink(link: string): Chord | null {
  if (!link) return null;
  return db().getFirstSync<Chord>(
    'SELECT * FROM chords WHERE external_link = ? LIMIT 1',
    [link]
  ) ?? null;
}

export function searchChords(query: string): ChordWithPlaylist[] {
  const q = '%' + query + '%';
  return db().getAllSync<ChordWithPlaylist>(
    `SELECT c.*,
            COALESCE((
              SELECT GROUP_CONCAT(p.name, ', ')
              FROM playlist_chords pc
              JOIN playlists p ON p.id = pc.playlist_id
              WHERE pc.chord_id = c.id
            ), '') as playlist_name
     FROM chords c
     WHERE c.name LIKE ? OR c.artist LIKE ?
     ORDER BY c.name ASC`,
    [q, q]
  );
}

export function getTotalCount(): number {
  return db().getFirstSync<{ n: number }>('SELECT COUNT(*) as n FROM chords')?.n ?? 0;
}

export function createChord(data: {
  name: string; artist: string; tone: string; lyrics: string;
  externalLink?: string; note?: string;
}): string {
  const id = genId();
  db().runSync(
    'INSERT INTO chords (id,name,artist,tone,lyrics,external_link,note) VALUES (?,?,?,?,?,?,?)',
    [id, data.name, data.artist, data.tone, data.lyrics,
     data.externalLink ?? '', data.note ?? '']
  );
  return id;
}

export function updateChord(id: string, data: {
  name: string; artist: string; tone: string; lyrics: string;
  externalLink?: string; note?: string;
}): void {
  db().runSync(
    'UPDATE chords SET name=?,artist=?,tone=?,lyrics=?,external_link=?,note=? WHERE id=?',
    [data.name, data.artist, data.tone, data.lyrics,
     data.externalLink ?? '', data.note ?? '', id]
  );
}

export function updateChordNote(id: string, note: string): void {
  db().runSync('UPDATE chords SET note=? WHERE id=?', [note, id]);
}

export function updateChordLyricsAndNote(id: string, lyrics: string, note: string): void {
  db().runSync('UPDATE chords SET lyrics=?, note=? WHERE id=?', [lyrics, note, id]);
}

export function deleteChord(id: string): void {
  db().runSync('DELETE FROM playlist_chords WHERE chord_id=?', [id]);
  db().runSync('DELETE FROM chords WHERE id=?', [id]);
}

export function updateChordToneOffset(id: string, offset: number): void {
  db().runSync('UPDATE chords SET tone_offset=? WHERE id=?', [offset, id]);
}

// ─── playlist_chords (vinculos N:N) ─────────────────────────────────────────

export function getPlaylistChords(playlistId: string): ChordInPlaylist[] {
  return db().getAllSync<ChordInPlaylist>(
    `SELECT c.*, pc.moment as moment, pc.sort_order as link_sort_order
     FROM playlist_chords pc
     JOIN chords c ON c.id = pc.chord_id
     WHERE pc.playlist_id = ?
     ORDER BY pc.sort_order ASC, c.created_at DESC`,
    [playlistId]
  );
}

/** Versao legacy mantida pra compat — retorna so Chord, sem dados do vinculo. */
export function getChordsForPlaylist(playlistId: string): Chord[] {
  return getPlaylistChords(playlistId);
}

export function getPlaylistsForChord(chordId: string): Playlist[] {
  return db().getAllSync<Playlist>(
    `SELECT p.* FROM playlists p
     JOIN playlist_chords pc ON pc.playlist_id = p.id
     WHERE pc.chord_id = ?
     ORDER BY p.sort_order ASC, p.created_at DESC`,
    [chordId]
  );
}

export function getAllLinks(): PlaylistChordLink[] {
  return db().getAllSync<PlaylistChordLink>('SELECT * FROM playlist_chords');
}

export function linkChordToPlaylist(
  chordId: string,
  playlistId: string,
  opts?: { sortOrder?: number; moment?: string }
): void {
  let sortOrder = opts?.sortOrder;
  if (sortOrder === undefined) {
    const row = db().getFirstSync<{ n: number }>(
      'SELECT COALESCE(MAX(sort_order)+1,0) as n FROM playlist_chords WHERE playlist_id=?',
      [playlistId]
    );
    sortOrder = row?.n ?? 0;
  }
  db().runSync(
    'INSERT OR IGNORE INTO playlist_chords (playlist_id, chord_id, sort_order, moment) VALUES (?,?,?,?)',
    [playlistId, chordId, sortOrder, opts?.moment ?? '']
  );
}

export function unlinkChordFromPlaylist(chordId: string, playlistId: string): void {
  db().runSync(
    'DELETE FROM playlist_chords WHERE playlist_id=? AND chord_id=?',
    [playlistId, chordId]
  );
}

export function updateLinkMoment(chordId: string, playlistId: string, moment: string): void {
  db().runSync(
    'UPDATE playlist_chords SET moment=? WHERE playlist_id=? AND chord_id=?',
    [moment, playlistId, chordId]
  );
}

export function updateLinkSortOrder(chordId: string, playlistId: string, sortOrder: number): void {
  db().runSync(
    'UPDATE playlist_chords SET sort_order=? WHERE playlist_id=? AND chord_id=?',
    [sortOrder, playlistId, chordId]
  );
}

export function getLink(chordId: string, playlistId: string): { sort_order: number; moment: string } | null {
  return db().getFirstSync<{ sort_order: number; moment: string }>(
    'SELECT sort_order, moment FROM playlist_chords WHERE playlist_id=? AND chord_id=?',
    [playlistId, chordId]
  ) ?? null;
}
