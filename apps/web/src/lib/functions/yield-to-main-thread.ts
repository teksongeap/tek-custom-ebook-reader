/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

export async function yieldToMainThread() {
  const scheduler = (globalThis as any).scheduler;
  const schedulerYield = scheduler?.yield;

  if (typeof schedulerYield === 'function') {
    await schedulerYield.call(scheduler);
    return;
  }

  await new Promise<void>((resolve) => {
    setTimeout(resolve);
  });
}
