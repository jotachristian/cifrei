import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet, TouchableOpacity,
  TextInput, KeyboardAvoidingView, Platform, Alert, Modal, Keyboard
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { getChord, updateChord, createChord, deleteChord, getAllChords, Chord, linkChordToPlaylist, updateChordCover, formatArtistName, findExistingChord } from '@/lib/database';
import { MAJOR_TONES, MINOR_TONES, transposeTone } from '@/lib/transpose';
import { ChordCover } from '@/components/ChordCover';
import { searchAlbumCover, getYoutubeCoverUrl, cacheCoverImage } from '@/lib/coverService';
import { extractYoutubeId, toYoutubeMusicUrl, getYoutubeThumbnailUrl } from '@/lib/youtube';

// Tabela de Campo Harmônico para o Teclado de Acordes
const HARMONIC_FIELDS: Record<string, string[]> = {
  'C': ['C', 'Dm', 'Em', 'F', 'G', 'Am', 'B°'],
  'C#': ['C#', 'D#m', 'E#m', 'F#', 'G#', 'A#m', 'B#°'],
  'D': ['D', 'Em', 'F#m', 'G', 'A', 'Bm', 'C#°'],
  'D#': ['D#', 'Fm', 'Gm', 'G#', 'A#', 'Cm', 'D°'],
  'E': ['E', 'F#m', 'G#m', 'A', 'B', 'C#m', 'D#°'],
  'F': ['F', 'Gm', 'Am', 'Bb', 'C', 'Dm', 'E°'],
  'F#': ['F#', 'G#m', 'A#m', 'B', 'C#', 'D#m', 'E#°'],
  'G': ['G', 'Am', 'Bm', 'C', 'D', 'Em', 'F#°'],
  'G#': ['G#', 'A#m', 'Cm', 'C#', 'D#', 'Fm', 'G°'],
  'A': ['A', 'Bm', 'C#m', 'D', 'E', 'F#m', 'G#°'],
  'A#': ['A#', 'Cm', 'Dm', 'D#', 'F', 'Gm', 'A°'],
  'B': ['B', 'C#m', 'D#m', 'E', 'F#', 'G#m', 'A#°'],
  // Menores
  'Am': ['Am', 'B°', 'C', 'Dm', 'Em', 'F', 'G', 'E7'],
  'Em': ['Em', 'F#°', 'G', 'Am', 'Bm', 'C', 'D', 'B7'],
  'Bm': ['Bm', 'C#°', 'D', 'Em', 'F#m', 'G', 'A', 'F#7'],
  'F#m': ['F#m', 'G#°', 'A', 'Bm', 'C#m', 'D', 'E', 'C#7'],
  'C#m': ['C#m', 'D#°', 'E', 'F#m', 'G#m', 'A', 'B', 'G#7'],
  'Dm': ['Dm', 'E°', 'F', 'Gm', 'Am', 'Bb', 'C', 'A7'],
  'Gm': ['Gm', 'A°', 'Bb', 'Cm', 'Dm', 'Eb', 'F', 'D7'],
  'Cm': ['Cm', 'D°', 'Eb', 'Fm', 'Gm', 'Ab', 'Bb', 'G7'],
  'Fm': ['Fm', 'G°', 'Ab', 'Bbm', 'Cm', 'Db', 'Eb', 'C7'],
};

function getChordVariations(baseChord: string): string[] {
  const root = baseChord.replace(/[°m794susdim]/g, '').trim() || 'C';
  const isMinor = baseChord.includes('m') && !baseChord.includes('maj');

  if (isMinor) {
    return [
      baseChord,
      `${root}m7`,
      `${root}m9`,
      `${root}m7(9)`,
      `${root}m6`,
      `${root}m(7M)`,
      `${root}m7(11)`,
      `${root}°`,
      `${root}m7(b5)`,
      root,
      `${root}7`,
      `${root}4`,
    ];
  }

  return [
    baseChord,
    `${root}7M`,
    `${root}7`,
    `${root}9`,
    `${root}7(9)`,
    `${root}6`,
    `${root}4`,
    `${root}7(4/9)`,
    `${root}add9`,
    `${root}sus4`,
    `${root}dim`,
    `${root}m`,
    `${root}m7`,
  ];
}

interface SectionItem {
  id: string;
  title: string;
  content: string;
}

function parseLyricsToSections(rawLyrics: string): SectionItem[] {
  if (!rawLyrics.trim()) {
    return [{ id: 'sec-0', title: '[Parte 1]', content: '' }];
  }

  const lines = rawLyrics.split('\n');
  const result: SectionItem[] = [];
  let curTitle = '[Parte 1]';
  let curLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const trimmed = l.trim();
    if (/^\[.+\]$/.test(trimmed)) {
      if (curLines.length > 0 || result.length > 0) {
        result.push({
          id: `sec-${result.length}`,
          title: curTitle,
          content: curLines.join('\n'),
        });
      }
      curTitle = trimmed;
      curLines = [];
    } else {
      curLines.push(l);
    }
  }

  result.push({
    id: `sec-${result.length}`,
    title: curTitle,
    content: curLines.join('\n'),
  });

  return result.length > 0 ? result : [{ id: 'sec-0', title: '[Parte 1]', content: '' }];
}

function compileSectionsToLyrics(secs: SectionItem[]): string {
  return secs
    .map(s => {
      const trimmedContent = s.content.trim();
      return `${s.title}${trimmedContent ? '\n' + trimmedContent : ''}`;
    })
    .join('\n\n');
}

export default function ChordEditScreen() {
  const { id, playlistId } = useLocalSearchParams<{ id?: string; playlistId?: string }>();
  const { colors } = useTheme();
  const router = useRouter();

  const isEditing = Boolean(id);

  // Navegação:
  // Step 1: Substep 1 (Música/Artista) | Substep 2 (Tom, Capo -12 a +12, Timbres, Anotações)
  // Step 2: Substep 1 (Letras & Sessões Geral) | Substep 2 (Cifras Fatiada por Sessão)
  const [step, setStep] = useState<1 | 2>(1);
  const [subStep, setSubStep] = useState<1 | 2>(1);

  // Form states
  const [name, setName] = useState('');
  const [artist, setArtist] = useState('');
  const [tone, setTone] = useState('G');
  const [toneModal, setToneModal] = useState(false);
  const [toneTab, setToneTab] = useState<'major' | 'minor'>('major');

  // Capotraste / Transposição (-12 a +12)
  const [hasCapo, setHasCapo] = useState(false);
  const [capoFret, setCapoFret] = useState(0);

  // Timbres e Estilos
  const [hasTimbres, setHasTimbres] = useState(false);
  const [timbreText, setTimbreText] = useState('');
  const [styleText, setStyleText] = useState('');

  // Anotações e Letra
  const [note, setNote] = useState('');
  const [lyrics, setLyrics] = useState('');
  const [externalLink, setExternalLink] = useState('');

  // Capa do Álbum
  const [coverUrl, setCoverUrl] = useState('');
  const [coverLocalUri, setCoverLocalUri] = useState('');
  const [isSearchingCover, setIsSearchingCover] = useState(false);
  const [coverSearchIndex, setCoverSearchIndex] = useState(0);

  // Artista Autocomplete
  const [showArtistSuggestions, setShowArtistSuggestions] = useState(false);

  // Step 2 - Substep 2: Sessões Fatiadas
  const [sections, setSections] = useState<SectionItem[]>([]);
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [keyboardMode, setKeyboardMode] = useState<'chords' | 'native'>('chords');
  const [activeChordForVariations, setActiveChordForVariations] = useState<string | null>(null);

  // Ref e estado do cursor dentro da sessão ativa
  const [cursorPos, setCursorPos] = useState({ start: 0, end: 0 });
  const sectionInputRef = useRef<TextInput>(null);

  const existingArtists = useMemo(() => {
    const all = getAllChords();
    const map = new Map<string, string>();
    for (const c of all) {
      const formatted = formatArtistName(c.artist || '');
      if (formatted) {
        const key = formatted.toLowerCase();
        if (!map.has(key)) {
          map.set(key, formatted);
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => a.localeCompare(b));
  }, []);

  const filteredArtists = useMemo(() => {
    if (!artist.trim()) return existingArtists.slice(0, 5);
    return existingArtists.filter(a => a.toLowerCase().includes(artist.toLowerCase())).slice(0, 5);
  }, [artist, existingArtists]);

  useEffect(() => {
    if (id) {
      const c = getChord(id);
      if (c) {
        setName(c.name);
        setArtist(c.artist || '');
        setTone(c.tone || 'G');
        setToneTab(c.tone?.endsWith('m') ? 'minor' : 'major');
        setExternalLink(c.external_link || '');
        setNote(c.note || '');
        setLyrics(c.lyrics || '');
        setCoverUrl(c.cover_url || '');
        setCoverLocalUri(c.cover_local_uri || '');

        if (typeof c.capo === 'number' && c.capo !== 0 && !isNaN(c.capo)) {
          setHasCapo(true);
          setCapoFret(c.capo);
        } else {
          setHasCapo(false);
          setCapoFret(0);
        }

        const initialTimbre = c.timbre || (c.keyboard_bank ? `Banco ${c.keyboard_bank}, Slot ${c.keyboard_slot || 1}` : '');
        const initialStyle = c.style || '';
        if (initialTimbre || initialStyle) {
          setHasTimbres(true);
          setTimbreText(initialTimbre);
          setStyleText(initialStyle);
        } else {
          setHasTimbres(false);
          setTimbreText('');
          setStyleText('');
        }
      }
    }
  }, [id]);

  const harmonicChords = useMemo(() => {
    return HARMONIC_FIELDS[tone] || ['C', 'Dm', 'Em', 'F', 'G', 'Am', 'B°'];
  }, [tone]);

  // Avançar da Subetapa 1 para Subetapa 2 da Etapa 2 (fatia as sessões)
  function handleGoToSlicedSections() {
    const parsed = parseLyricsToSections(lyrics);
    setSections(parsed);
    setCurrentSectionIndex(0);
    setSubStep(2);
  }

  // Atualiza o conteúdo da sessão atual
  function handleUpdateCurrentSectionContent(text: string) {
    setSections(prev => {
      const updated = [...prev];
      if (updated[currentSectionIndex]) {
        updated[currentSectionIndex] = {
          ...updated[currentSectionIndex],
          content: text,
        };
      }
      return updated;
    });
  }

  // Inserir acorde na posição atual do cursor na sessão ativa
  function handleInsertChordInCurrentSection(chordToInsert: string) {
    const currentSection = sections[currentSectionIndex];
    if (!currentSection) return;

    const currentText = currentSection.content;
    const formatted = `${chordToInsert}   `; // Garante espaçamento confortável entre acordes
    const start = cursorPos.start ?? currentText.length;
    const end = cursorPos.end ?? currentText.length;

    const newContent = currentText.slice(0, start) + formatted + currentText.slice(end);
    handleUpdateCurrentSectionContent(newContent);

    const newPos = start + formatted.length;
    setCursorPos({ start: newPos, end: newPos });
  }

  // Inserir espaço(s) na posição do cursor
  function handleInsertSpace(count = 1) {
    const currentSection = sections[currentSectionIndex];
    if (!currentSection) return;

    const currentText = currentSection.content;
    const spaces = ' '.repeat(count);
    const start = cursorPos.start ?? currentText.length;
    const end = cursorPos.end ?? currentText.length;

    const newContent = currentText.slice(0, start) + spaces + currentText.slice(end);
    handleUpdateCurrentSectionContent(newContent);

    const newPos = start + spaces.length;
    setCursorPos({ start: newPos, end: newPos });
  }

  // Inserir quebra de linha (Enter)
  function handleInsertNewline() {
    const currentSection = sections[currentSectionIndex];
    if (!currentSection) return;

    const currentText = currentSection.content;
    const start = cursorPos.start ?? currentText.length;
    const end = cursorPos.end ?? currentText.length;

    const newContent = currentText.slice(0, start) + '\n' + currentText.slice(end);
    handleUpdateCurrentSectionContent(newContent);

    const newPos = start + 1;
    setCursorPos({ start: newPos, end: newPos });
  }

  // Apagar caractere anterior (Backspace)
  function handleBackspace() {
    const currentSection = sections[currentSectionIndex];
    if (!currentSection) return;

    const currentText = currentSection.content;
    const start = cursorPos.start ?? currentText.length;
    const end = cursorPos.end ?? currentText.length;

    if (start === end && start > 0) {
      const newContent = currentText.slice(0, start - 1) + currentText.slice(end);
      handleUpdateCurrentSectionContent(newContent);
      const newPos = start - 1;
      setCursorPos({ start: newPos, end: newPos });
    } else if (start !== end) {
      const newContent = currentText.slice(0, start) + currentText.slice(end);
      handleUpdateCurrentSectionContent(newContent);
      setCursorPos({ start, end: start });
    }
  }

  function handleSelectTone(t: string) {
    setTone(t);
    setToneModal(false);
  }

  function handleNextSubStep() {
    if (!name.trim()) {
      if (Platform.OS === 'web') {
        window.alert('O nome da música é obrigatório.');
      } else {
        Alert.alert('Atenção', 'O nome da música é obrigatório.');
      }
      return;
    }

    const formattedArtist = formatArtistName(artist);
    const dup = findExistingChord(name, formattedArtist, isEditing ? id : undefined);
    if (dup) {
      const msg = `Já existe uma música cadastrada com o nome "${dup.name}" para o artista "${dup.artist || 'Sem artista'}". Não é permitido cadastrar músicas duplicadas.`;
      if (Platform.OS === 'web') {
        window.alert(msg);
      } else {
        Alert.alert('Música Duplicada', msg);
      }
      return;
    }

    setSubStep(2);
  }

  function handleBack() {
    if (step === 2) {
      if (subStep === 2) {
        // Sincroniza a letra compilada de volta
        setLyrics(compileSectionsToLyrics(sections));
        setSubStep(1);
      } else {
        setStep(1);
        setSubStep(2);
      }
    } else if (subStep === 2) {
      setSubStep(1);
    } else {
      router.back();
    }
  }

  function handleExternalLinkChange(text: string) {
    const ytId = extractYoutubeId(text);
    const formatted = ytId ? toYoutubeMusicUrl(text) : text;
    setExternalLink(formatted);
    if (ytId) {
      const ytThumb = getYoutubeThumbnailUrl(ytId);
      if (ytThumb && (!coverUrl || coverUrl.includes('ytimg.com') || coverUrl.includes('youtube'))) {
        setCoverUrl(ytThumb);
        setCoverLocalUri('');
      }
    }
  }

  async function handleSearchCover() {
    if (!name.trim() && !externalLink.trim()) {
      if (Platform.OS === 'web') {
        window.alert('Digite o nome da música ou adicione o link do YouTube primeiro para buscar a capa.');
      } else {
        Alert.alert('Aviso', 'Digite o nome da música ou adicione o link do YouTube primeiro para buscar a capa.');
      }
      return;
    }
    setIsSearchingCover(true);
    try {
      // Se há link do YouTube informado e ainda não pesquisamos capas adicionais
      if (externalLink.trim() && coverSearchIndex === 0 && !coverUrl) {
        const ytCover = getYoutubeCoverUrl(externalLink.trim());
        if (ytCover) {
          setCoverUrl(ytCover);
          setCoverLocalUri('');
          setCoverSearchIndex(1);
          return;
        }
      }

      // Busca no YouTube / YouTube Music pelo nome da música/artista com índice rotativo
      const cleanName = name.trim();
      const cleanArtist = artist.trim();
      const ytCover = await searchAlbumCover(cleanName, cleanArtist, coverSearchIndex);
      if (ytCover) {
        setCoverUrl(ytCover);
        setCoverLocalUri('');
        setCoverSearchIndex(prev => prev + 1);
      } else if (externalLink.trim()) {
        const directCover = getYoutubeCoverUrl(externalLink.trim());
        if (directCover) {
          setCoverUrl(directCover);
          setCoverLocalUri('');
        } else {
          Alert.alert('Não encontrada', 'Não foi possível encontrar a capa do YouTube.');
        }
      } else {
        Alert.alert('Não encontrada', 'Não foi possível encontrar capas no YouTube para esta música.');
      }
    } catch (err) {
      console.warn('Erro ao buscar capa:', err);
    } finally {
      setIsSearchingCover(false);
    }
  }

  function handleSave() {
    if (!name.trim()) {
      Alert.alert('Atenção', 'O nome da música é obrigatório.');
      return;
    }

    const formattedArtist = formatArtistName(artist);
    const dup = findExistingChord(name, formattedArtist, isEditing ? id : undefined);
    if (dup) {
      const msg = `Já existe uma música cadastrada com o nome "${dup.name}" para o artista "${dup.artist || 'Sem artista'}". Não é permitido cadastrar músicas duplicadas.`;
      if (Platform.OS === 'web') {
        window.alert(msg);
      } else {
        Alert.alert('Música Duplicada', msg);
      }
      return;
    }

    // Se estiver no modo de sessões fatiadas, compila antes de salvar
    const finalLyrics = (step === 2 && subStep === 2 && sections.length > 0)
      ? compileSectionsToLyrics(sections)
      : lyrics;

    const formattedLink = externalLink.trim()
      ? (extractYoutubeId(externalLink.trim()) ? toYoutubeMusicUrl(externalLink.trim()) : externalLink.trim())
      : '';

    const chordData = {
      name: name.trim(),
      artist: formattedArtist,
      tone: tone,
      lyrics: finalLyrics,
      externalLink: formattedLink,
      note: note.trim(),
      capo: hasCapo && typeof capoFret === 'number' && capoFret !== 0 ? capoFret : undefined,
      timbre: hasTimbres && timbreText.trim() ? timbreText.trim() : undefined,
      style: hasTimbres && styleText.trim() ? styleText.trim() : undefined,
      cover_url: coverUrl.trim(),
      cover_local_uri: coverLocalUri.trim(),
    };

    if (isEditing && id) {
      updateChord(id, chordData);
      if (coverUrl.trim()) {
        cacheCoverImage(id, coverUrl.trim()).then(localUri => {
          if (localUri && localUri !== coverUrl.trim()) {
            updateChordCover(id, coverUrl.trim(), localUri);
          }
        }).catch(() => { });
      }
      router.back();
    } else {
      const newId = createChord(chordData);
      if (coverUrl.trim()) {
        cacheCoverImage(newId, coverUrl.trim()).then(localUri => {
          if (localUri && localUri !== coverUrl.trim()) {
            updateChordCover(newId, coverUrl.trim(), localUri);
          }
        }).catch(() => { });
      }
      if (playlistId) {
        linkChordToPlaylist(newId, playlistId);
      }
      router.replace({ pathname: '/chord/[id]', params: { id: newId, playlistId } });
    }
  }

  function handleDeleteChord() {
    if (!id) return;
    const confirmDelete = () => {
      deleteChord(id);
      if (playlistId) {
        router.replace({ pathname: '/playlist/[id]', params: { id: playlistId } });
      } else {
        router.replace('/');
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Tem certeza que deseja excluir esta música? Esta ação não pode ser desfeita.')) {
        confirmDelete();
      }
    } else {
      Alert.alert(
        'Excluir Música',
        'Tem certeza que deseja excluir esta música permanentemente? Esta ação não pode ser desfeita.',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Excluir', style: 'destructive', onPress: confirmDelete }
        ]
      );
    }
  }

  const sty = makeStyles(colors);
  const currentSection = sections[currentSectionIndex];

  return (
    <SafeAreaView style={sty.container}>
      {/* Header Superior */}
      <View style={sty.header}>
        <Pressable onPress={handleBack} style={sty.backBtn}>
          <Ionicons name="chevron-back-outline" size={24} color={colors.text} />
        </Pressable>

        <View style={sty.stepTitleWrap}>
          <View style={sty.stepNumberBadge}>
            <Text style={sty.stepNumberBadgeTxt}>{step}.{subStep}</Text>
          </View>
          <Text style={sty.stepTitleText} numberOfLines={1}>
            {step === 1
              ? (isEditing ? 'Editar Cifra' : 'Criar Cifra')
              : (subStep === 1 ? 'Letras & Sessões' : 'Cifras nas Sessões')}
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={sty.scrollContent}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets={true}
        >

          {/* =========================================================================
              ETAPA 1: METADADOS DA CIFRA
             ========================================================================= */}
          {step === 1 && (
            <View style={sty.stepContainer}>

              {/* --- SUBETAPA 1: Música e Artista --- */}
              {subStep === 1 && (
                <View style={sty.card}>
                  <View style={sty.sectionHeaderRow}>
                    <Text style={sty.sectionTitle}>Identificação da Música</Text>
                  </View>

                  <View style={sty.fieldGroup}>
                    <Text style={sty.label}>MÚSICA</Text>
                    <TextInput
                      style={sty.input}
                      placeholder="Ex: Te Louvarei, A Casa é Sua..."
                      placeholderTextColor={colors.placeholder}
                      value={name}
                      onChangeText={setName}
                      autoFocus={!isEditing}
                    />
                  </View>

                  <View style={sty.fieldGroup}>
                    <Text style={sty.label}>ARTISTA</Text>
                    <TextInput
                      style={sty.input}
                      placeholder="Ex: Casa Worship, Gabriela Rocha..."
                      placeholderTextColor={colors.placeholder}
                      value={artist}
                      onChangeText={(t) => {
                        setArtist(t);
                        setShowArtistSuggestions(true);
                      }}
                      onFocus={() => setShowArtistSuggestions(true)}
                    />

                    {showArtistSuggestions && filteredArtists.length > 0 && (
                      <View style={sty.suggestionsBox}>
                        <Text style={sty.suggestionsHeader}>Artistas no sistema:</Text>
                        <View style={sty.suggestionsList}>
                          {filteredArtists.map((art) => (
                            <TouchableOpacity
                              key={art}
                              style={sty.suggestionChip}
                              onPress={() => { setArtist(art); setShowArtistSuggestions(false); }}
                              activeOpacity={0.7}
                            >
                              <Ionicons name="person-outline" size={13} color={colors.accent} />
                              <Text style={sty.suggestionChipTxt}>{art}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    )}
                  </View>

                  <View style={sty.fieldGroup}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={sty.label}>LINK DA MÚSICA</Text>
                      <Ionicons name="logo-youtube" size={15} color="#ef4444" />
                    </View>
                    <TextInput
                      style={sty.input}
                      placeholder="https://www.youtube.com/watch?v=... ou https://youtu.be/..."
                      placeholderTextColor={colors.placeholder}
                      value={externalLink}
                      onChangeText={handleExternalLinkChange}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>

                  <View style={sty.fieldGroup}>
                    <Text style={sty.label}>CAPA DO ÁLBUM</Text>
                    <View style={sty.coverPickerRow}>
                      <View style={{ width: 56, height: 56, borderRadius: 12, backgroundColor: colors.input, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border }}>
                        <ChordCover
                          coverUrl={coverUrl}
                          coverLocalUri={coverLocalUri}
                          size={56}
                          borderRadius={12}
                          fallback={<Ionicons name="disc-outline" size={26} color={colors.accent} />}
                        />
                      </View>
                      <View style={{ flex: 1, gap: 6 }}>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                          <TouchableOpacity
                            style={[sty.searchCoverBtn, isSearchingCover && { opacity: 0.6 }]}
                            onPress={handleSearchCover}
                            disabled={isSearchingCover}
                            activeOpacity={0.7}
                          >
                            <Ionicons name={isSearchingCover ? "sync-outline" : "disc-outline"} size={12} color="#ffffff" />
                            <Text style={sty.searchCoverBtnTxt}>
                              {isSearchingCover ? 'Buscando...' : (coverUrl ? 'Buscar Nova Capa' : 'Buscar Capa YT')}
                            </Text>
                          </TouchableOpacity>
                          {Boolean(coverUrl) && (
                            <TouchableOpacity
                              style={sty.removeCoverBtn}
                              onPress={() => { setCoverUrl(''); setCoverLocalUri(''); }}
                              activeOpacity={0.7}
                            >
                              <Ionicons name="remove-circle-outline" size={20} color="#e60b08" />
                            </TouchableOpacity>
                          )}
                        </View>
                        <Text style={sty.coverHintText}>Busca a capa no YT Music.</Text>
                      </View>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={[sty.primaryActionBtn, { opacity: name.trim() ? 1 : 0.5 }]}
                    onPress={handleNextSubStep}
                    disabled={!name.trim()}
                    activeOpacity={0.8}
                  >
                    <Text style={sty.primaryActionTxt}>Continuar</Text>
                    <Ionicons name="chevron-forward-outline" size={18} color="#ffffff" />
                  </TouchableOpacity>
                </View>
              )}

              {/* --- SUBETAPA 2: Tom, Capo (-12 a +12), Timbres e Anotações --- */}
              {subStep === 2 && (
                <View style={sty.card}>
                  <View style={sty.sectionHeaderRow}>
                    <Text style={sty.sectionTitle}>Tom e Configurações</Text>
                  </View>

                  {/* Seletor de Tom Responsivo */}
                  <View style={sty.fieldGroup}>
                    <Text style={sty.label}>TOM DA MÚSICA</Text>
                    <TouchableOpacity
                      style={sty.toneSelectorRow}
                      onPress={() => setToneModal(true)}
                      activeOpacity={0.7}
                    >
                      <View style={sty.toneSelectorInfo}>
                        <Text style={sty.toneSelectorLabel}>Tom Selecionado</Text>
                        <Ionicons name="musical-notes" size={18} color={colors.accent} />
                      </View>

                      <View style={sty.toneBadgeOfficial}>
                        <Text style={sty.toneBadgeText}>{tone}</Text>
                        <Ionicons name="chevron-down" size={14} color={colors.accent} />
                      </View>
                    </TouchableOpacity>
                  </View>

                  {/* Capotraste / Transposição (-12 a +12) */}
                  <View style={sty.fieldGroup}>
                    <View style={sty.switchRow}>
                      <View style={{ flex: 1, paddingRight: 8 }}>
                        <Text style={sty.switchLabel}>Adicionar Transpos</Text>
                        <Text style={sty.switchSub}>Ajuste de afinação em semitons</Text>
                      </View>

                      <View style={sty.yesNoToggle}>
                        <TouchableOpacity
                          style={[sty.yesNoBtn, !hasCapo && sty.yesNoBtnActive]}
                          onPress={() => { setHasCapo(false); setCapoFret(0); }}
                        >
                          <Text style={[sty.yesNoTxt, !hasCapo && sty.yesNoTxtActive]}>Não</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[sty.yesNoBtn, hasCapo && sty.yesNoBtnActive]}
                          onPress={() => { setHasCapo(true); }}
                        >
                          <Text style={[sty.yesNoTxt, hasCapo && sty.yesNoTxtActive]}>Sim</Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    {hasCapo && (
                      <View style={sty.capoStepperWrap}>
                        <Text style={sty.capoFretDisplay}>
                          {(capoFret || 0) === 0
                            ? '0 (Original / Sem Capo)'
                            : `${transposeTone(tone, capoFret || 0)} (${(capoFret || 0) > 0 ? `+${capoFret}` : capoFret})`}
                        </Text>
                        <View style={sty.stepperRow}>
                          <TouchableOpacity
                            style={sty.stepperBtn}
                            onPress={() => setCapoFret(prev => Math.max(-12, (prev || 0) - 1))}
                            disabled={(capoFret || 0) <= -12}
                          >
                            <Text style={sty.stepperTxt}>−</Text>
                          </TouchableOpacity>

                          <Text style={sty.stepperValue}>
                            {(capoFret || 0) > 0 ? `+${capoFret}` : (capoFret || 0)}
                          </Text>

                          <TouchableOpacity
                            style={sty.stepperBtn}
                            onPress={() => setCapoFret(prev => Math.min(12, (prev || 0) + 1))}
                            disabled={(capoFret || 0) >= 12}
                          >
                            <Text style={sty.stepperTxt}>+</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                  </View>

                  {/* Timbres e Estilos */}
                  <View style={sty.fieldGroup}>
                    <View style={sty.switchRow}>
                      <View style={{ flex: 1, paddingRight: 8 }}>
                        <Text style={sty.switchLabel}>Timbres e Estilos</Text>
                        <Text style={sty.switchSub}>Registros de teclado e ritmos</Text>
                      </View>

                      <View style={sty.yesNoToggle}>
                        <TouchableOpacity
                          style={[sty.yesNoBtn, !hasTimbres && sty.yesNoBtnActive]}
                          onPress={() => setHasTimbres(false)}
                        >
                          <Text style={[sty.yesNoTxt, !hasTimbres && sty.yesNoTxtActive]}>Não</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[sty.yesNoBtn, hasTimbres && sty.yesNoBtnActive]}
                          onPress={() => setHasTimbres(true)}
                        >
                          <Text style={[sty.yesNoTxt, hasTimbres && sty.yesNoTxtActive]}>Sim</Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    {hasTimbres && (
                      <View style={sty.timbresInputsWrap}>
                        <View style={{ marginBottom: 10 }}>
                          <Text style={sty.subLabel}>TIMBRES</Text>
                          <TextInput
                            style={sty.input}
                            placeholder="Ex: Piano + Strings, Synth..."
                            placeholderTextColor={colors.placeholder}
                            value={timbreText}
                            onChangeText={setTimbreText}
                          />
                        </View>

                        <View>
                          <Text style={sty.subLabel}>STYLE / RITMO</Text>
                          <TextInput
                            style={sty.input}
                            placeholder="Ex: Pop 8 Beat, 68 BPM..."
                            placeholderTextColor={colors.placeholder}
                            value={styleText}
                            onChangeText={setStyleText}
                          />
                        </View>
                      </View>
                    )}
                  </View>

                  {/* Anotações Extras */}
                  <View style={sty.fieldGroup}>
                    <Text style={sty.label}>ANOTAÇÕES</Text>
                    <TextInput
                      style={[sty.input, sty.textArea]}
                      placeholder="Informações extras, dinâmicas, observações..."
                      placeholderTextColor={colors.placeholder}
                      value={note}
                      onChangeText={setNote}
                      multiline
                      numberOfLines={3}
                    />
                  </View>

                  {/* Botões de Ação */}
                  <View style={sty.actionButtonsRow}>
                    <TouchableOpacity
                      style={sty.secondaryActionBtn}
                      onPress={() => setSubStep(1)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="chevron-back-outline" size={16} color={colors.text} />
                      <Text style={sty.secondaryActionTxt}>Voltar</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={sty.primaryActionBtn}
                      onPress={() => { setStep(2); setSubStep(1); }}
                      activeOpacity={0.8}
                    >
                      <Text style={sty.primaryActionTxt} numberOfLines={1}>Ir para Letras</Text>
                      <Ionicons name="arrow-forward" size={16} color="#ffffff" />
                    </TouchableOpacity>
                  </View>

                  {/* Opção de Excluir Música */}
                  {isEditing && id ? (
                    <TouchableOpacity
                      style={sty.deleteDangerBtn}
                      onPress={handleDeleteChord}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="trash-outline" size={25} color={colors.text} />
                      <Text style={sty.deleteDangerTxt}>Excluir Esta Música</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              )}

            </View>
          )}

          {/* =========================================================================
              ETAPA 2: LETRAS E SESSÕES & CIFRAGEM FATIADA
             ========================================================================= */}
          {step === 2 && (
            <View style={sty.stepContainer}>

              {/* --- SUBETAPA 1: Letras e Sessões (Inserção Geral com Teclado Nativo) --- */}
              {subStep === 1 && (
                <View style={sty.card}>
                  <View style={sty.sectionHeaderRow}>
                    <Text style={sty.sectionTitle}>Letras e Sessões</Text>
                  </View>

                  {/* Tags Rápidas */}
                  <View style={sty.quickTagsRow}>
                    {['[Intro]', '[Parte 1]', '[Parte 2]', '[Pré-Refrão]', '[Refrão]', '[Ponte]', '[Solo]', '[Final]'].map((tag) => (
                      <TouchableOpacity
                        key={tag}
                        style={sty.quickTagBtn}
                        onPress={() => {
                          setLyrics(prev => prev ? `${prev}\n\n${tag}\n` : `${tag}\n`);
                        }}
                      >
                        <Text style={sty.quickTagTxt}>{tag}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <TextInput
                    style={[sty.input, sty.lyricsEditor]}
                    placeholder={`[Intro]\n(Sua introdução aqui...)\n\n[Parte 1]\nTu, te abeiraste da praia\nNão buscaste nem sábios, nem ricos\n\n[Refrão]\nSenhor, Tu me olhaste nos olhos`}
                    placeholderTextColor={colors.placeholder}
                    value={lyrics}
                    onChangeText={setLyrics}
                    multiline
                    textAlignVertical="top"
                  />

                  <View style={sty.actionButtonsRow}>
                    <TouchableOpacity
                      style={sty.secondaryActionBtn}
                      onPress={() => { setStep(1); setSubStep(2); }}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="chevron-back-outline" size={16} color={colors.text} />
                      <Text style={sty.secondaryActionTxt}>Voltar</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={sty.primaryActionBtn}
                      onPress={handleGoToSlicedSections}
                      activeOpacity={0.8}
                    >
                      <Text style={sty.primaryActionTxt} numberOfLines={1}>Cifrar por Sessão</Text>
                      <Ionicons name="arrow-forward" size={16} color="#ffffff" />
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* --- SUBETAPA 2: Cifras nas Sessões (Apenas a Sessão Selecionada / Fatiada!) --- */}
              {subStep === 2 && currentSection && (
                <View style={sty.card}>
                  <View style={sty.sectionHeaderRow}>
                    <Ionicons name="musical-notes" size={26} color={colors.accent} />
                    <View style={{ flex: 1 }}>
                      <Text style={sty.sectionTitle}>Sessão {currentSectionIndex + 1} de {sections.length}</Text>
                      <Text style={sty.subStepHelper}>Tom: <Text style={{ color: colors.accent, fontWeight: '700' }}>{tone}</Text></Text>
                    </View>

                    <TouchableOpacity
                      style={sty.keyboardToggleBtn}
                      onPress={() => {
                        const nextMode = keyboardMode === 'chords' ? 'native' : 'chords';
                        setKeyboardMode(nextMode);
                        if (nextMode === 'chords') {
                          Keyboard.dismiss();
                        } else {
                          setTimeout(() => {
                            sectionInputRef.current?.focus();
                          }, 50);
                        }
                      }}
                      activeOpacity={0.7}
                    >
                      <Ionicons name={keyboardMode === 'chords' ? 'keypad' : 'create-outline'} size={20} color={colors.accent} />
                      <Text style={sty.keyboardToggleTxt}>
                        {keyboardMode === 'chords' ? 'ACORDES' : 'DIGITAR'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Abas Horizontais das Sessões Fatiadas */}
                  <View style={sty.sectionNavigationHeader}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={sty.sectionsTabsScroll}>
                      {sections.map((sec, sIdx) => {
                        const isCur = sIdx === currentSectionIndex;
                        return (
                          <TouchableOpacity
                            key={sec.id}
                            style={[sty.sectionTab, isCur && sty.sectionTabActive]}
                            onPress={() => {
                              setCurrentSectionIndex(sIdx);
                              if (keyboardMode === 'chords') {
                                Keyboard.dismiss();
                              }
                            }}
                          >
                            <Text style={[sty.sectionTabTxt, isCur && sty.sectionTabTxtActive]}>
                              {sec.title}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>

                  {/* Bloco da Sessão Selecionada Exclusivamente */}
                  <View style={sty.singleSectionCard}>
                    <View style={sty.singleSectionHeader}>
                      <Text style={sty.singleSectionTitleText}>{currentSection.title}</Text>
                      <Text style={sty.singleSectionIndicator}>
                        {keyboardMode === 'chords' ? 'Modo Acordes' : 'Modo Digitação'}
                      </Text>
                    </View>

                    <TextInput
                      ref={sectionInputRef}
                      style={[sty.input, sty.lyricsEditorInteractive]}
                      value={currentSection.content}
                      onChangeText={handleUpdateCurrentSectionContent}
                      onSelectionChange={(e) => setCursorPos(e.nativeEvent.selection)}
                      multiline
                      textAlignVertical="top"
                      placeholder="Posicione o cursor aqui e toque nos acordes abaixo..."
                      placeholderTextColor={colors.placeholder}
                      showSoftInputOnFocus={keyboardMode === 'native'}
                    />
                  </View>

                 

                  {/* Teclado de Acordes do Campo Harmônico */}
                  {keyboardMode === 'chords' && (
                    <View style={sty.chordKeyboardContainer}>
                      <View style={sty.chordKeyboardHeader}>
                        <Text style={sty.chordKeyboardTitle}>Campo Harmônico de {tone}:</Text>
                        <Text style={sty.chordKeyboardSub}>Aperte e segure para ver variações</Text>
                      </View>

                      <View style={sty.chordsGrid}>
                        {harmonicChords.map((ch) => (
                          <TouchableOpacity
                            key={ch}
                            style={sty.chordKeyBtn}
                            onPress={() => handleInsertChordInCurrentSection(ch)}
                            onLongPress={() => setActiveChordForVariations(ch)}
                            delayLongPress={250}
                            activeOpacity={0.7}
                          >
                            <Text style={sty.chordKeyTxt}>{ch}</Text>
                          </TouchableOpacity>
                        ))}
                         {/* Barra de Ações Rápidas: Espaço, Tab, Enter e Apagar */}
                      <View style={sty.keyboardActionsRow}>
                        <TouchableOpacity
                          style={sty.spaceBarBtn}
                          onPress={() => handleInsertSpace(1)}
                          activeOpacity={0.7}
                        >
                          <Text style={sty.spaceBarTxt}>␣  Espaço</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={sty.keyActionBtn}
                          onPress={() => handleInsertSpace(3)}
                          activeOpacity={0.7}
                        >
                          <Text style={sty.keyActionTxt}>+3 Espaços</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={sty.keyActionBtn}
                          onPress={handleInsertNewline}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="return-down-back" size={15} color={colors.text} />
                          <Text style={sty.keyActionTxt}>Enter</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={sty.keyActionBtn}
                          onPress={handleBackspace}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="backspace-outline" size={15} color={colors.text} />
                          <Text style={sty.keyActionTxt}>Apagar</Text>
                        </TouchableOpacity>
                      </View>
                      </View>

                     

                      {activeChordForVariations && (
                        <View style={sty.variationsWrap}>
                          <View style={sty.variationsHeader}>
                            <Text style={sty.variationsTitle}>Variações de {activeChordForVariations}:</Text>
                            <TouchableOpacity onPress={() => setActiveChordForVariations(null)}>
                              <Ionicons name="close-circle" size={18} color={colors.textSub} />
                            </TouchableOpacity>
                          </View>

                          <View style={sty.variationsGrid}>
                            {getChordVariations(activeChordForVariations).map((vCh) => (
                              <TouchableOpacity
                                key={vCh}
                                style={sty.variationBtn}
                                onPress={() => {
                                  handleInsertChordInCurrentSection(vCh);
                                  setActiveChordForVariations(null);
                                }}
                              >
                                <Text style={sty.variationTxt}>{vCh}</Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </View>
                      )}
                    </View>
                  )}

                  {/* Botões Finais de Ação */}
                  <View style={sty.actionButtonsRow}>
                    <TouchableOpacity
                      style={sty.secondaryActionBtn}
                      onPress={handleBack}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="chevron-back-outline" size={16} color={colors.text} />
                      <Text style={sty.secondaryActionTxt}>Voltar</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={sty.primaryActionBtn}
                      onPress={handleSave}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="checkmark-circle" size={18} color="#ffffff" />
                      <Text style={sty.primaryActionTxt} numberOfLines={1}>Salvar Cifra</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

            </View>
          )}

        </ScrollView>
      </KeyboardAvoidingView>

      {/* Modal de Escolha de Tom */}
      <Modal visible={toneModal} transparent animationType="fade" onRequestClose={() => setToneModal(false)}>
        <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />
        <Pressable style={sty.modalBackdrop} onPress={() => setToneModal(false)}>
          <Pressable style={sty.modalCard} onPress={e => e.stopPropagation()}>
            <Text style={sty.modalTitle}>SELECIONE O TOM</Text>

            <View style={sty.modalTabsRow}>
              <TouchableOpacity
                style={[sty.modalTab, toneTab === 'major' && sty.modalTabActive]}
                onPress={() => setToneTab('major')}
              >
                <Text style={[sty.modalTabTxt, toneTab === 'major' && sty.modalTabTxtActive]}>
                  Maiores
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[sty.modalTab, toneTab === 'minor' && sty.modalTabActive]}
                onPress={() => setToneTab('minor')}
              >
                <Text style={[sty.modalTabTxt, toneTab === 'minor' && sty.modalTabTxtActive]}>
                  Menores
                </Text>
              </TouchableOpacity>
            </View>

            <View style={sty.toneGridModal}>
              {(toneTab === 'major' ? MAJOR_TONES : MINOR_TONES).map((t) => {
                const isCur = t === tone;
                return (
                  <TouchableOpacity
                    key={t}
                    style={[sty.toneCellModal, isCur && sty.toneCellModalActive]}
                    onPress={() => handleSelectTone(t)}
                    activeOpacity={0.7}
                  >
                    <Text style={[sty.toneCellModalTxt, isCur && sty.toneCellModalTxtActive]}>
                      {t}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity style={sty.modalCloseBtn} onPress={() => setToneModal(false)}>
              <Text style={sty.modalCloseBtnTxt}>Selecionar</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

    </SafeAreaView>
  );
}

function makeStyles(c: any) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: 'transparent',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-start',
      gap: 10,
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: 'transparent',
    },
    backBtn: {
      padding: 6,
    },
    stepTitleWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flexShrink: 1,
    },
    stepNumberBadge: {
      backgroundColor: c.accent,
      paddingHorizontal: 15,
      paddingVertical: 0,
      borderRadius: 20,
    },
    stepNumberBadgeTxt: {
      color: '#ffffff',
      fontSize: 16,
      fontWeight: '600',
    },
    stepTitleText: {
      fontSize: 20,
      fontWeight: '700',
      color: c.text,
      fontFamily: 'Inter_600Bold',
      flexShrink: 1,
    },
    deleteHeaderBtn: {
      padding: 6,
      borderRadius: 20,
      backgroundColor: 'rgba(239, 68, 68, 0.12)',
    },
    deleteDangerBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: 'rgba(238, 9, 9, 0.8)',
      paddingVertical: 12,
      borderRadius: 20,
      marginTop: 8,
      width: '100%',
    },
    deleteDangerTxt: {
      color: c.text,
      fontWeight: '700',
      fontSize: 14,
    },
    scrollContent: {
      padding: 16,
      paddingBottom: 280,
    },
    stepContainer: {
      gap: 14,
    },
    card: {
      borderRadius: 20,
      padding: 14,
      gap: 16,
      width: '100%',
    },
    sectionHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingBottom: 10,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: c.text,
      fontFamily: 'Inter_700Bold',
      borderBottomWidth: 1,
      borderBottomColor: c.accent,
    },
    subStepHelper: {
      fontSize: 12,
      color: c.textSub,
      marginTop: 2,
    },
    fieldGroup: {
      gap: 6,
      width: '100%',
    },
    label: {
      fontSize: 12,
      fontWeight: '600',
      color: c.textSub,
      letterSpacing: 0.8,
      fontFamily: 'Inter_600SemiBold',
      paddingBottom: 3,
    },
    subLabel: {
      fontSize: 11,
      fontWeight: '600',
      color: c.textSub,
      marginBottom: 4,
    },
    input: {
      backgroundColor: c.input,
      borderRadius: 20,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      color: c.text,
      borderWidth: 1,
      borderColor: c.border,
      width: '100%',
    },
    textArea: {
      minHeight: 65,
      textAlignVertical: 'top',
    },
    lyricsEditor: {
      minHeight: 400,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      fontSize: 14,
      lineHeight: 22,
    },
    lyricsEditorInteractive: {
      minHeight: 160,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      fontSize: 15,
      lineHeight: 24,
      borderWidth: 0,
      backgroundColor: 'transparent',
      paddingHorizontal: 0,
    },

    // Seletor de Tom Responsivo
    toneSelectorRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: c.input,
      paddingHorizontal: 14,
      paddingVertical: 5,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: c.border,
      width: '100%',
    },
    toneSelectorInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flex: 1,
    },
    toneSelectorLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: c.text,
    },
    toneBadgeOfficial: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: c.card,
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 30,
      borderWidth: 1.5,
      borderColor: c.accent,
    },
    toneBadgeText: {
      color: c.accent,
      fontWeight: '700',
      fontSize: 15,
    },

    // Switches Sim / Não com Flex Seguro
    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      width: '100%',
    },
    switchLabel: {
      fontSize: 13,
      fontWeight: '700',
      color: c.text,
    },
    switchSub: {
      fontSize: 11,
      color: c.textSub,
      marginTop: 2,
    },
    yesNoToggle: {
      flexDirection: 'row',
      backgroundColor: c.input,
      borderRadius: 20,
      padding: 2,
      borderWidth: 1,
      borderColor: c.border,
    },
    yesNoBtn: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 20,
    },
    yesNoBtnActive: {
      backgroundColor: c.accent,
    },
    yesNoTxt: {
      fontSize: 12,
      fontWeight: '500',
      color: c.textSub,
    },
    yesNoTxtActive: {
      color: '#ffffff',
      fontWeight: '700',
    },

    // Capotraste Stepper (-12 a +12)
    capoStepperWrap: {
      marginTop: 6,
      backgroundColor: c.input,
      borderRadius: 20,
      padding: 10,
      alignItems: 'center',
      gap: 6,
      borderWidth: 1,
      borderColor: c.border,
      width: '100%',
    },
    capoFretDisplay: {
      fontSize: 13,
      fontWeight: '700',
      color: c.accent,
    },
    stepperRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
    },
    stepperBtn: {
      width: 36,
      height: 36,
      borderRadius: 8,
      backgroundColor: c.card,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: c.border,
    },
    stepperTxt: {
      color: c.text,
      fontSize: 20,
      fontWeight: '700',
      lineHeight: 22,
    },
    stepperValue: {
      fontSize: 16,
      fontWeight: '800',
      color: c.text,
      minWidth: 32,
      textAlign: 'center',
    },

    // Timbres Inputs
    timbresInputsWrap: {
      marginTop: 6,
      backgroundColor: c.input,
      borderRadius: 10,
      padding: 10,
      borderWidth: 1,
      borderColor: c.border,
      width: '100%',
    },

    // Tags Rápidas de Sessões
    quickTagsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      width: '100%',
    },
    quickTagBtn: {
      backgroundColor: c.input,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: c.border,
    },
    quickTagTxt: {
      fontSize: 12,
      fontWeight: '500',
      color: c.text,
    },

    // Teclado Toggle
    keyboardToggleBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: c.input,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: 20,
    },
    keyboardToggleTxt: {
      fontSize: 11,
      fontWeight: '700',
      color: c.accent,
    },

    // Abas de Sessões no Step 2 Substep 2
    sectionNavigationHeader: {
      width: '100%',
    },
    sectionsTabsScroll: {
      gap: 6,
      paddingVertical: 2,
    },
    sectionTab: {
      backgroundColor: c.input,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: c.border,
    },
    sectionTabActive: {
      backgroundColor: c.accent,
      borderColor: c.accent,
    },
    sectionTabTxt: {
      fontSize: 12,
      fontWeight: '600',
      color: c.textSub,
    },
    sectionTabTxtActive: {
      color: '#ffffff',
      fontWeight: '700',
    },

    // Card de Sessão Fatiada Exclusiva
    singleSectionCard: {
      backgroundColor: c.input,
      borderRadius: 12,
      padding: 12,
      borderWidth: 1,
      borderColor: c.border,
      gap: 8,
      width: '100%',
    },
    singleSectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingBottom: 6,
      borderBottomWidth: 1,
      borderColor: c.border,
    },
    singleSectionTitleText: {
      fontSize: 14,
      fontWeight: '700',
      color: c.accent,
    },
    singleSectionIndicator: {
      fontSize: 11,
      color: c.textSub,
    },

    // Botões de Próxima/Anterior Sessão
    sectionNavButtonsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 8,
    },
    navSectionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: c.input,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: c.border,
    },
    navSectionBtnTxt: {
      fontSize: 12,
      color: c.text,
      fontWeight: '600',
    },

    // Teclado de Acordes
    chordKeyboardContainer: {
      backgroundColor: c.input,
      borderRadius: 12,
      padding: 12,
      borderWidth: 1,
      borderColor: c.border,
      gap: 10,
      width: '100%',
    },
    chordKeyboardHeader: {
      gap: 2,
    },
    chordKeyboardTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: c.text,
    },
    chordKeyboardSub: {
      fontSize: 11,
      color: c.textSub,
    },
    chordsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      justifyContent: 'center',
      width: '100%',
    },
    chordKeyBtn: {
      width: '22%',
      paddingVertical: 10,
      borderRadius: 8,
      backgroundColor: c.card,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.5,
      borderColor: c.border,
      elevation: 2,
    },
    chordKeyTxt: {
      fontSize: 15,
      fontWeight: '700',
      color: c.accent,
    },

    // Ações Rápidas do Teclado (Espaço, Tab, Enter, Apagar)
    keyboardActionsRow: {
      alignItems: 'center',
      gap: 6,
      marginTop: 4,
      width: '100%',
    },
    spaceBarBtn: {
      flex: 2,
      backgroundColor: c.card,
      paddingVertical: 10,
      paddingHorizontal: 30,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.5,
      borderColor: c.accent,
    },
    spaceBarTxt: {
      fontSize: 13,
      fontWeight: '700',
      color: c.accent,
    },
    keyActionBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      backgroundColor: c.card,
      paddingVertical: 10,
      paddingHorizontal: 30,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: c.border,
    },
    keyActionTxt: {
      fontSize: 11,
      fontWeight: '600',
      color: c.text,
    },

    // Variações
    variationsWrap: {
      marginTop: 6,
      paddingTop: 8,
      borderTopWidth: 1,
      borderColor: c.border,
      gap: 8,
      width: '100%',
    },
    variationsHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    variationsTitle: {
      fontSize: 12,
      fontWeight: '700',
      color: c.text,
    },
    variationsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      width: '100%',
    },
    variationBtn: {
      backgroundColor: c.card,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: c.accent,
    },
    variationTxt: {
      fontSize: 12,
      fontWeight: '700',
      color: c.text,
    },

    // Sugestões de Artistas
    suggestionsBox: {
      marginTop: 4,
      backgroundColor: c.input,
      borderRadius: 8,
      padding: 8,
      borderWidth: 1,
      borderColor: c.border,
      gap: 6,
      width: '100%',
    },
    suggestionsHeader: {
      fontSize: 11,
      color: c.textSub,
      fontWeight: '600',
    },
    suggestionsList: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      width: '100%',
    },
    suggestionChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: c.card,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.border,
    },
    suggestionChipTxt: {
      fontSize: 12,
      color: c.text,
    },

    // Botões de Ação
    actionButtonsRow: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 6,
      width: '100%',
    },
    primaryActionBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: c.accent,
      paddingVertical: 12,
      borderRadius: 10,
    },
    primaryActionTxt: {
      color: '#ffffff',
      fontWeight: '700',
      fontSize: 14,
    },
    secondaryActionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      backgroundColor: c.input,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: c.border,
    },
    secondaryActionTxt: {
      color: c.text,
      fontWeight: '600',
      fontSize: 13,
    },

    // Modal de Escolha de Tom
    modalBackdrop: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(0,0,0,0.5)',
    },
    modalCard: {
      backgroundColor: c.card,
      borderRadius: 18,
      padding: 18,
      width: '100%',
      maxWidth: 340,
      borderWidth: 1,
      borderColor: c.border,
      elevation: 12,
      gap: 12,
    },
    modalTitle: {
      fontSize: 20,
      fontFamily: 'Inter_600Bold',
      color: c.text,
      textAlign: 'center',
    },
    modalTabsRow: {
      flexDirection: 'row',
      backgroundColor: c.accent,
      borderRadius: 20,
      padding: 3,
      gap: 4,
    },
    modalTab: {
      flex: 1,
      paddingVertical: 6,
      alignItems: 'center',
      borderRadius: 20,
    },
    modalTabActive: {
      backgroundColor: c.card,
    },
    modalTabTxt: {
      fontSize: 12,
      fontWeight: '600',
      color: c.textSub,
    },
    modalTabTxtActive: {
      color: c.accent,
      fontWeight: '700',
    },
    toneGridModal: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      justifyContent: 'center',
    },
    toneCellModal: {
      width: '22%',
      paddingVertical: 10,
      borderRadius: 20,
      backgroundColor: c.input,
      alignItems: 'center',
      justifyContent: 'center',
    },
    toneCellModalActive: {
      backgroundColor: c.accent,
      borderColor: c.accent,
    },
    toneCellModalTxt: {
      fontSize: 16,
      fontWeight: '600',
      color: c.text,
    },
    toneCellModalTxtActive: {
      color: '#ffffff',
    },
    modalCloseBtn: {
      paddingVertical: 10,
      borderRadius: 10,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: c.text,
      marginTop: 4,
    },
    modalCloseBtnTxt: {
      color: c.text,
      fontWeight: '600',
      fontSize: 13,
    },
    coverPickerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: c.input,
      borderRadius: 14,
      padding: 12,
      borderWidth: 1,
      borderColor: c.border,
    },
    searchCoverBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: c.accent,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
    },
    searchCoverBtnTxt: {
      color: '#ffffff',
      fontWeight: '500',
      fontSize: 13,
    },
    removeCoverBtn: {
      padding: 8,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: c.input,
      alignItems: 'center',
      justifyContent: 'center',
    },
    coverHintText: {
      fontSize: 11,
      color: c.textSub,
    },
  });
}
