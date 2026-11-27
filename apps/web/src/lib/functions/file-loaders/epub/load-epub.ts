/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import type { LoadData } from '../types';
import { normalizeLanguageCode } from '../../book-language/language-metadata';
import extractEpub from './extract-epub';
import generateEpubHtml from './generate-epub-html';
import generateEpubStyleSheet from './generate-epub-style-sheet';
import getEpubCoverImageFilename from './get-epub-cover-image-filename';
import { isOPFType } from './types';
import { startProfile } from '$lib/functions/performance-profiler';
import reduceObjToBlobs from '../utils/reduce-obj-to-blobs';

export default async function loadEpub(
  file: File,
  document: Document,
  lastBookModified: number,
  cancelSignal?: AbortSignal
): Promise<LoadData> {
  const profile = startProfile('epub load', { file: file.name, sizeBytes: file.size });

  try {
    const { contents, result: data, contentsDirectory } = await extractEpub(file, cancelSignal);
    profile.lap('extract', { files: Object.keys(data).length });

    const result = await generateEpubHtml(
      data,
      contents,
      document,
      contentsDirectory,
      cancelSignal
    );
    profile.lap('generate html', {
      characters: result.characters,
      sections: result.sections.length,
      toc: result.toc.length
    });

    const displayData = {
      title: file.name,
      language: '',
      hasThumb: true,
      styleSheet: generateEpubStyleSheet(data, contents)
    };
    profile.lap('generate stylesheet', { cssLength: displayData.styleSheet.length });

    const metadata = isOPFType(contents)
      ? contents['opf:package']['opf:metadata']
      : contents.package.metadata;

    if (metadata) {
      const languageValues = Array.isArray(metadata['dc:language'])
        ? metadata['dc:language']
        : [metadata['dc:language']];
      const titleValues = Array.isArray(metadata['dc:title'])
        ? metadata['dc:title']
        : [metadata['dc:title']];

      for (const dcTitle of titleValues) {
        if (typeof dcTitle === 'string') {
          displayData.title = dcTitle;
          break;
        } else if (dcTitle && dcTitle['#text']) {
          displayData.title = dcTitle['#text'];
          break;
        }
      }

      displayData.language =
        languageValues
          .map((value) =>
            normalizeLanguageCode(typeof value === 'string' ? value : value?.['#text'])
          )
          .find(Boolean) || '';
    }

    const blobData = reduceObjToBlobs(data);
    profile.lap('collect blobs', { blobs: Object.keys(blobData).length });

    const coverImageFilename = await getEpubCoverImageFilename(blobData, contents);
    let coverImage: Blob | undefined;
    profile.lap('cover lookup', { coverImage: !!coverImageFilename });

    if (coverImageFilename) {
      coverImage = blobData[coverImageFilename];
    }

    const elementHtml = result.element.innerHTML;
    profile.lap('serialize html', { htmlLength: elementHtml.length });

    return {
      ...displayData,
      declaredLanguage: displayData.language || undefined,
      language: '',
      elementHtml,
      blobs: blobData,
      coverImage,
      characters: result.characters,
      sections: result.sections,
      toc: result.toc,
      lastBookModified,
      lastBookOpen: 0
    };
  } finally {
    profile.end();
  }
}
