import fs from 'fs';
import path from 'path';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

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

const FOLDER = path.join(process.cwd(), 'cifras_pc');

if (!fs.existsSync(FOLDER)) {
  fs.mkdirSync(FOLDER);
  console.log('Pasta "cifras_pc" criada na raiz do projeto. Coloque seus arquivos .md lá e rode este script novamente.');
  process.exit(0);
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

async function uploadFiles() {
  const files = fs.readdirSync(FOLDER).filter(f => f.endsWith('.md') || f.endsWith('.txt'));

  if (files.length === 0) {
    console.log('Nenhum arquivo .md encontrado na pasta cifras_pc.');
    process.exit(0);
  }

  for (const file of files) {
    const text = fs.readFileSync(path.join(FOLDER, file), 'utf-8');
    const lines = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n').split('\n');

    let currentSong = null;
    let lyricBuf = [];
    let mode = 'header';

    const uploadCurrentSong = async () => {
      if (!currentSong) return;
      const lyrics = lyricBuf.join('\n').trim();
      const id = genId();
      const data = {
        id,
        name: currentSong.name,
        artist: currentSong.artist || '',
        tone: currentSong.tone || 'C',
        lyrics: lyrics,
        external_link: currentSong.link || '',
        note: '',
        tone_offset: 0,
        created_at: Date.now(),
        _secret: 'CifreiSeguro2026'
      };

      console.log(`Fazendo upload da cifra: ${data.name}`);
      await setDoc(doc(db, 'chords', id), data);
    };

    for (const raw of lines) {
      if (/^\s*[-–—_*=]{3,}\s*$/.test(raw)) continue;

      const songMatch = raw.match(/^##\s+(.+?)\s*$/);
      if (songMatch) {
        await uploadCurrentSong();
        currentSong = { name: songMatch[1], artist: '', tone: 'C', link: '' };
        lyricBuf = [];
        mode = 'meta';
        continue;
      }

      if (mode === 'meta' && currentSong) {
        if (raw.trim() === '') continue;
        const metaMatch = raw.match(/^([A-Za-zÀ-ÿ]+)\s*:\s*(.*)$/);
        if (metaMatch) {
          const key = metaMatch[1].toLowerCase();
          const val = metaMatch[2].trim();
          if (['artista', 'artist'].includes(key)) currentSong.artist = val;
          else if (['tom', 'tone'].includes(key)) currentSong.tone = val;
          else if (['link', 'url'].includes(key)) currentSong.link = val;
          continue;
        }
        mode = 'lyrics';
        lyricBuf.push(raw);
        continue;
      }

      if (mode === 'lyrics') {
        lyricBuf.push(raw);
      }
    }

    await uploadCurrentSong();
    console.log(`Arquivo ${file} processado.`);
  }

  console.log('Upload finalizado com sucesso!');
  process.exit(0);
}

uploadFiles().catch(console.error);
