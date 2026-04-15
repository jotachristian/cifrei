import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, Pressable, Alert, useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { getChord, createChord, updateChord, getPlaylists, Playlist } from '@/lib/database';
import { ALL_TONES } from '@/lib/transpose';

export default function ChordFormScreen() {
  const { id, playlistId } = useLocalSearchParams<{ id: string; playlistId?: string }>();
  const isNew = id === 'new';
  const { colors } = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();

  const [name, setName] = useState('');
  const [artist, setArtist] = useState('');
  const [tone, setTone] = useState('C');
  const [lyrics, setLyrics] = useState('');
  const [link, setLink] = useState('');
  const [sortOrder, setSortOrder] = useState('0');
  const [selPlaylist, setSelPlaylist] = useState(playlistId ?? '');
  const [playlists, setPlaylists] = useState<Playlist[]>([]);

  useEffect(() => {
    setPlaylists(getPlaylists());
    if (!isNew) {
      const c = getChord(id);
      if (c) {
        setName(c.name); setArtist(c.artist); setTone(c.tone);
        setLyrics(c.lyrics); setLink(c.external_link);
        setSelPlaylist(c.playlist_id);
        setSortOrder(String(c.sort_order));
      }
    }
  }, [id]);

  function handleSave() {
    if (!name.trim()) { Alert.alert('Erro', 'Nome obrigatorio'); return; }
    if (!selPlaylist) { Alert.alert('Erro', 'Selecione uma playlist'); return; }
    const order = parseInt(sortOrder) || 0;
    if (isNew) {
      createChord({ name: name.trim(), artist: artist.trim(), tone, lyrics, playlistId: selPlaylist, externalLink: link });
    } else {
      updateChord(id, { name: name.trim(), artist: artist.trim(), tone, lyrics, playlistId: selPlaylist, externalLink: link, sortOrder: order });
    }
    router.dismiss();
  }

  const sty = makeStyles(colors);

  return (
    <SafeAreaView style={sty.container}>
      <View style={sty.header}>
        <Pressable onPress={() => router.dismiss()} style={sty.iconBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.headerText} />
        </Pressable>
        <Text style={sty.headerTitle}>{isNew ? 'Nova Cifra' : 'Editar Cifra'}</Text>
        <TouchableOpacity style={sty.saveHeaderBtn} onPress={handleSave}>
          <Text style={sty.saveHeaderTxt}>Salvar</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={sty.form}>
        <Text style={sty.label}>Nome da musica *</Text>
        <TextInput style={sty.input} value={name} onChangeText={setName}
          placeholder="Ex: Oceans" placeholderTextColor={colors.placeholder} />

        <Text style={sty.label}>Artista</Text>
        <TextInput style={sty.input} value={artist} onChangeText={setArtist}
          placeholder="Ex: Hillsong" placeholderTextColor={colors.placeholder} />

        <Text style={sty.label}>Tom *</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={sty.toneScroll}>
          {ALL_TONES.map(t => (
            <TouchableOpacity
              key={t}
              style={[sty.toneChip, t === tone && sty.toneChipActive]}
              onPress={() => setTone(t)}
            >
              <Text style={[sty.toneText, t === tone && sty.toneTextActive]}>{t}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={sty.label}>Playlist *</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={sty.toneScroll}>
          {playlists.map(p => (
            <TouchableOpacity
              key={p.id}
              style={[sty.toneChip, p.id === selPlaylist && sty.toneChipActive]}
              onPress={() => setSelPlaylist(p.id)}
            >
              <Text style={[sty.toneText, p.id === selPlaylist && sty.toneTextActive]} numberOfLines={1}>{p.name}</Text>
            </TouchableOpacity>
          ))}
          {playlists.length === 0 && <Text style={{ color: colors.textSub, fontSize: 13, padding: 8 }}>Crie uma playlist primeiro</Text>}
        </ScrollView>

        <Text style={sty.label}>Posição na playlist</Text>
        <TextInput
          style={sty.input}
          value={sortOrder}
          onChangeText={v => setSortOrder(v.replace(/[^0-9]/g, ''))}
          placeholder="0"
          placeholderTextColor={colors.placeholder}
          keyboardType="number-pad"
        />

        <Text style={sty.label}>Letra e Cifras</Text>
        <Text style={sty.hint}>
          {'Linha de acordes: escreva os acordes separados por espaços, alinhados acima da sílaba.\nLinha de letra: escreva normalmente abaixo.\nSeções: use [Intro], [Refrão], [Estrofe].\n\nExemplo:\n[Intro]\nAm         G\nAqui está a letra\n\nC      G      Am\nOutra linha da música'}
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator
          style={sty.lyricsScroll}
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
        >
          <TextInput
            style={[sty.lyricsInput, { minWidth: width * 2.5 }]}
            value={lyrics}
            onChangeText={setLyrics}
            placeholder={'[Intro]\nAm         G\nAqui está a letra\n\nC      G      Am\nOutra linha da música'}
            placeholderTextColor={colors.placeholder}
            multiline
            scrollEnabled={false}
            textAlignVertical="top"
          />
        </ScrollView>

        <Text style={sty.label}>Link externo (opcional)</Text>
        <TextInput style={sty.input} value={link} onChangeText={setLink}
          placeholder="https://..." placeholderTextColor={colors.placeholder}
          autoCapitalize="none" keyboardType="url" />

        <TouchableOpacity style={sty.saveBtn} onPress={handleSave}>
          <Ionicons name="checkmark-circle" size={20} color="#0e0e0f" />
          <Text style={sty.saveBtnTxt}>Salvar Cifra</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(c: any) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    header: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.header, paddingHorizontal: 12, paddingVertical: 12 },
    iconBtn: { width: 40, padding: 4, alignItems: 'center' },
    headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: c.headerText, textAlign: 'center' },
    saveHeaderBtn: { paddingHorizontal: 10, paddingVertical: 6, backgroundColor: c.accent, borderRadius: 8 },
    saveHeaderTxt: { color: '#0e0e0f', fontWeight: '700', fontSize: 13 },
    form: { padding: 16, gap: 6, paddingBottom: 48 },
    label: { fontSize: 12, fontWeight: '600', color: c.textSub, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 8 },
    hint: { fontSize: 11, color: c.placeholder, marginBottom: 4 },
    input: { backgroundColor: c.input, borderRadius: 10, padding: 12, fontSize: 15, color: c.text, borderWidth: 1, borderColor: c.border },
    toneScroll: { marginVertical: 4 },
    toneChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: c.border, marginRight: 8, backgroundColor: c.card },
    toneChipActive: { backgroundColor: c.accent, borderColor: c.accent },
    toneText: { fontSize: 14, color: c.text, fontWeight: '500' },
    toneTextActive: { color: '#0e0e0f', fontWeight: '700' },
    lyricsScroll: {
      borderRadius: 10, borderWidth: 1, borderColor: c.border,
      backgroundColor: c.input, minHeight: 300,
    },
    lyricsInput: {
      padding: 12, fontSize: 14, color: c.text,
      fontFamily: 'monospace', minHeight: 300,
    },
    saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: c.accent, borderRadius: 12, padding: 16, marginTop: 16 },
    saveBtnTxt: { color: '#0e0e0f', fontSize: 16, fontWeight: '700' },
  });
}
