import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, FlatList, Modal,
  TouchableOpacity, StyleSheet, Pressable, Image, KeyboardAvoidingView, Platform, useWindowDimensions
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { createPlaylist, Playlist, addDatabaseListener, getPlaylists } from '@/lib/database';
import { PlaylistCover } from '@/components/PlaylistCover';
import { AppBackground } from '@/components/AppBackground';

export default function PlaylistsScreen() {
  const { colors, isDark, toggleTheme } = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();

  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');

  const effectiveWidth = Math.min(width, 600);
  const coverSize = Math.max(120, Math.floor((effectiveWidth - 60) / 2));

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

  const sty = makeStyles(colors, coverSize);

  return (
    <SafeAreaView style={sty.container} edges={['top']}>
      <AppBackground />
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
        key="playlists-grid"
        data={playlists}
        keyExtractor={item => item.id}
        numColumns={2}
        columnWrapperStyle={sty.gridRow}
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 20, maxWidth: 600, width: '100%', alignSelf: 'center' }}
        ListEmptyComponent={
          <View style={sty.emptyWrap}>
            <Image source={require('@/assets/playlist-none.png')} style={sty.emptyStateImage} resizeMode="contain" />
            <Text style={sty.emptyText}>Sua Biblioteca está vazia</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={sty.gridCard}
            onPress={() => router.push({ pathname: '/playlist/[id]', params: { id: item.id } })}
            activeOpacity={0.75}
          >
            <PlaylistCover
              playlistId={item.id}
              size={coverSize}
              borderRadius={14}
              fallback={
                <View style={sty.coverFallback}>
                  <Ionicons name="albums" size={36} color="#ffffff" />
                </View>
              }
            />
            <Text style={sty.playlistName} numberOfLines={2}>{item.name}</Text>
            {item.description ? (
              <Text style={sty.playlistDesc} numberOfLines={2}>{item.description}</Text>
            ) : null}
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

function makeStyles(c: any, coverSize: number) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 16, paddingVertical: 14,
      maxWidth: 600, width: '100%', alignSelf: 'center',
    },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    brandRow: { flexDirection: 'row', alignItems: 'center' },
    brandImage: { width: 160, height: 50 },
    iconBtn: { padding: 4 },
    gridRow: {
      justifyContent: 'space-around',
      gap: 12,
      marginBottom: 12,
    },
    gridCard: {
      width: coverSize,
      marginBottom: 16,
      alignItems: 'center',
    },
    coverFallback: {
      width: coverSize,
      height: coverSize,
      borderRadius: 14,
      backgroundColor: c.card,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: c.border,
    },
    playlistName: { fontSize: 14, fontWeight: '600', color: c.text, marginTop: 8, textAlign: 'center' },
    playlistDesc: { fontSize: 12, color: c.textSub, marginTop: 3, textAlign: 'center' },
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
