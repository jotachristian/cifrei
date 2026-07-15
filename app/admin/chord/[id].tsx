import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, Pressable, Alert, Modal,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import YoutubePlayer from 'react-native-youtube-iframe';
import { useTheme } from '@/contexts/ThemeContext';
import {
  getChord, createChord, updateChord,
  linkChordToPlaylist, getLink, updateLinkMoment,
} from '@/lib/database';
import { ALL_TONES, transposeChord } from '@/lib/transpose';
import { extractYoutubeId } from '@/lib/youtube';
import { getHarmonicField, ALL_KEY_BASES, nextKey } from '@/lib/harmonicField';
import ChordSampler, { ChordSamplerHandle } from '@/components/ChordSampler';

interface Section { label: string; lines: string[][]; }

const SECTION_OPTIONS = [
  'Intro', 'Parte 1', 'Parte 2', 'Parte 3', 'Pré-refrão',
  'Refrão', 'Ponte', 'Instrumental', 'Final',
];

const DEFAULT_SECTIONS: Section[] = [
  { label: 'Intro',   lines: [[]] },
  { label: 'Parte 1', lines: [[]] },
  { label: 'Refrão',  lines: [[]] },
  { label: 'Final',   lines: [[]] },
];

// Variacoes oferecidas no long-press de um acorde do teclado.
// Mantem a tonica do acorde e troca o sufixo.
const VARIATIONS: string[] = [
  '',     'm',    '°',     '+',
  '7',    'm7',   '7M',    '7M9',
  '9',    'm9',   'sus4',  'sus2',
  'add9', '6',    'm6',    'm7b5',
];

function rootOf(chord: string): string {
  const m = chord.match(/^([A-G][b#]?)/);
  return m ? m[1] : chord;
}

// ─── parse / serialize ────────────────────────────────────────────────────

function parseSections(lyrics: string): Section[] {
  const lines = lyrics.replace(/\r\n?/g, '\n').split('\n');
  const sections: Section[] = [];
  let current: Section | null = null;

  const startSection = (label: string) => {
    current = { label, lines: [[]] };
    sections.push(current);
  };

  for (const raw of lines) {
    const sec = raw.trim().match(/^\[(.+)\]$/);
    if (sec) { startSection(sec[1]); continue; }
    const t = raw.trim();
    if (!current) {
      if (!t) continue;
      startSection('Parte 1');
    }
    if (!t) {
      // linha vazia = nova linha dentro da secao, se a anterior tinha conteudo
      const last = current!.lines[current!.lines.length - 1];
      if (last && last.length > 0) current!.lines.push([]);
      continue;
    }
    const tokens = t.split(/\s+/).filter(Boolean);
    const lastLineIdx = current!.lines.length - 1;
    if (current!.lines[lastLineIdx].length === 0) {
      current!.lines[lastLineIdx] = tokens;
    } else {
      current!.lines.push(tokens);
    }
  }

  if (!sections.length) return DEFAULT_SECTIONS.map(s => ({ label: s.label, lines: [[]] }));
  return sections;
}

function serializeSections(sections: Section[]): string {
  return sections
    .map(s => {
      const linesStr = s.lines
        .map(toks => toks.join('  '))
        .filter(l => l.length > 0)
        .join('\n');
      return linesStr ? `[${s.label}]\n${linesStr}` : `[${s.label}]`;
    })
    .join('\n\n');
}

// ─── tela ─────────────────────────────────────────────────────────────────

export default function ChordEditScreen() {
  const { id, playlistId } = useLocalSearchParams<{ id: string; playlistId?: string }>();
  const isNew = id === 'new';
  const { colors } = useTheme();
  const router = useRouter();
  const synthRef = useRef<ChordSamplerHandle>(null);
  const contextPlaylistId = playlistId ?? '';

  const [name, setName] = useState('');
  const [artist, setArtist] = useState('');
  const [tone, setTone] = useState('C');
  const [link, setLink] = useState('');
  const [note, setNote] = useState('');
  const [moment, setMoment] = useState('');
  const [sections, setSections] = useState<Section[]>(DEFAULT_SECTIONS);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [playerOpen, setPlayerOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);

  // teclado harmonico
  const [fieldBase, setFieldBase] = useState('C');
  const [fieldMode, setFieldMode] = useState<'major' | 'minor'>('major');

  // long-press num acorde do teclado → abre menu de variacoes
  const [varRoot, setVarRoot] = useState<string | null>(null);

  useEffect(() => {
    if (!isNew) {
      const c = getChord(id);
      if (c) {
        setName(c.name); setArtist(c.artist); setTone(c.tone);
        setLink(c.external_link); setNote(c.note ?? '');
        const parsed = parseSections(c.lyrics ?? '');
        setSections(parsed);
        setSelectedIdx(0);
        const isMinor = c.tone.endsWith('m');
        setFieldBase(isMinor ? c.tone.slice(0, -1) : c.tone);
        setFieldMode(isMinor ? 'minor' : 'major');
      }
      if (contextPlaylistId) {
        const lk = getLink(id, contextPlaylistId);
        if (lk) setMoment(lk.moment ?? '');
      }
    } else {
      setSections(DEFAULT_SECTIONS.map(s => ({ label: s.label, lines: [[]] })));
    }
  }, [id]);

  const videoId = useMemo(() => extractYoutubeId(link), [link]);
  const fieldChords = useMemo(() => {
    const key = fieldMode === 'minor' ? fieldBase + 'm' : fieldBase;
    return getHarmonicField(key);
  }, [fieldBase, fieldMode]);

  // ─── acoes ─────────────────────────────────────────────────────────────

  function pickTone(t: string) {
    setTone(t);
    const isMinor = t.endsWith('m');
    setFieldBase(isMinor ? t.slice(0, -1) : t);
    setFieldMode(isMinor ? 'minor' : 'major');
  }

  function playChord(c: string) {
    synthRef.current?.play(c);
  }

  function addChord(c: string) {
    playChord(c);
    setSections(prev => {
      if (!prev[selectedIdx]) return prev;
      const copy = prev.slice();
      const s = { ...copy[selectedIdx] };
      s.lines = s.lines.length ? s.lines.slice() : [[]];
      const li = s.lines.length - 1;
      s.lines[li] = [...s.lines[li], c];
      copy[selectedIdx] = s;
      return copy;
    });
  }

  function newLine() {
    setSections(prev => {
      if (!prev[selectedIdx]) return prev;
      const copy = prev.slice();
      const s = { ...copy[selectedIdx] };
      const last = s.lines[s.lines.length - 1];
      if (last && last.length === 0) return prev; // ja tem linha vazia no fim
      s.lines = [...s.lines, []];
      copy[selectedIdx] = s;
      return copy;
    });
  }

  function backspace() {
    setSections(prev => {
      if (!prev[selectedIdx]) return prev;
      const copy = prev.slice();
      const s = { ...copy[selectedIdx] };
      s.lines = s.lines.slice();
      let li = s.lines.length - 1;
      if (li < 0) return prev;
      const last = s.lines[li];
      if (last.length === 0) {
        if (s.lines.length === 1) return prev;
        s.lines = s.lines.slice(0, -1);
      } else {
        s.lines[li] = last.slice(0, -1);
      }
      copy[selectedIdx] = s;
      return copy;
    });
  }

  function removeChordAt(secIdx: number, lineIdx: number, tokenIdx: number) {
    setSections(prev => {
      const copy = prev.slice();
      const s = { ...copy[secIdx] };
      s.lines = s.lines.slice();
      const line = s.lines[lineIdx].slice();
      line.splice(tokenIdx, 1);
      s.lines[lineIdx] = line;
      copy[secIdx] = s;
      return copy;
    });
  }

  function addSection() {
    Alert.alert('Nova seção', undefined, [
      ...SECTION_OPTIONS.map(label => ({
        text: label,
        onPress: () => {
          setSections(prev => {
            const copy = [...prev, { label, lines: [[]] as string[][] }];
            setSelectedIdx(copy.length - 1);
            return copy;
          });
        },
      })),
      { text: 'Cancelar', style: 'cancel' as const },
    ]);
  }

  function removeSection(idx: number) {
    if (sections.length <= 1) return;
    Alert.alert('Remover seção?', sections[idx].label, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: () => {
        setSections(prev => {
          const copy = prev.filter((_, i) => i !== idx);
          setSelectedIdx(Math.min(selectedIdx, copy.length - 1));
          return copy;
        });
      }},
    ]);
  }

  function handleSave() {
    if (!name.trim()) { Alert.alert('Erro', 'Nome obrigatorio'); return; }
    const lyrics = serializeSections(sections);

    let chordId: string;
    if (isNew) {
      chordId = createChord({
        name: name.trim(), artist: artist.trim(), tone,
        lyrics, externalLink: link, note,
      });
      if (contextPlaylistId) linkChordToPlaylist(chordId, contextPlaylistId);
    } else {
      updateChord(id, {
        name: name.trim(), artist: artist.trim(), tone,
        lyrics, externalLink: link, note,
      });
      chordId = id;
    }

    if (contextPlaylistId) {
      updateLinkMoment(chordId, contextPlaylistId, moment.trim());
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
        <Text style={sty.headerTitle} numberOfLines={1}>{name || (isNew ? 'Nova cifra' : 'Editar')}</Text>
        <TouchableOpacity style={sty.saveHeaderBtn} onPress={handleSave}>
          <Text style={sty.saveHeaderTxt}>Salvar</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={sty.scroll} keyboardShouldPersistTaps="handled">

        {videoId && (
          <View style={sty.playerWrap}>
            <Pressable style={sty.playerHeader} onPress={() => setPlayerOpen(o => !o)}>
              <Ionicons name="logo-youtube" size={16} color="#ff0000" />
              <Text style={sty.playerLabel}>{playerOpen ? 'Fechar player' : 'Abrir player'}</Text>
              <Ionicons name={playerOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.accent} />
            </Pressable>
            {playerOpen && <YoutubePlayer height={180} videoId={videoId} play={false} />}
          </View>
        )}

        <View style={sty.metaRow}>
          <TextInput style={sty.metaInput} value={name} onChangeText={setName}
            placeholder="Nome da musica" placeholderTextColor={colors.placeholder} />
        </View>
        <View style={sty.metaRow}>
          <TextInput style={sty.metaInput} value={artist} onChangeText={setArtist}
            placeholder="Artista (opcional)" placeholderTextColor={colors.placeholder} />
        </View>

        <Text style={sty.smallLabel}>Tom</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
          {ALL_TONES.map(t => (
            <TouchableOpacity
              key={t}
              style={[sty.chip, t === tone && sty.chipActive]}
              onPress={() => pickTone(t)}
            >
              <Text style={[sty.chipTxt, t === tone && sty.chipTxtActive]}>{t}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {contextPlaylistId ? (
          <>
            <Text style={sty.smallLabel}>Momento (nesta playlist)</Text>
            <TextInput style={sty.metaInput} value={moment} onChangeText={setMoment}
              placeholder="Entrada, Salmo, Comunhão..." placeholderTextColor={colors.placeholder} />
          </>
        ) : null}

        <Text style={sty.smallLabel}>Link YouTube</Text>
        <TextInput style={sty.metaInput} value={link} onChangeText={setLink}
          placeholder="https://youtu.be/..." placeholderTextColor={colors.placeholder}
          autoCapitalize="none" keyboardType="url" />

        <Pressable style={sty.noteToggle} onPress={() => setNoteOpen(o => !o)}>
          <Ionicons name={noteOpen ? 'chevron-down' : 'chevron-forward'} size={14} color={colors.textSub} />
          <Text style={sty.noteToggleTxt}>Anotações {note ? '(preenchida)' : ''}</Text>
        </Pressable>
        {noteOpen && (
          <TextInput
            style={[sty.metaInput, { minHeight: 100 }]}
            value={note} onChangeText={setNote}
            placeholder="Letra, observações, melodia..."
            placeholderTextColor={colors.placeholder}
            multiline textAlignVertical="top"
          />
        )}

        <View style={sty.sectionsHeader}>
          <Text style={sty.bigLabel}>Seções</Text>
          <TouchableOpacity onPress={addSection} style={sty.addSecBtn}>
            <Ionicons name="add" size={16} color={colors.accent} />
            <Text style={sty.addSecTxt}>Adicionar</Text>
          </TouchableOpacity>
        </View>

        {sections.map((s, si) => {
          const active = si === selectedIdx;
          return (
            <Pressable
              key={si}
              onPress={() => setSelectedIdx(si)}
              onLongPress={() => removeSection(si)}
              style={[sty.section, active && sty.sectionActive]}
            >
              <Text style={[sty.sectionLabel, active && { color: colors.accent }]}>
                [{s.label}]{active ? '  ← selecionada' : ''}
              </Text>
              {s.lines.map((line, li) => (
                <View key={li} style={sty.chordLine}>
                  {line.length === 0 && active && li === s.lines.length - 1 ? (
                    <Text style={sty.emptyLineHint}>toque um acorde do teclado abaixo</Text>
                  ) : null}
                  {line.map((tok, ti) => (
                    <Pressable
                      key={ti}
                      onPress={() => playChord(tok)}
                      onLongPress={() => removeChordAt(si, li, ti)}
                      style={sty.chordToken}
                    >
                      <Text style={sty.chordTokenTxt}>{tok}</Text>
                    </Pressable>
                  ))}
                </View>
              ))}
            </Pressable>
          );
        })}

        <View style={{ height: 24 }} />
      </ScrollView>

      {/* Teclado harmonico fixo embaixo */}
      <View style={sty.kbd}>
        <View style={sty.kbdHeader}>
          <TouchableOpacity onPress={() => setFieldBase(nextKey(fieldBase, -1))} style={sty.kbdArrow}>
            <Ionicons name="chevron-back" size={20} color={colors.accent} />
          </TouchableOpacity>
          <Pressable
            onPress={() => setFieldMode(m => m === 'major' ? 'minor' : 'major')}
            style={sty.kbdKey}
          >
            <Text style={sty.kbdKeyTxt}>
              Campo: {fieldBase}{fieldMode === 'minor' ? 'm' : ''}
            </Text>
            <Text style={sty.kbdKeyHint}>toque pra {fieldMode === 'major' ? 'menor' : 'maior'}</Text>
          </Pressable>
          <TouchableOpacity onPress={() => setFieldBase(nextKey(fieldBase, 1))} style={sty.kbdArrow}>
            <Ionicons name="chevron-forward" size={20} color={colors.accent} />
          </TouchableOpacity>
        </View>

        <View style={sty.kbdGrid}>
          {fieldChords.map((c, i) => (
            <Pressable
              key={i}
              style={sty.kbdChord}
              onPress={() => addChord(c)}
              onLongPress={() => setVarRoot(rootOf(c))}
              delayLongPress={280}
            >
              <Text style={sty.kbdChordTxt}>{c}</Text>
            </Pressable>
          ))}
        </View>

        <View style={sty.kbdActions}>
          <TouchableOpacity style={sty.kbdAction} onPress={newLine}>
            <Ionicons name="return-down-back" size={16} color={colors.text} />
            <Text style={sty.kbdActionTxt}>Nova linha</Text>
          </TouchableOpacity>
          <TouchableOpacity style={sty.kbdAction} onPress={backspace}>
            <Ionicons name="backspace-outline" size={16} color={colors.text} />
            <Text style={sty.kbdActionTxt}>Apagar</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Modal
        visible={varRoot !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setVarRoot(null)}
      >
        <Pressable style={sty.varBackdrop} onPress={() => setVarRoot(null)}>
          <Pressable style={sty.varCard} onPress={e => e.stopPropagation()}>
            <Text style={sty.varTitle}>Variações de {varRoot}</Text>
            <View style={sty.varGrid}>
              {VARIATIONS.map((suf, i) => {
                const full = (varRoot ?? '') + suf;
                return (
                  <TouchableOpacity
                    key={i}
                    style={sty.varCell}
                    onPress={() => { addChord(full); setVarRoot(null); }}
                    onLongPress={() => playChord(full)}
                  >
                    <Text style={sty.varCellTxt}>{full}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={sty.varHint}>Toque pra adicionar · segure pra só ouvir</Text>
          </Pressable>
        </Pressable>
      </Modal>

      <ChordSampler ref={synthRef} />
    </SafeAreaView>
  );
}

function makeStyles(c: any) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    header: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.header, paddingHorizontal: 12, paddingVertical: 12 },
    iconBtn: { width: 40, padding: 4, alignItems: 'center' },
    headerTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: c.text, textAlign: 'center' },
    saveHeaderBtn: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: c.accent, borderRadius: 8 },
    saveHeaderTxt: { color: '#ffffff', fontWeight: '700', fontSize: 13 },

    scroll: { padding: 14, gap: 8, paddingBottom: 16 },

    playerWrap: { backgroundColor: c.card, borderRadius: 12, borderWidth: 1, borderColor: c.border, padding: 8, gap: 6 },
    playerHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 4 },
    playerLabel: { flex: 1, fontSize: 13, color: c.text, fontWeight: '600' },

    metaRow: { flexDirection: 'row' },
    metaInput: { flex: 1, backgroundColor: c.input, borderRadius: 10, padding: 12, fontSize: 15, color: c.text, borderWidth: 1, borderColor: c.border },

    smallLabel: { fontSize: 11, fontWeight: '700', color: c.textSub, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 6 },
    bigLabel: { fontSize: 14, fontWeight: '700', color: c.text, textTransform: 'uppercase', letterSpacing: 0.8 },

    chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: c.border, marginRight: 6, backgroundColor: c.card },
    chipActive: { backgroundColor: c.accent, borderColor: c.accent },
    chipTxt: { fontSize: 13, color: c.text, fontWeight: '500' },
    chipTxtActive: { color: '#fff', fontWeight: '700' },

    noteToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8 },
    noteToggleTxt: { fontSize: 12, color: c.textSub, fontWeight: '600' },

    sectionsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, marginBottom: 6 },
    addSecBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: c.accent },
    addSecTxt: { fontSize: 12, color: c.accent, fontWeight: '700' },

    section: { backgroundColor: c.card, borderRadius: 10, borderWidth: 1, borderColor: c.border, padding: 10, marginBottom: 8, gap: 4 },
    sectionActive: { borderColor: c.accent, borderWidth: 2 },
    sectionLabel: { fontSize: 12, fontWeight: '700', color: c.textSub, letterSpacing: 0.5, marginBottom: 4 },
    chordLine: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center', minHeight: 28 },
    chordToken: { paddingHorizontal: 8, paddingVertical: 3, backgroundColor: c.input, borderRadius: 6, borderWidth: 1, borderColor: c.border },
    chordTokenTxt: { fontSize: 14, color: c.accent, fontWeight: '700' },
    emptyLineHint: { fontSize: 12, color: c.placeholder, fontStyle: 'italic' },

    kbd: { backgroundColor: c.card, borderTopWidth: 1, borderColor: c.border, padding: 10, gap: 8 },
    kbdHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    kbdArrow: { padding: 6 },
    kbdKey: { flex: 1, alignItems: 'center' },
    kbdKeyTxt: { fontSize: 13, fontWeight: '700', color: c.text },
    kbdKeyHint: { fontSize: 10, color: c.textSub, marginTop: 2 },
    kbdGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
    kbdChord: { minWidth: 56, paddingHorizontal: 10, paddingVertical: 10, backgroundColor: c.accent, borderRadius: 10, alignItems: 'center' },
    kbdChordTxt: { fontSize: 15, fontWeight: '700', color: '#ffffff' },
    kbdActions: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 4 },
    kbdAction: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: c.border },
    kbdActionTxt: { fontSize: 12, color: c.text, fontWeight: '600' },

    varBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: 24 },
    varCard: { backgroundColor: c.card, borderRadius: 16, padding: 18, gap: 12, borderWidth: 1, borderColor: c.border, width: '100%', maxWidth: 360 },
    varTitle: { fontSize: 15, fontWeight: '700', color: c.text, textAlign: 'center' },
    varGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
    varCell: { minWidth: 68, paddingHorizontal: 10, paddingVertical: 10, backgroundColor: c.input, borderRadius: 10, borderWidth: 1, borderColor: c.border, alignItems: 'center' },
    varCellTxt: { fontSize: 14, fontWeight: '700', color: c.accent },
    varHint: { fontSize: 11, color: c.textSub, textAlign: 'center', fontStyle: 'italic' },
  });
}
