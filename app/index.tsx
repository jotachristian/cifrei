import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, FlatList,
  TouchableOpacity, StyleSheet, Pressable, Image,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { getPlaylists, searchChords, getTotalCount, Playlist, ChordWithPlaylist } from '@/lib/database';

export default function HomeScreen() {
  const { colors } = useTheme();
  const router = useRouter();

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
        <View style={sty.brandRow}>
          {/* Ícone do app ocultado a pedido — manter só o nome como logo.
          <Image source={require('@/assets/logo-cinza.png')} style={sty.logo} resizeMode="contain" />
          */}
          <Text style={sty.brandText}>Cifrei</Text>
        </View>
        <Pressable onPress={() => router.push('/admin')} style={sty.iconBtn}>
          <Ionicons name="settings-outline" size={30} color="#ffffff" />
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
              onPress={() => router.push({ pathname: '/chord/[id]', params: { id: item.id } })}
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
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 32 }}
          ListEmptyComponent={
            <View style={sty.emptyWrap}>
              <Ionicons name="albums-outline" size={48} color={colors.border} />
              <Text style={sty.emptyText}>Nenhuma playlist ainda.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={sty.playlistRow}
              onPress={() => router.push({ pathname: '/playlist/[id]', params: { id: item.id } })}
              activeOpacity={0.7}
            >
              <View style={sty.playlistThumb}>
                <Ionicons name="musical-notes" size={22} color="#ffffff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={sty.playlistName} numberOfLines={1}>{item.name}</Text>
                {item.description ? (
                  <Text style={sty.playlistDesc} numberOfLines={2}>{item.description}</Text>
                ) : null}
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.placeholder} />
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
      backgroundColor: '#ff7700', paddingHorizontal: 16, paddingVertical: 14,
    },
    brandRow: { flexDirection: 'row', alignItems: 'center' },
    logo: { width: 60, height: 60 },
    brandText: {
      fontFamily: 'Comfortaa_700Bold',
      fontSize: 30,
      color: '#ffffff',
      letterSpacing: 0.5,
      marginLeft: 2,
    },
    iconBtn: { padding: 4 },
    searchRow: {
      flexDirection: 'row', alignItems: 'center', margin: 15,
      paddingHorizontal: 18, paddingVertical: 11,
      backgroundColor: c.input, borderRadius: 28, borderWidth: 1, borderColor: c.border,
    },
    searchInput: { flex: 1, fontSize: 15, color: c.text },
    playlistRow: {
      flexDirection: 'row', alignItems: 'center', gap: 14,
      backgroundColor: c.card, borderRadius: 14, padding: 12,
      marginBottom: 10, borderWidth: 1, borderColor: c.border,
    },
    playlistThumb: {
      width: 48, height: 48, borderRadius: 12,
      backgroundColor: '#ff7700',
      alignItems: 'center', justifyContent: 'center',
    },
    playlistName: { fontSize: 15, fontWeight: '600', color: c.text },
    playlistDesc: { fontSize: 12, color: c.textSub, marginTop: 2 },
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
