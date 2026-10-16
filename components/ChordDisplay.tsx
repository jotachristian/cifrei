import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { transposeChord } from '@/lib/transpose';
import { Colors } from '@/lib/theme';

interface Props {
  lyrics: string;
  semitones: number;
  showLyrics: boolean;
  fontSize: number;
  colors: Colors;
  onChordPress?: (chord: string) => void;
  onSectionLayout?: (secIdx: number, title: string, y: number) => void;
  highlightedSectionIdx?: number | null;
}

interface Seg { chord?: string; text: string; }

// ── detection ──────────────────────────────────────────────────────────────

// Permite combinacoes BR comuns: Am7, C7M, D7M(9), G#7(4/9), Bm7b5, Cmaj7/G, F#m11, etc.
// Sufixo permite parenteses com extensoes complexas, incluindo frações como (4/9).
const SUFFIX = '(?:m|M|maj|Maj|dim|°|º|aug|\\+|sus[24]?|add\\d+|[b#]?\\d+|\\([b#\\d,/\\s]+\\))*';
const CHORD_TOKEN = new RegExp(`^[A-G][b#]?${SUFFIX}(?:\\/[A-G][b#]?${SUFFIX})?$`);

function tokensAreAllChords(s: string): boolean {
  const t = s.trim();
  if (!t) return false;
  return t.split(/\s+/).every(tok => CHORD_TOKEN.test(tok));
}

/**
 * Escape hatch: linha envolvida em [..] forca interpretacao como cifra.
 * Retorna a linha com [ e ] substituidos por espaco (preserva alinhamento
 * de coluna com a letra abaixo). Retorna null se nao for cifra entre [].
 */
function unwrapChordBrackets(line: string): string | null {
  const m = line.match(/^(\s*)\[(.*)\](\s*)$/);
  if (!m) return null;
  const [, lead, inner, trail] = m;
  if (!tokensAreAllChords(inner)) return null;
  return lead + ' ' + inner + ' ' + trail;
}

/**
 * Escape hatch: linha envolvida em (..) como "(E F#m7 B7 E)".
 * Remove os parenteses externos e testa se o conteudo sao so acordes.
 * Retorna a linha interna sem parenteses, ou null.
 */
function unwrapParenChords(line: string): string | null {
  const m = line.match(/^(\s*)\((.+)\)(\s*)$/);
  if (!m) return null;
  const [, lead, inner, trail] = m;
  if (!tokensAreAllChords(inner)) return null;
  return lead + inner + trail;
}

function isChordLine(line: string): boolean {
  if (unwrapChordBrackets(line) !== null) return true;
  if (unwrapParenChords(line) !== null) return true;
  return tokensAreAllChords(line);
}

function isSectionLine(line: string): boolean {
  const t = line.trim();
  if (!/^\[.+\]$/.test(t)) return false;
  // [Am G D] e linha de cifra, nao secao
  return unwrapChordBrackets(line) === null;
}

// ── chord-position split ────────────────────────────────────────────────────

function chordPositions(line: string): Array<{ chord: string; pos: number }> {
  const out: { chord: string; pos: number }[] = [];
  for (const m of line.matchAll(/\S+/g))
    out.push({ chord: m[0], pos: m.index ?? 0 });
  return out;
}

/** Split lyric at each chord's column position → [{chord?, text}] */
function mergeChordLyric(chordLine: string, lyricLine: string): Seg[] {
  const cp = chordPositions(chordLine);
  if (!cp.length) return [{ text: lyricLine }];

  // Garante que a letra cubra ao menos a posição do último acorde +4 chars,
  // evitando que acordes no final da linha fiquem com largura 0 e apareçam
  // colados ao acorde anterior (ex: A em "D   G   A" sobre letra curta).
  const lastChordEnd = (cp[cp.length - 1]?.pos ?? 0) + 4;
  const padded =
    lyricLine.length < lastChordEnd
      ? lyricLine + '\u00A0'.repeat(lastChordEnd - lyricLine.length)
      : lyricLine;

  const segs: Seg[] = [];
  let last = 0;
  cp.forEach(({ chord, pos }, i) => {
    if (pos > last) segs.push({ text: padded.slice(last, pos) });
    const nextPos = cp[i + 1]?.pos ?? padded.length;
    segs.push({
      chord,
      text: padded.slice(Math.min(pos, padded.length), Math.min(nextPos, padded.length)),
    });
    last = nextPos;
  });
  if (last < padded.length) segs.push({ text: padded.slice(last) });
  return segs;
}

// ── word split (overflow prevention) ───────────────────────────────────────

/**
 * Two-pass approach:
 *   Pass 1 — split at chord positions   → exact chord placement
 *   Pass 2 — split each segment at word boundaries
 *            → each flex item is at most one word wide → no horizontal overflow
 *
 * The chord stays on the FIRST sub-segment of its original segment,
 * so the chord column sits directly above the correct syllable.
 */
function buildSegs(chordLine: string, lyricLine: string): Seg[] {
  const chordSegs = mergeChordLyric(chordLine, lyricLine);
  const result: Seg[] = [];

  for (const seg of chordSegs) {
    if (!seg.text) { result.push(seg); continue; }

    const leading = seg.text.match(/^\s+/)?.[0] ?? '';
    const words = seg.text.match(/\S+\s*/g) ?? [];

    if (!words.length) { result.push(seg); continue; }

    // First word inherits the chord (+ any leading spaces)
    result.push({ chord: seg.chord, text: leading + words[0] });
    // Remaining words in this segment have no chord
    for (let i = 1; i < words.length; i++) result.push({ text: words[i] });
  }
  return result;
}

/** Transposes a chord line and collapses spacing to single spaces. */
function compactChords(line: string, semitones: number): string {
  return line.trim().split(/\s+/).map(tok => transposeChord(tok, semitones)).join('  ');
}

// ── mid-word grouping ───────────────────────────────────────────────────────

/**
 * Group consecutive segments that share a mid-word boundary
 * (no space between segment[i].text end and segment[i+1].text start).
 *
 * Each group is rendered as a non-wrapping inner row, so flex wrap
 * only ever breaks between groups — i.e., at real word boundaries.
 */
function groupSegs(segs: Seg[]): Seg[][] {
  if (!segs.length) return [];
  const groups: Seg[][] = [];
  let cur: Seg[] = [segs[0]];
  for (let i = 1; i < segs.length; i++) {
    const prevEnd = segs[i - 1].text;
    const currStart = segs[i].text;
    const midWord =
      prevEnd.length > 0 && prevEnd[prevEnd.length - 1] !== ' ' &&
      currStart.length > 0 && currStart[0] !== ' ';
    if (midWord) { cur.push(segs[i]); }
    else { groups.push(cur); cur = [segs[i]]; }
  }
  groups.push(cur);
  return groups;
}

// ── component ──────────────────────────────────────────────────────────────

function ChordDisplay({ lyrics, semitones, showLyrics, fontSize, colors, onChordPress, onSectionLayout, highlightedSectionIdx }: Props) {
  const lines = lyrics.split('\n');
  const lineHeight = Math.round(fontSize * 1.75);
  const chordRowH = Math.round(fontSize * 1.4);

  const renderChordText = (chord: string, extraStyle?: any) => {
    const transposed = transposeChord(chord, semitones);
    const node = (
      <Text style={[{ fontSize, color: colors.chord, fontFamily: 'Inter_700Bold' }, extraStyle]}>
        {transposed}
      </Text>
    );
    if (!onChordPress) return node;
    return (
      <Pressable onPress={() => onChordPress(transposed)} hitSlop={6}>
        {node}
      </Pressable>
    );
  };

  // Renderiza linha de acordes compacta (cada token tocavel separadamente).
  const renderCompactLine = (chordLine: string, key: number) => {
    const tokens = chordLine.trim().split(/\s+/);
    return (
      <View key={key} style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginVertical: 2 }}>
        {tokens.map((tok, i) => (
          <View key={i} style={{ marginRight: fontSize * 0.9 }}>
            {renderChordText(tok)}
          </View>
        ))}
      </View>
    );
  };

  /**
   * Renders a chord+lyric pair.
   *
   * Outer View  flexDirection:'row'  flexWrap:'wrap'   ← wraps between word-groups
   *   Group View flexDirection:'row'  (no wrap)         ← keeps mid-word segs together
   *     Column View flexDirection:'column'              ← chord above its syllable
   *       chord Text  (fixed-height row)
   *       lyric Text
   */
  const renderPair = (chordLine: string, lyricLine: string, key: number, lyricFont: string = 'Inter_400Regular') => {
    const groups = groupSegs(buildSegs(chordLine, lyricLine));
    return (
      <View key={key} style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {groups.map((group, gi) => (
          <View key={gi} style={{ flexDirection: 'row' }}>
            {group.map((seg, si) => (
              <View key={si} style={{ flexDirection: 'column' }}>
                {/* chord row — same height for all columns keeps baselines aligned.
                    paddingRight no Text do acorde garante separação visual mínima
                    entre acordes consecutivos quando a letra abaixo é curta/vazia. */}
                <View style={{ height: chordRowH, justifyContent: 'flex-end' }}>
                  {seg.chord ? renderChordText(seg.chord, { paddingRight: fontSize * 0.5 }) : null}
                </View>
                {/* lyric text — negrito no refrão */}
                <Text style={{ fontSize, color: colors.text, lineHeight, fontFamily: lyricFont }}>
                  {seg.text}
                </Text>
              </View>
            ))}
          </View>
        ))}
      </View>
    );
  };

  // ── Seções estruturadas com cores de fundo harmoniosas ───────────────────
  interface SectionBlock {
    title: string | null;
    isChorus: boolean;
    lines: string[];
  }

  const rawLines = lyrics.split('\n');
  const sections: SectionBlock[] = [];
  let currentSection: SectionBlock = {
    title: null,
    isChorus: false,
    lines: [],
  };

  for (let idx = 0; idx < rawLines.length; idx++) {
    const l = rawLines[idx];
    if (isSectionLine(l)) {
      if (currentSection.lines.length > 0 || currentSection.title !== null) {
        sections.push(currentSection);
      }
      const rawTitle = l.trim();
      const lower = rawTitle.toLowerCase();
      const isChorus = lower.includes('refr') || lower.includes('chorus') || lower.includes('ponte') || lower.includes('bridge');
      currentSection = {
        title: rawTitle, // Mantém exatamente como vem do banco, ex: "[Intro]"
        isChorus,
        lines: [],
      };
    } else {
      currentSection.lines.push(l);
    }
  }
  if (currentSection.lines.length > 0 || currentSection.title !== null) {
    sections.push(currentSection);
  }

  const renderSectionContent = (secLines: string[], secKey: number, isChorus: boolean) => {
    const lyricFont = isChorus ? 'Inter_700Bold' : 'Inter_400Regular';
    const secNodes: React.ReactNode[] = [];
    let j = 0;

    while (j < secLines.length) {
      const line = secLines[j];

      if (!line.trim()) {
        secNodes.push(<View key={`empty-${j}`} style={{ height: Math.round(fontSize * 0.6) }} />);
        j++;
        continue;
      }

      if (isChordLine(line)) {
        // Unwrap [..] ou (..) se for linha de acordes entre parenteses/colchetes
        const chordLine = unwrapChordBrackets(line) ?? unwrapParenChords(line) ?? line;
        const next = secLines[j + 1];
        const hasLyric = next !== undefined && next.trim() !== '' && !isChordLine(next) && !isSectionLine(next);

        if (hasLyric) {
          if (showLyrics) {
            secNodes.push(renderPair(chordLine, next, j, lyricFont));
          } else {
            secNodes.push(renderCompactLine(chordLine, j));
          }
          j += 2;
        } else {
          secNodes.push(renderCompactLine(chordLine, j));
          j++;
        }
        continue;
      }

      // Linha de letra pura
      if (showLyrics) {
        secNodes.push(
          <Text key={`lyric-${j}`} style={{ fontSize, color: colors.text, lineHeight, fontFamily: lyricFont }}>
            {line}
          </Text>
        );
      }
      j++;
    }

    return secNodes;
  };

  return (
    <View style={{ gap: 14 }}>
      {sections.map((sec, secIdx) => {
        const isHighlighted = secIdx === highlightedSectionIdx;
        const isDark = colors.bg !== '#ffffff' && colors.bg !== '#f5f5f7';

        const bgColor = isHighlighted
          ? (isDark ? 'rgba(255, 119, 0, 0.28)' : 'rgba(255, 119, 0, 0.20)')
          : sec.isChorus
            ? (isDark ? '#c1bcbc22' : colors.bg)
            : (isDark ? '#01010100' : colors.bg);


        const titleColor = sec.isChorus
          ? colors.accent
          : colors.textSub;

        return (
          <View
            key={`sec-${secIdx}`}
            onLayout={(e) => {
              if (sec.title) {
                onSectionLayout?.(secIdx, sec.title, e.nativeEvent.layout.y);
              }
            }}
            style={{
              backgroundColor: bgColor,
              borderRadius: 14,
              paddingVertical: 12,
              paddingHorizontal: 14,
            }}
          >
            {/* Nome da Sessão (Ex: [Intro], [Refrão]) em cinza clarinho sem bold */}
            {sec.title ? (
              <View
                style={{
                  alignSelf: 'flex-start',          
                  marginBottom: 20,
                  paddingBottom: 4,
                  paddingTop: 4,                
                  borderBottomWidth: 1,
                  borderBottomColor: "#f73d13ff",
                }}
              >
                <Text
                  style={{
                    fontSize,
                    fontFamily: 'Inter_700Bold',
                    color: colors.text,
                  }}
                >
                  {sec.title.replace(/^\[|\]$/g, '')}
                </Text>
              </View>
            ) : null}

            {/* Conteúdo da Sessão (Acordes e Letras) */}
            <View>
              {renderSectionContent(sec.lines, secIdx, sec.isChorus)}
            </View>
          </View>
        );
      })}
    </View>
  );
}

export default React.memo(ChordDisplay);
