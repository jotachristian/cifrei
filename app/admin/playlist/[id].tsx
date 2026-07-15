import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Pressable, TextInput, Alert, Modal,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import {
  getPlaylist, getChordsForPlaylist, updatePlaylist,
  deleteChord, Chord, Playlist,
} from '@/lib/database';

export default function PlaylistAdminScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const router = useRouter();

  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [chords, setChords] = useState<Chord[]>([]);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [showEdit, setShowEdit] = useState(false);

  useFocusEffect(useCallback(() => { reload(); }, [id]));

  function reload() {
    const p = getPlaylist(id);
    setPlaylist(p);
    setEditName(p?.name ?? '');
    setEditDesc(p?.description ?? '');
    setChords(getChordsForPlaylist(id));
  }

  function handleSave() {
    if (!editName.trim()) return;
    updatePlaylist(id, editName.trim(), editDesc.trim());
    setShowEdit(false);
    reload();
  }

  function handleDelete(c: Chord) {
    Alert.alert('Excluir cifra', `Excluir "${c.name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: () => { deleteChord(c.id); reload(); } },
    ]);
  }

  const sty = makeStyles(colors);

  return (
    <SafeAreaView style={sty.container}>
      <View style={sty.header}>
        <Pressable onPress={() => router.dismiss()} style={sty.iconBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.headerText} />
        </Pressable>
        <TouchableOpacity style={{ flex: 1 }} onPress={() => setShowEdit(true)}>
          <Text style={sty.headerTitle} numberOfLines={1}>{playlist?.name ?? 'Playlist'}</Text>
        </TouchableOpacity>
        <Pressable
          style={sty.iconBtn}
          onPress={() => router.push({ pathname: '/admin/chord/[id]', params: { id: 'new', playlistId: id } })}
        >
          <Ionicons name="add" size={28} color={colors.headerText} />
        </Pressable>
      </View>

      {playlist?.description ? (
        <Text style={sty.desc}>{playlist.description}</Text>
      ) : null}

      <FlatList
        data={chords}
        keyExtractor={c => c.id}
        contentContainerStyle={{ padding: 14 }}
        ListEmptyComponent={
          <View style={sty.emptyWrap}>
            <Ionicons name="musical-notes-outline" size={60} color={colors.border} />
            <Text style={sty.emptyText}>Nenhuma cifra. Toque em + para adicionar.</Text>
          </View>
        }
        renderItem={({ item, index }) => (
          <View style={sty.item}>
            <View style={sty.numBadge}>
              <Text style={sty.numTxt}>{index + 1}</Text>
            </View>
            <TouchableOpacity
              style={{ flex: 1 }}
              onPress={() => router.push({ pathname: '/admin/chord/[id]', params: { id: item.id, playlistId: id } })}
            >
              <Text style={sty.itemName} numberOfLines={1}>{item.name}</Text>
              <Text style={sty.itemSub}>{item.artist} - Tom: {item.tone}</Text>
            </TouchableOpacity>
            <Pressable onPress={() => handleDelete(item)} style={sty.delBtn}>
              <Ionicons name="trash-outline" size={20} color={colors.danger} />
            </Pressable>
          </View>
        )}
      />

      <Modal visible={showEdit} transparent animationType="slide">
        <View style={sty.modalOverlay}>
          <View style={sty.modalBox}>
            <Text style={sty.modalTitle}>Editar Playlist</Text>
            <TextInput style={sty.input} placeholder="Nome *" placeholderTextColor={colors.placeholder}
              value={editName} onChangeText={setEditName} autoFocus />
            <TextInput style={sty.input} placeholder="Descricao (opcional)" placeholderTextColor={colors.placeholder}
              value={editDesc} onChangeText={setEditDesc} />
            <View style={sty.modalBtns}>
              <TouchableOpacity style={sty.cancelBtn} onPress={() => setShowEdit(false)}>
                <Text style={{ color: colors.textSub }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[sty.saveBtn, { opacity: editName.trim() ? 1 : 0.5 }]} onPress={handleSave}>
                <Text style={{ color: '#ffffff', fontWeight: '700' }}>Salvar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function makeStyles(c: any) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    header: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.header, paddingHorizontal: 12, paddingVertical: 12 },
    iconBtn: { width: 40, padding: 4, alignItems: 'center' },
    headerTitle: { fontSize: 18, fontWeight: '700', color: c.text, textAlign: 'center' },
    desc: { fontSize: 13, color: c.textSub, paddingHorizontal: 16, paddingVertical: 6, borderBottomWidth: 1, borderColor: c.border },
    item: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.card, borderRadius: 10, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: c.border, gap: 10 },
    numBadge: { width: 30, height: 30, borderRadius: 15, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' },
    numTxt: { color: '#ffffff', fontSize: 12, fontWeight: '700' },
    itemName: { fontSize: 15, fontWeight: '600', color: c.text },
    itemSub: { fontSize: 12, color: c.textSub, marginTop: 2 },
    delBtn: { padding: 6 },
    emptyWrap: { padding: 48, alignItems: 'center', gap: 12 },
    emptyText: { color: c.textSub, fontSize: 14, textAlign: 'center' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalBox: { backgroundColor: c.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, gap: 12 },
    modalTitle: { fontSize: 18, fontWeight: '700', color: c.text, marginBottom: 4 },
    input: { backgroundColor: c.input, borderRadius: 10, padding: 12, fontSize: 15, color: c.text, borderWidth: 1, borderColor: c.border },
    modalBtns: { flexDirection: 'row', gap: 12, marginTop: 4 },
    cancelBtn: { flex: 1, padding: 14, borderRadius: 10, borderWidth: 1, borderColor: c.border, alignItems: 'center' },
    saveBtn: { flex: 1, padding: 14, borderRadius: 10, backgroundColor: c.accent, alignItems: 'center' },
  });
}
