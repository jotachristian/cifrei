import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc } from 'firebase/firestore';

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

const ACRONYMS = new Set(['CNBB', 'II', 'III', 'IV', 'VI', 'VII', 'VIII', 'IX', 'DJ', 'MC']);
const CONNECTORS = new Set(['e', 'de', 'do', 'da', 'dos', 'das', 'em', 'com', 'ao', 'aos']);

export function formatArtistName(name) {
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

export function normalizeKey(str) {
  if (!str) return '';
  return str
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

async function runClean(dryRun = false) {
  console.log(`=== EXECUTANDO LIMPEZA DE DUPLICATAS (dryRun: ${dryRun}) ===`);
  const cSnap = await getDocs(collection(db, 'chords'));
  const lSnap = await getDocs(collection(db, 'playlist_chords'));
  
  const allChords = cSnap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(c => !c.is_deleted && !c.deleted);

  const allLinks = lSnap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(l => !l.is_deleted && !l.deleted);

  console.log(`Total de cifras ativas: ${allChords.length}`);
  console.log(`Total de links em playlists: ${allLinks.length}`);

  // 1. Agrupar por nome normalizado + artista normalizado
  const grouped = new Map();
  for (const c of allChords) {
    const normName = normalizeKey(c.name);
    const normArtist = normalizeKey(c.artist);
    const key = `${normName}:::${normArtist}`;
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key).push(c);
  }

  let dupRemoved = 0;
  let linksUpdated = 0;
  let artistUpdated = 0;

  for (const [k, list] of grouped.entries()) {
    list.sort((a, b) => {
      const aScore = (a.cover_url ? 100 : 0) + (a.lyrics ? a.lyrics.length : 0) + (a.note ? 20 : 0);
      const bScore = (b.cover_url ? 100 : 0) + (b.lyrics ? b.lyrics.length : 0) + (b.note ? 20 : 0);
      return bScore - aScore;
    });

    const canonical = list[0];
    const canonicalArtist = formatArtistName(canonical.artist);

    // Se o artista precisa ser padronizado para Title Case
    if (canonical.artist !== canonicalArtist) {
      if (!dryRun) {
        await updateDoc(doc(db, 'chords', canonical.id), {
          artist: canonicalArtist,
          _secret: SECRET
        });
      }
      artistUpdated++;
    }

    // Se houver duplicatas
    if (list.length > 1) {
      const duplicates = list.slice(1);
      console.log(`\nMesclando ${duplicates.length} duplicatas para "${canonical.name}" - ${canonicalArtist} (ID Principal: ${canonical.id})`);

      for (const dup of duplicates) {
        // Redireciona links de playlist que apontavam para a duplicata
        const dupLinks = allLinks.filter(l => l.chord_id === dup.id);
        for (const l of dupLinks) {
          const alreadyLinked = allLinks.some(
            existingLink => existingLink.playlist_id === l.playlist_id && existingLink.chord_id === canonical.id
          );

          if (!alreadyLinked) {
            console.log(`  -> Redirecionando link da playlist ${l.playlist_id} para a cifra principal ${canonical.id}`);
            if (!dryRun) {
              await updateDoc(doc(db, 'playlist_chords', l.id), {
                chord_id: canonical.id,
                _secret: SECRET
              });
            }
            linksUpdated++;
          } else {
            console.log(`  -> Removendo link redundante da playlist ${l.playlist_id}`);
            if (!dryRun) {
              await updateDoc(doc(db, 'playlist_chords', l.id), {
                is_deleted: true,
                deleted: true,
                _secret: SECRET
              });
            }
          }
        }

        // Marca a cifra duplicada como deletada no Firestore
        console.log(`  -> Marcando cifra duplicada como deletada ID: ${dup.id}`);
        if (!dryRun) {
          await updateDoc(doc(db, 'chords', dup.id), {
            is_deleted: true,
            deleted: true,
            _secret: SECRET
          });
        }
        dupRemoved++;
      }
    }
  }

  // Também padroniza nome do artista em todas as outras cifras não-duplicadas
  for (const c of allChords) {
    const formatted = formatArtistName(c.artist);
    if (c.artist && c.artist !== formatted) {
      console.log(`Padronizando artista: "${c.artist}" -> "${formatted}" (Música: "${c.name}")`);
      if (!dryRun) {
        await updateDoc(doc(db, 'chords', c.id), {
          artist: formatted,
          _secret: SECRET
        });
      }
      artistUpdated++;
    }
  }

  console.log('\n=== RESULTADO ===');
  console.log(`Duplicatas removidas/mescladas: ${dupRemoved}`);
  console.log(`Links em playlists ajustados: ${linksUpdated}`);
  console.log(`Artistas padronizados para Title Case: ${artistUpdated}`);
}

const isDryRun = process.argv.includes('--dry');
runClean(isDryRun).then(() => process.exit(0)).catch(console.error);
