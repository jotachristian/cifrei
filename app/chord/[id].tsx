import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import YoutubePlayer from 'react-native-youtube-iframe';
import { useTheme } from '@/contexts/ThemeContext';
import { getChord, getChordsForPlaylist, updateChordToneOffset, getLink, Chord } from '@/lib/database';
import { transposeTone, semitonesBetween, MAJOR_TONES, MINOR_TONES } from '@/lib/transpose';
import { extractYoutubeId } from '@/lib/youtube';
import ChordDisplay from '@/components/ChordDisplay';
import ChordSampler, { ChordSamplerHandle } from '@/components/ChordSampler';

const MIN_FONT = 10, MAX_FONT = 32;

// Cache de prefs: AsyncStorage so e lido na primeira vez que a tela monta no app.
// Navegacoes seguintes (prev/next) usam o cache e ja iniciam com valores corretos,
// sem flash de "default → real" depois que a Promise resolve.
let prefsCache: { fontSize: number; showLyrics: boolean } | null = null;

export default function ChordScreen() {
  const { id, playlistId } = useLocalSearchParams<{ id: string; playlistId?: string }>();
  const { colors } = useTheme();
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const synthRef = useRef<ChordSamplerHandle>(null);
  // Lazy init: chama getChord/getChordsForPlaylist sincronamente no primeiro render,
  // entao o primeiro paint ja mostra a cifra (sem aparecer so o botao voltar).
  const [chord, setChord] = useState<Chord | null>(() => getChord(id));
  const [siblings, setSiblings] = useState<Chord[]>(() => playlistId ? getChordsForPlaylist(playlistId) : []);
  const [semitones, setSemitones] = useState<number>(() => getChord(id)?.tone_offset ?? 0);
  const [fontSize, setFontSize] = useState<number>(() => prefsCache?.fontSize ?? 16);
  const [showLyrics, setShowLyrics] = useState<boolean>(() => prefsCache?.showLyrics ?? true);
  const [moment, setMoment] = useState<string>(() => playlistId ? (getLink(id, playlistId)?.moment ?? '') : '');
  const [toneModal, setToneModal] = useState(false);
  const [playerOpen, setPlayerOpen] = useState(false);
  const [playing, setPlaying] = useState(false);

  // Le AsyncStorage uma unica vez no app inteiro
  useEffect(() => {
    if (prefsCache) return;
    Promise.all([
      AsyncStorage.getItem('cifrei_font_size'),
      AsyncStorage.getItem('cifrei_show_lyrics'),
    ]).then(([fsVal, slVal]) => {
      const fs = fsVal !== null ? Number(fsVal) : 16;
      const sl = slVal !== null ? slVal === '1' : true;
      prefsCache = { fontSize: fs, showLyrics: sl };
      setFontSize(fs);
      setShowLyrics(sl);
    });
  }, []);

  // Refresh ao voltar do admin (edicoes na cifra ou playlist)
  useFocusEffect(useCallback(() => {
    const c = getChord(id);
    if (c) {
      setChord(c);
      setSemitones(c.tone_offset);
    }
    if (playlistId) {
      setSiblings(getChordsForPlaylist(playlistId));
      setMoment(getLink(id, playlistId)?.moment ?? '');
    }
    setPlayerOpen(false);
    setPlaying(false);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [id, playlistId]));

  const changeFont = (d: number) => setFontSize(prev => {
    const n = Math.max(MIN_FONT, Math.min(MAX_FONT, prev + d));
    if (prefsCache) prefsCache.fontSize = n;
    AsyncStorage.setItem('cifrei_font_size', String(n));
    return n;
  });
  const toggleLyrics = () => setShowLyrics(prev => {
    const n = !prev;
    if (prefsCache) prefsCache.showLyrics = n;
    AsyncStorage.setItem('cifrei_show_lyrics', n ? '1' : '0');
    return n;
  });
  const pickTone = (newTone: string) => {
    if (!chord) return;
    const offset = semitonesBetween(chord.tone, newTone);
    setSemitones(offset);
    updateChordToneOffset(chord.id, offset);
    setChord({ ...chord, tone_offset: offset });
    setToneModal(false);
  };
  const resetTone = () => {
    if (!chord) return;
    setSemitones(0);
    updateChordToneOffset(chord.id, 0);
    setChord({ ...chord, tone_offset: 0 });
    setToneModal(false);
  };

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
  const isMinor = chord.tone.endsWith('m');
  const toneOptions = isMinor ? MINOR_TONES : MAJOR_TONES;
  const videoId = extractYoutubeId(chord.external_link);
  const playChord = (c: string) => synthRef.current?.play(c);

  return (
    <SafeAreaView style={sty.container}>
      <Pressable onPress={() => router.dismiss()} style={sty.backBtn}>
        <Ionicons name="arrow-back" size={22} color={colors.text} />
      </Pressable>

      <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={sty.scrollContent}>

        {/* momento (se vier de uma playlist) + título + artista + tom */}
        {moment ? <Text style={sty.moment}>{moment}</Text> : null}
        <Text style={sty.songTitle}>{chord.name}</Text>
        <View style={sty.metaRow}>
          {chord.artist ? <Text style={sty.artist}>{chord.artist}</Text> : null}
          <TouchableOpacity style={sty.toneBadge} onPress={() => setToneModal(true)} activeOpacity={0.7}>
            <Text style={[sty.toneText, { color: colors.accent }]}>{displayTone}</Text>
            <Ionicons name="chevron-down" size={14} color={colors.accent} style={{ marginLeft: 2 }} />
          </TouchableOpacity>
          {videoId && (
            <TouchableOpacity
              style={sty.audioBtn}
              onPress={() => { setPlayerOpen(true); setPlaying(true); }}
              activeOpacity={0.7}
            >
              <Ionicons name="musical-notes" size={16} color={colors.accent} />
              <Text style={[sty.audioBtnTxt, { color: colors.accent }]}>Tocar</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* controles */}
        <View style={sty.controlsWrap}>
          <View style={sty.controls}>
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
              <Text style={sty.ctrlLabel}>LETRA</Text>
              <TouchableOpacity
                style={[sty.toggleBtn, showLyrics && sty.toggleBtnOn]}
                onPress={toggleLyrics}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={showLyrics ? 'eye' : 'eye-off'}
                  size={15}
                  color={showLyrics ? '#ffffff' : colors.textSub}
                />
                <Text style={[sty.toggleTxt, { color: showLyrics ? '#ffffff' : colors.textSub }]}>
                  {showLyrics ? 'On' : 'Off'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* cifra */}
        <ChordDisplay
          lyrics={chord.lyrics} semitones={semitones}
          showLyrics={showLyrics} fontSize={fontSize} colors={colors}
          onChordPress={playChord}
        />
      </ScrollView>

      <ChordSampler ref={synthRef} />

      {playerOpen && videoId && (
        <View style={sty.playerBar}>
          <View style={sty.playerHeader}>
            <Ionicons name="logo-youtube" size={16} color="#ff0000" />
            <Text style={sty.playerTitle} numberOfLines={1}>{chord.name}</Text>
            <TouchableOpacity
              onPress={() => { setPlaying(false); setPlayerOpen(false); }}
              hitSlop={10}
            >
              <Ionicons name="close" size={20} color={colors.text} />
            </TouchableOpacity>
          </View>
          <YoutubePlayer
            height={180}
            play={playing}
            videoId={videoId}
            onChangeState={(state: string) => {
              if (state === 'ended' || state === 'paused') setPlaying(false);
              if (state === 'playing') setPlaying(true);
            }}
          />
        </View>
      )}

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

      <Modal visible={toneModal} transparent animationType="fade" onRequestClose={() => setToneModal(false)}>
        <Pressable style={sty.modalBackdrop} onPress={() => setToneModal(false)}>
          <Pressable style={sty.modalCard} onPress={e => e.stopPropagation()}>
            <Text style={sty.modalTitle}>Escolher tom</Text>
            <View style={sty.toneGrid}>
              {toneOptions.map(t => {
                const isCurrent = t === displayTone;
                const isOriginal = t === chord.tone;
                return (
                  <TouchableOpacity
                    key={t}
                    style={[
                      sty.toneCell,
                      isCurrent && sty.toneCellActive,
                      !isCurrent && isOriginal && sty.toneCellOriginal,
                    ]}
                    onPress={() => pickTone(t)}
                    activeOpacity={0.7}
                  >
                    <Text style={[sty.toneCellTxt, isCurrent && sty.toneCellTxtActive]}>
                      {t}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {semitones !== 0 && (
              <TouchableOpacity style={sty.modalResetBtn} onPress={resetTone}>
                <Text style={sty.modalResetTxt}>Voltar ao tom original ({chord.tone})</Text>
              </TouchableOpacity>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function makeStyles(c: any) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    backBtn: { paddingHorizontal: 16, paddingVertical: 12 },
    scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },

    moment: { fontSize: 11, fontFamily: 'Inter_700Bold', color: c.accent, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 2 },
    songTitle: { fontSize: 22, fontFamily: 'Inter_700Bold', color: c.text, marginBottom: 6 },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
    artist: { fontSize: 14, color: c.textSub, fontFamily: 'Inter_400Regular' },
    toneBadge: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 10, paddingVertical: 3,
      borderRadius: 20, borderWidth: 1, borderColor: c.accent,
    },
    toneText: { fontSize: 13, fontFamily: 'Inter_700Bold' },
    audioBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      paddingHorizontal: 10, paddingVertical: 3,
      borderRadius: 20, borderWidth: 1, borderColor: c.accent,
    },
    audioBtnTxt: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
    playerBar: {
      borderTopWidth: 1, borderColor: c.border,
      backgroundColor: c.card,
      paddingBottom: 4,
    },
    playerHeader: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      paddingHorizontal: 12, paddingVertical: 8,
    },
    playerTitle: {
      flex: 1, fontSize: 13, fontFamily: 'Inter_600SemiBold', color: c.text,
    },

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
    ctrlLabel: { fontSize: 9, color: c.textSub, letterSpacing: 0.8, fontFamily: 'Inter_500Medium' },
    btnRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    roundBtn: {
      width: 28, height: 28, borderRadius: 14,
      backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center',
    },
    roundBtnTxt: { color: '#ffffff', fontSize: 17, fontFamily: 'Inter_700Bold', lineHeight: 22 },
    ctrlVal: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: c.text, minWidth: 24, textAlign: 'center' },
    divider: { width: 1, height: 32, backgroundColor: c.border },
    toggleBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      paddingHorizontal: 14, height: 28, borderRadius: 14,
      borderWidth: 1, borderColor: c.border,
    },
    toggleBtnOn: { backgroundColor: c.accent, borderColor: c.accent },
    toggleTxt: { fontSize: 12, fontFamily: 'Inter_700Bold' },
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
    navTxt: { fontSize: 14, fontFamily: 'Inter_500Medium' },
    navCounter: { fontSize: 13, color: c.textSub, fontFamily: 'Inter_400Regular' },

    modalBackdrop: {
      flex: 1, backgroundColor: 'rgba(0,0,0,0.4)',
      justifyContent: 'center', alignItems: 'center', padding: 24,
    },
    modalCard: {
      backgroundColor: c.card, borderRadius: 16, padding: 20,
      width: '100%', maxWidth: 360,
      borderWidth: 1, borderColor: c.border,
    },
    modalTitle: {
      fontSize: 16, fontFamily: 'Inter_700Bold', color: c.text,
      marginBottom: 16, textAlign: 'center',
    },
    toneGrid: {
      flexDirection: 'row', flexWrap: 'wrap',
      justifyContent: 'center', gap: 8,
    },
    toneCell: {
      width: 64, height: 44, borderRadius: 10,
      borderWidth: 1, borderColor: c.border,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: c.bg,
    },
    toneCellOriginal: { borderColor: c.accent, borderWidth: 1.5 },
    toneCellActive: { backgroundColor: c.accent, borderColor: c.accent },
    toneCellTxt: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: c.text },
    toneCellTxtActive: { color: '#ffffff' },
    modalResetBtn: {
      marginTop: 16, alignSelf: 'center',
      paddingHorizontal: 14, paddingVertical: 8,
      borderRadius: 8, borderWidth: 1, borderColor: c.accent,
    },
    modalResetTxt: { fontSize: 13, color: c.accent, fontFamily: 'Inter_500Medium' },
  });
}
