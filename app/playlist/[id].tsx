import React, { useState, useCallback } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, Pressable, TextInput, KeyboardAvoidingView, Platform, Alert, FlatList } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { getPlaylist, getPlaylistChords, updatePlaylist, deletePlaylist, ChordInPlaylist, getAllChords, linkChordToPlaylist, Chord, updateLinkSortOrder, createChord, addDatabaseListener, unlinkChordFromPlaylist } from '@/lib/database';
import { transposeTone } from '@/lib/transpose';

export default function PlaylistScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const router = useRouter();
  const [name, setName] = useState('Playlist');
  const [chords, setChords] = useState<ChordInPlaylist[]>([]);
  const [showMenu, setShowMenu] = useState(false);
  const [showRename, setShowRename] = useState(false);
  const [renameInput, setRenameInput] = useState('');
  const [isEditingList, setIsEditingList] = useState(false);
  
  const [showAddChord, setShowAddChord] = useState(false);
  const [allChords, setAllChords] = useState<Chord[]>([]);
  const [chordQuery, setChordQuery] = useState('');

  useFocusEffect(
    useCallback(() => {
      const reload = () => {
        const p = getPlaylist(id);
        setName(p?.name ?? 'Playlist');
        setChords(getPlaylistChords(id));
        setAllChords(getAllChords().sort((a,b) => a.name.localeCompare(b.name)));
      };
      reload();
      const unsub = addDatabaseListener(reload);
      return () => unsub();
    }, [id])
  );

  function handleAddChord(chordId: string) {
    linkChordToPlaylist(chordId, id);
    setChords(getPlaylistChords(id));
    setShowAddChord(false);
  }

  function handleCreateAndAdd() {
    const newId = createChord({ name: 'Nova Cifra', artist: '', tone: 'C', lyrics: '' });
    handleAddChord(newId);
    router.push({ pathname: '/chord/[id]', params: { id: newId, playlistId: id } });
  }

  function handleGoBack() {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  }

  function handleRename() {
    if (renameInput.trim()) {
      updatePlaylist(id, renameInput.trim(), '');
      setName(renameInput.trim());
    }
    setShowRename(false);
  }

  function handleRemoveChord(chordId: string, chordName: string) {
    if (Platform.OS === 'web') {
      const confirmed = window.confirm(`Deseja remover "${chordName}" desta playlist?`);
      if (confirmed) {
        unlinkChordFromPlaylist(chordId, id);
        setChords(getPlaylistChords(id));
      }
    } else {
      Alert.alert(
        'Remover Cifra',
        `Deseja remover "${chordName}" desta playlist?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Remover',
            style: 'destructive',
            onPress: () => {
              unlinkChordFromPlaylist(chordId, id);
              setChords(getPlaylistChords(id));
            },
          },
        ]
      );
    }
  }

  function confirmDelete() {
    setShowMenu(false);
    const deleteAction = () => {
      deletePlaylist(id);
      handleGoBack();
    };

    if (Platform.OS === 'web') {
      const confirmed = window.confirm('Tem certeza que deseja excluir esta playlist? As cifras continuarão salvas no acervo.');
      if (confirmed) {
        deleteAction();
      }
    } else {
      Alert.alert('Excluir Playlist', 'Tem certeza que deseja excluir esta playlist? As cifras continuarão salvas no acervo.', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Excluir', style: 'destructive', onPress: deleteAction }
      ]);
    }
  }

  async function onReordered(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= chords.length || toIndex >= chords.length) return;
    const newChords = [...chords];
    const [moved] = newChords.splice(fromIndex, 1);
    newChords.splice(toIndex, 0, moved);

    // Salvar a nova ordem no banco
    newChords.forEach((c, index) => {
      updateLinkSortOrder(c.id, id, index + 1);
    });

    setChords(newChords);
  }

  // Render do Header Hero com capa, título e contagem
  const renderListHeader = () => (
    <View style={sty.heroHeader}>
      <View style={sty.coverShadowWrapper}>
        <View style={sty.coverContainer}>
          <View style={sty.coverGrid}>
            <View style={[sty.coverQuadrant, { backgroundColor: '#202227' }]}>
              <Ionicons name="musical-notes" size={24} color="#8e9297" />
            </View>
            <View style={[sty.coverQuadrant, { backgroundColor: '#282b31' }]}>
              <Ionicons name="disc" size={24} color="#8e9297" />
            </View>
            <View style={[sty.coverQuadrant, { backgroundColor: '#1c1e22' }]}>
              <Ionicons name="headset" size={24} color="#8e9297" />
            </View>
            <View style={[sty.coverQuadrant, { backgroundColor: '#24272d' }]}>
              <Ionicons name="radio" size={24} color="#8e9297" />
            </View>
          </View>
        </View>
      </View>

      <Text style={sty.heroTitle} numberOfLines={2}>{name}</Text>
      
      <View style={sty.heroMetaRow}>
        <Text style={sty.heroMetaCount}>
          {chords.length} {chords.length === 1 ? 'música' : 'músicas'}
        </Text>
      </View>

      {isEditingList ? (
        <View style={sty.editingBanner}>
          <Text style={sty.editingBannerText}>
            Arraste para reordenar ou toque no botão (-) para remover
          </Text>
        </View>
      ) : null}
    </View>
  );

  // Render para FlatList padrão (Visualização Normal)
  function renderNormalItem({ item, index }: { item: ChordInPlaylist; index: number }) {
    const itemTone = transposeTone(item.tone, item.tone_offset ?? 0);
    const subInfo = [item.artist, itemTone].filter(Boolean).join(' • ');
    const formattedNumber = String(index + 1).padStart(2, '0');

    return (
      <View style={sty.songRowWrap}>
        <TouchableOpacity
          style={sty.songRow}
          onPress={() => router.push({
            pathname: '/chord/[id]',
            params: { id: item.id, playlistId: id },
          })}
          activeOpacity={0.7}
        >
          {/* Capa da Música */}
          <View style={sty.songThumb}>
            <Ionicons name="musical-notes" size={18} color="#8e9297" />
          </View>

          {/* Numeração com 2 dígitos (01, 02, 03...) */}
          <Text style={sty.songIndexText}>{formattedNumber}</Text>

          {/* Dados da Música */}
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={sty.songTitle} numberOfLines={1}>{item.name}</Text>
            <Text style={sty.songSubTitle} numberOfLines={1}>{subInfo}</Text>
          </View>

          <Ionicons name="ellipsis-vertical" size={18} color="#8e9297" style={{ padding: 4 }} />
        </TouchableOpacity>
      </View>
    );
  }

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Render para modo de Edição
  function renderEditItem(item: ChordInPlaylist, index: number, onDragStart?: () => void, onDragEnd?: () => void, isActive?: boolean) {
    const itemTone = transposeTone(item.tone, item.tone_offset ?? 0);
    const subInfo = [item.artist, itemTone].filter(Boolean).join(' • ');

    const webDragProps = Platform.OS === 'web' ? {
      draggable: true,
      onDragStart: (e: any) => {
        if (e?.dataTransfer) {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', String(index));
        }
        setDraggedIndex(index);
      },
      onDragOver: (e: any) => {
        if (e) {
          e.preventDefault();
          if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
        }
      },
      onDrop: (e: any) => {
        if (e) {
          e.preventDefault();
          const raw = e.dataTransfer ? e.dataTransfer.getData('text/plain') : null;
          const fromIdx = raw !== null && raw !== '' ? parseInt(raw, 10) : draggedIndex;
          if (fromIdx !== null && !isNaN(fromIdx) && fromIdx !== index) {
            onReordered(fromIdx, index);
          }
        }
        setDraggedIndex(null);
      },
      onDragEnd: () => {
        setDraggedIndex(null);
      }
    } : {};

    return (
      <View 
        style={[
          sty.editItemWrap, 
          isActive && sty.itemActive,
          draggedIndex === index && { opacity: 0.4 }
        ]}
        {...(webDragProps as any)}
      >
        <View style={[sty.editItem, isActive && sty.itemDragging]}>
          {/* Botão de Menos Vermelho */}
          <TouchableOpacity
            style={sty.minusButton}
            onPress={() => handleRemoveChord(item.id, item.name)}
            activeOpacity={0.7}
          >
            <Ionicons name="remove-circle" size={24} color="#ff5c75" />
          </TouchableOpacity>

          <View style={{ flex: 1, marginHorizontal: 12 }}>
            <Text style={sty.editSongName} numberOfLines={1}>{item.name}</Text>
            <Text style={sty.editSongSub} numberOfLines={1}>{subInfo}</Text>
          </View>

          {/* Ícone de 6 Pontinhos para arrastar */}
          <Pressable 
            onPressIn={onDragStart} 
            onPressOut={onDragEnd} 
            style={[sty.dragGridHandle, Platform.OS === 'web' && { cursor: 'grab' } as any]}
          >
            <Ionicons name="grid-outline" size={20} color="#8e9297" />
          </Pressable>
        </View>
      </View>
    );
  }

  const filteredChords = allChords.filter(c => c.name.toLowerCase().includes(chordQuery.toLowerCase()) || c.artist.toLowerCase().includes(chordQuery.toLowerCase()));

  const sty = makeStyles(colors);

  return (
    <SafeAreaView style={sty.container}>
      <View style={sty.innerContent}>
        {/* Header Superior Limpo */}
        <View style={sty.topBar}>
          <Pressable onPress={handleGoBack} style={sty.topActionBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </Pressable>

          <View style={sty.topRightActions}>
            {isEditingList ? (
              <TouchableOpacity 
                style={sty.doneBtn} 
                onPress={() => setIsEditingList(false)}
                activeOpacity={0.8}
              >
                <Text style={sty.doneBtnText}>Concluir</Text>
              </TouchableOpacity>
            ) : (
              <>
                <Pressable onPress={() => setShowAddChord(true)} style={sty.topActionBtn}>
                  <Ionicons name="add" size={28} color={colors.text} />
                </Pressable>
                <Pressable onPress={() => setShowMenu(true)} style={sty.topActionBtn}>
                  <Ionicons name="ellipsis-vertical" size={22} color={colors.text} />
                </Pressable>
              </>
            )}
          </View>
        </View>

        {/* Lista com Scroll 100% Nativo e Fluido em Web e Mobile */}
        <FlatList
          data={chords}
          keyExtractor={item => item.id}
          style={sty.scrollableList}
          contentContainerStyle={sty.listContent}
          ListHeaderComponent={renderListHeader}
          ListEmptyComponent={
            <View style={sty.emptyWrap}>
              <Ionicons name="musical-notes-outline" size={54} color={colors.textSub} />
              <Text style={sty.emptyText}>Nenhuma música nesta playlist.</Text>
            </View>
          }
          renderItem={isEditingList 
            ? ({ item, index }) => renderEditItem(item, index) 
            : renderNormalItem
          }
          showsVerticalScrollIndicator={true}
        />
      </View>

      {/* Modal dos 3 Pontinhos */}
      <Modal visible={showMenu} transparent animationType="fade">
        <Pressable style={sty.modalBackdrop} onPress={() => setShowMenu(false)}>
          <View style={sty.menuCard}>
            <TouchableOpacity 
              style={sty.menuItem} 
              onPress={() => { 
                setShowMenu(false); 
                setIsEditingList(true); 
              }}
            >
              <Ionicons name="create-outline" size={22} color={colors.text} style={sty.menuIcon} />
              <Text style={sty.menuTxt}>Editar</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={sty.menuItem} 
              onPress={() => { 
                setShowMenu(false); 
                setRenameInput(name); 
                setShowRename(true); 
              }}
            >
              <Ionicons name="text-outline" size={22} color={colors.text} style={sty.menuIcon} />
              <Text style={sty.menuTxt}>Renomear</Text>
            </TouchableOpacity>

            <TouchableOpacity style={sty.menuItem} onPress={confirmDelete}>
              <Ionicons name="trash-outline" size={22} color={colors.danger} style={sty.menuIcon} />
              <Text style={[sty.menuTxt, { color: colors.danger }]}>Excluir</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* Modal de Renomear */}
      <Modal visible={showRename} transparent animationType="fade">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={sty.modalOverlay}>
          <View style={sty.renameCard}>
            <Text style={sty.renameTitle}>Renomear</Text>
            
            <TextInput
              style={sty.renameInput}
              placeholder="Nome da playlist"
              placeholderTextColor={colors.placeholder}
              value={renameInput}
              onChangeText={setRenameInput}
              maxLength={50}
              autoFocus
            />

            <Text style={sty.renameCharCounter}>{renameInput.length} / 50</Text>

            <View style={sty.renameBtns}>
              <TouchableOpacity 
                style={sty.renameCancelBtn} 
                onPress={() => { setShowRename(false); setRenameInput(''); }}
                activeOpacity={0.8}
              >
                <Text style={sty.renameCancelTxt}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[sty.renameSaveBtn, { opacity: renameInput.trim() ? 1 : 0.4 }]}
                onPress={handleRename}
                disabled={!renameInput.trim()}
                activeOpacity={0.8}
              >
                <Text style={sty.renameSaveTxt}>Salvar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal de Adicionar Cifra */}
      <Modal visible={showAddChord} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={sty.fullModalOverlay}>
          <View style={sty.fullModalBox}>
            <View style={sty.fullModalHeader}>
              <Text style={sty.fullModalTitle}>Adicionar ao Repertório</Text>
              <Pressable onPress={() => setShowAddChord(false)}>
                <Ionicons name="close" size={26} color={colors.text} />
              </Pressable>
            </View>
            <View style={sty.searchRow}>
              <Ionicons name="search-outline" size={18} color={colors.placeholder} style={{ marginRight: 8 }} />
              <TextInput
                style={sty.searchInput}
                placeholder="Buscar cifra ou artista..."
                placeholderTextColor={colors.placeholder}
                value={chordQuery}
                onChangeText={setChordQuery}
              />
            </View>
            <TouchableOpacity style={sty.createNewBtn} onPress={handleCreateAndAdd} activeOpacity={0.8}>
              <Ionicons name="add" size={20} color="#fff" style={{ marginRight: 8 }} />
              <Text style={{ color: '#fff', fontWeight: 'bold' }}>Criar Nova Cifra</Text>
            </TouchableOpacity>
            <FlatList
              data={filteredChords}
              keyExtractor={c => c.id}
              renderItem={({ item }) => (
                <TouchableOpacity style={sty.chordResult} onPress={() => handleAddChord(item.id)}>
                  <View style={sty.songThumbSmall}>
                    <Ionicons name="musical-notes" size={16} color={colors.textSub} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={sty.songResultName}>{item.name}</Text>
                    <Text style={sty.songResultSub}>{item.artist || 'Sem artista'} • {item.tone}</Text>
                  </View>
                  <Ionicons name="add" size={24} color={colors.accent} />
                </TouchableOpacity>
              )}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </SafeAreaView>
  );
}

function makeStyles(c: any) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.bg,
      height: Platform.OS === 'web' ? ('100vh' as any) : '100%',
    },
    innerContent: {
      flex: 1,
      width: '100%',
      maxWidth: 900,
      alignSelf: 'center',
    },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: c.bg,
    },
    topActionBtn: {
      padding: 6,
    },
    topRightActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
    },
    doneBtn: {
      backgroundColor: c.accent,
      paddingHorizontal: 16,
      paddingVertical: 6,
      borderRadius: 16,
    },
    doneBtnText: {
      color: '#ffffff',
      fontWeight: '700',
      fontSize: 14,
    },
    
    // Lista com Scroll Nativo
    scrollableList: {
      flex: 1,
      width: '100%',
    },
    listContent: {
      paddingBottom: 160,
      flexGrow: 1,
    },

    // Hero Header
    heroHeader: {
      alignItems: 'center',
      paddingTop: 10,
      paddingBottom: 24,
      paddingHorizontal: 20,
    },
    coverShadowWrapper: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.35,
      shadowRadius: 20,
      elevation: 8,
      marginBottom: 20,
    },
    coverContainer: {
      width: 170,
      height: 170,
      borderRadius: 18,
      overflow: 'hidden',
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.border,
    },
    coverGrid: {
      flex: 1,
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    coverQuadrant: {
      width: '50%',
      height: '50%',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 0.5,
      borderColor: c.border,
    },
    heroTitle: {
      fontSize: 26,
      fontWeight: '800',
      color: c.text,
      textAlign: 'center',
      marginBottom: 6,
    },
    heroMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    heroMetaCount: {
      fontSize: 14,
      color: c.textSub,
      fontWeight: '500',
    },
    editingBanner: {
      marginTop: 14,
      backgroundColor: 'rgba(255, 119, 0, 0.15)',
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: 'rgba(255, 119, 0, 0.3)',
    },
    editingBannerText: {
      color: c.accent,
      fontSize: 12,
      fontWeight: '600',
      textAlign: 'center',
    },

    // Linha de Música (Modo Normal - Imagem 4)
    songRowWrap: {
      paddingHorizontal: 16,
      marginBottom: 6,
    },
    songRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 12,
      backgroundColor: 'transparent',
    },
    songThumb: {
      width: 44,
      height: 44,
      borderRadius: 10,
      backgroundColor: c.card,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: c.border,
    },
    songIndexText: {
      fontSize: 14,
      fontWeight: '600',
      color: c.textSub,
      width: 26,
      textAlign: 'center',
      marginLeft: 10,
    },
    songTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: c.text,
      marginBottom: 3,
    },
    songSubTitle: {
      fontSize: 13,
      color: c.textSub,
    },

    // Linha de Música (Modo de Edição - Imagem 3)
    editItemWrap: {
      paddingHorizontal: 16,
      marginBottom: 6,
    },
    editItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: 12,
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.border,
    },
    minusButton: {
      padding: 2,
    },
    editSongName: {
      fontSize: 15,
      fontWeight: '700',
      color: c.text,
      marginBottom: 3,
    },
    editSongSub: {
      fontSize: 13,
      color: c.textSub,
    },
    dragGridHandle: {
      padding: 6,
      justifyContent: 'center',
      alignItems: 'center',
    },
    itemActive: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.5,
      shadowRadius: 8,
      elevation: 10,
      zIndex: 99,
    },
    itemDragging: {
      borderColor: c.accent,
      backgroundColor: c.input,
    },

    emptyWrap: {
      padding: 48,
      alignItems: 'center',
      gap: 12,
    },
    emptyText: {
      color: c.textSub,
      fontSize: 14,
      textAlign: 'center',
    },

    // Modal dos 3 Pontinhos (Imagem 2)
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.65)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    menuCard: {
      backgroundColor: c.card,
      borderRadius: 16,
      paddingVertical: 8,
      paddingHorizontal: 8,
      width: 240,
      borderWidth: 1,
      borderColor: c.border,
      elevation: 12,
    },
    menuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: 10,
    },
    menuIcon: {
      marginRight: 14,
    },
    menuTxt: {
      fontSize: 15,
      fontWeight: '600',
      color: c.text,
    },

    // Modal Renomear (Imagem 2)
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.65)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    renameCard: {
      backgroundColor: c.card,
      borderRadius: 24,
      padding: 24,
      width: '100%',
      maxWidth: 380,
      borderWidth: 1,
      borderColor: c.border,
      elevation: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.4,
      shadowRadius: 20,
    },
    renameTitle: {
      fontSize: 22,
      fontWeight: '800',
      color: c.text,
      marginBottom: 20,
      textAlign: 'center',
    },
    renameInput: {
      backgroundColor: c.input,
      borderRadius: 14,
      padding: 16,
      fontSize: 16,
      color: c.text,
      borderWidth: 1,
      borderColor: c.border,
    },
    renameCharCounter: {
      fontSize: 13,
      color: c.textSub,
      textAlign: 'right',
      marginTop: 8,
      marginBottom: 20,
      fontWeight: '500',
    },
    renameBtns: {
      flexDirection: 'row',
      gap: 12,
    },
    renameCancelBtn: {
      flex: 1,
      padding: 14,
      borderRadius: 12,
      backgroundColor: c.input,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    renameCancelTxt: {
      color: c.text,
      fontWeight: '700',
      fontSize: 15,
    },
    renameSaveBtn: {
      flex: 1,
      padding: 14,
      borderRadius: 12,
      backgroundColor: c.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    renameSaveTxt: {
      color: '#ffffff',
      fontWeight: '700',
      fontSize: 15,
    },

    // Full Modal Adicionar Cifra
    fullModalOverlay: {
      flex: 1,
      backgroundColor: c.bg,
      paddingTop: 40,
    },
    fullModalBox: {
      flex: 1,
      backgroundColor: c.bg,
      padding: 16,
    },
    fullModalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    fullModalTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: c.text,
    },
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 10,
      backgroundColor: c.input,
      borderRadius: 28,
      borderWidth: 1,
      borderColor: c.border,
      marginBottom: 16,
    },
    searchInput: {
      flex: 1,
      fontSize: 15,
      color: c.text,
    },
    createNewBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 14,
      backgroundColor: c.accent,
      borderRadius: 12,
      marginBottom: 16,
    },
    chordResult: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.card,
      borderRadius: 12,
      padding: 12,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: c.border,
      gap: 12,
    },
    songThumbSmall: {
      width: 36,
      height: 36,
      borderRadius: 8,
      backgroundColor: c.input,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: c.border,
    },
    songResultName: {
      fontSize: 15,
      fontWeight: '600',
      color: c.text,
    },
    songResultSub: {
      fontSize: 12,
      color: c.textSub,
      marginTop: 2,
    },
  });
}
