/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

export enum LocalFont {
  KZUDGOTHIC = 'KZ UDGothic',
  KZUDMINCHO = 'KZ UDMincho',
  GENEI = 'Genei Koburi Mincho v5',
  KLEEONE = 'Klee One',
  KLEEONESEMIBOLD = 'Klee One SemiBold',
  NOTOSANSJP = 'Noto Sans JP',
  NOTOSERIFJP = 'Noto Serif JP',
  SHIPPORIMINCHO = 'Shippori Mincho',
  SERIF = 'Serif',
  SANSSERIF = 'Sans-Serif'
}

export interface UserFont {
  name: string;
  path: string;
  fileName: string;
}

export const userFontsCacheName = 'ttu-userfonts';

const userFontFormatsByExtension: Record<string, string> = {
  otf: 'opentype',
  ttf: 'truetype',
  woff: 'woff',
  woff2: 'woff2'
};

export const reservedFontNames = new Set([
  'KZ UDGothic',
  'KZ UDMincho',
  'Genei Koburi Mincho v5',
  'Klee One',
  'Klee One SemiBold',
  'Noto Sans JP',
  'Noto Serif JP',
  'Shippori Mincho',
  'Serif',
  'Sans-Serif'
]);

export function isStoredFont(fontName: string, userFonts: UserFont[]) {
  return (
    reservedFontNames.has(fontName) || !!userFonts.find((userFont) => userFont.name === fontName)
  );
}

export function isUserFont(value: unknown): value is UserFont {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const userFont = value as Partial<UserFont>;

  return (
    typeof userFont.name === 'string' &&
    typeof userFont.path === 'string' &&
    typeof userFont.fileName === 'string'
  );
}

export function getUserFontFormat(fileName: string) {
  const extension = fileName.split('.').pop()?.toLowerCase() || '';

  return userFontFormatsByExtension[extension] || '';
}
