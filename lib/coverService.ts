import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { extractYoutubeId, getYoutubeThumbnailUrl, searchYoutubeCover } from './youtube';

const COVERS_DIR = `${FileSystem.documentDirectory || ''}covers/`;

// Garante que o diretório de capas existe localmente
async function ensureCoversDirExists(): Promise<void> {
  if (Platform.OS === 'web' || !FileSystem.documentDirectory) return;
  try {
    const dirInfo = await FileSystem.getInfoAsync(COVERS_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(COVERS_DIR, { intermediates: true });
    }
  } catch (err) {
    console.warn('Não foi possível verificar/criar diretório de capas:', err);
  }
}

/**
 * Busca a capa via YouTube / YouTube Music a partir do nome da música e artista.
 * Permite passar resultIndex para alternar entre resultados ao clicar em "Buscar Outra Capa".
 */
export async function searchAlbumCover(
  trackName: string,
  artistName: string = '',
  resultIndex: number = 0
): Promise<string | null> {
  const cleanTrack = trackName.trim();
  const cleanArtist = artistName.trim();
  if (!cleanTrack) return null;

  try {
    const query = cleanArtist ? `${cleanTrack} ${cleanArtist}` : cleanTrack;
    const result = await searchYoutubeCover(query, resultIndex);
    return result ? result.coverUrl : null;
  } catch (err) {
    console.warn('Erro ao buscar capa no YouTube:', err);
    return null;
  }
}

/**
 * Retorna a URL da thumbnail do YouTube / YouTube Music caso exista um link ou ID válido.
 */
export function getYoutubeCoverUrl(urlOrId: string): string | null {
  return getYoutubeThumbnailUrl(urlOrId);
}

/**
 * Retorna a URI local de uma capa salva se existir no disco.
 */
export async function getLocalCoverUri(chordId: string): Promise<string | null> {
  if (Platform.OS === 'web' || !FileSystem.documentDirectory) return null;
  try {
    const filePath = `${COVERS_DIR}${chordId}.jpg`;
    const info = await FileSystem.getInfoAsync(filePath);
    if (info.exists) {
      return filePath;
    }
  } catch (err) {
    // Silencioso
  }
  return null;
}

/**
 * Faz download de uma capa remota para o sistema de arquivos local do celular (100% offline-ready).
 */
export async function cacheCoverImage(chordId: string, remoteUrl: string): Promise<string | null> {
  if (!remoteUrl || Platform.OS === 'web' || !FileSystem.documentDirectory) {
    return remoteUrl || null;
  }

  try {
    await ensureCoversDirExists();
    const filePath = `${COVERS_DIR}${chordId}.jpg`;
    const downloadRes = await FileSystem.downloadAsync(remoteUrl, filePath);
    if (downloadRes.status === 200) {
      return filePath;
    }
  } catch (err) {
    console.warn('Erro ao salvar capa localmente:', err);
  }

  return remoteUrl;
}

/**
 * Deleta a capa local associada a uma cifra quando esta for removida.
 */
export async function deleteLocalCover(chordId: string): Promise<void> {
  if (Platform.OS === 'web' || !FileSystem.documentDirectory) return;
  try {
    const filePath = `${COVERS_DIR}${chordId}.jpg`;
    const info = await FileSystem.getInfoAsync(filePath);
    if (info.exists) {
      await FileSystem.deleteAsync(filePath, { idempotent: true });
    }
  } catch (err) {
    // Silencioso
  }
}
