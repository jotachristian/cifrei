import * as SQLite from 'expo-sqlite';

// Estrutura do arquivo de backup JSON
export interface BackupPlaylist {
  id: string; name: string; description: string; sort_order: number;
}
export interface BackupChord {
  id: string; name: string; artist: string; tone: string; lyrics: string;
  playlist_id: string; external_link: string; sort_order: number;
}
export interface BackupData {
  version: number;
  exportedAt: string;
  playlists: BackupPlaylist[];
  chords: BackupChord[];
}

let _db: SQLite.SQLiteDatabase | null = null;
function db() {
  if (!_db) _db = SQLite.openDatabaseSync('cifrei.db');
  return _db;
}

/** Exporta TODOS os dados do SQLite como objeto JSON. */
export function exportAllData(): BackupData {
  const playlists = db().getAllSync<BackupPlaylist>(
    'SELECT id, name, description, sort_order FROM playlists ORDER BY sort_order ASC'
  );
  const chords = db().getAllSync<BackupChord>(
    'SELECT id, name, artist, tone, lyrics, playlist_id, external_link, sort_order FROM chords ORDER BY playlist_id, sort_order ASC'
  );
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    playlists,
    chords,
  };
}

/**
 * Importa um BackupData no banco.
 * mode = 'merge'   -> adiciona apenas registros com IDs novos (nao sobrescreve)
 * mode = 'replace' -> apaga tudo e reimporta
 */
export function importData(
  data: BackupData,
  mode: 'merge' | 'replace'
): { added: { playlists: number; chords: number } } {
  if (mode === 'replace') {
    db().runSync('DELETE FROM chords');
    db().runSync('DELETE FROM playlists');
  }

  let pAdded = 0;
  for (const p of data.playlists) {
    const exists = db().getFirstSync<{ id: string }>('SELECT id FROM playlists WHERE id=?', [p.id]);
    if (!exists) {
      db().runSync(
        'INSERT INTO playlists (id, name, description, sort_order) VALUES (?,?,?,?)',
        [p.id, p.name, p.description ?? '', p.sort_order ?? 0]
      );
      pAdded++;
    }
  }

  let cAdded = 0;
  for (const c of data.chords) {
    const exists = db().getFirstSync<{ id: string }>('SELECT id FROM chords WHERE id=?', [c.id]);
    if (!exists) {
      db().runSync(
        'INSERT INTO chords (id, name, artist, tone, lyrics, playlist_id, external_link, sort_order) VALUES (?,?,?,?,?,?,?,?)',
        [c.id, c.name, c.artist ?? '', c.tone ?? 'C', c.lyrics ?? '',
         c.playlist_id ?? '', c.external_link ?? '', c.sort_order ?? 0]
      );
      cAdded++;
    }
  }

  return { added: { playlists: pAdded, chords: cAdded } };
}
