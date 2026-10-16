import React, { useState, useEffect } from 'react';
import { View, Image, StyleProp, ViewStyle, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { getLocalCoverUri } from '@/lib/coverService';
import { getYoutubeThumbnailUrl } from '@/lib/youtube';

interface ChordCoverProps {
  chordId?: string;
  coverUrl?: string | null;
  coverLocalUri?: string | null;
  externalLink?: string | null;
  size?: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
  fallback?: React.ReactNode;
}

function cleanThumbnailUrl(url: string): string {
  if (!url) return '';
  return url
    .replace(/\/hq720\.(jpg|webp)/gi, '/mqdefault.jpg')
    .replace(/\/maxresdefault\.(jpg|webp)/gi, '/mqdefault.jpg')
    .replace(/\/sddefault\.(jpg|webp)/gi, '/mqdefault.jpg')
    .replace(/\/hqdefault\.(jpg|webp)/gi, '/mqdefault.jpg');
}

export const ChordCover: React.FC<ChordCoverProps> = ({
  chordId,
  coverUrl,
  coverLocalUri,
  externalLink,
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
      // 1. Tenta derivar a URL remota de coverUrl ou de externalLink
      let candidateUrl = '';
      if (coverUrl && typeof coverUrl === 'string' && coverUrl.trim().length > 0) {
        candidateUrl = coverUrl.trim();
      } else if (externalLink && typeof externalLink === 'string' && externalLink.trim().length > 0) {
        candidateUrl = getYoutubeThumbnailUrl(externalLink.trim()) || '';
      }

      if (candidateUrl && candidateUrl.startsWith('http')) {
        if (isMounted) {
          setImgUri(cleanThumbnailUrl(candidateUrl));
        }
        return;
      }

      // 2. Se não houver URL remota válida, tenta a capa local salva no aparelho (Mobile)
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

      if (candidateUrl && isMounted) {
        setImgUri(cleanThumbnailUrl(candidateUrl));
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
  }, [chordId, coverUrl, coverLocalUri, externalLink]);

  const handleError = () => {
    if (imgUri && imgUri.includes('/mqdefault.jpg')) {
      setImgUri(imgUri.replace('/mqdefault.jpg', '/hqdefault.jpg'));
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
