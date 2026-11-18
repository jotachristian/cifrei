import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, TextInput, FlatList, Modal,
  TouchableOpacity, StyleSheet, Pressable, Image, KeyboardAvoidingView, Platform, ScrollView
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { createPlaylist, Playlist, addDatabaseListener, getPlaylists, getPlaylistChordsCount } from '@/lib/database';
import { PlaylistCover } from '@/components/PlaylistCover';
import { AppBackground } from '@/components/AppBackground';
import { EVENT_CATEGORIES, getCategoryConfig } from '@/lib/events';

export default function PlaylistsScreen() {
  const { colors, isDark, toggleTheme } = useTheme();
  const router = useRouter();

  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Modal de Criação de Playlist
  const [showAdd, setShowAdd] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [newPlaylistDesc, setNewPlaylistDesc] = useState('');
  const [newPlaylistCategory, setNewPlaylistCategory] = useState<string | undefined>(undefined);

  useFocusEffect(
    useCallback(() => {
      const reload = () => {
        setPlaylists(getPlaylists());
      };
      reload();
      const unsub = addDatabaseListener(reload);
      return () => unsub();
    }, [])
  );

  // A playlist mais recente para a seção "Tocar Agora"
  const mostRecentPlaylist = useMemo(() => {
    return playlists.length > 0 ? playlists[0] : null;
  }, [playlists]);

  // Playlists filtradas pela categoria selecionada
  const filteredPlaylists = useMemo(() => {
    if (selectedCategory === 'all') {
      return playlists;
    }
    return playlists.filter(p => p.category === selectedCategory);
  }, [playlists, selectedCategory]);

  function handleOpenCreateModal(presetCategory?: string) {
    setNewPlaylistName('');
    setNewPlaylistDesc('');
    setNewPlaylistCategory(presetCategory !== 'all' ? presetCategory : undefined);
    setShowAdd(true);
  }

  function handleAddPlaylist() {
    if (newPlaylistName.trim()) {
      const newId = createPlaylist(
        newPlaylistName.trim(),
        newPlaylistDesc.trim(),
        newPlaylistCategory
      );
      setNewPlaylistName('');
      setNewPlaylistDesc('');
      setNewPlaylistCategory(undefined);
      setShowAdd(false);
      router.push({ pathname: '/playlist/[id]', params: { id: newId } });
    }
  }

  const sty = makeStyles(colors);

  return (
    <SafeAreaView style={sty.container} edges={['top']}>
      <AppBackground />

      {/* Header Superior */}
      <View style={sty.header}>
        <View style={sty.brandRow}>
          <Image source={require('@/assets/logo-name.png')} style={sty.brandImage} resizeMode="contain" />
        </View>
        <View style={sty.headerActions}>
          <Pressable onPress={() => handleOpenCreateModal()} style={sty.iconBtn}>
            <Ionicons name="add" size={32} color={colors.text} />
          </Pressable>
          <Pressable onPress={toggleTheme} style={sty.iconBtn}>
            <Ionicons name={isDark ? "sunny-outline" : "moon-outline"} size={26} color={colors.text} />
          </Pressable>
        </View>
      </View>

      <FlatList
        data={filteredPlaylists}
        keyExtractor={item => item.id}
        contentContainerStyle={sty.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={sty.listHeaderWrap}>
            {/* 1. SEÇÃO DE TOPO: "Tocar Agora" (Playlist mais recente registrada) */}
            {mostRecentPlaylist ? (
              <View style={sty.recentSection}>
                <View style={sty.sectionTitleRow}>
                  <Text style={sty.sectionTitle}>Tocar Agora</Text>
                </View>

                <TouchableOpacity
                  style={sty.recentCard}
                  onPress={() => router.push({ pathname: '/playlist/[id]', params: { id: mostRecentPlaylist.id } })}
                  activeOpacity={0.8}
                >
                  <PlaylistCover
                    playlistId={mostRecentPlaylist.id}
                    size={72}
                    borderRadius={16}
                  />

                  <View style={sty.recentInfo}>
                    {mostRecentPlaylist.category ? (
                      <View style={sty.badgeRow}>
                        {(() => {
                          const cat = getCategoryConfig(mostRecentPlaylist.category);
                          if (!cat) return null;
                          return (
                            <View style={[sty.categoryBadge]}>
                              <Text style={[sty.categoryBadgeText]}>
                                {cat.label}
                              </Text>
                            </View>
                          );
                        })()}
                        <Text style={sty.recentSongCount}>
                          {getPlaylistChordsCount(mostRecentPlaylist.id)} {getPlaylistChordsCount(mostRecentPlaylist.id) === 1 ? 'cifra' : 'cifras'}
                        </Text>
                      </View>
                    ) : (
                      <Text style={sty.recentSongCount}>
                        {getPlaylistChordsCount(mostRecentPlaylist.id)} {getPlaylistChordsCount(mostRecentPlaylist.id) === 1 ? 'cifra' : 'cifras'}
                      </Text>
                    )}

                    <Text style={sty.recentName} numberOfLines={1}>
                      {mostRecentPlaylist.name}
                    </Text>

                    {mostRecentPlaylist.description ? (
                      <Text style={sty.recentDesc} numberOfLines={1}>
                        {mostRecentPlaylist.description}
                      </Text>
                    ) : null}
                  </View>

                  <View style={sty.recentActionBtn}>
                    <Ionicons name="play" size={18} color="#ffffff" />
                  </View>
                </TouchableOpacity>
              </View>
            ) : null}

            {/* 2. SEÇÃO DE BIBLIOTECA: Filtro de Eventos */}
            <View style={sty.libraryHeader}>
              <View style={sty.sectionTitleRow}>
                <Text style={sty.sectionTitle}>Biblioteca de Eventos</Text>
              </View>

              {/* Barra Horizontal de Filtros por Tipo de Evento */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={sty.categoriesScroll}
              >
                <TouchableOpacity
                  style={[sty.categoryChip, selectedCategory === 'all' && sty.categoryChipActive]}
                  onPress={() => setSelectedCategory('all')}
                  activeOpacity={0.7}
                >
                  
                  <Text style={[sty.categoryChipText, selectedCategory === 'all' && sty.categoryChipTextActive]}>
                    Todas ({playlists.length})
                  </Text>
                </TouchableOpacity>

                {EVENT_CATEGORIES.map(cat => {
                  const isSelected = selectedCategory === cat.id;
                  const count = playlists.filter(p => p.category === cat.id).length;
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      style={[
                        sty.categoryChip,
                        isSelected && { backgroundColor: colors.accent, borderColor: colors.accent }
                      ]}
                      onPress={() => setSelectedCategory(cat.id)}
                      activeOpacity={0.7}
                    >
                     
                      <Text style={[sty.categoryChipText, isSelected && sty.categoryChipTextActive]}>
                        {cat.label} {count > 0 ? `(${count})` : ''}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={sty.emptyWrap}>
            <Image source={require('@/assets/playlist-none.png')} style={sty.emptyStateImage} resizeMode="contain" />
            <Text style={sty.emptyTitle}>
              {selectedCategory === 'all'
                ? 'Sua Biblioteca está vazia'
                : `Nenhuma playlist em "${getCategoryConfig(selectedCategory)?.label || 'este evento'}"`}
            </Text>
            <Text style={sty.emptySubtitle}>
              {selectedCategory === 'all'
                ? 'Crie seu primeiro repertório para organizar as músicas que vai tocar.'
                : 'Crie uma playlist para organizar as cifras deste tipo de evento.'}
            </Text>
            <TouchableOpacity
              style={sty.createEmptyBtn}
              onPress={() => handleOpenCreateModal(selectedCategory !== 'all' ? selectedCategory : undefined)}
              activeOpacity={0.8}
            >
              <Ionicons name="add" size={18} color="#ffffff" />
              <Text style={sty.createEmptyBtnTxt}>Criar Playlist</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => {
          const cat = getCategoryConfig(item.category);
          const chordCount = getPlaylistChordsCount(item.id);

          return (
            <TouchableOpacity
              style={sty.playlistCard}
              onPress={() => router.push({ pathname: '/playlist/[id]', params: { id: item.id } })}
              activeOpacity={0.75}
            >
              <PlaylistCover
                playlistId={item.id}
                size={68}
                borderRadius={12}
              />

              <View style={sty.cardInfo}>
                <View style={sty.cardTopMeta}>
                  <Text style={sty.songCountText}>
                    {chordCount} {chordCount === 1 ? 'cifra' : 'cifras'}
                  </Text>
                </View>

                <Text style={sty.cardTitle} numberOfLines={1}>{item.name}</Text>

                {item.description ? (
                  <Text style={sty.cardDesc} numberOfLines={1}>{item.description}</Text>
                ) : null}
              </View>

              <Ionicons name="chevron-forward" size={18} color={colors.placeholder} style={sty.chevron} />
            </TouchableOpacity>
          );
        }}
      />

      {/* =========================================================================
          MODAL: CRIAR PLAYLIST COM EVENTO E DESCRIÇÃO
         ========================================================================= */}
      <Modal visible={showAdd} transparent animationType="fade">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={sty.modalOverlay}>
          <View style={sty.modalCard}>
            <Text style={sty.modalTitle}>Criar Playlist</Text>

            {/* Input: Nome */}
            <View style={sty.fieldGroup}>
              <Text style={sty.fieldLabel}>NOME DO REPERTÓRIO *</Text>
              <TextInput
                style={sty.input}
                placeholder="Ex: Missa do 3º Domingo, Louvor..."
                placeholderTextColor={colors.placeholder}
                value={newPlaylistName}
                onChangeText={setNewPlaylistName}
                maxLength={50}
                autoFocus
              />
              <Text style={sty.charCounter}>{newPlaylistName.length} / 50</Text>
            </View>

            {/* Input: Descrição (Opcional) */}
            <View style={sty.fieldGroup}>
              <Text style={sty.fieldLabel}>DESCRIÇÃO (OPCIONAL)</Text>
              <TextInput
                style={[sty.input, sty.descInput]}
                placeholder="Ex: Músicas para entrada, comunhão e final..."
                placeholderTextColor={colors.placeholder}
                value={newPlaylistDesc}
                onChangeText={setNewPlaylistDesc}
                maxLength={120}
                multiline
                numberOfLines={2}
              />
            </View>

            {/* Seletor: Tipo de Evento (Opcional) */}
            <View style={sty.fieldGroup}>
              <View style={sty.labelWithHelper}>
                <Text style={sty.fieldLabel}>TIPO DE EVENTO</Text>
                <Text style={sty.fieldOptional}>(opcional)</Text>
              </View>

              <View style={sty.eventSelectorWrap}>
                {EVENT_CATEGORIES.map(cat => {
                  const isSelected = newPlaylistCategory === cat.id;
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      style={[
                        sty.eventOptionChip,
                        isSelected && { backgroundColor: `${cat.color}25`, borderColor: cat.color }
                      ]}
                      onPress={() => {
                        // Toggle: se tocar no mesmo, desmarca
                        setNewPlaylistCategory(prev => prev === cat.id ? undefined : cat.id);
                      }}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={cat.icon as any}
                        size={13}
                        color={isSelected ? cat.color : colors.textSub}
                      />
                      <Text
                        style={[
                          sty.eventOptionText,
                          isSelected && { color: cat.color, fontWeight: '700' }
                        ]}
                      >
                        {cat.label}
                      </Text>
                      {isSelected && (
                        <Ionicons name="checkmark-circle" size={13} color={cat.color} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Botões do Modal */}
            <View style={sty.modalBtns}>
              <TouchableOpacity
                style={sty.cancelBtn}
                onPress={() => { setShowAdd(false); setNewPlaylistName(''); setNewPlaylistDesc(''); setNewPlaylistCategory(undefined); }}
                activeOpacity={0.8}
              >
                <Text style={sty.cancelBtnTxt}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[sty.saveBtn, { opacity: newPlaylistName.trim() ? 1 : 0.4 }]}
                onPress={handleAddPlaylist}
                disabled={!newPlaylistName.trim()}
                activeOpacity={0.8}
              >
                <Text style={sty.saveBtnTxt}>Criar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </SafeAreaView>
  );
}

function makeStyles(c: any) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 16, paddingVertical: 12,
      maxWidth: 600, width: '100%', alignSelf: 'center',
    },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    brandRow: { flexDirection: 'row', alignItems: 'center' },
    brandImage: { width: 150, height: 46 },
    iconBtn: { padding: 4 },

    listContent: {
      paddingHorizontal: 16,
      paddingBottom: 40,
      maxWidth: 600,
      width: '100%',
      alignSelf: 'center',
    },
    listHeaderWrap: {
      marginBottom: 12,
    },

    // ── Seção Topo: Tocar Agora ──────────────────────────────────────────
    recentSection: {
      marginBottom: 20,
    },
    sectionTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 10,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: c.text,
      letterSpacing: 0.2,
    },
    sectionSubtitle: {
      fontSize: 12,
      color: c.textSub,
    },
    recentCard: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12
    },
    recentInfo: {
      flex: 1,
      marginLeft: 14,
      marginRight: 10,
      gap: 3,
    },
    badgeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flexWrap: 'wrap',
    },
    categoryBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
    },
    categoryBadgeText: {
      fontSize: 11,
      fontWeight: '700',
      color: c.accent,
      borderWidth: 2,
      borderRadius: 20,
      padding: 5,
      borderColor: c.accent,
    },
    recentSongCount: {
      fontSize: 12,
      color: c.textSub,
      fontWeight: '500',
    },
    recentName: {
      fontSize: 16,
      fontWeight: '700',
      color: c.text,
      marginTop: 2,
    },
    recentDesc: {
      fontSize: 12,
      color: c.textSub,
    },
    recentActionBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: c.accent,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: c.accent,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.35,
      shadowRadius: 4,
      elevation: 3,
    },

    // ── Seção Biblioteca: Filtros e Abas ─────────────────────────────────
    libraryHeader: {
      marginTop: 4,
      marginBottom: 6,
    },
    categoriesScroll: {
      paddingVertical: 6,
      gap: 8,
    },
    categoryChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 13,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: c.input,

    },
    categoryChipActive: {
      backgroundColor: c.accent,
      borderColor: c.accent,
    },
    categoryChipText: {
      fontSize: 13,
      color: c.textSub,
      fontWeight: '600',
    },
    categoryChipTextActive: {
      color: '#ffffff',
      fontWeight: '700',
    },

    // ── Cards da Lista de Playlists ──────────────────────────────────────
    playlistCard: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      borderRadius: 16,
      marginBottom: 10,
    },
    cardInfo: {
      flex: 1,
      marginLeft: 12,
      marginRight: 6,
      gap: 3,
    },
    cardTopMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    categoryBadgeSmall: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 6,
      borderRadius: 6,
    },
    categoryBadgeSmallTxt: {
      fontSize: 12,
      fontWeight: '700',
    },
    songCountText: {
      fontSize: 11,
      color: c.textSub,
    },
    cardTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: c.text,
    },
    cardDesc: {
      fontSize: 12,
      color: c.textSub,
    },
    chevron: {
      marginLeft: 4,
    },

    // ── Estado Vazio ─────────────────────────────────────────────────────
    emptyWrap: {
      padding: 36,
      alignItems: 'center',
      gap: 10,
    },
    emptyStateImage: {
      width: 140,
      height: 140,
      opacity: 0.85,
    },
    emptyTitle: {
      color: c.text,
      fontSize: 16,
      fontWeight: '700',
      textAlign: 'center',
    },
    emptySubtitle: {
      color: c.textSub,
      fontSize: 13,
      textAlign: 'center',
      lineHeight: 18,
      maxWidth: 280,
    },
    createEmptyBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: c.accent,
      paddingHorizontal: 18,
      paddingVertical: 10,
      borderRadius: 20,
      marginTop: 8,
    },
    createEmptyBtnTxt: {
      color: '#ffffff',
      fontWeight: '700',
      fontSize: 14,
    },

    // ── Modal de Criação ─────────────────────────────────────────────────
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.65)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    modalCard: {
      backgroundColor: c.card,
      borderRadius: 24,
      padding: 22,
      width: '100%',
      maxWidth: 420,
      borderWidth: 1,
      borderColor: c.border,
      elevation: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.4,
      shadowRadius: 20,
      gap: 14,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: '800',
      color: c.text,
      textAlign: 'center',
      marginBottom: 4,
    },
    fieldGroup: {
      gap: 6,
    },
    fieldLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: c.textSub,
      letterSpacing: 0.5,
    },
    labelWithHelper: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    fieldOptional: {
      fontSize: 11,
      color: c.textSub,
      fontStyle: 'italic',
    },
    input: {
      backgroundColor: c.input,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 15,
      color: c.text,
      borderWidth: 1,
      borderColor: c.border,
    },
    descInput: {
      minHeight: 60,
      textAlignVertical: 'top',
    },
    charCounter: {
      fontSize: 11,
      color: c.textSub,
      textAlign: 'right',
      marginTop: 2,
    },
    eventSelectorWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 7,
      marginTop: 2,
    },
    eventOptionChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 12,
      backgroundColor: c.input,
      borderWidth: 1,
      borderColor: c.border,
    },
    eventOptionText: {
      fontSize: 12,
      color: c.text,
      fontWeight: '500',
    },
    modalBtns: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 8,
    },
    cancelBtn: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 12,
      backgroundColor: c.input,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cancelBtnTxt: {
      color: c.text,
      fontWeight: '700',
      fontSize: 14,
    },
    saveBtn: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 12,
      backgroundColor: c.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    saveBtnTxt: {
      color: '#ffffff',
      fontWeight: '700',
      fontSize: 14,
    },
  });
}
