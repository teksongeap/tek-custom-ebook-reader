/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { getChapterSections, type SectionWithProgress } from './book-toc/book-toc';

export function getReaderChapterMarkers(
  sections: SectionWithProgress[],
  totalCharacters: number,
  trackWidth: number
) {
  if (totalCharacters <= 0 || trackWidth <= 0) return [];

  const chapters = getChapterSections(sections)
    .filter(
      (chapter) =>
        typeof chapter.startCharacter === 'number' &&
        Number.isFinite(chapter.startCharacter) &&
        chapter.startCharacter > 0 &&
        chapter.startCharacter < totalCharacters
    )
    .sort((a, b) => (a.startCharacter as number) - (b.startCharacter as number));
  let previousPixel = -Infinity;

  return chapters.flatMap((chapter) => {
    const position = ((chapter.startCharacter as number) / totalCharacters) * 100;
    const pixel = (position / 100) * trackWidth;
    // These are landmarks, not separate controls. Keep dense books from becoming a barcode.
    if (pixel - previousPixel < 8) return [];
    previousPixel = pixel;
    return [{ key: chapter.reference, position }];
  });
}
