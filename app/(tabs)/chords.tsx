import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, TextInput, FlatList,
  TouchableOpacity, StyleSheet, Pressable, Image, ScrollView, Platform
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import {
  getAllChords, searchChords, Chord, ChordWithPlaylist,
  addDatabaseListener, formatArtistName, createOrGetArtistPlaylist
} from '@/lib/database';
import { ChordCover } from '@/components/ChordCover';
import { AppBackground } from '@/components/AppBackground';

interface ArtistGroup {
  name: string;
  count: number;
  sampleChord?: Chord;
}

export default function ChordsScreen() {
  const { colors } = useTheme();
  const router = useRouter();

  const [allChords, setAllChords] = useState<Chord[]>([]);
  const [results, setResults] = useState<ChordWithPlaylist[]>([]);
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'songs' | 'artists'>('songs');

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

  // Agrupamento de artistas com contagem de músicas e capa de amostra
  const artistsList = useMemo<ArtistGroup[]>(() => {
    const map = new Map<string, ArtistGroup>();
    for (const c of allChords) {
      const formatted = formatArtistName(c.artist || '').trim();
      if (!formatted) continue;
      const key = formatted.toLowerCase();
      const existing = map.get(key);
      if (existing) {
        existing.count++;
        if (!existing.sampleChord && (c.cover_url || c.cover_local_uri || c.external_link)) {
          existing.sampleChord = c;
        }
      } else {
        map.set(key, {
          name: formatted,
          count: 1,
          sampleChord: (c.cover_url || c.cover_local_uri || c.external_link) ? c : undefined,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [allChords]);

  // Artistas filtrados pela busca
  const filteredArtists = useMemo(() => {
    if (!query.trim()) return artistsList;
    const cleanQ = query.trim().toLowerCase();
    return artistsList.filter(a => a.name.toLowerCase().includes(cleanQ));
  }, [artistsList, query]);

  // Lista de músicas a exibir
  const displaySongsList = query.length >= 2 ? results : allChords;

  // Ação ao selecionar um artista: cria ou abre a playlist do artista com todas as suas músicas
  function handleSelectArtist(artistName: string) {
    const playlistId = createOrGetArtistPlaylist(artistName);
    if (playlistId) {
      router.push({ pathname: '/playlist/[id]', params: { id: playlistId } });
    }
  }

  function handleCreateChord() {
    router.push('/chord/edit');
  }

  const sty = makeStyles(colors);

  return (
    <SafeAreaView style={sty.container} edges={['top']}>
      <AppBackground />

      {/* Header */}
      <View style={sty.header}>
        <Text style={sty.headerTitle}>Acervo Geral</Text>
      </View>

      {/* Barra de Pesquisa */}
      <View style={sty.searchRow}>
        <Ionicons name="search-outline" size={18} color={colors.placeholder} style={{ marginRight: 8 }} />
        <TextInput
          style={sty.searchInput}
          placeholder={activeTab === 'songs' ? "Buscar cifra ou artista..." : "Buscar artista..."}
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

      {/* Alternador de Visualização: Músicas / Artistas */}
      <View style={sty.tabSelectorRow}>
        <TouchableOpacity
          style={[sty.tabBtn, activeTab === 'songs' && sty.tabBtnActive]}
          onPress={() => setActiveTab('songs')}
          activeOpacity={0.7}
        >
          <Ionicons
            name="musical-notes-outline"
            size={15}
            color={activeTab === 'songs' ? '#ffffff' : colors.textSub}
          />
          <Text style={[sty.tabBtnTxt, activeTab === 'songs' && sty.tabBtnTxtActive]}>
            Músicas ({allChords.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[sty.tabBtn, activeTab === 'artists' && sty.tabBtnActive]}
          onPress={() => setActiveTab('artists')}
          activeOpacity={0.7}
        >
          <Ionicons
            name="person-outline"
            size={15}
            color={activeTab === 'artists' ? '#ffffff' : colors.textSub}
          />
          <Text style={[sty.tabBtnTxt, activeTab === 'artists' && sty.tabBtnTxtActive]}>
            Artistas ({artistsList.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* =========================================================================
          ABA 1: LISTA DE MÚSICAS
         ========================================================================= */}
      {activeTab === 'songs' ? (
        <FlatList
          key="songs-list"
          data={displaySongsList}
          keyExtractor={item => item.id}
          contentContainerStyle={sty.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            // Se o usuário digitou uma busca e encontrou algum artista correspondente,
            // oferece um atalho para abrir/criar a playlist daquele artista
            query.trim().length >= 2 && filteredArtists.length > 0 ? (
              <View style={sty.artistSuggestionsBox}>
                <Text style={sty.artistSuggestionsTitle}>Artistas encontrados:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {filteredArtists.slice(0, 4).map(art => (
                    <TouchableOpacity
                      key={art.name}
                      style={sty.artistPill}
                      onPress={() => handleSelectArtist(art.name)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="person-circle-outline" size={16} color={colors.accent} />
                      <Text style={sty.artistPillName} numberOfLines={1}>{art.name}</Text>
                      <View style={sty.artistPillBadge}>
                        <Text style={sty.artistPillBadgeTxt}>{art.count}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            ) : null
          }
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
                <View style={sty.songThumb}>
                  {item.cover_url || item.cover_local_uri || item.external_link ? (
                    <ChordCover
                      chordId={item.id}
                      coverUrl={item.cover_url}
                      coverLocalUri={item.cover_local_uri}
                      externalLink={item.external_link}
                      size={50}
                      fallback={<Ionicons name="musical-notes" size={22} color="#8e9297" />}
                    />
                  ) : (
                    <Ionicons name="musical-notes" size={22} color="#8e9297" />
                  )}
                </View>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={sty.songName} numberOfLines={1}>{item.name}</Text>
                  <Text style={sty.songSub} numberOfLines={1}>
                    {item.artist}{plName ? ` • ${plName}` : ''}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      ) : (
        /* =========================================================================
            ABA 2: LISTA DE ARTISTAS COM CRIAÇÃO DIRETA DE PLAYLIST
           ========================================================================= */
        <FlatList
          key="artists-list"
          data={filteredArtists}
          keyExtractor={item => item.name}
          contentContainerStyle={sty.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={sty.emptyWrap}>
              <Ionicons name="people-outline" size={48} color={colors.placeholder} />
              <Text style={sty.emptyText}>Nenhum artista encontrado.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={sty.artistCard}
              onPress={() => handleSelectArtist(item.name)}
              activeOpacity={0.75}
            >
              <View style={sty.artistAvatar}>
                {item.sampleChord ? (
                  <ChordCover
                    chordId={item.sampleChord.id}
                    coverUrl={item.sampleChord.cover_url}
                    coverLocalUri={item.sampleChord.cover_local_uri}
                    externalLink={item.sampleChord.external_link}
                    size={46}
                    borderRadius={23}
                    fallback={<Ionicons name="person" size={22} color={colors.accent} />}
                  />
                ) : (
                  <Ionicons name="person" size={22} color={colors.accent} />
                )}
              </View>

              <View style={{ flex: 1, marginRight: 10 }}>
                <Text style={sty.artistCardName} numberOfLines={1}>{item.name}</Text>
                <Text style={sty.artistCardSub}>
                  {item.count} {item.count === 1 ? 'música registrada' : 'músicas registradas'}
                </Text>
              </View>

            </TouchableOpacity>
          )}
        />
      )}

      {/* FAB para Criar Cifra */}
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
      paddingHorizontal: 16, paddingVertical: 14,
      maxWidth: 600, width: '100%', alignSelf: 'center',
    },
    headerTitle: { fontSize: 20, fontWeight: '700', color: c.text },
    searchRow: {
      flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 10,
      paddingHorizontal: 20, paddingVertical: 4,
      backgroundColor: c.input, borderRadius: 12,
      maxWidth: 600, width: '92%', alignSelf: 'center',
    },
    searchInput: { flex: 1, fontSize: 14, color: c.text },

    // Alternador de Abas Músicas / Artistas
    tabSelectorRow: {
      flexDirection: 'row',
      marginHorizontal: 16,
      marginBottom: 12,
      gap: 10,
      maxWidth: 600,
      width: '92%',
      alignSelf: 'center',
    },
    tabBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 9,
      borderRadius: 14,
      backgroundColor: c.input,
    },
    tabBtnActive: {
      backgroundColor: c.accent,
      borderColor: c.accent,
    },
    tabBtnTxt: {
      fontSize: 13,
      fontWeight: '600',
      color: c.textSub,
    },
    tabBtnTxtActive: {
      color: '#ffffff',
      fontWeight: '700',
    },

    listContent: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      paddingBottom: 90,
      maxWidth: 600,
      width: '100%',
      alignSelf: 'center',
    },

    // Card de Música
    songCard: {
      flexDirection: 'row', 
      alignItems: 'center',
      padding: 10,
      marginBottom: 8,
    },
    songThumb: {
      width: 50,
      height: 50,
      borderRadius: 12,
      backgroundColor: c.input,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      marginRight: 12,
    },
    coverFallback: {
      width: 50, height: 50, borderRadius: 12,
      backgroundColor: c.input, alignItems: 'center', justifyContent: 'center',
      borderWidth: 1, borderColor: c.border, marginRight: 12,
    },
    songName: { fontSize: 16, fontWeight: '600', color: c.text },
    songSub: { fontSize: 14, color: c.textSub},
    toneBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
      backgroundColor: 'rgba(247, 61, 19, 0.1)',
    },

    // Sugestão de Artistas no Topo da Busca
    artistSuggestionsBox: {
      marginBottom: 14,
      padding: 12,
      gap: 8,
    },
    artistSuggestionsTitle: {
      fontSize: 12,
      fontWeight: '700',
      color: c.textSub,
      letterSpacing: 0.3,
    },
    artistPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: c.input,
      paddingHorizontal: 12,
      paddingVertical: 7,
    },
    artistPillName: {
      fontSize: 13,
      fontWeight: '600',
      color: c.text,
      maxWidth: 140,
    },
    artistPillBadge: {
      backgroundColor: 'rgba(247, 61, 19, 0.16)',
      paddingHorizontal: 6,
      paddingVertical: 1,
      borderRadius: 10,
    },
    artistPillBadgeTxt: {
      fontSize: 10,
      fontWeight: '700',
      color: c.accent,
    },

    // Card de Artista na Aba de Artistas
    artistCard: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      marginBottom: 8,
    },
    artistAvatar: {
      width: 46,
      height: 46,
      borderRadius: 23,
      backgroundColor: c.input,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
      borderWidth: 1,
      borderColor: c.border,
      overflow: 'hidden',
    },
    artistCardName: {
      fontSize: 15,
      fontWeight: '700',
      color: c.text,
    },
    artistCardSub: {
      fontSize: 12,
      color: c.textSub,
      marginTop: 2,
    },
    openArtistBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.accent,
      paddingHorizontal: 11,
      paddingVertical: 7,
      borderRadius: 12,
    },
    openArtistBtnTxt: {
      color: '#ffffff',
      fontSize: 12,
      fontWeight: '700',
    },

    emptyWrap: { padding: 48, alignItems: 'center', gap: 12 },
    emptyStateImage: { width: 140, height: 140, opacity: 0.9 },
    emptyText: { color: c.text, fontSize: 14, textAlign: 'center', lineHeight: 22 },
    fab: {
      position: 'absolute', right: 20, bottom: 20,
      backgroundColor: c.accent, width: 56, height: 56, borderRadius: 28,
      alignItems: 'center', justifyContent: 'center', elevation: 5,
      shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 3
    }
  });
}
