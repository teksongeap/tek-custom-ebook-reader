/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import type { DBSchema } from 'idb';

interface BooksDbV3BookData {
  id: number;
  title: string;
  styleSheet: string;
  elementHtml: string;
  blobs: Record<string, Blob>;
  coverImage?: string | Blob;
  hasThumb: boolean;
  sections?: Section[];
  toc?: BookTocEntry[];
  lastBookModified: number;
  lastBookOpen: number;
}

interface BooksDbV3BookmarkData {
  dataId: number;
  scrollX?: number;
  scrollY?: number;
  exploredCharCount?: number;
  progress: number | string | undefined;
  lastBookmarkModified: number;
}

export interface Section {
  reference: string;
  charactersWeight: number;
  label?: string;
  startCharacter?: number;
  characters?: number;
  parentChapter?: string;
  sourceHref?: string;
  targetFragment?: string;
  tocDepth?: number;
}

export interface BookTocEntry {
  id: string;
  label: string;
  reference: string;
  sourceHref: string;
  targetFragment?: string;
  children?: BookTocEntry[];
}

export default interface BooksDbV3 extends DBSchema {
  data: {
    key: number;
    value: BooksDbV3BookData;
    indexes: {
      title: string;
    };
  };
  bookmark: {
    key: number;
    value: BooksDbV3BookmarkData;
    indexes: {
      dataId: number;
    };
  };
  lastItem: {
    key: number;
    value: {
      dataId: number;
    };
  };
}
