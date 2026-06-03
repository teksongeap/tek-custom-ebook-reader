/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { logger } from '$lib/data/logger';

type ProfileDetails = Record<string, boolean | number | string | undefined> | string;

export function startProfile(label: string, details?: ProfileDetails) {
  const startedAt = now();
  let lastLapAt = startedAt;

  logProfile(`${label} started`, details);

  return {
    lap: (lapLabel: string, lapDetails?: ProfileDetails) => {
      const lapAt = now();
      const duration = lapAt - lastLapAt;
      lastLapAt = lapAt;

      logProfile(`${label} ${lapLabel}`, {
        ...normalizeDetails(lapDetails),
        durationMs: Math.round(duration)
      });

      return duration;
    },
    end: (endDetails?: ProfileDetails) => {
      const duration = now() - startedAt;

      logProfile(`${label} finished`, {
        ...normalizeDetails(endDetails),
        durationMs: Math.round(duration)
      });

      return duration;
    }
  };
}

export async function profileAsync<T>(
  label: string,
  work: () => Promise<T>,
  details?: ProfileDetails
) {
  const profile = startProfile(label, details);

  try {
    return await work();
  } finally {
    profile.end();
  }
}

function logProfile(message: string, details?: ProfileDetails) {
  const formattedDetails = formatDetails(details);

  logger.info(`[perf] ${message}${formattedDetails ? ` | ${formattedDetails}` : ''}`);
}

function formatDetails(details?: ProfileDetails) {
  if (!details) {
    return '';
  }

  if (typeof details === 'string') {
    return details;
  }

  return Object.entries(details)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${value}`)
    .join(', ');
}

function normalizeDetails(details?: ProfileDetails): Record<string, boolean | number | string> {
  if (!details) {
    return {};
  }

  if (typeof details === 'string') {
    return { details };
  }

  return Object.entries(details).reduce<Record<string, boolean | number | string>>(
    (acc, [key, value]) => {
      if (value !== undefined) {
        acc[key] = value;
      }

      return acc;
    },
    {}
  );
}

function now() {
  return globalThis.performance?.now ? globalThis.performance.now() : Date.now();
}
