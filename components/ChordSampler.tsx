import React, { forwardRef, useImperativeHandle, useEffect, useRef } from 'react';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

// ─────────────────────────────────────────────────────────────────────────────
// Sampler de piano usando 4 samples Salamander (C2, C3, C4, C5).
// Pra cada nota tocada, escolhe o sample mais proximo e ajusta o pitch via
// playbackRate (shouldCorrectPitch=false → muda pitch junto com velocidade).
// Pool de 3 vozes por sample → 12 vozes simultaneas.
//
// IMPORTANTE: o expo-audio carrega async em background. createAudioPlayer
// retorna sincrono mas o sample ainda nao tocou. Esperamos isLoaded via
// listener antes de marcar a voice como pronta.
// ─────────────────────────────────────────────────────────────────────────────

interface Sample { midi: number; asset: any; }
const SAMPLES: Sample[] = [
  { midi: 36, asset: require('../assets/piano/C2.mp3') },
  { midi: 48, asset: require('../assets/piano/C3.mp3') },
  { midi: 60, asset: require('../assets/piano/C4.mp3') },
  { midi: 72, asset: require('../assets/piano/C5.mp3') },
];

const VOICES_PER_SAMPLE = 3;

interface Voice {
  player: AudioPlayer;
  midi: number;
  busyUntil: number;
  loaded: boolean;
}

const NOTE: Record<string, number> = {
  'C':0,'C#':1,'Db':1,'D':2,'D#':3,'Eb':3,
  'E':4,'F':5,'F#':6,'Gb':6,'G':7,'G#':8,'Ab':8,
  'A':9,'A#':10,'Bb':10,'B':11,
};

function chordToMidi(name: string): number[] {
  const m = name.match(/^([A-G][b#]?)(.*?)(?:\/([A-G][b#]?).*)?$/);
  if (!m) return [];
  const rootName = m[1];
  const quality = (m[2] || '').replace(/\s+/g, '');
  const bassName = m[3] || '';
  const rootSemi = NOTE[rootName];
  if (rootSemi === undefined) return [];

  let intervals: number[];
  if (/dim|°|º/.test(quality)) intervals = [0, 3, 6];
  else if (/aug|\+/.test(quality)) intervals = [0, 4, 8];
  else if (/sus2/.test(quality)) intervals = [0, 2, 7];
  else if (/sus4|sus/.test(quality)) intervals = [0, 5, 7];
  else if (/^m(?!aj|M)/.test(quality)) intervals = [0, 3, 7];
  else intervals = [0, 4, 7];

  if (/maj7|7M|M7/.test(quality)) intervals.push(11);
  else if (/m7b5|ø/.test(quality)) intervals = [0, 3, 6, 10];
  else if (/7/.test(quality)) intervals.push(10);
  else if (/6/.test(quality)) intervals.push(9);

  if (/(?:add9|9)/.test(quality) && !/maj9/.test(quality)) {
    if (!intervals.includes(14)) intervals.push(14);
  }

  const baseMidi = 60 + rootSemi;
  const notes = intervals.map(i => baseMidi + i);
  if (bassName && NOTE[bassName] !== undefined) {
    notes.unshift(48 + NOTE[bassName]);
  }
  return notes;
}

function pickSample(midi: number): Sample {
  let best = SAMPLES[0];
  let bestDist = Math.abs(midi - best.midi);
  for (let i = 1; i < SAMPLES.length; i++) {
    const d = Math.abs(midi - SAMPLES[i].midi);
    if (d < bestDist) { best = SAMPLES[i]; bestDist = d; }
  }
  return best;
}

export interface ChordSamplerHandle {
  play: (chord: string) => void;
}

const ChordSampler = forwardRef<ChordSamplerHandle>((_props, ref) => {
  const voicesRef = useRef<Voice[]>([]);
  const subsRef = useRef<{ remove: () => void }[]>([]);

  useEffect(() => {
    let mounted = true;

    setAudioModeAsync({ playsInSilentMode: true }).catch(e => {
      console.warn('[ChordSampler] setAudioMode:', e);
    });

    const pool: Voice[] = [];
    for (const s of SAMPLES) {
      for (let i = 0; i < VOICES_PER_SAMPLE; i++) {
        try {
          const player = createAudioPlayer(s.asset);
          player.volume = 0.85;
          player.shouldCorrectPitch = false;
          const voice: Voice = { player, midi: s.midi, busyUntil: 0, loaded: false };
          pool.push(voice);
          const sub = player.addListener('playbackStatusUpdate', (st: any) => {
            if (st?.isLoaded && !voice.loaded) {
              voice.loaded = true;
            }
          });
          subsRef.current.push(sub);
        } catch (e) {
          console.warn('[ChordSampler] createAudioPlayer falhou:', s.midi, e);
        }
      }
    }
    voicesRef.current = pool;

    return () => {
      mounted = false;
      subsRef.current.forEach(s => { try { s.remove(); } catch {} });
      subsRef.current = [];
      voicesRef.current.forEach(v => { try { v.player.remove(); } catch {} });
      voicesRef.current = [];
    };
  }, []);

  const playOne = (midi: number) => {
    const sample = pickSample(midi);
    const candidates = voicesRef.current.filter(v => v.midi === sample.midi);
    if (!candidates.length) return;
    const loadedOnes = candidates.filter(v => v.loaded);
    const pool = loadedOnes.length ? loadedOnes : candidates;
    const now = Date.now();
    let voice = pool.find(v => v.busyUntil <= now);
    if (!voice) voice = pool.reduce((a, b) => a.busyUntil < b.busyUntil ? a : b);
    voice.busyUntil = now + 3000;
    const rate = Math.pow(2, (midi - sample.midi) / 12);
    try {
      // setPlaybackRate sem segundo arg = sem pitch correction (muda pitch junto)
      voice.player.setPlaybackRate(rate);
      voice.player.seekTo(0)
        .then(() => { try { voice!.player.play(); } catch {} })
        .catch(() => {
          try { voice!.player.play(); } catch {}
        });
    } catch (e) {
      console.warn('[ChordSampler] play falhou:', e);
    }
  };

  useImperativeHandle(ref, () => ({
    play: (chord: string) => {
      const notes = chordToMidi(chord);
      notes.forEach((n, i) => {
        setTimeout(() => playOne(n), i * 8);
      });
    },
  }));

  return null;
});

ChordSampler.displayName = 'ChordSampler';
export default ChordSampler;
