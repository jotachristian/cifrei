import React, { useMemo } from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ChordCover } from './ChordCover';
import { ChordInPlaylist, getPlaylistChords } from '@/lib/database';

interface PlaylistCoverProps {
  playlistId: string;
  chords?: ChordInPlaylist[];
  size?: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
  fallback?: React.ReactNode;
}

const DEFAULT_QUADRANT_ICONS = [
  { icon: 'musical-notes', bg: '#202227' },
  { icon: 'disc', bg: '#282b31' },
  { icon: 'headset', bg: '#1c1e22' },
  { icon: 'radio', bg: '#24272d' },
] as const;

export const PlaylistCover: React.FC<PlaylistCoverProps> = ({
  playlistId,
  chords: passedChords,
  size = 48,
  borderRadius = 12,
  style,
  fallback,
}) => {
  const chords = useMemo(() => {
    return passedChords ?? getPlaylistChords(playlistId);
  }, [passedChords, playlistId]);

  const songsWithCovers = useMemo(() => {
    return chords.filter(c => Boolean(c.cover_url || c.cover_local_uri || c.external_link));
  }, [chords]);

  // Se não houver nenhuma música com capa salva
  if (songsWithCovers.length === 0) {
    if (fallback) {
      return <>{fallback}</>;
    }
    return (
      <View style={[{ width: size, height: size, borderRadius, overflow: 'hidden' }, style]}>
        <View style={styles.grid}>
          {DEFAULT_QUADRANT_ICONS.map((q, idx) => (
            <View key={idx} style={[styles.quadrant, { backgroundColor: q.bg }]}>
              <Ionicons name={q.icon as any} size={Math.round(size * 0.2)} color="#8e9297" />
            </View>
          ))}
        </View>
      </View>
    );
  }

  // Se houver entre 1 e 3 músicas/capas, exibe a primeira capa em destaque 100%
  const mainCover = songsWithCovers[0];
  return (
    <View style={[{ width: size, height: size, borderRadius, overflow: 'hidden' }, style]}>
      <ChordCover
        chordId={mainCover.id}
        coverUrl={mainCover.cover_url}
        coverLocalUri={mainCover.cover_local_uri}
        externalLink={mainCover.external_link}
        size={size}
        borderRadius={borderRadius}
        fallback={fallback}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  grid: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: '100%',
    height: '100%',
  },
  quadrant: {
    width: '50%',
    height: '50%',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  quadrantFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
