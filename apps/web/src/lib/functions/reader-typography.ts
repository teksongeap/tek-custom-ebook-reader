/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

type ReaderChromeStyleOptions = {
  fontSize: number | undefined;
  fontColor?: string;
  backgroundColor?: string;
};

const defaultReaderFontSize = 20;
const defaultReaderFontFamily = 'Noto Serif JP';
const genericFontFamilies = new Set([
  'cursive',
  'emoji',
  'fangsong',
  'fantasy',
  'math',
  'monospace',
  'sans-serif',
  'serif',
  'system-ui',
  'ui-monospace',
  'ui-rounded',
  'ui-sans-serif',
  'ui-serif'
]);

export function getReaderTypographyStyle(fontSize: number | undefined) {
  const contentFontSize = normalizeFontSize(fontSize);

  return [
    toCssVariable('reader-content-font-size', contentFontSize),
    toCssVariable('reader-reading-font-size', limitToRange(15, 28, contentFontSize * 0.95)),
    toCssVariable('reader-ui-title-font-size', limitToRange(16, 22, contentFontSize * 0.86)),
    toCssVariable('reader-ui-font-size', limitToRange(14, 20, contentFontSize * 0.78)),
    toCssVariable('reader-ui-control-font-size', limitToRange(13, 18, contentFontSize * 0.68)),
    toCssVariable('reader-ui-small-font-size', limitToRange(12, 16, contentFontSize * 0.62)),
    toCssVariable('reader-ui-xsmall-font-size', limitToRange(11, 14, contentFontSize * 0.54))
  ].join('; ');
}

export function getReaderChromeStyle({
  fontSize,
  fontColor,
  backgroundColor
}: ReaderChromeStyleOptions) {
  return [
    getReaderTypographyStyle(fontSize),
    `--reader-page-text: ${fontColor || 'var(--font-color)'}`,
    `--reader-page-bg: ${backgroundColor || 'var(--background-color)'}`
  ].join('; ');
}

export function getReaderSurfaceStyle(options: ReaderChromeStyleOptions) {
  return [
    getReaderChromeStyle(options),
    `color: ${options.fontColor || 'var(--font-color)'}`,
    `background-color: ${options.backgroundColor || 'var(--background-color)'}`
  ].join('; ');
}

export function getReaderFontFamilyCssValue(
  fontFamily: string | undefined,
  fallback = defaultReaderFontFamily
) {
  const normalizedFontFamily = fontFamily || fallback;

  if (genericFontFamilies.has(normalizedFontFamily.toLowerCase())) {
    return normalizedFontFamily;
  }

  return toCssQuotedString(normalizedFontFamily);
}

export function getReaderFontLoadDescriptor(fontSize: number, fontFamily: string | undefined) {
  return `${normalizeFontSize(fontSize)}px ${getReaderFontFamilyCssValue(fontFamily)}`;
}

export async function waitForReaderFontLoad(
  fontSize: number,
  fontFamily: string | undefined,
  timeout: number
) {
  const fontDescriptor = getReaderFontLoadDescriptor(fontSize, fontFamily);

  if (document.fonts.check(fontDescriptor)) {
    return 'ready';
  }

  return Promise.race([
    document.fonts.load(fontDescriptor).then(
      () => 'loaded',
      () => 'error'
    ),
    new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), timeout))
  ]);
}

export function toCssQuotedString(value: string) {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function normalizeFontSize(fontSize: number | undefined) {
  return typeof fontSize === 'number' && Number.isFinite(fontSize) && fontSize > 0
    ? fontSize
    : defaultReaderFontSize;
}

function limitToRange(min: number, max: number, value: number) {
  return Math.min(Math.max(value, min), max);
}

function toCssVariable(name: string, value: number) {
  return `--${name}: ${toPixelValue(value)}`;
}

function toPixelValue(value: number) {
  return `${Math.round(value * 1000) / 1000}px`;
}
