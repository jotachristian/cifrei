import React, { useState, useEffect } from 'react';
import { View, Image, StyleProp, ViewStyle, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { getLocalCoverUri } from '@/lib/coverService';

interface ChordCoverProps {
  chordId?: string;
  coverUrl?: string | null;
  coverLocalUri?: string | null;
  size?: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
  fallback?: React.ReactNode;
}

function cleanThumbnailUrl(url: string): string {
  if (!url) return '';
  // Converte thumbnails antigas em 4:3 (com barras pretas) para 16:9 widescreen sem barras pretas
  return url
    .replace(/\/hqdefault\.jpg/gi, '/mqdefault.jpg')
    .replace(/\/sddefault\.jpg/gi, '/mqdefault.jpg')
    .replace(/\/hqdefault\.webp/gi, '/mqdefault.jpg');
}

export const ChordCover: React.FC<ChordCoverProps> = ({
  chordId,
  coverUrl,
  coverLocalUri,
  size = 50,
  borderRadius = 12,
  style,
  fallback = null,
}) => {
  const [imgUri, setImgUri] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setHasError(false);

    async function resolveUri() {
      // 1. Se tiver coverUrl remota válida (http/https), usa diretamente tanto na Web quanto no Mobile.
      // No React Native (iOS e Android), o componente Image faz o cache em disco automaticamente de URLs https.
      if (coverUrl && typeof coverUrl === 'string' && coverUrl.trim().startsWith('http')) {
        if (isMounted) {
          setImgUri(cleanThumbnailUrl(coverUrl.trim()));
        }
        return;
      }

      // 2. Se não houver coverUrl remota, tenta a capa local salva no aparelho (Mobile)
      if (Platform.OS !== 'web') {
        if (coverLocalUri && !coverLocalUri.startsWith('http')) {
          try {
            const info = await FileSystem.getInfoAsync(coverLocalUri);
            if (info.exists && info.size > 0 && isMounted) {
              setImgUri(coverLocalUri);
              return;
            }
          } catch {
            // Arquivo local não existe ou erro de leitura
          }
        }

        if (chordId) {
          const local = await getLocalCoverUri(chordId);
          if (local && isMounted) {
            try {
              const info = await FileSystem.getInfoAsync(local);
              if (info.exists && info.size > 0) {
                setImgUri(local);
                return;
              }
            } catch {
              // Silencioso
            }
          }
        }
      }

      // 3. Se coverUrl não começar com http mas existir, tenta usá-la
      if (coverUrl && typeof coverUrl === 'string' && coverUrl.trim().length > 0 && isMounted) {
        setImgUri(cleanThumbnailUrl(coverUrl.trim()));
        return;
      }

      if (isMounted) {
        setImgUri(null);
      }
    }

    resolveUri();

    return () => {
      isMounted = false;
    };
  }, [chordId, coverUrl, coverLocalUri]);

  const handleError = () => {
    // Sequência de fallback robusta caso a imagem falhe (ex: hq720 não existe para vídeos sem HD)
    if (imgUri && imgUri.includes('/hq720.jpg')) {
      setImgUri(imgUri.replace('/hq720.jpg', '/mqdefault.jpg'));
    } else if (imgUri && imgUri.includes('/mqdefault.jpg')) {
      setImgUri(imgUri.replace('/mqdefault.jpg', '/hqdefault.jpg'));
    } else if (imgUri && coverUrl && imgUri !== coverUrl) {
      setImgUri(cleanThumbnailUrl(coverUrl));
    } else {
      setHasError(true);
    }
  };

  if (imgUri && !hasError) {
    return (
      <View style={[{ width: size, height: size, borderRadius, overflow: 'hidden', backgroundColor: 'transparent' }, style]}>
        <Image
          source={{ uri: imgUri }}
          style={{ width: size, height: size }}
          resizeMode="cover"
          onError={handleError}
        />
      </View>
    );
  }

  return <>{fallback}</>;
};
