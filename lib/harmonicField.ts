// Campo harmonico: dado um tom, retorna os 7 acordes diatonicos.
// Maior: I, ii, iii, IV, V, vi, vii°
// Menor (harmonico): i, ii°, III, iv, v, VI, VII

const NOTES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

const MAJOR_DEGREES: { semi: number; suffix: string }[] = [
  { semi: 0,  suffix: ''   },  // I
  { semi: 2,  suffix: 'm'  },  // ii
  { semi: 4,  suffix: 'm'  },  // iii
  { semi: 5,  suffix: ''   },  // IV
  { semi: 7,  suffix: ''   },  // V
  { semi: 9,  suffix: 'm'  },  // vi
  { semi: 11, suffix: '°'  },  // vii°
];

const MINOR_DEGREES: { semi: number; suffix: string }[] = [
  { semi: 0,  suffix: 'm'  },  // i
  { semi: 2,  suffix: '°'  },  // ii°
  { semi: 3,  suffix: ''   },  // III
  { semi: 5,  suffix: 'm'  },  // iv
  { semi: 7,  suffix: 'm'  },  // v   (natural; em harmonico vira maior)
  { semi: 8,  suffix: ''   },  // VI
  { semi: 10, suffix: ''   },  // VII
];

export function getHarmonicField(tone: string): string[] {
  const isMinor = tone.endsWith('m');
  const baseName = isMinor ? tone.slice(0, -1) : tone;
  const baseIdx = NOTES.indexOf(baseName);
  if (baseIdx === -1) return [];
  const degrees = isMinor ? MINOR_DEGREES : MAJOR_DEGREES;
  return degrees.map(d => NOTES[(baseIdx + d.semi) % 12] + d.suffix);
}

/** Lista todos os tons (so a tonica base, sem maior/menor). */
export const ALL_KEY_BASES = NOTES.slice();

/** Proximo / anterior tom dado um base (usado pra navegar entre campos). */
export function nextKey(base: string, dir: 1 | -1): string {
  const i = NOTES.indexOf(base);
  if (i === -1) return base;
  return NOTES[(i + dir + 12) % 12];
}
