import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, FlatList, Modal,
  TouchableOpacity, StyleSheet, Pressable, Image, KeyboardAvoidingView, Platform
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { getPlaylists, searchChords, getTotalCount, createPlaylist, Playlist, ChordWithPlaylist, addDatabaseListener } from '@/lib/database';

export default function HomeScreen() {
  const { colors } = useTheme();
  const router = useRouter();

  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');

  useFocusEffect(
    useCallback(() => {
      const reload = () => {
        setPlaylists(getPlaylists());
      };
      reload();
      const unsub = addDatabaseListener(reload);
      return unsub;
    }, [])
  );

  function handleAddPlaylist() {
    if (newPlaylistName.trim().length > 0) {
      createPlaylist(newPlaylistName.trim(), '');
      setNewPlaylistName('');
      setShowAdd(false);
      // addDatabaseListener automatically refreshes the list
    }
  }

  const sty = makeStyles(colors);

  return (
    <SafeAreaView style={sty.container} edges={['top']}>
      <View style={sty.header}>
        <View style={sty.brandRow}>
          <Image source={require('@/assets/logo-name.png')} style={sty.brandImage} resizeMode="contain" />
        </View>
        <View style={sty.headerActions}>
          <Pressable onPress={() => setShowAdd(true)} style={sty.iconBtn}>
            <Ionicons name="add" size={32} color={colors.text} />
          </Pressable>
          <Pressable onPress={() => {/* Settings future */}} style={sty.iconBtn}>
            <Image source={require('@/assets/settings.png')} style={sty.settingsIcon} resizeMode="contain" />
          </Pressable>
        </View>
      </View>

      <FlatList
        key="playlists"
        data={playlists}
        keyExtractor={item => item.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 32 }}
        ListEmptyComponent={
          <View style={sty.emptyWrap}>
            <Image source={require('@/assets/playlist-none.png')} style={sty.emptyStateImage} resizeMode="contain" />
            <Text style={sty.emptyText}>Sua Biblioteca está vazia</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={sty.playlistRow}
            onPress={() => router.push({ pathname: '/playlist/[id]', params: { id: item.id } })}
            activeOpacity={0.7}
          >
            <View style={sty.playlistThumb}>
              <Ionicons name="albums" size={22} color="#ffffff" />
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

      <Modal visible={showAdd} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={sty.modalOverlay}>
          <View style={sty.modalBox}>
            <Text style={sty.modalTitle}>Nova Playlist</Text>
            <TextInput
              style={sty.input}
              placeholder="Nome da playlist"
              placeholderTextColor={colors.placeholder}
              value={newPlaylistName}
              onChangeText={setNewPlaylistName}
              autoFocus
            />
            <View style={sty.modalBtns}>
              <TouchableOpacity style={sty.cancelBtn} onPress={() => { setShowAdd(false); setNewPlaylistName(''); }}>
                <Text style={{ color: colors.textSub }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[sty.saveBtn, { opacity: newPlaylistName.trim() ? 1 : 0.5 }]}
                onPress={handleAddPlaylist}
                disabled={!newPlaylistName.trim()}
              >
                <Text style={{ color: '#ffffff', fontWeight: '700' }}>Criar</Text>
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
      backgroundColor: 'transparent', paddingHorizontal: 16, paddingVertical: 14,
    },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    brandRow: { flexDirection: 'row', alignItems: 'center' },
    brandImage: { width: 160, height: 50 },
    settingsIcon: { width: 28, height: 28, tintColor: c.text },
    iconBtn: { padding: 4 },
    playlistRow: {
      flexDirection: 'row', alignItems: 'center', gap: 14,
      backgroundColor: c.card, borderRadius: 14, padding: 12,
      marginBottom: 10, borderWidth: 1, borderColor: c.border,
    },
    playlistThumb: {
      width: 48, height: 48, borderRadius: 12,
      backgroundColor: c.danger,
      alignItems: 'center', justifyContent: 'center',
    },
    playlistName: { fontSize: 15, fontWeight: '600', color: c.text },
    playlistDesc: { fontSize: 12, color: c.textSub, marginTop: 2 },
    emptyWrap: { padding: 48, alignItems: 'center', gap: 12 },
    emptyStateImage: { width: 160, height: 160, opacity: 0.9 },
    emptyText: { color: c.text, fontSize: 14, textAlign: 'center', lineHeight: 22 },
    footer: { paddingVertical: 10, alignItems: 'center', borderTopWidth: 1, borderColor: c.border },
    footerText: { fontSize: 12, color: c.text },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalBox: { backgroundColor: c.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, gap: 16 },
    modalTitle: { fontSize: 18, fontWeight: '700', color: c.text, marginBottom: 4 },
    input: { backgroundColor: c.input, borderRadius: 10, padding: 12, fontSize: 15, color: c.text, borderWidth: 1, borderColor: c.border },
    modalBtns: { flexDirection: 'row', gap: 12, marginTop: 4 },
    cancelBtn: { flex: 1, padding: 14, borderRadius: 10, borderWidth: 1, borderColor: c.border, alignItems: 'center' },
    saveBtn: { flex: 1, padding: 14, borderRadius: 10, backgroundColor: c.accent, alignItems: 'center' },
  });
}
