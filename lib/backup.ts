import * as SQLite from 'expo-sqlite';

// Estrutura do arquivo de backup JSON.
// Versao 2: schema N:N. Cifras vivem standalone; vinculos em playlist_chords.
export interface BackupPlaylist {
  id: string; name: string; description: string; sort_order: number;
}
export interface BackupChord {
  id: string; name: string; artist: string; tone: string; lyrics: string;
  external_link: string; tone_offset: number; note: string;
}
export interface BackupLink {
  playlist_id: string; chord_id: string; sort_order: number; moment: string;
}
export interface BackupData {
  version: number;
  exportedAt: string;
  playlists: BackupPlaylist[];
  chords: BackupChord[];
  playlist_chords?: BackupLink[]; // opcional: backups v1 nao tem
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
    `SELECT id, name, artist, tone, lyrics, external_link,
            COALESCE(tone_offset,0) as tone_offset, COALESCE(note,'') as note
     FROM chords ORDER BY created_at ASC`
  );
  const links = db().getAllSync<BackupLink>(
    'SELECT playlist_id, chord_id, sort_order, moment FROM playlist_chords ORDER BY playlist_id, sort_order ASC'
  );
  return {
    version: 2,
    exportedAt: new Date().toISOString(),
    playlists,
    chords,
    playlist_chords: links,
  };
}

/**
 * Importa um BackupData no banco.
 * mode = 'merge'   -> adiciona apenas registros com IDs novos (nao sobrescreve)
 * mode = 'replace' -> apaga tudo e reimporta
 *
 * Backups v1 (sem playlist_chords) sao tratados: se cada chord tem playlist_id,
 * reconstroi o vinculo automaticamente.
 */
export function importData(
  data: BackupData,
  mode: 'merge' | 'replace'
): { added: { playlists: number; chords: number; links: number } } {
  if (mode === 'replace') {
    db().runSync('DELETE FROM playlist_chords');
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
        `INSERT INTO chords (id, name, artist, tone, lyrics, external_link, tone_offset, note)
         VALUES (?,?,?,?,?,?,?,?)`,
        [c.id, c.name, c.artist ?? '', c.tone ?? 'C', c.lyrics ?? '',
         c.external_link ?? '', c.tone_offset ?? 0, c.note ?? '']
      );
      cAdded++;
    }
  }

  let lAdded = 0;
  if (data.playlist_chords && data.playlist_chords.length > 0) {
    for (const l of data.playlist_chords) {
      db().runSync(
        'INSERT OR IGNORE INTO playlist_chords (playlist_id, chord_id, sort_order, moment) VALUES (?,?,?,?)',
        [l.playlist_id, l.chord_id, l.sort_order ?? 0, l.moment ?? '']
      );
      lAdded++;
    }
  } else {
    // backup v1 (legacy): reconstroi vinculos a partir do campo playlist_id
    // que existia em cada chord. Os objetos vem do JSON antigo, entao olho la.
    for (const c of (data.chords as any[])) {
      const pid = c.playlist_id as string | undefined;
      if (pid) {
        db().runSync(
          'INSERT OR IGNORE INTO playlist_chords (playlist_id, chord_id, sort_order, moment) VALUES (?,?,?,?)',
          [pid, c.id, c.sort_order ?? 0, '']
        );
        lAdded++;
      }
    }
  }

  return { added: { playlists: pAdded, chords: cAdded, links: lAdded } };
}
