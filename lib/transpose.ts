const NOTES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

export function transposeChord(chord: string, semitones: number): string {
  if (!semitones) return chord;
  if (chord.includes('/')) {
    return chord.split('/').map(c => transposeChord(c, semitones)).join('/');
  }
  const m = chord.match(/^([A-G]#?)(m?)(.*)$/);
  if (!m) return chord;
  const [, base, minor, suffix] = m;
  const idx = NOTES.indexOf(base);
  if (idx === -1) return chord;
  return NOTES[(idx + semitones + 120) % 12] + minor + suffix;
}

export function transposeTone(tone: string, semitones: number): string {
  if (!semitones) return tone;
  const isMinor = tone.endsWith('m');
  const base = isMinor ? tone.slice(0, -1) : tone;
  const idx = NOTES.indexOf(base);
  if (idx === -1) return tone;
  return NOTES[(idx + semitones + 120) % 12] + (isMinor ? 'm' : '');
}

export const ALL_TONES = [
  'C','C#','D','D#','E','F','F#','G','G#','A','A#','B',
  'Cm','C#m','Dm','D#m','Em','Fm','F#m','Gm','G#m','Am','A#m','Bm',
];

export const MAJOR_TONES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
export const MINOR_TONES = ['Cm','C#m','Dm','D#m','Em','Fm','F#m','Gm','G#m','Am','A#m','Bm'];

export function semitonesBetween(fromTone: string, toTone: string): number {
  const baseOf = (t: string) => t.endsWith('m') ? t.slice(0, -1) : t;
  const fromIdx = NOTES.indexOf(baseOf(fromTone));
  const toIdx = NOTES.indexOf(baseOf(toTone));
  if (fromIdx === -1 || toIdx === -1) return 0;
  return (toIdx - fromIdx + 12) % 12;
}
