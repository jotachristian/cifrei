import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

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

async function check() {
  const snap = await getDocs(collection(db, 'chords'));
  console.log(`Found ${snap.size} chords.`);
  snap.docs.slice(0, 3).forEach(doc => {
    const data = doc.data();
    console.log(`\n--- Chord: ${data.name} ---`);
    console.log(`Lyrics field:\n${data.lyrics}`);
  });
  process.exit(0);
}

check().catch(console.error);
