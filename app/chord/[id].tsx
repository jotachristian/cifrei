import React, { useState, useCallback, useRef } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, TouchableOpacity, Switch } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '@/contexts/ThemeContext';
import { getChord, getChordsForPlaylist, Chord } from '@/lib/database';
import { transposeTone } from '@/lib/transpose';
import ChordDisplay from '@/components/ChordDisplay';

const MIN_FONT = 10, MAX_FONT = 32;

export default function ChordScreen() {
  const { id, playlistId } = useLocalSearchParams<{ id: string; playlistId?: string }>();
  const { colors } = useTheme();
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const [chord, setChord] = useState<Chord | null>(null);
  const [siblings, setSiblings] = useState<Chord[]>([]);
  const [semitones, setSemitones] = useState(0);
  const [showLyrics, setShowLyrics] = useState(true);
  const [fontSize, setFontSize] = useState(16);

  useFocusEffect(useCallback(() => {
    setChord(getChord(id));
    setSemitones(0);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    if (playlistId) setSiblings(getChordsForPlaylist(playlistId));
    AsyncStorage.multiGet(['cifrei_show_lyrics', 'cifrei_font_size']).then(pairs => {
      const sl = pairs[0][1], fs = pairs[1][1];
      if (sl !== null) setShowLyrics(sl === 'true');
      if (fs !== null) setFontSize(Number(fs));
    });
  }, [id, playlistId]));

  const toggleShow = (v: boolean) => { setShowLyrics(v); AsyncStorage.setItem('cifrei_show_lyrics', String(v)); };
  const changeFont = (d: number) => setFontSize(prev => {
    const n = Math.max(MIN_FONT, Math.min(MAX_FONT, prev + d));
    AsyncStorage.setItem('cifrei_font_size', String(n)); return n;
  });

  const idx = siblings.findIndex(c => c.id === id);
  const navTo = (dir: 'prev' | 'next') => {
    const t = siblings[dir === 'prev' ? idx - 1 : idx + 1];
    if (t) router.replace({ pathname: '/chord/[id]', params: { id: t.id, playlistId } });
  };
  const sty = makeStyles(colors);

  if (!chord) return (
    <SafeAreaView style={sty.container}>
      <Pressable onPress={() => router.dismiss()} style={sty.backBtn}>
        <Ionicons name="arrow-back" size={22} color={colors.text} />
      </Pressable>
    </SafeAreaView>
  );

  const displayTone = transposeTone(chord.tone, semitones);
  const semLabel = semitones > 0 ? '+' + semitones : String(semitones);

  return (
    <SafeAreaView style={sty.container}>
      <Pressable onPress={() => router.dismiss()} style={sty.backBtn}>
        <Ionicons name="arrow-back" size={22} color={colors.text} />
      </Pressable>

      <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={sty.scrollContent}>

        {/* título + artista + tom */}
        <Text style={sty.songTitle}>{chord.name}</Text>
        <View style={sty.metaRow}>
          {chord.artist ? <Text style={sty.artist}>{chord.artist}</Text> : null}
          <View style={sty.toneBadge}>
            <Text style={[sty.toneText, { color: colors.accent }]}>{displayTone}</Text>
          </View>
        </View>

        {/* controles */}
        <View style={sty.controlsWrap}>
          <View style={sty.controls}>
            <View style={sty.ctrlGroup}>
              <Text style={sty.ctrlLabel}>TRANSPOSE</Text>
              <View style={sty.btnRow}>
                <TouchableOpacity style={sty.roundBtn} onPress={() => setSemitones(s => s - 1)}>
                  <Text style={sty.roundBtnTxt}>−</Text>
                </TouchableOpacity>
                <Text style={sty.ctrlVal}>{semLabel}</Text>
                <TouchableOpacity style={sty.roundBtn} onPress={() => setSemitones(s => s + 1)}>
                  <Text style={sty.roundBtnTxt}>+</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={sty.divider} />

            <View style={sty.ctrlGroup}>
              <Text style={sty.ctrlLabel}>FONTE</Text>
              <View style={sty.btnRow}>
                <TouchableOpacity style={sty.roundBtn} onPress={() => changeFont(-1)} disabled={fontSize <= MIN_FONT}>
                  <Text style={sty.roundBtnTxt}>−</Text>
                </TouchableOpacity>
                <Text style={sty.ctrlVal}>{fontSize}</Text>
                <TouchableOpacity style={sty.roundBtn} onPress={() => changeFont(1)} disabled={fontSize >= MAX_FONT}>
                  <Text style={sty.roundBtnTxt}>+</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={sty.divider} />

            <View style={sty.ctrlGroup}>
              <Text style={sty.ctrlLabel}>LETRAS</Text>
              <Switch value={showLyrics} onValueChange={toggleShow}
                trackColor={{ false: colors.border, true: colors.accent }} thumbColor="#fff" />
            </View>
          </View>

          {semitones !== 0 && (
            <TouchableOpacity style={sty.resetBtn} onPress={() => setSemitones(0)}>
              <Text style={[sty.resetTxt, { color: colors.accent }]}>Redefinir transpose</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* cifra */}
        <ChordDisplay
          lyrics={chord.lyrics} semitones={semitones}
          showLyrics={showLyrics} fontSize={fontSize} colors={colors}
        />
      </ScrollView>

      {siblings.length > 0 && (
        <View style={sty.navRow}>
          <TouchableOpacity style={sty.navBtn} onPress={() => navTo('prev')} disabled={idx <= 0}>
            <Ionicons name="chevron-back" size={20} color={idx > 0 ? colors.accent : colors.border} />
            <Text style={[sty.navTxt, { color: idx > 0 ? colors.accent : colors.border }]}>Anterior</Text>
          </TouchableOpacity>
          <Text style={sty.navCounter}>{idx + 1} / {siblings.length}</Text>
          <TouchableOpacity style={sty.navBtn} onPress={() => navTo('next')} disabled={idx >= siblings.length - 1}>
            <Text style={[sty.navTxt, { color: idx < siblings.length - 1 ? colors.accent : colors.border }]}>Próxima</Text>
            <Ionicons name="chevron-forward" size={20} color={idx < siblings.length - 1 ? colors.accent : colors.border} />
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

function makeStyles(c: any) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    backBtn: { paddingHorizontal: 16, paddingVertical: 12 },
    scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },

    songTitle: { fontSize: 22, fontWeight: '700', color: c.text, marginBottom: 6 },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
    artist: { fontSize: 14, color: c.textSub },
    toneBadge: {
      paddingHorizontal: 10, paddingVertical: 3,
      borderRadius: 20, borderWidth: 1, borderColor: c.accent,
    },
    toneText: { fontSize: 13, fontWeight: '700' },

    controlsWrap: {
      marginBottom: 24, gap: 8,
    },
    controls: {
      flexDirection: 'row', alignItems: 'center',
      gap: 16,
      paddingVertical: 14, paddingHorizontal: 16,
      borderRadius: 14, borderWidth: 1, borderColor: c.border,
    },
    ctrlGroup: { alignItems: 'center', gap: 5 },
    ctrlLabel: { fontSize: 9, color: c.textSub, letterSpacing: 0.8 },
    btnRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    roundBtn: {
      width: 28, height: 28, borderRadius: 14,
      backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center',
    },
    roundBtnTxt: { color: '#0e0e0f', fontSize: 17, fontWeight: '700', lineHeight: 22 },
    ctrlVal: { fontSize: 14, fontWeight: '600', color: c.text, minWidth: 24, textAlign: 'center' },
    divider: { width: 1, height: 32, backgroundColor: c.border },
    resetBtn: {
      alignSelf: 'flex-start',
      paddingHorizontal: 12, paddingVertical: 6,
      borderRadius: 8, borderWidth: 1, borderColor: c.accent,
    },
    resetTxt: { fontSize: 12 },

    navRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      borderTopWidth: 1, borderColor: c.border,
      paddingVertical: 10, paddingHorizontal: 16,
    },
    navBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 6 },
    navTxt: { fontSize: 14, fontWeight: '500' },
    navCounter: { fontSize: 13, color: c.textSub },
  });
}
