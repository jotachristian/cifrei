import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Colors } from '@/lib/theme';
import { Ionicons } from '@expo/vector-icons';
import { ALL_TONES } from '@/lib/transpose';

const NOTES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

interface Props {
  initialTone: string;
  onInsert: (text: string) => void;
  onBackspace: () => void;
  colors: Colors;
}

export default function SmartKeyboard({ initialTone, onInsert, onBackspace, colors }: Props) {
  const [selectedTone, setSelectedTone] = useState(initialTone || 'C');

  // Compute harmonic field
  const { graus, inversoes } = useMemo(() => {
    const isMinor = selectedTone.endsWith('m');
    const base = isMinor ? selectedTone.slice(0, -1) : selectedTone;
    const rootIdx = NOTES.indexOf(base);
    if (rootIdx === -1) return { graus: [], inversoes: [] };

    const getNote = (semitones: number) => NOTES[(rootIdx + semitones) % 12];

    if (isMinor) {
      const i = getNote(0) + 'm';
      const III = getNote(3);
      const iv = getNote(5) + 'm';
      const v = getNote(7) + 'm';
      const VI = getNote(8);
      const VII = getNote(10);
      const V_maj = getNote(7);
      const i_bass = i + '/' + getNote(3);
      const iv_bass = iv + '/' + getNote(8);
      const V_bass = V_maj + '/' + getNote(11);
      
      return { graus: [i, III, iv, v, VI, VII], inversoes: [V_maj, i_bass, iv_bass, V_bass, i+'7', iv+'7'] };
    } else {
      const I = getNote(0);
      const ii = getNote(2) + 'm';
      const iii = getNote(4) + 'm';
      const IV = getNote(5);
      const V = getNote(7);
      const vi = getNote(9) + 'm';
      const I_bass = I + '/' + getNote(4);
      const V_bass = V + '/' + getNote(11);
      
      return { graus: [I, ii, iii, IV, V, vi], inversoes: [I_bass, V_bass, I+'7', IV+'7', V+'7', vi+'7'] };
    }
  }, [selectedTone]);

  const sty = StyleSheet.create({
    container: { backgroundColor: colors.input, paddingTop: 10, paddingBottom: 16, borderTopWidth: 1, borderColor: colors.border },
    toneScroll: { paddingHorizontal: 12, marginBottom: 12 },
    toneBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: colors.border, marginRight: 8, backgroundColor: colors.card },
    toneBtnActive: { backgroundColor: colors.accent, borderColor: colors.accent },
    toneTxt: { color: colors.textSub, fontSize: 14, fontWeight: 'bold' },
    toneTxtActive: { color: '#fff' },
    grid: { paddingHorizontal: 8, gap: 8 },
    row: { flexDirection: 'row', justifyContent: 'space-between', gap: 6, paddingHorizontal: 4 },
    chordBtn: { flex: 1, height: 50, backgroundColor: colors.card, borderRadius: 8, alignItems: 'center', justifyContent: 'center', elevation: 1, shadowColor: '#000', shadowOffset: {width: 0, height: 1}, shadowOpacity: 0.1, shadowRadius: 1 },
    chordTxt: { color: colors.text, fontSize: 17, fontWeight: 'bold' },
    suffixBtn: { flex: 1, height: 46, backgroundColor: colors.bg, borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
    suffixTxt: { color: colors.text, fontSize: 15, fontWeight: 'bold' },
    actionBtn: { height: 48, backgroundColor: colors.accent, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    actionTxt: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
    actionBtnSec: { height: 48, backgroundColor: colors.card, borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
    actionTxtSec: { color: colors.text, fontSize: 13, fontWeight: 'bold' },
  });

  return (
    <View style={sty.container}>
      {/* Top Bar: Seleção de Tom */}
      <View style={{height: 40}}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={sty.toneScroll}>
          {ALL_TONES.map(t => (
            <TouchableOpacity key={t} style={[sty.toneBtn, selectedTone === t && sty.toneBtnActive]} onPress={() => setSelectedTone(t)}>
              <Text style={[sty.toneTxt, selectedTone === t && sty.toneTxtActive]}>{t}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={sty.grid}>
        {/* Graus Principais */}
        <View style={sty.row}>
          {graus.map(c => (
            <TouchableOpacity key={c} style={sty.chordBtn} onPress={() => onInsert(c)}>
              <Text style={sty.chordTxt}>{c}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Inversões e Sufixos */}
        <View style={sty.row}>
          {['m', '7', 'M', 'maj7', 'dim', 'sus', '#', 'b', '/'].map(s => (
            <TouchableOpacity key={s} style={sty.suffixBtn} onPress={() => onInsert(s)}>
              <Text style={sty.suffixTxt}>{s}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Ações (Espaço, Enter, Apagar) */}
        <View style={sty.row}>
          <TouchableOpacity style={[sty.actionBtnSec, { flex: 1.2 }]} onPress={() => onInsert('[Refrão]\n')}>
            <Text style={sty.actionTxtSec}>[Ref]</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[sty.actionBtnSec, { flex: 1.2 }]} onPress={() => onInsert('[Estrofe]\n')}>
            <Text style={sty.actionTxtSec}>[Est]</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[sty.actionBtn, { flex: 2 }]} onPress={() => onInsert(' ')}>
            <Text style={sty.actionTxt}>ESPAÇO</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[sty.actionBtn, { flex: 2 }]} onPress={() => onInsert('\n')}>
            <Text style={sty.actionTxt}>ENTER</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[sty.actionBtnSec, { flex: 1.5, backgroundColor: colors.danger, borderColor: colors.danger }]} onPress={onBackspace}>
            <Ionicons name="backspace" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
