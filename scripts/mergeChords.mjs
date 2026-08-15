import fs from 'fs';
import path from 'path';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDocs, collection } from 'firebase/firestore';

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

function getBlocks(text) {
  return text.replace(/\r/g, '').split(/\n\s*\n/).map(b => b.trim()).filter(b => b);
}

async function run() {
  console.log('🔍 Buscando cifras no Firebase...');
  const snap = await getDocs(collection(db, 'chords'));
  
  let mergedCount = 0;
  
  for (const document of snap.docs) {
    const c = document.data();
    
    // Só mescla se a nota tiver conteudo de verdade e a cifra também
    if (!c.lyrics || !c.note || c.note.trim().length < 5) continue;
    
    // Ignorar se a nota for apenas um link do youtube ou algo curto
    if (c.note.includes('youtube.com') && c.note.length < 50) continue;

    console.log(`\n🔄 Mesclando: ${c.name}`);
    const cBlocks = getBlocks(c.lyrics);
    const nBlocks = getBlocks(c.note);
    
    let mergedBlocks = [];
    const max = Math.max(cBlocks.length, nBlocks.length);
    
    for(let i=0; i<max; i++) {
      const cb = cBlocks[i] || '';
      const nb = nBlocks[i] || '';
      
      const cbLines = cb.split('\n');
      const nbLines = nb.split('\n');
      
      let header = '';
      let cData = cbLines;
      let nData = nbLines;
      
      const isHeader = (line) => line.trim().startsWith('[') && line.trim().endsWith(']');
      
      if (cbLines.length > 0 && isHeader(cbLines[0])) { header = cbLines[0]; cData = cbLines.slice(1); }
      else if (nbLines.length > 0 && isHeader(nbLines[0])) { header = nbLines[0]; nData = nbLines.slice(1); }
      
      if (nbLines.length > 0 && isHeader(nbLines[0]) && cbLines.length > 0 && isHeader(cbLines[0])) {
         // Ambos tem header, usa o da cifra
         nData = nbLines.slice(1);
      }
      
      let blockOut = header ? [header] : [];
      
      const linesMax = Math.max(cData.length, nData.length);
      for(let j=0; j<linesMax; j++) {
        if (cData[j] !== undefined && cData[j].trim() !== '') blockOut.push(cData[j]);
        if (nData[j] !== undefined && nData[j].trim() !== '') blockOut.push(nData[j]);
      }
      mergedBlocks.push(blockOut.join('\n'));
    }
    
    const newLyrics = mergedBlocks.join('\n\n');
    
    // Salvar no Firebase
    await setDoc(doc(db, 'chords', c.id), {
      ...c,
      lyrics: newLyrics,
      note: '', // Limpa o campo note
      _secret: 'sappinessvocationswingingtreachery8targetnative2026$'
    }, { merge: true });
    
    mergedCount++;
    console.log(`✅ ${c.name} atualizada!`);
  }
  
  console.log(`\n🎉 Operação concluída! ${mergedCount} cifras foram mescladas com sucesso.`);
  process.exit(0);
}

run().catch(console.error);
