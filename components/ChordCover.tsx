import React, { useState, useEffect } from 'react';
import { View, Image, StyleProp, ViewStyle, Platform } from 'react-native';
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
  // Troca hqdefault ou sddefault (que possuem barras pretas em 4:3) por hq720 (16:9 sem barras pretas)
  return url
    .replace(/\/hqdefault\.jpg/gi, '/hq720.jpg')
    .replace(/\/sddefault\.jpg/gi, '/hq720.jpg')
    .replace(/\/hqdefault\.webp/gi, '/hq720.jpg');
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
      // No Web, caminhos locais mobile (file:///) não existem no navegador. Usa coverUrl diretamente.
      if (Platform.OS === 'web') {
        if (coverUrl && isMounted) {
          setImgUri(cleanThumbnailUrl(coverUrl));
        } else if (isMounted) {
          setImgUri(null);
        }
        return;
      }

      // No Mobile:
      if (coverLocalUri && !coverLocalUri.startsWith('http')) {
        if (isMounted) setImgUri(coverLocalUri);
        return;
      }

      if (chordId) {
        const local = await getLocalCoverUri(chordId);
        if (local && isMounted) {
          setImgUri(local);
          return;
        }
      }

      if (coverUrl && isMounted) {
        setImgUri(cleanThumbnailUrl(coverUrl));
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
    // Fallback gracioso caso hq720 não exista (vídeos muito antigos) ou localUri falhe
    if (imgUri && imgUri.includes('/hq720.jpg')) {
      // mqdefault também é 16:9 sem barras pretas e sempre existe
      setImgUri(imgUri.replace('/hq720.jpg', '/mqdefault.jpg'));
    } else if (imgUri && coverUrl && imgUri !== coverUrl) {
      setImgUri(cleanThumbnailUrl(coverUrl));
    } else {
      setHasError(true);
    }
  };

  if (imgUri && !hasError) {
    return (
      <View style={[{ width: size, height: size, borderRadius, overflow: 'hidden', backgroundColor: '#1e293b' }, style]}>
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
