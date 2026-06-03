/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { BlobReader, BlobWriter, TextWriter, ZipReader } from '@zip.js/zip.js';
import { isOPFType, type EpubContent, type EpubOPFContent } from './types';

import type { Entry } from '@zip.js/zip.js';
import { XMLParser } from 'fast-xml-parser';
import { startProfile } from '$lib/functions/performance-profiler';
import { throwIfAborted } from '$lib/functions/replication/replication-error';
import initZipSettings from '../utils/init-zip-settings';
import pLimit from 'p-limit';
import path from 'path-browserify';

initZipSettings();

export default async function extractEpub(blob: Blob, cancelSignal?: AbortSignal) {
  const profile = startProfile('epub extract', { sizeBytes: blob.size });
  const reader = new ZipReader(new BlobReader(blob));

  try {
    throwIfAborted(cancelSignal);
    // get all entries from the zip
    const entries = await reader.getEntries();
    throwIfAborted(cancelSignal);
    profile.lap('read entries', { entries: entries.length });

    const result: Record<string, string | Blob> = {};
    let contentsDirectory = '';
    let contents!: EpubContent | EpubOPFContent;
    if (entries.length) {
      const fileMap = entries.reduce<Record<string, Entry>>((acc, cur) => {
        acc[cur.filename] = cur;
        return acc;
      }, {});

      const containerXml = await fileMap['META-INF/container.xml'].getData!(new TextWriter());
      const parser = new XMLParser({
        ignoreAttributes: false
      });
      const container = parser.parse(containerXml);
      const rootFiles = container.container.rootfiles.rootfile;
      const rootFile = Array.isArray(rootFiles) ? rootFiles[0] : rootFiles;

      const contentOpfFilename = rootFile['@_full-path'];
      profile.lap('read container', { rootFile: contentOpfFilename });

      const contentsXml = await fileMap[contentOpfFilename].getData!(new TextWriter());
      result[contentOpfFilename] = contentsXml;

      contentsDirectory = path.dirname(contentOpfFilename);

      contents = parser.parse(contentsXml);
      profile.lap('read opf', { contentLength: contentsXml.length });

      const extractLimiter = pLimit(4);
      const manifestItems = normalizeArray(
        isOPFType(contents)
          ? contents['opf:package']['opf:manifest']['opf:item']
          : contents.package.manifest.item
      );
      let imageItems = 0;
      let textItems = 0;
      let skippedItems = 0;

      await Promise.all(
        manifestItems.map((item) =>
          extractLimiter(async () => {
            throwIfAborted(cancelSignal);
            const fileRelativePath = item['@_href'];
            const entry = fileMap[path.join(contentsDirectory, fileRelativePath)];

            if (!entry) {
              throw new Error(`item ${fileRelativePath} not found`);
            }

            if (entry.getData && !entry.directory) {
              let value: string | Blob;
              const mediaType = normalizeMediaType(item['@_media-type']);
              if (mediaType.startsWith('image/')) {
                value = await entry.getData(new BlobWriter(mediaType));
                imageItems += 1;
              } else if (isTextManifestItem(mediaType)) {
                value = await entry.getData(new TextWriter());
                textItems += 1;
              } else {
                skippedItems += 1;
                return;
              }
              result[fileRelativePath] = value;
            }
          })
        )
      );
      profile.lap('extract manifest', {
        manifest: manifestItems.length,
        images: imageItems,
        text: textItems,
        skipped: skippedItems
      });
    }

    return {
      contentsDirectory,
      contents,
      result
    };
  } finally {
    profile.end();
    await reader.close().catch(() => {
      // no-op
    });
  }
}

function normalizeArray<T>(value: T | T[]) {
  return Array.isArray(value) ? value : [value];
}

function normalizeMediaType(mediaType?: string) {
  return (mediaType || '').split(';')[0].trim().toLowerCase();
}

function isTextManifestItem(mediaType: string) {
  return (
    mediaType.startsWith('text/') ||
    mediaType === 'application/xhtml+xml' ||
    mediaType === 'application/xml' ||
    mediaType === 'application/x-dtbncx+xml' ||
    mediaType === 'application/smil+xml'
  );
}
