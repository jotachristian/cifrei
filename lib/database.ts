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
}
export interface PlaylistChordLink { playlist_id: string; chord_id: string; sort_order: number; moment: string; created_at: number; }
export interface ChordWithPlaylist extends Chord { playlist_name: string; }
export interface ChordInPlaylist extends Chord { moment: string; link_sort_order: number; }

export let chords: Chord[] = [];
export let playlists: Playlist[] = [];
export let playlist_chords: PlaylistChordLink[] = [];

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
    const [cCache, pCache, lCache] = await Promise.all([
      AsyncStorage.getItem('cache_chords'),
      AsyncStorage.getItem('cache_playlists'),
      AsyncStorage.getItem('cache_playlist_chords'),
    ]);
    if (cCache) chords = JSON.parse(cCache);
    if (pCache) playlists = JSON.parse(pCache);
    if (lCache) playlist_chords = JSON.parse(lCache);
    notify();
  } catch (e) {
    console.error('Erro ao carregar cache local:', e);
  }

  return new Promise((resolve) => {
    let cLoaded = false; let pLoaded = false; let lLoaded = false;
    const check = () => { if (cLoaded && pLoaded && lLoaded) { isInitialized = true; resolve(); } };

    onSnapshot(collection(db, 'chords'), snap => {
      chords = snap.docs.map(d => d.data() as Chord);
      saveToCache();
      if (isInitialized) notify();
      cLoaded = true; check();
    }, () => {
      cLoaded = true; check();
    });
    onSnapshot(collection(db, 'playlists'), snap => {
      playlists = snap.docs.map(d => d.data() as Playlist);
      saveToCache();
      if (isInitialized) notify();
      pLoaded = true; check();
    }, () => {
      pLoaded = true; check();
    });
    onSnapshot(collection(db, 'playlist_chords'), snap => {
      playlist_chords = snap.docs.map(d => d.data() as PlaylistChordLink);
      saveToCache();
      if (isInitialized) notify();
      lLoaded = true; check();
    }, () => {
      lLoaded = true; check();
    });
  });
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
  setDoc(doc(db, 'playlists', id), p);
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
  updateDoc(doc(db, 'playlists', id), { name, description, _secret: 'sappinessvocationswingingtreachery8targetnative2026$' });
}

export function deletePlaylist(id: string): void {
  const linksToDelete = playlist_chords.filter(l => l.playlist_id === id);
  playlists = playlists.filter(p => p.id !== id);
  playlist_chords = playlist_chords.filter(l => l.playlist_id !== id);
  saveToCache();
  notify();

  deleteDoc(doc(db, 'playlists', id)).catch(err => {
    console.warn('Firestore deletePlaylist warn:', err);
  });
  linksToDelete.forEach(l => {
    deleteDoc(doc(db, 'playlist_chords', `${l.playlist_id}_${l.chord_id}`)).catch(err => {
      console.warn('Firestore delete link warn:', err);
    });
  });
}

export function getChord(id: string): Chord | null {
  return chords.find(c => c.id === id) || null;
}

export function getAllChords(): Chord[] {
  return [...chords];
}

export function findChordByYoutubeLink(link: string): Chord | null {
  if (!link) return null;
  return chords.find(c => c.external_link === link) || null;
}

export function searchChords(query: string): ChordWithPlaylist[] {
  const q = query.toLowerCase();
  const matched = chords.filter(c => c.name.toLowerCase().includes(q) || c.artist.toLowerCase().includes(q));
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

export function createChord(data: { name: string; artist: string; tone: string; lyrics: string; externalLink?: string; note?: string; keyboard_bank?: number; keyboard_slot?: number; capo?: number; }): string {
  const id = genId();
  const c: Chord = {
    id,
    name: data.name || '',
    artist: data.artist || '',
    tone: data.tone || 'C',
    lyrics: data.lyrics || '',
    external_link: data.externalLink || '',
    tone_offset: 0,
    note: data.note || '',
    created_at: Date.now(),
    keyboard_bank: data.keyboard_bank,
    keyboard_slot: data.keyboard_slot,
    capo: data.capo,
  };
  chords.push(c);

  const payload = cleanFirestoreDoc({
    ...c,
    _secret: 'sappinessvocationswingingtreachery8targetnative2026$'
  });
  setDoc(doc(db, 'chords', id), payload);
  saveToCache();
  notify();
  return id;
}

export function updateChord(id: string, data: { name: string; artist: string; tone: string; lyrics: string; externalLink?: string; note?: string; keyboard_bank?: number; keyboard_slot?: number; capo?: number; }): void {
  const c = chords.find(c => c.id === id);
  if (c) {
    c.name = data.name;
    c.artist = data.artist;
    c.tone = data.tone;
    c.lyrics = data.lyrics;
    c.external_link = data.externalLink || '';
    c.note = data.note || '';
    c.keyboard_bank = data.keyboard_bank;
    c.keyboard_slot = data.keyboard_slot;
    c.capo = data.capo;
    saveToCache();
    notify();
  }
  const payload = cleanFirestoreDoc({
    name: data.name,
    artist: data.artist,
    tone: data.tone,
    lyrics: data.lyrics,
    external_link: data.externalLink || '',
    note: data.note || '',
    keyboard_bank: data.keyboard_bank ?? null,
    keyboard_slot: data.keyboard_slot ?? null,
    capo: data.capo ?? null,
    _secret: 'sappinessvocationswingingtreachery8targetnative2026$'
  });
  updateDoc(doc(db, 'chords', id), payload);
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

  deleteDoc(doc(db, 'chords', id)).catch(err => {
    console.warn('Firestore deleteChord warn:', err);
  });
  linksToDelete.forEach(l => {
    deleteDoc(doc(db, 'playlist_chords', `${l.playlist_id}_${l.chord_id}`)).catch(err => {
      console.warn('Firestore delete link warn:', err);
    });
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

  deleteDoc(doc(db, 'playlist_chords', `${playlistId}_${chordId}`));
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
