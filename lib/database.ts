import * as SQLite from 'expo-sqlite';

let _db: SQLite.SQLiteDatabase | null = null;

function db(): SQLite.SQLiteDatabase {
  if (!_db) _db = SQLite.openDatabaseSync('cifrei.db');
  return _db;
}

export function initDatabase(): void {
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
      playlist_id TEXT,
      external_link TEXT DEFAULT '',
      sort_order INTEGER DEFAULT 0,
      created_at INTEGER DEFAULT (strftime('%s','now')*1000)
    );
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
  lyrics: string; playlist_id: string; external_link: string;
  sort_order: number; created_at: number;
}

export interface ChordWithPlaylist extends Chord { playlist_name: string; }

export function getPlaylists(): Playlist[] {
  return db().getAllSync<Playlist>(
    'SELECT * FROM playlists ORDER BY sort_order ASC, created_at DESC'
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

export function deletePlaylist(id: string): void {
  db().runSync('DELETE FROM chords WHERE playlist_id=?', [id]);
  db().runSync('DELETE FROM playlists WHERE id=?', [id]);
}

export function getChordsForPlaylist(playlistId: string): Chord[] {
  return db().getAllSync<Chord>(
    'SELECT * FROM chords WHERE playlist_id=? ORDER BY sort_order ASC, created_at DESC',
    [playlistId]
  );
}

export function getChord(id: string): Chord | null {
  return db().getFirstSync<Chord>('SELECT * FROM chords WHERE id=?', [id]) ?? null;
}

export function searchChords(query: string): ChordWithPlaylist[] {
  const q = '%' + query + '%';
  return db().getAllSync<ChordWithPlaylist>(
    `SELECT c.*, COALESCE(p.name,'') as playlist_name
     FROM chords c LEFT JOIN playlists p ON c.playlist_id=p.id
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
  playlistId: string; externalLink?: string;
}): string {
  const id = genId();
  const row = db().getFirstSync<{ n: number }>(
    'SELECT COALESCE(MAX(sort_order)+1,0) as n FROM chords WHERE playlist_id=?',
    [data.playlistId]
  );
  db().runSync(
    'INSERT INTO chords (id,name,artist,tone,lyrics,playlist_id,external_link,sort_order) VALUES (?,?,?,?,?,?,?,?)',
    [id, data.name, data.artist, data.tone, data.lyrics, data.playlistId,
     data.externalLink ?? '', row?.n ?? 0]
  );
  return id;
}

export function updateChord(id: string, data: {
  name: string; artist: string; tone: string; lyrics: string;
  playlistId: string; externalLink?: string; sortOrder?: number;
}): void {
  db().runSync(
    'UPDATE chords SET name=?,artist=?,tone=?,lyrics=?,playlist_id=?,external_link=?,sort_order=? WHERE id=?',
    [data.name, data.artist, data.tone, data.lyrics, data.playlistId,
     data.externalLink ?? '', data.sortOrder ?? 0, id]
  );
}

export function deleteChord(id: string): void {
  db().runSync('DELETE FROM chords WHERE id=?', [id]);
}
