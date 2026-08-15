import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, updateDoc, doc } from 'firebase/firestore';

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

async function run() {
  console.log('Adicionando secret em playlists...');
  const pSnap = await getDocs(collection(db, 'playlists'));
  for (const d of pSnap.docs) {
    await updateDoc(doc(db, 'playlists', d.id), { _secret: SECRET });
  }

  console.log('Adicionando secret em chords...');
  const cSnap = await getDocs(collection(db, 'chords'));
  for (const d of cSnap.docs) {
    await updateDoc(doc(db, 'chords', d.id), { _secret: SECRET });
  }

  console.log('Adicionando secret em playlist_chords...');
  const lSnap = await getDocs(collection(db, 'playlist_chords'));
  for (const d of lSnap.docs) {
    await updateDoc(doc(db, 'playlist_chords', d.id), { _secret: SECRET });
  }

  console.log('Finalizado com sucesso!');
  process.exit(0);
}

run().catch(console.error);
