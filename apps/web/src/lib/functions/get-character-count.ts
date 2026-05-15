/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { isNodeGaiji } from './is-node-gaiji';

type SegmenterConstructor = new (
  locale: string | string[] | undefined,
  options: { granularity: 'grapheme' }
) => {
  segment: (input: string) => Iterable<{ segment: string }>;
};

const intlSegmenter = (Intl as unknown as { Segmenter?: SegmenterConstructor }).Segmenter
  ? new (Intl as unknown as { Segmenter: SegmenterConstructor }).Segmenter(undefined, {
      granularity: 'grapheme'
    })
  : undefined;
const readingUnitRegex = /[\p{Letter}\p{Mark}\p{Number}\p{Radical}\p{Unified_Ideograph}]/u;
const japaneseReadingMarkRegex = /[○◯々〻ー]/u;

export function getCharacterCount(node: Node) {
  return isNodeGaiji(node) ? 1 : getRawCharacterCount(node);
}

function getRawCharacterCount(node: Node) {
  if (!node.textContent) return 0;
  return countReadingUnits(node.textContent);
}

function countReadingUnits(text: string) {
  return getGraphemeSegments(text.normalize('NFC')).filter(isReadingUnit).length;
}

function getGraphemeSegments(text: string) {
  if (!intlSegmenter) {
    return Array.from(text);
  }

  return Array.from(intlSegmenter.segment(text), ({ segment }) => segment);
}

function isReadingUnit(segment: string) {
  return readingUnitRegex.test(segment) || japaneseReadingMarkRegex.test(segment);
}
