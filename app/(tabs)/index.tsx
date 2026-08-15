import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, FlatList, Modal,
  TouchableOpacity, StyleSheet, Pressable, Image, KeyboardAvoidingView, Platform
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { createPlaylist, Playlist, addDatabaseListener, getPlaylists } from '@/lib/database';

export default function PlaylistsScreen() {
  const { colors, isDark, toggleTheme } = useTheme();
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
      return () => unsub();
    }, [])
  );

  function handleAddPlaylist() {
    if (newPlaylistName.trim()) {
      const newId = createPlaylist(newPlaylistName.trim(), '');
      setNewPlaylistName('');
      setShowAdd(false);
      router.push({ pathname: '/playlist/[id]', params: { id: newId } });
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
          <Pressable onPress={toggleTheme} style={sty.iconBtn}>
            <Ionicons name={isDark ? "sunny-outline" : "moon-outline"} size={26} color={colors.text} />
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
              <Ionicons name="musical-notes" size={24} color="#ffffff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={sty.playlistName}>{item.name}</Text>
              {item.description ? (
                <Text style={sty.playlistDesc} numberOfLines={2}>{item.description}</Text>
              ) : null}
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.placeholder} />
          </TouchableOpacity>
        )}
      />

      <Modal visible={showAdd} transparent animationType="fade">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={sty.modalOverlay}>
          <View style={sty.modalCard}>
            <Text style={sty.modalTitle}>Criar Playlist</Text>
            
            <TextInput
              style={sty.input}
              placeholder="Nome da playlist"
              placeholderTextColor={colors.placeholder}
              value={newPlaylistName}
              onChangeText={setNewPlaylistName}
              maxLength={50}
              autoFocus
            />

            <Text style={sty.charCounter}>{newPlaylistName.length} / 50</Text>

            <View style={sty.modalBtns}>
              <TouchableOpacity 
                style={sty.cancelBtn} 
                onPress={() => { setShowAdd(false); setNewPlaylistName(''); }}
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
      backgroundColor: 'transparent', paddingHorizontal: 16, paddingVertical: 14,
    },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    brandRow: { flexDirection: 'row', alignItems: 'center' },
    brandImage: { width: 160, height: 50 },
    iconBtn: { padding: 4 },
    playlistRow: {
      flexDirection: 'row', alignItems: 'center', gap: 14,
      backgroundColor: c.card, borderRadius: 14, padding: 12,
      marginBottom: 10, borderWidth: 1, borderColor: c.border,
    },
    playlistThumb: {
      width: 48, height: 48, borderRadius: 12,
      backgroundColor: c.accent,
      alignItems: 'center', justifyContent: 'center',
    },
    playlistName: { fontSize: 16, fontWeight: '700', color: c.text },
    playlistDesc: { fontSize: 12, color: c.textSub, marginTop: 2 },
    emptyWrap: { padding: 48, alignItems: 'center', gap: 12 },
    emptyStateImage: { width: 160, height: 160, opacity: 0.9 },
    emptyText: { color: c.text, fontSize: 14, textAlign: 'center', lineHeight: 22 },
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
    modalTitle: { 
      fontSize: 22, 
      fontWeight: '800', 
      color: c.text, 
      marginBottom: 20,
      textAlign: 'center',
    },
    input: { 
      backgroundColor: c.input, 
      borderRadius: 14, 
      padding: 16, 
      fontSize: 16, 
      color: c.text, 
      borderWidth: 1, 
      borderColor: c.border,
    },
    charCounter: {
      fontSize: 13,
      color: c.textSub,
      textAlign: 'right',
      marginTop: 8,
      marginBottom: 20,
      fontWeight: '500',
    },
    modalBtns: { 
      flexDirection: 'row', 
      gap: 12, 
    },
    cancelBtn: { 
      flex: 1, 
      padding: 14, 
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
      fontSize: 15,
    },
    saveBtn: { 
      flex: 1, 
      padding: 14, 
      borderRadius: 12, 
      backgroundColor: c.accent, 
      alignItems: 'center',
      justifyContent: 'center',
    },
    saveBtnTxt: {
      color: '#ffffff',
      fontWeight: '700',
      fontSize: 15,
    },
  });
}
