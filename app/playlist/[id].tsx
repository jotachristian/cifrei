import React, { useState, useCallback } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, Pressable, TextInput, KeyboardAvoidingView, Platform, Alert, FlatList } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { getPlaylist, getPlaylistChords, updatePlaylist, deletePlaylist, ChordInPlaylist, getAllChords, linkChordToPlaylist, Chord, updateLinkSortOrder, createChord, addDatabaseListener } from '@/lib/database';
import { transposeTone } from '@/lib/transpose';
import DragList, { DragListRenderItemInfo } from 'react-native-draglist';

export default function PlaylistScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const router = useRouter();
  const [name, setName] = useState('Playlist');
  const [chords, setChords] = useState<ChordInPlaylist[]>([]);
  const [showMenu, setShowMenu] = useState(false);
  const [showRename, setShowRename] = useState(false);
  const [renameInput, setRenameInput] = useState('');
  
  const [showAddChord, setShowAddChord] = useState(false);
  const [allChords, setAllChords] = useState<Chord[]>([]);
  const [chordQuery, setChordQuery] = useState('');

  const [orderModal, setOrderModal] = useState<{ visible: boolean, chordId: string, currentPos: string }>({ visible: false, chordId: '', currentPos: '1' });

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

  function handleRename() {
    if (renameInput.trim()) {
      updatePlaylist(id, renameInput.trim(), '');
      setName(renameInput.trim());
    }
    setShowRename(false);
  }

  function confirmDelete() {
    setShowMenu(false);
    Alert.alert('Excluir Playlist', 'Tem certeza que deseja excluir esta playlist? As cifras continuarão salvas no banco.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: () => {
          deletePlaylist(id);
          router.dismiss();
        } 
      }
    ]);
  }

  function handleReorderSave() {
    const newPos = parseInt(orderModal.currentPos, 10);
    if (isNaN(newPos) || newPos < 1) return;

    const oldIndex = chords.findIndex(c => c.id === orderModal.chordId);
    if (oldIndex === -1) return;

    let targetIndex = newPos - 1;
    if (targetIndex >= chords.length) targetIndex = chords.length - 1;

    const newChords = [...chords];
    const [moved] = newChords.splice(oldIndex, 1);
    newChords.splice(targetIndex, 0, moved);

    // Salvar a nova ordem no banco
    newChords.forEach((c, index) => {
      updateLinkSortOrder(c.id, id, index + 1);
    });

    setChords(newChords);
    setOrderModal({ visible: false, chordId: '', currentPos: '1' });
  }

  async function onReordered(fromIndex: number, toIndex: number) {
    const newChords = [...chords];
    const [moved] = newChords.splice(fromIndex, 1);
    newChords.splice(toIndex, 0, moved);

    // Salvar a nova ordem no banco
    newChords.forEach((c, index) => {
      updateLinkSortOrder(c.id, id, index + 1);
    });

    setChords(newChords);
  }

  function renderItem(info: DragListRenderItemInfo<ChordInPlaylist>) {
    const { item, onDragStart, onDragEnd, isActive, index } = info;
    return (
      <View style={[sty.itemWrap, isActive && sty.itemActive]}>
        <View style={[sty.item, isActive && sty.itemDragging]}>
          <Pressable 
            onPressIn={onDragStart} 
            onPressOut={onDragEnd} 
            style={sty.dragHandle}
          >
            <Ionicons name="reorder-three-outline" size={24} color={isActive ? colors.accent : colors.border} />
          </Pressable>
          
          <TouchableOpacity 
            style={sty.numBadge} 
            activeOpacity={0.7}
            onPress={() => setOrderModal({ visible: true, chordId: item.id, currentPos: String(index + 1) })}
          >
            <Text style={sty.numText}>{index + 1}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={{ flex: 1 }}
            onPress={() => router.push({
              pathname: '/chord/[id]',
              params: { id: item.id, playlistId: id },
            })}
            activeOpacity={0.7}
          >
            {item.moment ? (
              <Text style={sty.itemMoment} numberOfLines={1}>{item.moment}</Text>
            ) : null}
            <Text style={sty.itemName} numberOfLines={1}>{item.name}</Text>
            {item.artist ? (
              <Text style={sty.itemSub} numberOfLines={1}>{item.artist}</Text>
            ) : null}
          </TouchableOpacity>
          <Text style={[sty.itemTone, { color: colors.accent }]}>
            {transposeTone(item.tone, item.tone_offset ?? 0)}
          </Text>
          <Ionicons name="chevron-forward" size={18} color={colors.border} />
        </View>
      </View>
    );
  }

  const filteredChords = allChords.filter(c => c.name.toLowerCase().includes(chordQuery.toLowerCase()) || c.artist.toLowerCase().includes(chordQuery.toLowerCase()));

  const sty = makeStyles(colors);

  return (
    <SafeAreaView style={sty.container}>
      <View style={sty.header}>
        <Pressable onPress={() => router.dismiss()} style={sty.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.headerText} />
        </Pressable>
        <Text style={sty.headerTitle} numberOfLines={1}>{name}</Text>
        <Pressable onPress={() => setShowMenu(true)} style={sty.backBtn}>
          <Ionicons name="ellipsis-vertical" size={24} color={colors.headerText} />
        </Pressable>
      </View>

      <DragList
        data={chords}
        keyExtractor={item => item.id}
        contentContainerStyle={{ padding: 14 }}
        onReordered={onReordered}
        ListEmptyComponent={
          <View style={sty.emptyWrap}>
            <Ionicons name="musical-notes-outline" size={60} color={colors.border} />
            <Text style={sty.emptyText}>Nenhuma cifra nesta playlist.</Text>
          </View>
        }
        ListFooterComponent={
          <TouchableOpacity style={sty.addChordBtn} onPress={() => setShowAddChord(true)} activeOpacity={0.7}>
            <Ionicons name="add-circle" size={24} color={colors.accent} />
            <Text style={[sty.addChordTxt, { color: colors.accent }]}>Adicionar Cifra do Acervo</Text>
          </TouchableOpacity>
        }
        renderItem={renderItem}
      />

      <Modal visible={showMenu} transparent animationType="fade">
        <Pressable style={sty.modalBackdrop} onPress={() => setShowMenu(false)}>
          <View style={sty.menuCard}>
            <TouchableOpacity style={sty.menuItem} onPress={() => { setShowMenu(false); setRenameInput(name); setShowRename(true); }}>
              <Ionicons name="pencil-outline" size={20} color={colors.text} />
              <Text style={sty.menuTxt}>Renomear Playlist</Text>
            </TouchableOpacity>
            <View style={sty.menuDiv} />
            <TouchableOpacity style={sty.menuItem} onPress={confirmDelete}>
              <Ionicons name="trash-outline" size={20} color={colors.danger} />
              <Text style={[sty.menuTxt, { color: colors.danger }]}>Excluir Playlist</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      <Modal visible={showRename} transparent animationType="fade">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={sty.modalOverlay}>
          <View style={sty.modalBox}>
            <Text style={sty.modalTitle}>Renomear Playlist</Text>
            <TextInput
              style={sty.input}
              placeholder="Novo nome"
              placeholderTextColor={colors.placeholder}
              value={renameInput}
              onChangeText={setRenameInput}
              autoFocus
            />
            <View style={sty.modalBtns}>
              <TouchableOpacity style={sty.cancelBtn} onPress={() => { setShowRename(false); setRenameInput(''); }}>
                <Text style={{ color: colors.textSub }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[sty.saveBtn, { opacity: renameInput.trim() ? 1 : 0.5 }]}
                onPress={handleRename}
                disabled={!renameInput.trim()}
              >
                <Text style={{ color: '#ffffff', fontWeight: '700' }}>Salvar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={showAddChord} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={sty.fullModalOverlay}>
          <View style={sty.fullModalBox}>
            <View style={sty.fullModalHeader}>
              <Text style={sty.modalTitle}>Adicionar ao Repertório</Text>
              <Pressable onPress={() => setShowAddChord(false)}><Ionicons name="close" size={28} color={colors.text}/></Pressable>
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
              <Ionicons name="add" size={20} color="#fff" style={{marginRight: 8}} />
              <Text style={{color: '#fff', fontWeight: 'bold'}}>Criar Nova Cifra</Text>
            </TouchableOpacity>
            <FlatList
              data={filteredChords}
              keyExtractor={c => c.id}
              renderItem={({item}) => (
                <TouchableOpacity style={sty.chordResult} onPress={() => handleAddChord(item.id)}>
                  <Ionicons name="musical-notes" size={20} color={colors.accent} style={{ marginRight: 12 }} />
                  <View style={{flex: 1}}>
                    <Text style={sty.songName}>{item.name}</Text>
                    <Text style={sty.songSub}>{item.artist}</Text>
                  </View>
                  <Ionicons name="add" size={24} color={colors.accent} />
                </TouchableOpacity>
              )}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={orderModal.visible} transparent animationType="fade">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={sty.modalOverlay}>
          <View style={[sty.modalBox, { alignItems: 'center' }]}>
            <Text style={sty.modalTitle}>Mudar Posição</Text>
            <Text style={{ color: colors.textSub, marginBottom: 12, textAlign: 'center' }}>Digite a nova posição desta música na playlist:</Text>
            <TextInput
              style={[sty.input, { width: 100, textAlign: 'center', fontSize: 24, fontWeight: '700' }]}
              keyboardType="number-pad"
              value={orderModal.currentPos}
              onChangeText={t => setOrderModal(prev => ({ ...prev, currentPos: t }))}
              autoFocus
            />
            <View style={[sty.modalBtns, { width: '100%', marginTop: 24 }]}>
              <TouchableOpacity style={sty.cancelBtn} onPress={() => setOrderModal({ visible: false, chordId: '', currentPos: '1' })}>
                <Text style={{ color: colors.textSub }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={sty.saveBtn} onPress={handleReorderSave}>
                <Text style={{ color: '#ffffff', fontWeight: '700' }}>Confirmar</Text>
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
      flexDirection: 'row', alignItems: 'center', backgroundColor: c.header,
      paddingHorizontal: 12, paddingVertical: 12,
    },
    backBtn: { width: 40, padding: 4 },
    headerTitle: {
      flex: 1, fontSize: 18, fontWeight: '700', color: c.text,
      textAlign: 'center', marginHorizontal: 8,
    },
    itemWrap: { marginBottom: 8 },
    item: {
      flexDirection: 'row', alignItems: 'center', backgroundColor: c.card,
      borderRadius: 10, padding: 14, borderWidth: 1,
      borderColor: c.border, gap: 10,
    },
    dragHandle: {
      paddingHorizontal: 4,
      paddingVertical: 8,
      justifyContent: 'center',
      alignItems: 'center',
    },
    itemActive: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 6,
      elevation: 8,
      zIndex: 99,
    },
    itemDragging: {
      borderColor: c.accent,
      backgroundColor: c.input,
      opacity: 0.9,
    },
    numBadge: {
      width: 32, height: 32, borderRadius: 16, backgroundColor: c.input,
      alignItems: 'center', justifyContent: 'center',
    },
    numText: { fontSize: 13, fontWeight: '700', color: c.text },
    itemMoment: { fontSize: 10, fontWeight: '700', color: c.accent, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 2 },
    itemName: { fontSize: 15, fontWeight: '600', color: c.text },
    itemSub: { fontSize: 12, color: c.textSub, marginTop: 2 },
    itemTone: { fontSize: 13, fontWeight: '600', marginRight: 4 },
    emptyWrap: { padding: 48, alignItems: 'center', gap: 12 },
    emptyText: { color: c.textSub, fontSize: 14, textAlign: 'center' },
    modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 24 },
    menuCard: { backgroundColor: c.card, borderRadius: 12, padding: 8, width: 220, borderWidth: 1, borderColor: c.border },
    menuItem: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
    menuTxt: { fontSize: 15, fontFamily: 'Inter_500Medium', color: c.text },
    menuDiv: { height: 1, backgroundColor: c.border, marginHorizontal: 8 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalBox: { backgroundColor: c.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, gap: 16 },
    modalTitle: { fontSize: 18, fontWeight: '700', color: c.text, marginBottom: 4 },
    input: { backgroundColor: c.input, borderRadius: 10, padding: 12, fontSize: 15, color: c.text, borderWidth: 1, borderColor: c.border },
    modalBtns: { flexDirection: 'row', gap: 12, marginTop: 4 },
    cancelBtn: { flex: 1, padding: 14, borderRadius: 10, borderWidth: 1, borderColor: c.border, alignItems: 'center' },
    saveBtn: { flex: 1, padding: 14, borderRadius: 10, backgroundColor: c.accent, alignItems: 'center' },
    
    addChordBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16, backgroundColor: c.card, borderRadius: 10, borderWidth: 1, borderColor: c.border, marginTop: 10 },
    addChordTxt: { fontSize: 15, fontWeight: '700' },
    fullModalOverlay: { flex: 1, backgroundColor: c.bg, paddingTop: 40 },
    fullModalBox: { flex: 1, backgroundColor: c.bg, padding: 16 },
    fullModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    searchRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: c.input, borderRadius: 28, borderWidth: 1, borderColor: c.border, marginBottom: 16 },
    searchInput: { flex: 1, fontSize: 15, color: c.text },
    createNewBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 14, backgroundColor: c.accent, borderRadius: 10, marginBottom: 16 },
    chordResult: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.card, borderRadius: 10, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: c.border },
    songName: { fontSize: 15, fontWeight: '600', color: c.text },
    songSub: { fontSize: 12, color: c.textSub, marginTop: 2 },
  });
}
