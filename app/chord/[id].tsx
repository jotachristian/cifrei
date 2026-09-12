import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, TouchableOpacity, Modal, Linking, Image } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '@/contexts/ThemeContext';
import { getChord, getChordsForPlaylist, updateChordToneOffset, getLink, Chord, getSavedFontSize, saveFontSize, getSavedShowLyrics, saveShowLyrics, addDatabaseListener } from '@/lib/database';
import { transposeTone, semitonesBetween, MAJOR_TONES, MINOR_TONES } from '@/lib/transpose';
import { getYoutubeThumbnailUrl } from '@/lib/youtube';
import ChordDisplay from '@/components/ChordDisplay';
import { ChordCover } from '@/components/ChordCover';

const MIN_FONT = 10, MAX_FONT = 32;

interface SectionNavInfo {
  id: number;
  displayTitle: string;
  isChorus: boolean;
  shortLabel: string;
  y: number;
}

export default function ChordScreen() {
  const { id, playlistId } = useLocalSearchParams<{ id: string; playlistId?: string }>();
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const [chord, setChord] = useState<Chord | null>(() => getChord(id));
  const [siblings, setSiblings] = useState<Chord[]>(() => playlistId ? getChordsForPlaylist(playlistId) : []);
  const [semitones, setSemitones] = useState<number>(() => getChord(id)?.tone_offset ?? 0);
  const [fontSize, setFontSize] = useState<number>(() => getSavedFontSize());
  const [showLyrics, setShowLyrics] = useState<boolean>(() => getSavedShowLyrics());
  const [moment, setMoment] = useState<string>(() => playlistId ? (getLink(id, playlistId)?.moment ?? '') : '');
  const [toneModal, setToneModal] = useState(false);
  const [fontModal, setFontModal] = useState(false);
  const [showNote, setShowNote] = useState(false);

  const [chordDisplayY, setChordDisplayY] = useState(0);
  const [sectionsMap, setSectionsMap] = useState<Record<number, SectionNavInfo>>({});
  const [highlightedSecIdx, setHighlightedSecIdx] = useState<number | null>(null);
  const highlightTimerRef = useRef<any>(null);

  // Sincroniza estado quando id ou playlistId mudam (ex: navegação anterior/próximo ou troca de rota)
  useEffect(() => {
    setSectionsMap({});
    setHighlightedSecIdx(null);
    const c = getChord(id);
    if (c) {
      setChord(c);
      setSemitones(c.tone_offset);
    }
    if (playlistId) {
      setSiblings(getChordsForPlaylist(playlistId));
      setMoment(getLink(id, playlistId)?.moment ?? '');
    }
  }, [id, playlistId]);

  // Listener para sincronização em tempo real do banco (Firestore sync e cache de capas)
  useEffect(() => {
    const reload = () => {
      const c = getChord(id);
      if (c) {
        setChord(c);
      }
      if (playlistId) {
        setSiblings(getChordsForPlaylist(playlistId));
      }
    };
    const unsub = addDatabaseListener(reload);
    return () => {
      unsub();
    };
  }, [id, playlistId]);

  const handleSectionLayout = useCallback((secIdx: number, rawTitle: string, y: number) => {
    const cleanTitle = rawTitle.replace(/^\[|\]$/g, '').trim();
    const lower = cleanTitle.toLowerCase();

    // Ignora introdução conforme solicitado
    if (lower.includes('intro')) return;

    const isChorus = lower.includes('refr') || lower.includes('chorus');

    // Rótulos curtos minimalistas (ex: "R", "E1", "E2", "P")
    let shortLabel = '';
    if (isChorus) {
      shortLabel = 'R';
    } else if (lower.includes('ponte') || lower.includes('bridge')) {
      shortLabel = 'P';
    } else if (lower.includes('solo')) {
      shortLabel = 'S';
    } else {
      const num = cleanTitle.match(/\d+/)?.[0];
      shortLabel = num ? `E${num}` : 'E';
    }

    setSectionsMap(prev => ({
      ...prev,
      [secIdx]: {
        id: secIdx,
        displayTitle: cleanTitle,
        isChorus,
        shortLabel,
        y,
      }
    }));
  }, []);

  const navSections = Object.values(sectionsMap).sort((a, b) => a.id - b.id);

  const scrollToSection = (secIdx: number, secY: number) => {
    const targetY = Math.max(0, chordDisplayY + secY - 12);
    scrollRef.current?.scrollTo({ y: targetY, animated: true });

    setHighlightedSecIdx(secIdx);
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = setTimeout(() => {
      setHighlightedSecIdx(null);
    }, 2500);
  };

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
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [id, playlistId]));

  const changeFont = (d: number) => setFontSize(prev => {
    const n = Math.max(MIN_FONT, Math.min(MAX_FONT, prev + d));
    saveFontSize(n);
    return n;
  });

  const setSpecificFont = (size: number) => {
    setFontSize(size);
    saveFontSize(size);
  };

  const toggleLyrics = () => setShowLyrics(prev => {
    const n = !prev;
    saveShowLyrics(n);
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
    setChord({ ...chord, tone_offset: 0 });
    setToneModal(false);
  };

  const openEdit = () => {
    if (chord) {
      router.push({ pathname: '/chord/edit', params: { id: chord.id, playlistId } });
    }
  };

  function handleGoBack() {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  }

  const idx = siblings.findIndex(c => c.id === id);
  const navTo = (dir: 'prev' | 'next') => {
    const t = siblings[dir === 'prev' ? idx - 1 : idx + 1];
    if (t) router.replace({ pathname: '/chord/[id]', params: { id: t.id, playlistId } });
  };
  const sty = makeStyles(colors, isDark);

  if (!chord) {
    return (
      <SafeAreaView style={sty.container}>
        <View style={{ padding: 20, alignItems: 'center', justifyContent: 'center', flex: 1, gap: 16 }}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.textSub} />
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>Cifra não encontrada</Text>
          <TouchableOpacity
            style={{ backgroundColor: colors.accent, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 }}
            onPress={handleGoBack}
          >
            <Text style={{ color: '#ffffff', fontWeight: '700' }}>Voltar</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const displayTone = transposeTone(chord.tone, semitones);
  const isMinor = chord.tone.endsWith('m');
  const toneOptions = isMinor ? MINOR_TONES : MAJOR_TONES;
  // Se não houver capa salva, deriva a thumbnail do link do YouTube
  const effectiveCoverUrl =
    chord.cover_url || (chord.external_link ? getYoutubeThumbnailUrl(chord.external_link) : '') || '';

  const openYoutube = () => {
    if (chord.external_link) {
      Linking.openURL(chord.external_link).catch(() => { });
    }
  };

  return (
    <SafeAreaView style={sty.container}>
      <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={sty.scrollContent}>

        {/* Botão Voltar (fora das divs) */}
        <Pressable onPress={handleGoBack} style={sty.backBtn} hitSlop={8}>
          <Ionicons name="chevron-back-outline" size={24} color={colors.text} />
        </Pressable>

        {/* Div 1 — Informações da Música (Capa à esquerda + Nome/Artista no centro + Tom à direita) */}
        <View style={sty.glassCard}>
          <View style={sty.songInfoRow}>
            <ChordCover
              chordId={chord.id}
              coverUrl={effectiveCoverUrl}
              coverLocalUri={chord.cover_local_uri}
              size={68}
              borderRadius={14}
              fallback={
                <View style={[sty.coverFallback, { width: 68, height: 68, borderRadius: 14 }]}>
                  <Ionicons name="musical-notes" size={26} color={colors.textSub} />
                </View>
              }
            />

            <View style={sty.songInfoText}>
              <Text style={sty.songTitle} numberOfLines={1}>{chord.name}</Text>
              {chord.artist ? <Text style={sty.artist} numberOfLines={1}>{chord.artist}</Text> : null}
            </View>

            <TouchableOpacity style={sty.toneBadge} onPress={() => setToneModal(true)} activeOpacity={0.7}>
              <Text style={[sty.toneText, { backgroundColor: colors.accent }]}>{displayTone}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Div 2 — Opções (Fonte, Letra, Vídeo, Editar) */}
        <View style={[sty.glassCard, sty.optionsCard]}>
          <TouchableOpacity
            style={sty.pillBtn}
            onPress={() => setFontModal(true)}
            activeOpacity={0.7}
          >
            <Text style={sty.pillBtnTxt}>Fonte</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[sty.pillBtn, !showLyrics && sty.pillBtnInactive]}
            onPress={toggleLyrics}
            activeOpacity={0.7}
          >
            <Text style={[sty.pillBtnTxt, !showLyrics && { color: colors.textSub }]}>Letra</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[sty.pillBtn, !chord.external_link && { opacity: 0.35 }]}
            onPress={openYoutube}
            disabled={!chord.external_link}
            activeOpacity={0.7}
          >
            <Text style={sty.pillBtnTxt}>Ouvir</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={sty.pillBtn}
            onPress={openEdit}
            activeOpacity={0.7}
          >
            <Text style={sty.pillBtnTxt}>Editar</Text>
          </TouchableOpacity>
        </View>

        {/* Cifra */}
        <View onLayout={(e) => setChordDisplayY(e.nativeEvent.layout.y)}>
          <ChordDisplay
            lyrics={chord.lyrics}
            semitones={semitones}
            showLyrics={showLyrics}
            fontSize={fontSize}
            colors={colors}
            onSectionLayout={handleSectionLayout}
            highlightedSectionIdx={highlightedSecIdx}
          />
        </View>
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

      {/* Modal de Tamanho de Fonte */}
      <Modal visible={fontModal} transparent animationType="fade" onRequestClose={() => setFontModal(false)}>
        <Pressable style={sty.modalBackdrop} onPress={() => setFontModal(false)}>
          <Pressable style={sty.modalCard} onPress={e => e.stopPropagation()}>
            <Text style={sty.modalTitle}>Tamanho da Fonte</Text>

            <View style={sty.fontPreviewWrap}>
              <Text style={[sty.fontPreviewText, { fontSize, color: colors.accent }]}>Exemplo de Cifra [G7M]</Text>
              <Text style={sty.fontSizeDisplay}>{fontSize} pt</Text>
            </View>

            <View style={sty.fontSizeStepper}>
              <TouchableOpacity
                style={sty.fontStepBtn}
                onPress={() => changeFont(-1)}
                disabled={fontSize <= MIN_FONT}
                activeOpacity={0.7}
              >
                <Text style={sty.fontStepTxt}>−</Text>
              </TouchableOpacity>

              <View style={sty.fontPresetsRow}>
                {[12, 14, 16, 18, 20, 22].map(size => (
                  <TouchableOpacity
                    key={size}
                    style={[sty.fontPresetCell, fontSize === size && sty.fontPresetActive]}
                    onPress={() => setSpecificFont(size)}
                    activeOpacity={0.7}
                  >
                    <Text style={[sty.fontPresetTxt, fontSize === size && sty.fontPresetTxtActive]}>
                      {size}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={sty.fontStepBtn}
                onPress={() => changeFont(1)}
                disabled={fontSize >= MAX_FONT}
                activeOpacity={0.7}
              >
                <Text style={sty.fontStepTxt}>+</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={sty.fontCloseBtn} onPress={() => setFontModal(false)} activeOpacity={0.8}>
              <Text style={sty.fontCloseBtnTxt}>Concluir</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

    </SafeAreaView>
  );
}

function makeStyles(c: any, isDark: boolean) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: 'transparent' },
    topHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 8,
      paddingVertical: 6,
      backgroundColor: 'transparent',
      borderBottomColor: c.border,
    },
    backBtn: { paddingHorizontal: 10, paddingVertical: 8, alignSelf: 'flex-start', marginBottom: 8 },
    sectionNavRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginLeft: 'auto',
      marginRight: 10,
    },
    sectionBtnBase: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      height: 30,
      paddingHorizontal: 9,
      borderRadius: 8,
      gap: 3,
    },
    sectionBtnChorus: {
      backgroundColor: '#f73d13ff',
      borderWidth: 0,
    },
    sectionBtnOutlined: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: c.border,
    },
    sectionBtnTxt: {
      fontSize: 12,
      fontFamily: 'Inter_700Bold',
    },
    sectionBtnTxtChorus: {
      color: '#ffffff',
    },
    sectionBtnTxtOutlined: {
      color: c.textSub,
    },
    scrollContent: { paddingHorizontal: 20, paddingBottom: 40, paddingTop: 8 },

    // Cards de Vidro (Div 1 e Div 2)
    glassCard: {
      alignSelf: 'center',
      width: '100%',
      borderRadius: 22,
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.07)',
      paddingVertical: 10,
      paddingHorizontal: 10,
      marginBottom: 14,
    },
    songInfoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    songInfoText: {
      flex: 1,
      minWidth: 0,
      alignItems: 'center',
    },
    coverFallback: {
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
    },
    optionsCard: {
      flexDirection: 'row',
      gap: 5,
    },

    moment: { fontSize: 11, fontFamily: 'Inter_700Bold', color: c.accent, marginBottom: 2 },
    songTitle: { fontSize: 16, fontFamily: 'Inter_700Bold', color: c.text, marginBottom: 6 },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 12 },
    artist: { fontSize: 14, color: c.textSub, fontFamily: 'Inter_400Regular' },
    transposHighlightBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: '#f73d13ff',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 10,
      alignSelf: 'flex-start',
      marginBottom: 14,
    },
    transposHighlightTxt: {
      fontSize: 13,
      fontWeight: '800',
      color: '#ffffff',
      fontFamily: 'Inter_700Bold',
      letterSpacing: 0.5,
    },
    infoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
    infoChip: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      backgroundColor: c.input, borderRadius: 12,
      paddingHorizontal: 10, paddingVertical: 5,
      borderWidth: 1, borderColor: c.border
    },
    infoChipLabel: { fontSize: 11, fontWeight: '600', color: c.textSub },
    infoChipTxt: { fontSize: 12, fontWeight: '700', color: c.text },
    toneBadge: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 12, paddingVertical: 5,
      backgroundColor: c.accent, borderRadius: 12,
       borderColor: c.accent,
    },
    toneText: { fontSize: 13, fontFamily: 'Inter_700Bold' },

    // Barra de Opções Compacta (Estilo Imagem)
    compactActionsWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 10,
      marginBottom: 20,
    },
    pillBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.07)',
      paddingHorizontal: 17,
      paddingVertical: 6,
      borderRadius: 10,
    },
    pillBtnInactive: {
      opacity: 0.5,
    },
    pillBtnTxt: {
      fontSize: 14,
      fontFamily: 'Inter_600SemiBold',
      color: c.text,
    },

    // Modal de Tamanho de Fonte
    fontPreviewWrap: {
      alignItems: 'center',
      paddingVertical: 14,
      marginBottom: 16,
      backgroundColor: c.input,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.border,
    },
    fontPreviewText: {
      fontFamily: 'Inter_600SemiBold',
      marginBottom: 6,
    },
    fontSizeDisplay: {
      fontSize: 13,
      color: c.textSub,
      fontWeight: '500',
    },
    fontSizeStepper: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      marginBottom: 20,
    },
    fontStepBtn: {
      width: 38,
      height: 38,
      borderRadius: 10,
      backgroundColor: c.input,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    fontStepTxt: {
      color: c.text,
      fontSize: 20,
      fontWeight: '700',
      lineHeight: 22,
    },
    fontPresetsRow: {
      flexDirection: 'row',
      gap: 6,
      flexWrap: 'wrap',
      justifyContent: 'center',
      flex: 1,
    },
    fontPresetCell: {
      width: 34,
      height: 34,
      borderRadius: 8,
      backgroundColor: c.input,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    fontPresetActive: {
      backgroundColor: c.accent,
      borderColor: c.accent,
    },
    fontPresetTxt: {
      fontSize: 13,
      fontWeight: '600',
      color: c.text,
    },
    fontPresetTxtActive: {
      color: '#ffffff',
      fontWeight: '700',
    },
    fontCloseBtn: {
      backgroundColor: c.accent,
      paddingVertical: 12,
      borderRadius: 12,
      alignItems: 'center',
    },
    fontCloseBtnTxt: {
      color: '#ffffff',
      fontWeight: '700',
      fontSize: 15,
    },

    navRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      borderTopWidth: 1, borderColor: c.border,
      paddingVertical: 10, paddingHorizontal: 16,
    },
    navBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 6 },
    navTxt: { fontSize: 14, fontFamily: 'Inter_500Medium' },
    navCounter: { fontSize: 13, color: c.textSub, fontFamily: 'Inter_400Regular' },

    modalBackdrop: {
      flex: 1, backgroundColor: 'rgba(0,0,0,0.65)',
      justifyContent: 'center', alignItems: 'center', padding: 24,
    },
    modalCard: {
      backgroundColor: c.card, borderRadius: 20, padding: 22,
      width: '100%', maxWidth: 360,
      borderWidth: 1, borderColor: c.border,
      elevation: 12,
    },
    modalTitle: {
      fontSize: 18, fontFamily: 'Inter_700Bold', color: c.text,
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
      backgroundColor: 'transparent',
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
