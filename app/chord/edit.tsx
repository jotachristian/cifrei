import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { getChord, updateChord, Chord } from '@/lib/database';

export default function ChordEditScreen() {
  const { id, playlistId } = useLocalSearchParams<{ id: string; playlistId?: string }>();
  const { colors } = useTheme();
  const router = useRouter();

  const [step, setStep] = useState<1 | 2>(1);
  const [chord, setChord] = useState<Chord | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [artist, setArtist] = useState('');
  const [tone, setTone] = useState('');
  const [externalLink, setExternalLink] = useState('');
  const [note, setNote] = useState('');
  const [lyrics, setLyrics] = useState('');
  const [keyboardBank, setKeyboardBank] = useState('');
  const [keyboardSlot, setKeyboardSlot] = useState('');
  const [capo, setCapo] = useState('');

  useEffect(() => {
    const c = getChord(id);
    if (c) {
      setChord(c);
      setName(c.name);
      setArtist(c.artist);
      setTone(c.tone);
      setExternalLink(c.external_link);
      setNote(c.note);
      setLyrics(c.lyrics);
      setKeyboardBank(c.keyboard_bank ? String(c.keyboard_bank) : '');
      setKeyboardSlot(c.keyboard_slot ? String(c.keyboard_slot) : '');
      setCapo(c.capo !== undefined ? (c.capo > 0 ? `+${c.capo}` : String(c.capo)) : '');
    }
  }, [id]);

  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert('Erro', 'O título da música é obrigatório.');
      return;
    }

    const parsedBank = parseInt(keyboardBank, 10);
    const parsedSlot = parseInt(keyboardSlot, 10);
    const parsedCapo = parseInt(capo, 10);

    const updateData = {
      name: name.trim(),
      artist: artist.trim(),
      tone: tone.trim(),
      lyrics: lyrics,
      externalLink: externalLink.trim(),
      note: note.trim(),
      keyboard_bank: isNaN(parsedBank) ? undefined : parsedBank,
      keyboard_slot: isNaN(parsedSlot) ? undefined : parsedSlot,
      capo: isNaN(parsedCapo) ? undefined : parsedCapo
    };

    updateChord(id, updateData);
    router.back();
  };

  const handleBack = () => {
    if (step === 2) {
      setStep(1);
    } else {
      router.back();
    }
  };

  if (!chord) {
    const sty = makeStyles(colors);
    return (
      <SafeAreaView style={[sty.container, { backgroundColor: colors.bg }]}>
        <View style={sty.header}>
          <Pressable onPress={() => router.back()} style={sty.backBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={[sty.headerTitle, { color: colors.text }]}>Editar Cifra</Text>
        </View>
        <View style={sty.loadingWrap}>
          <Text style={{ color: colors.textSub }}>Carregando cifra...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const sty = makeStyles(colors);

  return (
    <SafeAreaView style={sty.container}>
      {/* Header */}
      <View style={sty.header}>
        <Pressable onPress={handleBack} style={sty.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={sty.headerTitle}>
          {step === 1 ? 'Passo 1: Detalhes' : 'Passo 2: Letra & Cifras'}
        </Text>
        {step === 1 ? (
          <TouchableOpacity onPress={() => setStep(2)} style={sty.nextHeaderBtn}>
            <Text style={{ color: colors.accent, fontWeight: '700' }}>Avançar</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.accent} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={handleSave} style={sty.nextHeaderBtn}>
            <Text style={{ color: colors.accent, fontWeight: '700' }}>Salvar</Text>
            <Ionicons name="checkmark" size={18} color={colors.accent} />
          </TouchableOpacity>
        )}
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        {step === 1 ? (
          /* STEP 1: Basic Info Form */
          <ScrollView contentContainerStyle={sty.scrollContent} keyboardShouldPersistTaps="handled">
            <View style={sty.section}>
              <Text style={sty.sectionTitle}>Identificação Geral</Text>
              
              <Text style={sty.inputLabel}>Título da Música *</Text>
              <TextInput
                style={sty.input}
                placeholder="Ex: Oceans"
                placeholderTextColor={colors.placeholder}
                value={name}
                onChangeText={setName}
              />

              <Text style={sty.inputLabel}>Artista / Banda</Text>
              <TextInput
                style={sty.input}
                placeholder="Ex: Hillsong United"
                placeholderTextColor={colors.placeholder}
                value={artist}
                onChangeText={setArtist}
              />

              <Text style={sty.inputLabel}>Link do Vídeo (YouTube)</Text>
              <TextInput
                style={sty.input}
                placeholder="Ex: https://youtube.com/..."
                placeholderTextColor={colors.placeholder}
                value={externalLink}
                onChangeText={setExternalLink}
                autoCapitalize="none"
                keyboardType="url"
              />
            </View>

            <View style={sty.section}>
              <Text style={sty.sectionTitle}>Configurações de Tom & Execução</Text>
              
              <Text style={sty.inputLabel}>Tom Original</Text>
              <TextInput
                style={sty.input}
                placeholder="Ex: G, C#m, F"
                placeholderTextColor={colors.placeholder}
                value={tone}
                onChangeText={setTone}
              />

              <Text style={sty.inputLabel}>Capotraste / Transpose do Teclado (ex: -2, +4)</Text>
              <TextInput
                style={sty.input}
                placeholder="Ex: +2 ou -1"
                placeholderTextColor={colors.placeholder}
                value={capo}
                onChangeText={setCapo}
                keyboardType="numbers-and-punctuation"
              />
            </View>

            <View style={sty.section}>
              <Text style={sty.sectionTitle}>Timbre do Teclado</Text>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={sty.inputLabel}>Banco (1-8)</Text>
                  <TextInput
                    style={sty.input}
                    placeholder="Ex: 3"
                    placeholderTextColor={colors.placeholder}
                    value={keyboardBank}
                    onChangeText={setKeyboardBank}
                    keyboardType="number-pad"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={sty.inputLabel}>Casa / Slot (1-4)</Text>
                  <TextInput
                    style={sty.input}
                    placeholder="Ex: 2"
                    placeholderTextColor={colors.placeholder}
                    value={keyboardSlot}
                    onChangeText={setKeyboardSlot}
                    keyboardType="number-pad"
                  />
                </View>
              </View>
            </View>

            <View style={sty.section}>
              <Text style={sty.sectionTitle}>Anotações Adicionais</Text>
              <Text style={sty.inputLabel}>Anotação Oculta (apenas para você)</Text>
              <TextInput
                style={sty.input}
                placeholder="Ex: Introdução dedilhada, fade out no final..."
                placeholderTextColor={colors.placeholder}
                value={note}
                onChangeText={setNote}
              />
            </View>

            <TouchableOpacity style={sty.actionBtn} onPress={() => setStep(2)}>
              <Text style={sty.actionBtnTxt}>Avançar para Letra e Cifras</Text>
              <Ionicons name="arrow-forward" size={18} color="#ffffff" style={{ marginLeft: 8 }} />
            </TouchableOpacity>
          </ScrollView>
        ) : (
          /* STEP 2: Lyrics Editor */
          <View style={sty.lyricsContent}>
            <Text style={[sty.inputLabel, { marginHorizontal: 16, marginTop: 12 }]}>Letra com acordes no formato [C], [Am], etc.</Text>
            <TextInput
              style={sty.lyricsInput}
              multiline
              textAlignVertical="top"
              placeholder="Digite a letra e cifras aqui..."
              placeholderTextColor={colors.placeholder}
              value={lyrics}
              onChangeText={setLyrics}
              autoCapitalize="none"
              autoCorrect={false}
            />
            
            <View style={sty.bottomBtns}>
              <TouchableOpacity style={sty.backStepBtn} onPress={() => setStep(1)}>
                <Ionicons name="arrow-back" size={18} color={colors.text} />
                <Text style={[sty.backStepTxt, { color: colors.text }]}>Voltar ao Passo 1</Text>
              </TouchableOpacity>
              <TouchableOpacity style={sty.saveBtn} onPress={handleSave}>
                <Text style={sty.saveBtnTxt}>Salvar Alterações</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function makeStyles(c: any) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    header: {
      flexDirection: 'row', alignItems: 'center', backgroundColor: c.header,
      paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: 1, borderColor: c.border
    },
    backBtn: { width: 40, padding: 4 },
    headerTitle: {
      flex: 1, fontSize: 16, fontWeight: '700', color: c.text,
      textAlign: 'center', marginHorizontal: 8,
    },
    nextHeaderBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, padding: 4 },
    loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    scrollContent: { padding: 16, paddingBottom: 40 },
    section: { marginBottom: 20 },
    sectionTitle: { fontSize: 14, fontWeight: '700', color: c.accent, letterSpacing: 0.5, marginBottom: 8, textTransform: 'uppercase' },
    inputLabel: { fontSize: 13, color: c.textSub, marginBottom: 6, fontWeight: '600' },
    input: { backgroundColor: c.input, borderRadius: 10, padding: 12, fontSize: 15, color: c.text, borderWidth: 1, borderColor: c.border, marginBottom: 12 },
    actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: c.accent, padding: 16, borderRadius: 10, marginTop: 12 },
    actionBtnTxt: { color: '#ffffff', fontWeight: '700', fontSize: 15 },
    lyricsContent: { flex: 1 },
    lyricsInput: { flex: 1, backgroundColor: c.input, marginHorizontal: 16, marginTop: 8, marginBottom: 16, borderRadius: 12, padding: 14, fontSize: 15, color: c.text, fontFamily: 'monospace', borderWidth: 1, borderColor: c.border },
    bottomBtns: { flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 16, gap: 12 },
    backStepBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: c.border, borderRadius: 10, padding: 14 },
    backStepTxt: { fontWeight: '700' },
    saveBtn: { flex: 1.5, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center', borderRadius: 10, padding: 14 },
    saveBtnTxt: { color: '#ffffff', fontWeight: '700' }
  });
}
