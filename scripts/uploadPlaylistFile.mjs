import fs from 'fs';
import path from 'path';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, deleteDoc, getDocs, collection } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDykQHFceqftXorEbuIXcUutjh5z0H_4Zc",
  authDomain: "cifras-music.firebaseapp.com",
  projectId: "cifras-music",
  storageBucket: "cifras-music.firebasestorage.app",
  messagingSenderId: "225499251144",
  appId: "1:225499251144:web:24fb80afb97ce6fe5980fd"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const SECRET = 'sappinessvocationswingingtreachery8targetnative2026$';

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

const META_KEYS = {
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

const isSeparator = (line) => /^\s*[-–—_*=]{3,}\s*$/.test(line);

function parsePlaylistMd(input) {
  const text = input.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const lines = text.split('\n');

  const playlist = { name: '', description: '', songs: [] };
  let current = null;
  let lyricBuf = [];
  let mode = 'header';

  const flushSong = () => {
    if (!current) return;
    const lyrics = lyricBuf.join('\n').replace(/^\n+|\n+$/g, '');
    playlist.songs.push({ ...current, lyrics });
    current = null;
    lyricBuf = [];
  };

  for (const raw of lines) {
    const line = raw;
    if (isSeparator(line)) continue;

    const songMatch = line.match(/^##\s+(.+?)\s*$/);
    if (songMatch) {
      flushSong();
      current = { name: songMatch[1], artist: '', tone: 'C', link: '', moment: '', lyrics: '' };
      mode = 'meta';
      continue;
    }

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
      const t = line.trim();
      if (t === '') continue;
      if (!playlist.name) { playlist.name = t; continue; }
      if (!playlist.description) { playlist.description = t; continue; }
      continue;
    }

    if (mode === 'meta') {
      if (line.trim() === '') continue;
      const metaMatch = line.match(/^([A-Za-zÀ-ÿ]+)\s*:\s*(.*)$/);
      if (metaMatch) {
        const key = metaMatch[1].toLowerCase();
        const val = metaMatch[2].trim();
        const field = META_KEYS[key];
        if (field === 'name') {
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
      }
      mode = 'lyrics';
      lyricBuf.push(line);
      continue;
    }

    lyricBuf.push(line);
  }
  flushSong();

  return playlist;
}

async function uploadPlaylistFile(filePath) {
  const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
  if (!fs.existsSync(absolutePath)) {
    console.error(`❌ Arquivo não encontrado: ${absolutePath}`);
    process.exit(1);
  }

  const text = fs.readFileSync(absolutePath, 'utf8');
  const parsed = parsePlaylistMd(text);

  if (!parsed.name) {
    console.error('❌ Não foi encontrado o nome da playlist (deve começar com "# Nome").');
    process.exit(1);
  }

  if (parsed.songs.length === 0) {
    console.error('❌ Nenhuma música encontrada no arquivo (cada música deve começar com "## ").');
    process.exit(1);
  }

  console.log(`🚀 Criando playlist: "${parsed.name}" (${parsed.songs.length} músicas)...`);

  // Procurar por playlist com o mesmo nome para deletar/sobrescrever, e achar o maior sort_order
  const existingPlaylistsSnap = await getDocs(collection(db, 'playlists'));
  let playlistId = null;
  let maxSortOrder = 0;
  existingPlaylistsSnap.forEach(docSnap => {
    const data = docSnap.data();
    if (data.name === parsed.name) {
      playlistId = data.id;
    }
    if (typeof data.sort_order === 'number' && data.sort_order > maxSortOrder) {
      maxSortOrder = data.sort_order;
    }
  });

  if (playlistId) {
    console.log(`🗑️ Encontrada playlist existente "${parsed.name}" com ID ${playlistId}. Removendo para recriar...`);
    await deleteDoc(doc(db, 'playlists', playlistId));
    
    // Deletar os links associados em playlist_chords
    const linksSnap = await getDocs(collection(db, 'playlist_chords'));
    let linkCount = 0;
    for (const linkDoc of linksSnap.docs) {
      const linkData = linkDoc.data();
      if (linkData.playlist_id === playlistId) {
        await deleteDoc(doc(db, 'playlist_chords', linkDoc.id));
        linkCount++;
      }
    }
    console.log(`✅ Playlist antiga e seus ${linkCount} vínculos foram removidos.`);
  } else {
    playlistId = genId();
  }

  // Obter todas as cifras existentes para evitar duplicações
  const existingChordsSnap = await getDocs(collection(db, 'chords'));
  const chordsByNameAndArtist = new Map();
  existingChordsSnap.forEach(docSnap => {
    const data = docSnap.data();
    const key = `${data.name.trim().toLowerCase()} - ${(data.artist || '').trim().toLowerCase()}`;
    chordsByNameAndArtist.set(key, data.id);
  });

  const playlistDoc = {
    id: playlistId,
    name: parsed.name,
    description: parsed.description || '',
    sort_order: maxSortOrder + 1,
    created_at: Date.now(),
    _secret: SECRET
  };

  await setDoc(doc(db, 'playlists', playlistId), playlistDoc);
  console.log(`✅ Playlist salva com ID: ${playlistId}`);

  for (let idx = 0; idx < parsed.songs.length; idx++) {
    const song = parsed.songs[idx];
    const key = `${song.name.trim().toLowerCase()} - ${(song.artist || '').trim().toLowerCase()}`;
    let chordId = chordsByNameAndArtist.get(key);
    const isNewChord = !chordId;

    if (isNewChord) {
      chordId = genId();
      chordsByNameAndArtist.set(key, chordId);
    }

    const chordDoc = {
      id: chordId,
      name: song.name,
      artist: song.artist || '',
      tone: song.tone || 'C',
      lyrics: song.lyrics || '',
      external_link: song.link || '',
      note: '',
      tone_offset: 0,
      created_at: Date.now(),
      _secret: SECRET
    };

    await setDoc(doc(db, 'chords', chordId), chordDoc);

    const linkDoc = {
      playlist_id: playlistId,
      chord_id: chordId,
      sort_order: song.sortOrder !== undefined ? song.sortOrder : idx + 1,
      moment: song.moment || '',
      created_at: Date.now(),
      _secret: SECRET
    };

    await setDoc(doc(db, 'playlist_chords', `${playlistId}_${chordId}`), linkDoc);

    console.log(`   🎵 [${idx + 1}/${parsed.songs.length}] ${isNewChord ? '[Nova] ' : '[Reutilizada] '}${song.moment ? `[${song.moment}] ` : ''}${song.name} - ${song.artist}`);
  }

  console.log(`\n🎉 Upload da playlist "${parsed.name}" finalizado com sucesso!`);
  process.exit(0);
}

const fileArg = process.argv[2] || 'examples/Festa-da-padroeira-2026.md';
uploadPlaylistFile(fileArg).catch(err => {
  console.error('❌ Erro durante o upload:', err);
  process.exit(1);
});
