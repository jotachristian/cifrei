import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, FlatList,
  TouchableOpacity, StyleSheet, Pressable, useWindowDimensions, Image,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { getPlaylists, searchChords, getTotalCount, Playlist, ChordWithPlaylist } from '@/lib/database';

function VinylIcon({ size = 64 }: { size?: number }) {
  const s = size;
  const ring = (d: number, opacity: number) => ({
    width: d, height: d, borderRadius: d / 2,
    borderWidth: s * 0.025, borderColor: `rgba(255,255,255,${opacity})`,
    position: 'absolute' as const,
  });
  return (
    <View style={{ width: s, height: s, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: s, height: s, borderRadius: s / 2, backgroundColor: 'rgba(255,255,255,0.12)', position: 'absolute' }} />
      <View style={ring(s * 0.82, 0.18)} />
      <View style={ring(s * 0.64, 0.15)} />
      <View style={ring(s * 0.46, 0.13)} />
      <View style={{ width: s * 0.28, height: s * 0.28, borderRadius: s * 0.14, backgroundColor: 'rgba(255,255,255,0.22)', position: 'absolute' }} />
      <View style={{ width: s * 0.08, height: s * 0.08, borderRadius: s * 0.04, backgroundColor: '#0b2e35' }} />
    </View>
  );
}

export default function HomeScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const numCols = width >= 600 ? 3 : 2;
  const PADDING = 20;
  const GAP = 16;
  const itemWidth = (width - PADDING * 2 - GAP * (numCols - 1)) / numCols;

  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [results, setResults] = useState<ChordWithPlaylist[]>([]);
  const [query, setQuery] = useState('');
  const [totalCount, setTotalCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      setPlaylists(getPlaylists());
      setTotalCount(getTotalCount());
    }, [])
  );

  function handleSearch(text: string) {
    setQuery(text);
    setResults(text.trim().length >= 2 ? searchChords(text) : []);
  }

  const sty = makeStyles(colors);

  return (
    <SafeAreaView style={sty.container}>
      <View style={sty.header}>
        <Image source={require('@/assets/name.png')} style={sty.logo} resizeMode="contain" />
        <Pressable onPress={() => router.push('/admin')} style={sty.iconBtn}>
          <Ionicons name="settings-outline" size={22} color={colors.headerText} />
        </Pressable>
      </View>

      <View style={sty.searchRow}>
        <Ionicons name="search-outline" size={18} color={colors.placeholder} style={{ marginRight: 8 }} />
        <TextInput
          style={sty.searchInput}
          placeholder="Buscar cifra ou artista..."
          placeholderTextColor={colors.placeholder}
          value={query}
          onChangeText={handleSearch}
          clearButtonMode="while-editing"
        />
        {query.length > 0 && (
          <Pressable onPress={() => { setQuery(''); setResults([]); }}>
            <Ionicons name="close-circle" size={18} color={colors.placeholder} />
          </Pressable>
        )}
      </View>

      {query.length >= 2 ? (
        <FlatList
          key="search"
          data={results}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: 14 }}
          ListEmptyComponent={
            <View style={sty.emptyWrap}>
              <Ionicons name="search-outline" size={48} color={colors.border} />
              <Text style={sty.emptyText}>Nenhuma cifra encontrada.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={sty.songCard}
              onPress={() => router.push({ pathname: '/chord/[id]', params: { id: item.id, playlistId: item.playlist_id } })}
              activeOpacity={0.7}
            >
              <View style={{ flex: 1 }}>
                <Text style={sty.songName} numberOfLines={1}>{item.name}</Text>
                <Text style={sty.songSub} numberOfLines={1}>
                  {item.artist}{item.playlist_name ? ` - ${item.playlist_name}` : ''}
                </Text>
              </View>
              <Text style={[sty.songTone, { color: colors.accent }]}>{item.tone}</Text>
            </TouchableOpacity>
          )}
        />
      ) : (
        <FlatList
          key="playlists"
          data={playlists}
          keyExtractor={item => item.id}
          numColumns={2}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 32 }}
          columnWrapperStyle={{ gap: 16, marginBottom: 20 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[sty.playlistItem, { width: itemWidth }]}
              onPress={() => router.push({ pathname: '/playlist/[id]', params: { id: item.id } })}
              activeOpacity={0.75}
            >
              <View style={sty.playlistCard}>
                <VinylIcon size={itemWidth * 0.55} />
              </View>
              <Text style={sty.playlistName} numberOfLines={1}>{item.name}</Text>
              {item.description ? (
                <Text style={sty.playlistDesc} numberOfLines={2}>{item.description}</Text>
              ) : null}
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

function makeStyles(c: any) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      backgroundColor: c.header, paddingHorizontal: 16, paddingVertical: 14,
    },
    logo: { width: 60, height: 60 },
    iconBtn: { padding: 0 },
    searchRow: {
      flexDirection: 'row', alignItems: 'center', margin: 15,
      paddingHorizontal: 12, paddingVertical: 8,
      backgroundColor: c.input, borderRadius: 12, borderWidth: 1, borderColor: c.border,
    },
    searchInput: { flex: 1, fontSize: 15, color: c.text },
    playlistItem: {
      gap: 8,
    },
    playlistCard: {
      backgroundColor: '#0b2e35', borderRadius: 12,
      aspectRatio: 1,
      alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden',
      shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.18, shadowRadius: 6, elevation: 4,
    },

    playlistName: { fontSize: 13, fontWeight: '600', color: c.text, textAlign: 'center' },
    playlistDesc: { fontSize: 11, color: c.textSub, textAlign: 'center' },
    songCard: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: c.card, borderRadius: 10, padding: 14,
      marginBottom: 8, borderWidth: 1, borderColor: c.border,
    },
    songName: { fontSize: 15, fontWeight: '600', color: c.text },
    songSub: { fontSize: 12, color: c.textSub, marginTop: 2 },
    songTone: { fontSize: 14, fontWeight: '700', marginLeft: 8 },
    emptyWrap: { padding: 48, alignItems: 'center', gap: 12 },
    emptyText: { color: c.text, fontSize: 14, textAlign: 'center', lineHeight: 22 },
    footer: { paddingVertical: 10, alignItems: 'center', borderTopWidth: 1, borderColor: c.border },
    footerText: { fontSize: 12, color: c.text },
  });
}
