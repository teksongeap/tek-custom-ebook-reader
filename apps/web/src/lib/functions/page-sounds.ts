/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

export type PageSoundStyle = 'gather' | 'current' | 'ribbon' | 'fold' | 'scan';

export const defaultPageSoundStyle: PageSoundStyle = 'fold';

export const gatherLandingTime = 0.085;

export interface SoundPoint {
  time: number;
  value: number;
  curve?: 'linear' | 'exponential';
}

export interface PageSoundVoice {
  frequency: SoundPoint[];
  gain: SoundPoint[];
  pan?: SoundPoint[];
  offset: number;
  duration: number;
}

export const pageSoundOptions: { id: PageSoundStyle; label: string; description: string }[] = [
  { id: 'fold', label: 'A · Fold', description: 'A pitch dip that bends back into place' },
  {
    id: 'gather',
    label: 'B · Swell',
    description: 'A small swell with a clean, weighted landing'
  },
  { id: 'ribbon', label: 'C · Ribbon', description: 'A continuous sweep across the stereo field' },
  { id: 'scan', label: 'D · Scan', description: 'Four quick steps passing into the next page' }
];

export function normalizePageSoundStyle(value: unknown): PageSoundStyle {
  if (value === 'current') return 'gather';
  return pageSoundOptions.find((option) => option.id === value)?.id ?? defaultPageSoundStyle;
}

const root = 587.33;
const third = 739.989;
const fifth = 880;
const octave = 1174.659;

function envelope(level: number, duration: number, attack = 0.002): SoundPoint[] {
  return [
    { time: 0, value: 0 },
    { time: attack, value: level },
    { time: Math.max(attack, 0.009), value: level * 0.72 },
    { time: duration * 0.22, value: level * 0.72 },
    { time: duration - 0.002, value: 0.0001, curve: 'exponential' },
    { time: duration, value: 0 }
  ];
}

/** Shared scores for real-time playback and downloadable audio samples. */
export function getPageSoundVoices(style: PageSoundStyle): PageSoundVoice[] {
  switch (style) {
    case 'current':
    case 'gather': {
      const foundation: SoundPoint[] = Array.from({ length: 13 }, (_, step) => {
        const progress = step / 12;
        return {
          time: 0.006 * progress,
          value: 0.035 * (0.5 - 0.5 * Math.cos(Math.PI * progress))
        };
      });
      foundation.push(
        { time: 0.012, value: 0.0252 },
        { time: 0.032, value: 0.0001, curve: 'exponential' },
        { time: 0.035, value: 0 }
      );
      return [
        {
          frequency: [{ time: 0, value: root }],
          gain: [
            { time: 0, value: 0 },
            { time: 0.025, value: 0.008 },
            { time: 0.065, value: 0.035 },
            { time: 0.083, value: 0.07 },
            { time: gatherLandingTime, value: 0.22 },
            { time: 0.092, value: 0.1584 },
            { time: 0.107, value: 0.1584 },
            { time: 0.158, value: 0.0001, curve: 'exponential' },
            { time: 0.16, value: 0 }
          ],
          offset: 0,
          duration: 0.16
        },
        {
          frequency: [{ time: 0, value: root / 2 }],
          gain: foundation,
          offset: 0.079,
          duration: 0.035
        },
        {
          frequency: [{ time: 0, value: octave }],
          gain: [
            { time: 0, value: 0 },
            { time: 0.003, value: 0.018 },
            { time: 0.01, value: 0.01296 },
            { time: 0.043, value: 0.0001, curve: 'exponential' },
            { time: 0.045, value: 0 }
          ],
          offset: 0.089,
          duration: 0.045
        }
      ];
    }
    case 'ribbon':
      return [
        {
          frequency: [
            { time: 0, value: root },
            { time: 0.13, value: fifth, curve: 'exponential' }
          ],
          gain: [
            { time: 0, value: 0 },
            { time: 0.006, value: 0.12 },
            { time: 0.065, value: 0.105 },
            { time: 0.14, value: 0 }
          ],
          pan: [
            { time: 0, value: -0.55 },
            { time: 0.14, value: 0.55 }
          ],
          offset: 0,
          duration: 0.14
        },
        {
          frequency: [
            { time: 0, value: octave },
            { time: 0.13, value: fifth * 2, curve: 'exponential' }
          ],
          gain: [
            { time: 0, value: 0 },
            { time: 0.012, value: 0.025 },
            { time: 0.14, value: 0 }
          ],
          pan: [
            { time: 0, value: -0.35 },
            { time: 0.14, value: 0.35 }
          ],
          offset: 0,
          duration: 0.14
        }
      ];
    case 'fold':
      return [
        {
          frequency: [
            { time: 0, value: fifth },
            { time: 0.045, value: root, curve: 'exponential' },
            { time: 0.105, value: third, curve: 'exponential' }
          ],
          gain: [
            { time: 0, value: 0 },
            { time: 0.003, value: 0.15 },
            { time: 0.045, value: 0.07 },
            { time: 0.095, value: 0.12 },
            { time: 0.145, value: 0 }
          ],
          offset: 0,
          duration: 0.145
        },
        {
          frequency: [{ time: 0, value: octave }],
          gain: envelope(0.035, 0.055),
          offset: 0.095,
          duration: 0.055
        }
      ];
    case 'scan':
      return [root, third, fifth, octave].map((frequency, index) => ({
        frequency: [
          { time: 0, value: frequency * 0.97 },
          { time: 0.018, value: frequency, curve: 'exponential' }
        ],
        gain: envelope(0.14 - index * 0.015, 0.06),
        pan: [{ time: 0, value: -0.35 + index * 0.23 }],
        offset: index * 0.024,
        duration: 0.06
      }));
  }
}
