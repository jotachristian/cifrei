import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Pressable, TextInput, Alert, Modal, ActivityIndicator,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  cacheDirectory, writeAsStringAsync, readAsStringAsync, EncodingType,
} from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { useTheme } from '@/contexts/ThemeContext';
import { getPlaylists, createPlaylist, deletePlaylist, Playlist } from '@/lib/database';
import { exportAllData, importData, BackupData } from '@/lib/backup';

export default function AdminScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [loading, setLoading] = useState(false);

  useFocusEffect(useCallback(() => { reload(); }, []));
  const reload = () => setPlaylists(getPlaylists());

  function handleAdd() {
    if (!name.trim()) return;
    createPlaylist(name.trim(), desc.trim());
    setName(''); setDesc(''); setShowAdd(false); reload();
  }

  function handleDelete(p: Playlist) {
    Alert.alert('Excluir playlist', 'Isso tambem exclui todas as cifras dela. Continuar?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: () => { deletePlaylist(p.id); reload(); } },
    ]);
  }

  async function handleExport() {
    try {
      setLoading(true);
      const data = exportAllData();
      const json = JSON.stringify(data, null, 2);
      const date = new Date().toISOString().split('T')[0];
      const filename = 'cifrei-backup-' + date + '.json';
      const uri = (cacheDirectory ?? '') + filename;
      await writeAsStringAsync(uri, json, { encoding: EncodingType.UTF8 });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, { mimeType: 'application/json', dialogTitle: 'Salvar backup do Cifrei' });
      } else {
        Alert.alert('Backup exportado!', 'Arquivo: ' + uri);
      }
    } catch (e) {
      Alert.alert('Erro ao exportar', String(e));
    } finally {
      setLoading(false);
    }
  }

  async function handleImport() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;

      setLoading(true);
      const uri = result.assets[0].uri;
      const raw = await readAsStringAsync(uri, { encoding: EncodingType.UTF8 });
      let data: BackupData;
      try { data = JSON.parse(raw); }
      catch { Alert.alert('Erro', 'Arquivo invalido. Use um backup .json do Cifrei.'); return; }

      if (!data.playlists || !data.chords) {
        Alert.alert('Erro', 'Formato de backup invalido.'); return;
      }

      const pCount = data.playlists.length;
      const cCount = data.chords.length;

      Alert.alert(
        'Importar backup',
        pCount + ' playlists e ' + cCount + ' cifras encontradas.\n\nO que deseja fazer?',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Adicionar ao existente',
            onPress: () => {
              const { added } = importData(data, 'merge');
              Alert.alert('Importado!', added.playlists + ' playlists e ' + added.chords + ' cifras adicionadas.');
              reload();
            },
          },
          {
            text: 'Substituir tudo',
            style: 'destructive',
            onPress: () => {
              const { added } = importData(data, 'replace');
              Alert.alert('Importado!', added.playlists + ' playlists e ' + added.chords + ' cifras importadas.');
              reload();
            },
          },
        ]
      );
    } catch (e) {
      Alert.alert('Erro ao importar', String(e));
    } finally {
      setLoading(false);
    }
  }

  const sty = makeStyles(colors);

  return (
    <SafeAreaView style={sty.container}>
      <View style={sty.header}>
        <Pressable onPress={() => router.dismiss()} style={sty.iconBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.headerText} />
        </Pressable>
        <Text style={sty.headerTitle}>Admin</Text>
        <Pressable onPress={() => setShowAdd(true)} style={sty.iconBtn}>
          <Ionicons name="add" size={28} color={colors.headerText} />
        </Pressable>
      </View>

      <View style={sty.backupRow}>
        <Text style={sty.backupLabel}>Backup das cifras</Text>
        <View style={sty.backupBtns}>
          <TouchableOpacity style={sty.backupBtn} onPress={handleExport} disabled={loading}>
            <Ionicons name="cloud-upload-outline" size={18} color={colors.headerText} />
            <Text style={sty.backupBtnTxt}>Exportar JSON</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[sty.backupBtn, sty.backupBtnOutline]} onPress={handleImport} disabled={loading}>
            <Ionicons name="cloud-download-outline" size={18} color={colors.accent} />
            <Text style={[sty.backupBtnTxt, { color: colors.accent }]}>Importar JSON</Text>
          </TouchableOpacity>
        </View>
        {loading && <ActivityIndicator size="small" color={colors.accent} style={{ marginTop: 4 }} />}
        <Text style={sty.backupHint}>
          Exporte para salvar no Google Drive, email ou WhatsApp. Importe para restaurar.
        </Text>
      </View>

      <FlatList
        data={playlists}
        keyExtractor={p => p.id}
        contentContainerStyle={{ padding: 14 }}
        ListHeaderComponent={<Text style={sty.sectionTitle}>Playlists</Text>}
        ListEmptyComponent={
          <View style={sty.emptyWrap}>
            <Ionicons name="folder-open-outline" size={60} color={colors.border} />
            <Text style={sty.emptyText}>Nenhuma playlist. Toque em + para adicionar.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={sty.item}
            onPress={() => router.push({ pathname: '/admin/playlist/[id]', params: { id: item.id } })}
            activeOpacity={0.7}
          >
            <Ionicons name="musical-note" size={22} color={colors.accent} />
            <View style={{ flex: 1 }}>
              <Text style={sty.itemName}>{item.name}</Text>
              {item.description ? <Text style={sty.itemDesc}>{item.description}</Text> : null}
            </View>
            <Pressable onPress={() => handleDelete(item)} style={sty.delBtn}>
              <Ionicons name="trash-outline" size={20} color={colors.danger} />
            </Pressable>
            <Ionicons name="chevron-forward" size={18} color={colors.border} />
          </TouchableOpacity>
        )}
      />

      <Modal visible={showAdd} transparent animationType="slide">
        <View style={sty.modalOverlay}>
          <View style={sty.modalBox}>
            <Text style={sty.modalTitle}>Nova Playlist</Text>
            <TextInput style={sty.input} placeholder="Nome da playlist *"
              placeholderTextColor={colors.placeholder} value={name} onChangeText={setName} autoFocus />
            <TextInput style={sty.input} placeholder="Descricao (opcional)"
              placeholderTextColor={colors.placeholder} value={desc} onChangeText={setDesc} />
            <View style={sty.modalBtns}>
              <TouchableOpacity style={sty.cancelBtn} onPress={() => { setShowAdd(false); setName(''); setDesc(''); }}>
                <Text style={{ color: colors.textSub }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[sty.saveBtn, { opacity: name.trim() ? 1 : 0.5 }]} onPress={handleAdd}>
                <Text style={{ color: '#0e0e0f', fontWeight: '700' }}>Salvar</Text>
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
    headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: c.headerText, textAlign: 'center' },
    backupRow: { backgroundColor: c.card, margin: 12, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: c.border, gap: 10 },
    backupLabel: { fontSize: 13, fontWeight: '700', color: c.text },
    backupBtns: { flexDirection: 'row', gap: 10 },
    backupBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: c.accent, borderRadius: 10, paddingVertical: 10 },
    backupBtnOutline: { backgroundColor: c.input, borderWidth: 1, borderColor: c.accent },
    backupBtnTxt: { fontSize: 13, fontWeight: '700', color: '#0e0e0f' },
    backupHint: { fontSize: 11, color: c.textSub, lineHeight: 16 },
    sectionTitle: { fontSize: 12, fontWeight: '700', color: c.text, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
    item: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.card, borderRadius: 10, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: c.border, gap: 10 },
    itemName: { fontSize: 15, fontWeight: '600', color: c.text },
    itemDesc: { fontSize: 12, color: c.textSub, marginTop: 2 },
    delBtn: { padding: 6 },
    emptyWrap: { padding: 48, alignItems: 'center', gap: 12 },
    emptyText: { color: c.text, fontSize: 14, textAlign: 'center' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalBox: { backgroundColor: c.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, gap: 12 },
    modalTitle: { fontSize: 18, fontWeight: '700', color: c.text, marginBottom: 4 },
    input: { backgroundColor: c.input, borderRadius: 10, padding: 12, fontSize: 15, color: c.text, borderWidth: 1, borderColor: c.border },
    modalBtns: { flexDirection: 'row', gap: 12, marginTop: 4 },
    cancelBtn: { flex: 1, padding: 14, borderRadius: 10, borderWidth: 1, borderColor: c.border, alignItems: 'center' },
    saveBtn: { flex: 1, padding: 14, borderRadius: 10, backgroundColor: c.accent, alignItems: 'center' },
  });
}
