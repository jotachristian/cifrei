import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, FlatList,
  TouchableOpacity, StyleSheet, Pressable, Image,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { getAllChords, searchChords, Chord, ChordWithPlaylist, addDatabaseListener, createChord } from '@/lib/database';

export default function ChordsScreen() {
  const { colors } = useTheme();
  const router = useRouter();

  const [allChords, setAllChords] = useState<Chord[]>([]);
  const [results, setResults] = useState<ChordWithPlaylist[]>([]);
  const [query, setQuery] = useState('');

  useFocusEffect(
    useCallback(() => {
      const reload = () => {
        setAllChords(getAllChords().sort((a, b) => a.name.localeCompare(b.name)));
      };
      reload();
      const unsub = addDatabaseListener(reload);
      return unsub;
    }, [])
  );

  function handleSearch(text: string) {
    setQuery(text);
    setResults(text.trim().length >= 2 ? searchChords(text) : []);
  }

  const sty = makeStyles(colors);

  const displayList = query.length >= 2 ? results : allChords;

  function handleCreateChord() {
    const newId = createChord({ name: 'Nova Cifra', artist: '', tone: 'C', lyrics: '' });
    router.push({ pathname: '/chord/[id]', params: { id: newId } });
  }

  return (
    <SafeAreaView style={sty.container} edges={['top']}>
      <View style={sty.header}>
        <Text style={sty.headerTitle}>Acervo Geral</Text>
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

      <FlatList
        key="search"
        data={displayList}
        keyExtractor={item => item.id}
        contentContainerStyle={{ padding: 10 }}
        ListEmptyComponent={
          <View style={sty.emptyWrap}>
            <Image source={require('@/assets/song-none.png')} style={sty.emptyStateImage} resizeMode="contain" />
            <Text style={sty.emptyText}>Nenhuma cifra encontrada.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const isResult = 'playlist_name' in item;
          const plName = isResult ? (item as ChordWithPlaylist).playlist_name : '';
          return (
            <TouchableOpacity
              style={sty.songCard}
              onPress={() => router.push({ pathname: '/chord/[id]', params: { id: item.id } })}
              activeOpacity={0.7}
            >
              <Ionicons name="musical-notes" size={30} color={colors.accent} style={{ marginRight: 12 }} />
              <View style={{ flex: 1 }}>
                <Text style={sty.songName} numberOfLines={1}>{item.name}</Text>
                <Text style={sty.songSub} numberOfLines={1}>
                  {item.artist}{plName ? ` - ${plName}` : ''}
                </Text>
              </View>
              <Text style={[sty.songTone, { color: colors.accent }]}>{item.tone}</Text>
            </TouchableOpacity>
          );
        }}
      />

      <TouchableOpacity 
        style={sty.fab}
        activeOpacity={0.8}
        onPress={handleCreateChord}
      >
        <Ionicons name="add" size={32} color="#fff" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

function makeStyles(c: any) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      backgroundColor: 'transparent', paddingHorizontal: 16, paddingVertical: 14,
    },
    headerTitle: { fontSize: 20, fontWeight: '700', color: c.text },
    searchRow: {
      flexDirection: 'row', alignItems: 'center', margin: 15, marginTop: 0,
      paddingHorizontal: 18, paddingVertical: 11,
      backgroundColor: c.input, borderRadius: 28, borderWidth: 1, borderColor: c.border,
    },
    searchInput: { flex: 1, fontSize: 15, color: c.text },
    songCard: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: c.card, padding: 14,
      marginBottom: 8,  borderColor: c.border,
    },
    songName: { fontSize: 15, fontWeight: '600', color: c.text },
    songSub: { fontSize: 12, color: c.textSub, marginTop: 2 },
    songTone: { fontSize: 14, fontWeight: '700', marginLeft: 8 },
    emptyWrap: { padding: 48, alignItems: 'center', gap: 12 },
    emptyStateImage: { width: 160, height: 160, opacity: 0.9 },
    emptyText: { color: c.text, fontSize: 14, textAlign: 'center', lineHeight: 22 },
    fab: {
      position: 'absolute', right: 20, bottom: 20,
      backgroundColor: c.accent, width: 56, height: 56, borderRadius: 28,
      alignItems: 'center', justifyContent: 'center', elevation: 5,
      shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 3
    }
  });
}
