import React from 'react';
import { View, Text } from 'react-native';
import { transposeChord } from '@/lib/transpose';
import { Colors } from '@/lib/theme';

interface Props {
  lyrics: string;
  semitones: number;
  showLyrics: boolean;
  fontSize: number;
  colors: Colors;
}

interface Seg { chord?: string; text: string; }

// ── detection ──────────────────────────────────────────────────────────────

const CHORD_TOKEN =
  /^[A-G][b#]?(m(aj\d*)?|M(aj\d*)?|dim\d*|aug|sus[24]?|add\d+|\d{1,2})?(\/[A-G][b#]?)?$/;

function isChordLine(line: string): boolean {
  const t = line.trim();
  return t.length > 0 && t.split(/\s+/).every(tok => CHORD_TOKEN.test(tok));
}
function isSectionLine(line: string): boolean {
  return /^\[.+\]$/.test(line.trim());
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
  const segs: Seg[] = [];
  let last = 0;
  cp.forEach(({ chord, pos }, i) => {
    if (pos > last) segs.push({ text: lyricLine.slice(last, pos) });
    const nextPos = cp[i + 1]?.pos ?? lyricLine.length;
    segs.push({
      chord,
      text: lyricLine.slice(Math.min(pos, lyricLine.length), Math.min(nextPos, lyricLine.length)),
    });
    last = nextPos;
  });
  if (last < lyricLine.length) segs.push({ text: lyricLine.slice(last) });
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
    const words   = seg.text.match(/\S+\s*/g) ?? [];

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

export default function ChordDisplay({ lyrics, semitones, showLyrics, fontSize, colors }: Props) {
  const lines = lyrics.split('\n');
  const lineHeight = Math.round(fontSize * 1.75);
  const chordRowH  = Math.round(fontSize * 1.4);

  /**
   * Renders a chord+lyric pair.
   *
   * Outer View  flexDirection:'row'  flexWrap:'wrap'   ← wraps between word-groups
   *   Group View flexDirection:'row'  (no wrap)         ← keeps mid-word segs together
   *     Column View flexDirection:'column'              ← chord above its syllable
   *       chord Text  (fixed-height row)
   *       lyric Text
   */
  const renderPair = (chordLine: string, lyricLine: string, key: number) => {
    const groups = groupSegs(buildSegs(chordLine, lyricLine));
    return (
      <View key={key} style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {groups.map((group, gi) => (
          <View key={gi} style={{ flexDirection: 'row' }}>
            {group.map((seg, si) => (
              <View key={si} style={{ flexDirection: 'column' }}>
                {/* chord row — same height for all columns keeps baselines aligned */}
                <View style={{ height: chordRowH, justifyContent: 'flex-end' }}>
                  {seg.chord ? (
                    <Text style={{ fontSize, color: colors.chord, fontFamily: 'monospace' }}>
                      {transposeChord(seg.chord, semitones)}
                    </Text>
                  ) : null}
                </View>
                {/* lyric text */}
                <Text style={{ fontSize, color: colors.text, fontFamily: 'monospace', lineHeight }}>
                  {seg.text}
                </Text>
              </View>
            ))}
          </View>
        ))}
      </View>
    );
  };

  const nodes: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      nodes.push(<View key={i} style={{ height: Math.round(fontSize * 0.8) }} />);
      i++; continue;
    }

    if (isSectionLine(line)) {
      const label = line.trim().slice(1, -1).toUpperCase();
      nodes.push(
        <View key={i} style={{ marginTop: 14, marginBottom: 6 }}>
          <Text style={{ fontSize: fontSize - 2, fontWeight: '700', color: '#FF9500', letterSpacing: 1.2, fontFamily: 'monospace' }}>
            {label}
          </Text>
          <View style={{ height: 1, backgroundColor: colors.border, marginTop: 3 }} />
        </View>
      );
      i++; continue;
    }

    if (isChordLine(line)) {
      const next = lines[i + 1];
      const hasLyric = next !== undefined && next.trim() !== '' && !isChordLine(next) && !isSectionLine(next);

      if (hasLyric) {
        if (showLyrics) {
          // letras visíveis → mostra acordes + letra (view normal)
          nodes.push(renderPair(line, next, i));
        } else {
          // letras ocultas → acordes compactos (espaço simples, sem posicionamento)
          const transposed = compactChords(line, semitones);
          nodes.push(
            <Text key={i} style={{ fontSize, color: colors.chord, fontFamily: 'monospace', lineHeight }}>
              {transposed}
            </Text>
          );
        }
        i += 2;
      } else {
        // linha de acorde sem letra abaixo: sempre mostra compacto
        const transposed = compactChords(line, semitones);
        nodes.push(
          <Text key={i} style={{ fontSize, color: colors.chord, fontFamily: 'monospace', lineHeight }}>
            {transposed}
          </Text>
        );
        i++;
      }
      continue;
    }

    // linha de letra pura — só aparece quando letras estão visíveis
    if (showLyrics) {
      nodes.push(
        <Text key={i} style={{ fontSize, color: colors.text, fontFamily: 'monospace', lineHeight }}>
          {line}
        </Text>
      );
    }
    i++;
  }

  return <View>{nodes}</View>;
}
