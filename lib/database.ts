import { collection, onSnapshot, doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Playlist { id: string; name: string; description: string; sort_order: number; created_at: number; }
export interface Chord {
  id: string;
  name: string;
  artist: string;
  tone: string;
  lyrics: string;
  external_link: string;
  tone_offset: number;
  note: string;
  created_at: number;
  keyboard_bank?: number;
  keyboard_slot?: number;
  capo?: number;
  timbre?: string;
  style?: string;
  cover_url?: string;
  cover_local_uri?: string;
}
export interface PlaylistChordLink { playlist_id: string; chord_id: string; sort_order: number; moment: string; created_at: number; }
export interface ChordWithPlaylist extends Chord { playlist_name: string; }
export interface ChordInPlaylist extends Chord { moment: string; link_sort_order: number; }

export let chords: Chord[] = [];
export let playlists: Playlist[] = [];
export let playlist_chords: PlaylistChordLink[] = [];

export interface UserSettings {
  fontSize: number;
  showLyrics: boolean;
}

export let userSettings: UserSettings = {
  fontSize: 16,
  showLyrics: true,
};

export function getSavedFontSize(): number {
  return userSettings.fontSize;
}

export function saveFontSize(size: number): void {
  userSettings.fontSize = size;
  AsyncStorage.setItem('cifrei_font_size', String(size)).catch(() => {});
  setDoc(doc(db, 'app_settings', 'user'), { fontSize: size, showLyrics: userSettings.showLyrics }, { merge: true }).catch(() => {});
}

export function getSavedShowLyrics(): boolean {
  return userSettings.showLyrics;
}

export function saveShowLyrics(show: boolean): void {
  userSettings.showLyrics = show;
  AsyncStorage.setItem('cifrei_show_lyrics', show ? '1' : '0').catch(() => {});
  setDoc(doc(db, 'app_settings', 'user'), { fontSize: userSettings.fontSize, showLyrics: show }, { merge: true }).catch(() => {});
}

let isInitialized = false;
type Listener = () => void;
const listeners = new Set<Listener>();

export function addDatabaseListener(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify() {
  listeners.forEach(l => l());
}

async function saveToCache() {
  try {
    await Promise.all([
      AsyncStorage.setItem('cache_chords', JSON.stringify(chords)),
      AsyncStorage.setItem('cache_playlists', JSON.stringify(playlists)),
      AsyncStorage.setItem('cache_playlist_chords', JSON.stringify(playlist_chords)),
    ]);
  } catch (e) {
    console.error('Erro ao salvar cache local:', e);
  }
}

export async function initDatabase(): Promise<void> {
  if (isInitialized) return Promise.resolve();

  try {
    const [cCache, pCache, lCache, fontCache, lyricsCache] = await Promise.all([
      AsyncStorage.getItem('cache_chords'),
      AsyncStorage.getItem('cache_playlists'),
      AsyncStorage.getItem('cache_playlist_chords'),
      AsyncStorage.getItem('cifrei_font_size'),
      AsyncStorage.getItem('cifrei_show_lyrics'),
    ]);
    if (cCache) {
      try {
        const parsed = JSON.parse(cCache);
        if (Array.isArray(parsed) && parsed.length > 0) chords = parsed;
      } catch (e) {}
    }
    if (pCache) {
      try {
        const parsed = JSON.parse(pCache);
        if (Array.isArray(parsed) && parsed.length > 0) playlists = parsed;
      } catch (e) {}
    }
    if (lCache) {
      try {
        const parsed = JSON.parse(lCache);
        if (Array.isArray(parsed) && parsed.length > 0) playlist_chords = parsed;
      } catch (e) {}
    }
    if (fontCache !== null) {
      const parsedFont = Number(fontCache);
      if (!isNaN(parsedFont) && parsedFont >= 10 && parsedFont <= 32) {
        userSettings.fontSize = parsedFont;
      }
    }
    if (lyricsCache !== null) {
      userSettings.showLyrics = lyricsCache === '1';
    }
  } catch (e) {
    console.error('Erro ao carregar cache local:', e);
  }

  isInitialized = true;
  notify();

  startFirestoreSync();
  return Promise.resolve();
}

let syncStarted = false;
function startFirestoreSync() {
  if (syncStarted) return;
  syncStarted = true;

  try {
    onSnapshot(doc(db, 'app_settings', 'user'), snap => {
      if (snap.exists()) {
        const data = snap.data();
        if (typeof data.fontSize === 'number' && data.fontSize >= 10 && data.fontSize <= 32) {
          userSettings.fontSize = data.fontSize;
          AsyncStorage.setItem('cifrei_font_size', String(data.fontSize)).catch(() => {});
        }
        if (typeof data.showLyrics === 'boolean') {
          userSettings.showLyrics = data.showLyrics;
          AsyncStorage.setItem('cifrei_show_lyrics', data.showLyrics ? '1' : '0').catch(() => {});
        }
        notify();
      }
    }, err => {
      console.warn('Firestore offline mode (user_settings):', err);
    });

    onSnapshot(collection(db, 'chords'), snap => {
      if (!snap.empty) {
        chords = snap.docs
          .map(d => d.data() as Chord & { is_deleted?: boolean; deleted?: boolean })
          .filter(c => !c.is_deleted && !c.deleted) as Chord[];
        saveToCache();
        notify();
      }
    }, err => {
      console.warn('Firestore offline mode (chords):', err);
    });

    onSnapshot(collection(db, 'playlists'), snap => {
      if (!snap.empty) {
        playlists = snap.docs
          .map(d => d.data() as Playlist & { is_deleted?: boolean; deleted?: boolean })
          .filter(p => !p.is_deleted && !p.deleted) as Playlist[];
        saveToCache();
        notify();
      }
    }, err => {
      console.warn('Firestore offline mode (playlists):', err);
    });

    onSnapshot(collection(db, 'playlist_chords'), snap => {
      if (!snap.empty) {
        playlist_chords = snap.docs
          .map(d => d.data() as PlaylistChordLink & { is_deleted?: boolean; deleted?: boolean })
          .filter(l => !l.is_deleted && !l.deleted) as PlaylistChordLink[];
        saveToCache();
        notify();
      }
    }, err => {
      console.warn('Firestore offline mode (playlist_chords):', err);
    });
  } catch (err) {
    console.warn('Erro ao inicializar listeners do Firestore:', err);
  }
}

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function getPlaylists(): Playlist[] {
  return [...playlists].sort((a, b) => {
    if (a.created_at !== b.created_at) return b.created_at - a.created_at;
    return b.sort_order - a.sort_order;
  });
}

export const getAllPlaylists = getPlaylists;

export function getPlaylist(id: string): Playlist | null {
  return playlists.find(p => p.id === id) || null;
}

export function createPlaylist(name: string, description: string): string {
  const id = genId();
  const sort_order = playlists.length > 0 ? Math.max(...playlists.map(p => p.sort_order)) + 1 : 0;
  const p: Playlist & { _secret: string } = { id, name, description, sort_order, created_at: Date.now(), _secret: 'sappinessvocationswingingtreachery8targetnative2026$' };
  playlists.push(p);
  setDoc(doc(db, 'playlists', id), p).catch(() => {});
  saveToCache();
  notify();
  return id;
}

export function updatePlaylist(id: string, name: string, description: string): void {
  const p = playlists.find(p => p.id === id);
  if (p) {
    p.name = name;
    p.description = description;
    saveToCache();
    notify();
  }
  updateDoc(doc(db, 'playlists', id), { name, description, _secret: 'sappinessvocationswingingtreachery8targetnative2026$' }).catch(() => {});
}

export function deletePlaylist(id: string): void {
  const linksToDelete = playlist_chords.filter(l => l.playlist_id === id);
  playlists = playlists.filter(p => p.id !== id);
  playlist_chords = playlist_chords.filter(l => l.playlist_id !== id);
  saveToCache();
  notify();

  updateDoc(doc(db, 'playlists', id), {
    is_deleted: true,
    deleted: true,
    _secret: 'sappinessvocationswingingtreachery8targetnative2026$'
  }).catch(() => {});

  deleteDoc(doc(db, 'playlists', id)).catch(() => {});

  linksToDelete.forEach(l => {
    updateDoc(doc(db, 'playlist_chords', `${l.playlist_id}_${l.chord_id}`), {
      is_deleted: true,
      deleted: true,
      _secret: 'sappinessvocationswingingtreachery8targetnative2026$'
    }).catch(() => {});
    deleteDoc(doc(db, 'playlist_chords', `${l.playlist_id}_${l.chord_id}`)).catch(() => {});
  });
}

export function getChord(id: string): Chord | null {
  return chords.find(c => c.id === id) || null;
}

export function getAllChords(): Chord[] {
  return [...chords];
}

const ACRONYMS = new Set(['CNBB', 'II', 'III', 'IV', 'VI', 'VII', 'VIII', 'IX', 'DJ', 'MC']);
const CONNECTORS = new Set(['e', 'de', 'do', 'da', 'dos', 'das', 'em', 'com', 'ao', 'aos']);

/**
 * Formata o nome do artista para Title Case com a primeira letra de cada palavra em maiúsculo,
 * preservando conectores em minúsculo e siglas/números romanos em maiúsculo.
 */
export function formatArtistName(name: string): string {
  if (!name) return '';
  const clean = name.trim();
  if (!clean) return '';
  return clean
    .split(/\s+/)
    .map((word, i) => {
      if (!word) return '';
      const upper = word.toUpperCase();
      if (ACRONYMS.has(upper)) {
        return upper;
      }
      const lower = word.toLowerCase();
      if (CONNECTORS.has(lower) && i > 0) {
        return lower;
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ')
    .replace(/^\w/, c => c.toUpperCase());
}

/**
 * Normaliza strings para comparação insensível a maiúsculas, minúsculas, acentos e múltiplos espaços.
 */
export function normalizeKey(str: string): string {
  if (!str) return '';
  return str
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * Busca se já existe uma música com o mesmo nome e mesmo artista cadastrada.
 */
export function findExistingChord(name: string, artist: string, excludeId?: string): Chord | null {
  const normName = normalizeKey(name);
  const normArtist = normalizeKey(artist);
  if (!normName) return null;
  return chords.find(c => {
    if (excludeId && c.id === excludeId) return false;
    return normalizeKey(c.name) === normName && normalizeKey(c.artist) === normArtist;
  }) || null;
}

export function findChordByYoutubeLink(link: string): Chord | null {
  if (!link) return null;
  return chords.find(c => c.external_link === link) || null;
}

export function searchChords(query: string): ChordWithPlaylist[] {
  const q = normalizeKey(query);
  const matched = chords.filter(c => normalizeKey(c.name).includes(q) || normalizeKey(c.artist).includes(q));
  return matched.map(c => {
    const pNames = playlist_chords
      .filter(l => l.chord_id === c.id)
      .map(l => playlists.find(p => p.id === l.playlist_id)?.name)
      .filter(Boolean)
      .join(', ');
    return { ...c, playlist_name: pNames };
  }).sort((a, b) => a.name.localeCompare(b.name));
}

function cleanFirestoreDoc(obj: Record<string, any>): Record<string, any> {
  const clean: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      clean[k] = v;
    }
  }
  return clean;
}

export function getTotalCount(): number {
  return chords.length;
}

export function createChord(data: {
  name: string;
  artist: string;
  tone: string;
  lyrics: string;
  externalLink?: string;
  note?: string;
  keyboard_bank?: number;
  keyboard_slot?: number;
  capo?: number;
  timbre?: string;
  style?: string;
  cover_url?: string;
  cover_local_uri?: string;
}): string {
  const formattedArtist = formatArtistName(data.artist || '');
  const cleanName = (data.name || '').trim();

  // Verificação rigorosa anti-duplicidade:
  const existing = findExistingChord(cleanName, formattedArtist);
  if (existing) {
    // Se a música já existir, atualiza dados faltantes e retorna o ID existente sem criar cópia
    let shouldUpdate = false;
    if (!existing.cover_url && data.cover_url) {
      existing.cover_url = data.cover_url;
      shouldUpdate = true;
    }
    if ((!existing.lyrics || existing.lyrics.length < (data.lyrics?.length || 0)) && data.lyrics) {
      existing.lyrics = data.lyrics;
      shouldUpdate = true;
    }
    if (shouldUpdate) {
      saveToCache();
      notify();
      updateDoc(doc(db, 'chords', existing.id), cleanFirestoreDoc({
        ...existing,
        _secret: 'sappinessvocationswingingtreachery8targetnative2026$'
      })).catch(() => {});
    }
    return existing.id;
  }

  const id = genId();
  const c: Chord = {
    id,
    name: cleanName,
    artist: formattedArtist,
    tone: data.tone || 'C',
    lyrics: data.lyrics || '',
    external_link: data.externalLink || '',
    tone_offset: 0,
    note: data.note || '',
    created_at: Date.now(),
    keyboard_bank: data.keyboard_bank,
    keyboard_slot: data.keyboard_slot,
    capo: data.capo,
    timbre: data.timbre,
    style: data.style,
    cover_url: data.cover_url || '',
    cover_local_uri: data.cover_local_uri || '',
  };
  chords.push(c);

  const payload = cleanFirestoreDoc({
    ...c,
    _secret: 'sappinessvocationswingingtreachery8targetnative2026$'
  });
  setDoc(doc(db, 'chords', id), payload).catch(() => {});
  saveToCache();
  notify();
  return id;
}

export function updateChord(id: string, data: {
  name: string;
  artist: string;
  tone: string;
  lyrics: string;
  externalLink?: string;
  note?: string;
  keyboard_bank?: number;
  keyboard_slot?: number;
  capo?: number;
  timbre?: string;
  style?: string;
  cover_url?: string;
  cover_local_uri?: string;
}): void {
  const formattedArtist = formatArtistName(data.artist || '');
  const cleanName = (data.name || '').trim();

  const c = chords.find(c => c.id === id);
  if (c) {
    c.name = cleanName;
    c.artist = formattedArtist;
    c.tone = data.tone;
    c.lyrics = data.lyrics;
    c.external_link = data.externalLink || '';
    c.note = data.note || '';
    c.keyboard_bank = data.keyboard_bank;
    c.keyboard_slot = data.keyboard_slot;
    c.capo = data.capo;
    c.timbre = data.timbre;
    c.style = data.style;
    if (data.cover_url !== undefined) c.cover_url = data.cover_url;
    if (data.cover_local_uri !== undefined) c.cover_local_uri = data.cover_local_uri;
    saveToCache();
    notify();
  }
  const payload = cleanFirestoreDoc({
    name: cleanName,
    artist: formattedArtist,
    tone: data.tone,
    lyrics: data.lyrics,
    external_link: data.externalLink || '',
    note: data.note || '',
    keyboard_bank: data.keyboard_bank ?? null,
    keyboard_slot: data.keyboard_slot ?? null,
    capo: data.capo ?? null,
    timbre: data.timbre ?? null,
    style: data.style ?? null,
    cover_url: data.cover_url ?? c?.cover_url ?? '',
    cover_local_uri: data.cover_local_uri ?? c?.cover_local_uri ?? '',
    _secret: 'sappinessvocationswingingtreachery8targetnative2026$'
  });
  updateDoc(doc(db, 'chords', id), payload).catch(() => {});
}

export function updateChordCover(id: string, cover_url: string, cover_local_uri?: string): void {
  const c = chords.find(c => c.id === id);
  if (c) {
    c.cover_url = cover_url;
    if (cover_local_uri) c.cover_local_uri = cover_local_uri;
    saveToCache();
    notify();
  }
  updateDoc(doc(db, 'chords', id), {
    cover_url,
    cover_local_uri: cover_local_uri || '',
    _secret: 'sappinessvocationswingingtreachery8targetnative2026$'
  }).catch(() => {});
}

export function updateChordNote(id: string, note: string): void {
  const c = chords.find(c => c.id === id);
  if (c) {
    c.note = note;
    saveToCache();
    notify();
  }
  updateDoc(doc(db, 'chords', id), { note, _secret: 'sappinessvocationswingingtreachery8targetnative2026$' });
}

export function updateChordLyricsAndNote(id: string, lyrics: string, note: string): void {
  const c = chords.find(c => c.id === id);
  if (c) {
    c.lyrics = lyrics;
    c.note = note;
    saveToCache();
    notify();
  }
  updateDoc(doc(db, 'chords', id), { lyrics, note, _secret: 'sappinessvocationswingingtreachery8targetnative2026$' });
}

export function deleteChord(id: string): void {
  const linksToDelete = playlist_chords.filter(l => l.chord_id === id);
  chords = chords.filter(c => c.id !== id);
  playlist_chords = playlist_chords.filter(l => l.chord_id !== id);
  saveToCache();
  notify();

  updateDoc(doc(db, 'chords', id), {
    is_deleted: true,
    deleted: true,
    _secret: 'sappinessvocationswingingtreachery8targetnative2026$'
  }).catch(() => {});

  deleteDoc(doc(db, 'chords', id)).catch(() => {});

  linksToDelete.forEach(l => {
    updateDoc(doc(db, 'playlist_chords', `${l.playlist_id}_${l.chord_id}`), {
      is_deleted: true,
      deleted: true,
      _secret: 'sappinessvocationswingingtreachery8targetnative2026$'
    }).catch(() => {});
    deleteDoc(doc(db, 'playlist_chords', `${l.playlist_id}_${l.chord_id}`)).catch(() => {});
  });
}

export function updateChordToneOffset(id: string, offset: number): void {
  const c = chords.find(c => c.id === id);
  if (c) {
    c.tone_offset = offset;
    saveToCache();
    notify();
  }
  updateDoc(doc(db, 'chords', id), { tone_offset: offset, _secret: 'sappinessvocationswingingtreachery8targetnative2026$' });
}

export function getPlaylistChords(playlistId: string): ChordInPlaylist[] {
  const links = playlist_chords.filter(l => l.playlist_id === playlistId);
  return links.map(l => {
    const c = chords.find(ch => ch.id === l.chord_id);
    if (!c) return null;
    return { ...c, moment: l.moment, link_sort_order: l.sort_order };
  }).filter((c): c is ChordInPlaylist => c !== null)
    .sort((a, b) => {
      if (a.link_sort_order !== b.link_sort_order) return a.link_sort_order - b.link_sort_order;
      return b.created_at - a.created_at;
    });
}

export function getChordsForPlaylist(playlistId: string): Chord[] {
  return getPlaylistChords(playlistId);
}

export function getPlaylistsForChord(chordId: string): Playlist[] {
  const links = playlist_chords.filter(l => l.chord_id === chordId);
  return links.map(l => playlists.find(p => p.id === l.playlist_id))
    .filter((p): p is Playlist => p !== undefined)
    .sort((a, b) => {
      if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
      return b.created_at - a.created_at;
    });
}

export function getAllLinks(): PlaylistChordLink[] {
  return [...playlist_chords];
}

export function linkChordToPlaylist(chordId: string, playlistId: string, opts?: { sortOrder?: number; moment?: string }): void {
  let sortOrder = opts?.sortOrder;
  if (sortOrder === undefined) {
    const existing = playlist_chords.filter(l => l.playlist_id === playlistId);
    sortOrder = existing.length > 0 ? Math.max(...existing.map(l => l.sort_order)) + 1 : 0;
  }
  const l: PlaylistChordLink & { _secret: string } = {
    playlist_id: playlistId, chord_id: chordId, sort_order: sortOrder, moment: opts?.moment || '', created_at: Date.now(),
    _secret: 'sappinessvocationswingingtreachery8targetnative2026$'
  };
  playlist_chords.push(l);
  saveToCache();
  notify();

  setDoc(doc(db, 'playlist_chords', `${playlistId}_${chordId}`), l);
}

export function unlinkChordFromPlaylist(chordId: string, playlistId: string): void {
  playlist_chords = playlist_chords.filter(l => !(l.playlist_id === playlistId && l.chord_id === chordId));
  saveToCache();
  notify();

  updateDoc(doc(db, 'playlist_chords', `${playlistId}_${chordId}`), {
    is_deleted: true,
    deleted: true,
    _secret: 'sappinessvocationswingingtreachery8targetnative2026$'
  }).catch(() => {});
  deleteDoc(doc(db, 'playlist_chords', `${playlistId}_${chordId}`)).catch(() => {});
}

export function updateLinkMoment(chordId: string, playlistId: string, moment: string): void {
  const l = playlist_chords.find(l => l.playlist_id === playlistId && l.chord_id === chordId);
  if (l) {
    l.moment = moment;
    saveToCache();
    notify();
  }
  updateDoc(doc(db, 'playlist_chords', `${playlistId}_${chordId}`), { moment, _secret: 'sappinessvocationswingingtreachery8targetnative2026$' });
}

export function updateLinkSortOrder(chordId: string, playlistId: string, sortOrder: number): void {
  const l = playlist_chords.find(l => l.playlist_id === playlistId && l.chord_id === chordId);
  if (l) {
    l.sort_order = sortOrder;
    saveToCache();
    notify();
  }
  updateDoc(doc(db, 'playlist_chords', `${playlistId}_${chordId}`), { sort_order: sortOrder, _secret: 'sappinessvocationswingingtreachery8targetnative2026$' });
}

export function getLink(chordId: string, playlistId: string): { sort_order: number; moment: string } | null {
  const l = playlist_chords.find(l => l.playlist_id === playlistId && l.chord_id === chordId);
  if (!l) return null;
  return { sort_order: l.sort_order, moment: l.moment };
}
