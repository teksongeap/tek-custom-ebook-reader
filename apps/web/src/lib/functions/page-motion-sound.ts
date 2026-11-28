/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import {
  gatherLandingTime,
  getPageSoundVoices,
  type PageSoundStyle,
  type SoundPoint
} from './page-sounds.ts';

export interface PageMotionSound {
  update(progress: number, speed: number, direction: 1 | -1, remainingSeconds?: number): void;
  finish(): void;
  cancel(): void;
}

export const silentPageMotion: PageMotionSound = {
  update() {},
  finish() {},
  cancel() {}
};

function sample(points: SoundPoint[], time: number) {
  if (time <= points[0].time) return points[0].value;
  for (let index = 1; index < points.length; index += 1) {
    const next = points[index];
    const previous = points[index - 1];
    if (time <= next.time) {
      const fraction = (time - previous.time) / (next.time - previous.time);
      return next.curve === 'exponential'
        ? previous.value * (next.value / previous.value) ** fraction
        : previous.value + (next.value - previous.value) * fraction;
    }
  }
  return points[points.length - 1].value;
}

/** The animation supplies the clock; no fixed-duration page clip runs underneath it. */
export function createPageMotionSound(
  context: AudioContext,
  destination: AudioNode,
  style: PageSoundStyle,
  isAudible: () => boolean,
  onClose: () => void
): PageMotionSound {
  const score = getPageSoundVoices(style);
  const duration = Math.max(...score.map((voice) => voice.offset + voice.duration));
  const voices: { source: OscillatorNode; gain: GainNode; pan?: StereoPannerNode }[] = [];
  let closed = false;
  let finishing = false;
  const gather = style === 'gather' || style === 'current';
  let endedVoices = 0;

  const close = () => {
    if (closed) return;
    closed = true;
    for (const { source, gain } of voices) {
      try {
        gain.gain.cancelScheduledValues(context.currentTime);
        gain.gain.setTargetAtTime(0, context.currentTime, 0.001);
        source.stop(context.currentTime + 0.005);
      } catch (_) {
        /* A device interruption may already have ended the voice. */
      }
    }
    onClose();
  };

  try {
    for (const voice of score) {
      const source = context.createOscillator();
      const gain = context.createGain();
      const pan =
        voice.pan && typeof context.createStereoPanner === 'function'
          ? context.createStereoPanner()
          : undefined;
      voices.push({ source, gain, pan });
      source.type = 'sine';
      source.frequency.value = voice.frequency[0].value;
      gain.gain.value = 0;
      source.connect(gain);
      if (pan) {
        gain.connect(pan);
        pan.connect(destination);
      } else gain.connect(destination);
      source.onended = () => {
        source.disconnect();
        gain.disconnect();
        pan?.disconnect();
        endedVoices += 1;
        if (endedVoices === voices.length && !closed) {
          closed = true;
          onClose();
        }
      };
      source.start(context.currentTime);
      source.stop(context.currentTime + 2);
    }
  } catch (_) {
    close();
    return silentPageMotion;
  }

  return {
    update(progress, speed, direction, remainingSeconds) {
      if (closed || finishing) return;
      if (!isAudible() || context.state !== 'running') {
        close();
        return;
      }
      if (![progress, speed].every(Number.isFinite)) {
        close();
        return;
      }
      const phase = Math.min(1, Math.max(0, progress));
      const remaining =
        remainingSeconds !== undefined && Number.isFinite(remainingSeconds)
          ? Math.max(0, remainingSeconds)
          : (1 - phase) * 0.6;
      const scoreTime = gather ? gatherLandingTime - remaining : phase * duration;
      const energy = Math.min(1, Math.sqrt(Math.abs(speed) / 4));
      const now = context.currentTime;
      try {
        score.forEach((voice, index) => {
          const { source, gain, pan } = voices[index];
          const time = scoreTime - voice.offset;
          const active = time >= 0 && time < voice.duration && phase < 1;
          const peak = Math.max(...voice.gain.map((point) => point.value));
          const body = style === 'scan' || gather ? 0 : peak * 0.1;
          const level = active ? (sample(voice.gain, time) + body) * (gather ? 1 : energy) : 0;
          source.frequency.setTargetAtTime(sample(voice.frequency, Math.max(0, time)), now, 0.003);
          if (pan && voice.pan)
            pan.pan.setTargetAtTime(sample(voice.pan, Math.max(0, time)) * direction, now, 0.003);
          gain.gain.cancelScheduledValues(now);
          gain.gain.setTargetAtTime(level, now, gather ? 0.001 : 0.003);
          // Silence a stalled/background frame stream without leaving a held tone.
          gain.gain.setValueAtTime(level, now + 0.06);
          gain.gain.linearRampToValueAtTime(0, now + 0.1);
          source.stop(now + 2);
        });
      } catch (_) {
        close();
      }
    },
    finish() {
      if (!gather) {
        close();
        return;
      }
      if (closed || finishing) return;
      if (!isAudible() || context.state !== 'running') {
        close();
        return;
      }
      finishing = true;
      const now = context.currentTime;
      try {
        score.forEach((voice, index) => {
          const { source, gain } = voices[index];
          const localTime = gatherLandingTime - voice.offset;
          const held = gain.gain.value;
          gain.gain.cancelScheduledValues(now);
          gain.gain.setValueAtTime(held, now);
          if (localTime >= 0)
            gain.gain.linearRampToValueAtTime(sample(voice.gain, localTime), now + 0.002);
          for (const point of voice.gain) {
            const offset = point.time - localTime;
            if (offset <= (localTime >= 0 ? 0.002 : 0)) continue;
            if (point.curve === 'exponential')
              gain.gain.exponentialRampToValueAtTime(point.value, now + offset);
            else gain.gain.linearRampToValueAtTime(point.value, now + offset);
          }
          source.stop(now + Math.max(0, voice.duration - localTime) + 0.01);
        });
      } catch (_) {
        close();
      }
    },
    cancel: close
  };
}
