/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { getControlSound } from '../../src/lib/functions/control-sound.ts';

test('links leave sound to navigation while downloads retain button feedback', () => {
  const dom = new JSDOM(`
    <a href="/manage"><svg><path /></svg>Library</a>
    <a href="/settings">Settings</a>
    <a href="/statistics">Statistics</a>
    <a href="/b?id=1">Book</a>
    <a href="blob:log" download="log.json">Download log</a>
  `);
  try {
    for (const target of dom.window.document.querySelectorAll('a:not([download]), path')) {
      assert.equal(getControlSound(target), undefined);
    }
    assert.equal(getControlSound(dom.window.document.querySelector('[download]')!), 'click');
  } finally {
    dom.window.close();
  }
});

test('local controls retain clicks and toggles while silent or disabled controls stay silent', () => {
  const dom = new JSDOM(`
    <button><span>Fullscreen</span></button>
    <button aria-pressed="false">Select books</button>
    <details><summary>More</summary></details>
    <div role="button">Action</div>
    <button data-sound="none"><span>Library</span></button>
    <button disabled>Disabled</button>
    <button aria-disabled="true">Unavailable</button>
    <div inert><button>Hidden action</button></div>
    <div data-sound="none"><button>Preview</button></div>
  `);
  try {
    const targets = dom.window.document.querySelectorAll('button, summary, [role="button"]');
    assert.deepEqual(Array.from(targets, getControlSound), [
      'click',
      'toggle',
      'click',
      'click',
      undefined,
      undefined,
      undefined,
      undefined,
      undefined
    ]);
    const [local, navigation] = dom.window.document.querySelectorAll('span');
    assert.equal(getControlSound(local), 'click');
    assert.equal(getControlSound(navigation), undefined);
  } finally {
    dom.window.close();
  }
});
