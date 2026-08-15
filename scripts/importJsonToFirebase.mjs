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

const jsonPath = path.join(process.cwd(), 'backup.json');

if (!fs.existsSync(jsonPath)) {
  console.log('⚠️ Arquivo "backup.json" não encontrado na raiz do projeto.');
  console.log('👉 Pegue o seu arquivo antigo .json, renomeie para "backup.json", coloque na pasta raiz (junto com o package.json) e rode este script novamente.');
  process.exit(0);
}

async function uploadJson() {
  const raw = fs.readFileSync(jsonPath, 'utf8');
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    console.log('Erro ao ler o JSON. Verifique se o arquivo está corrompido.');
    process.exit(1);
  }

  if (!data.chords || !data.playlists) {
    console.log('Formato de backup inválido. Não foram encontradas as listas de "chords" e "playlists".');
    process.exit(1);
  }

  console.log(`🚀 Iniciando importação de ${data.chords.length} cifras e ${data.playlists.length} playlists...`);

  // Enviar Cifras
  for (const c of data.chords) {
    // Adiciona created_at se nao tiver
    if (!c.created_at) c.created_at = Date.now();
    c._secret = 'sappinessvocationswingingtreachery8targetnative2026$';
    await setDoc(doc(db, 'chords', c.id), c);
    console.log(`✅ Cifra restaurada: ${c.name}`);
  }

  // Enviar Playlists
  for (const p of data.playlists) {
    if (!p.created_at) p.created_at = Date.now();
    p._secret = 'sappinessvocationswingingtreachery8targetnative2026$';
    await setDoc(doc(db, 'playlists', p.id), p);
    console.log(`📁 Playlist restaurada: ${p.name}`);
  }

  // Enviar Vínculos (playlist_chords)
  if (data.playlist_chords && data.playlist_chords.length > 0) {
    for (const l of data.playlist_chords) {
      if (!l.created_at) l.created_at = Date.now();
      l._secret = 'sappinessvocationswingingtreachery8targetnative2026$';
      await setDoc(doc(db, 'playlist_chords', `${l.playlist_id}_${l.chord_id}`), l);
    }
    console.log(`🔗 Vínculos restaurados: ${data.playlist_chords.length}`);
  } else {
    // Fallback para Backups versão 1 (onde as playlists vinham grudadas no chord)
    let legacyLinks = 0;
    for (const c of data.chords) {
      if (c.playlist_id) {
        const l = {
          playlist_id: c.playlist_id,
          chord_id: c.id,
          sort_order: c.sort_order || 0,
          moment: '',
          created_at: Date.now(),
          _secret: 'sappinessvocationswingingtreachery8targetnative2026$'
        };
        await setDoc(doc(db, 'playlist_chords', `${l.playlist_id}_${l.chord_id}`), l);
        legacyLinks++;
      }
    }
    if (legacyLinks > 0) console.log(`🔗 Vínculos legacy restaurados: ${legacyLinks}`);
  }

  console.log('🎉 Upload do JSON finalizado com sucesso! Pode abrir o aplicativo.');
  process.exit(0);
}

uploadJson().catch(console.error);
