/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import type { FsHandle, RemoteContext } from '$lib/data/storage/storage-source-manager';

import type { DBSchema } from 'idb';
import type { ReadingGoal } from '$lib/data/reading-goal';
import type { StorageKey } from '$lib/data/storage/storage-types';

interface Subtitle {
  id: string;
  originalStartSeconds: number;
  adjustedStartSeconds?: number;
  startSeconds: number;
  startTime: string;
  originalEndSeconds: number;
  adjustedEndSeconds?: number;
  endSeconds: number;
  endTime: string;
  originalText: string;
  text: string;
  subIndex: number;
}

interface SubtitleData {
  name: string;
  subtitles: Subtitle[];
}

interface BooksDbV7BookData {
  id: number;
  title: string;
  language?: string;
  styleSheet: string;
  elementHtml: string;
  blobs: Record<string, Blob>;
  coverImage?: string | Blob;
  hasThumb: boolean;
  characters: number;
  sections?: Section[];
  toc?: BookTocEntry[];
  lastBookModified: number;
  lastBookOpen: number;
  storageSource?: string;
  htmlBackup?: string;
}

interface BooksDbV7BookmarkData {
  dataId: number;
  scrollX?: number;
  scrollY?: number;
  exploredCharCount?: number;
  progress: number | string | undefined;
  lastBookmarkModified: number;
}

export type BooksDbAnnotationColor = 'yellow' | 'green' | 'blue' | 'pink' | 'violet';

export interface BooksDbSerializedAnnotationRange {
  sectionId: string;
  startOffset: number;
  endOffset: number;
  text: string;
  prefix: string;
  suffix: string;
}

interface BooksDbV7Annotation {
  id: string;
  dataId: number;
  color: BooksDbAnnotationColor;
  comment: string;
  selectedText: string;
  anchor: BooksDbSerializedAnnotationRange;
  progress: number;
  exploredCharCount: number;
  createdAt: number;
  updatedAt: number;
}

interface BooksDbV7StorageSource {
  name: string;
  type: StorageKey;
  data: FsHandle | ArrayBuffer | RemoteContext;
  storedInManager: boolean;
  encryptionDisabled: boolean;
  lastSourceModified: number;
}

interface BooksDbV7Statistic {
  title: string;
  dateKey: string;
  charactersRead: number;
  readingTime: number;
  minReadingSpeed: number;
  altMinReadingSpeed: number;
  lastReadingSpeed: number;
  maxReadingSpeed: number;
  lastStatisticModified: number;
  completedBook?: number;
  completedData?: Omit<BooksDbV7Statistic, 'title' | 'lastStatisticModified'>;
}

interface BooksDbV7ReadingGoal extends ReadingGoal {
  goalEndDate: string;
  goalOriginalEndDate: string;
}

interface BooksDbV7LastModified {
  title: string;
  dataType: string;
  lastModifiedValue: number;
}

interface BooksDbV7AudioBook {
  title: string;
  playbackPosition: number;
  lastAudioBookModified: number;
}

interface BooksDbV7SubtitleData {
  title: string;
  subtitleData: SubtitleData;
  lastSubtitleDataModified: number;
}

interface BooksDbV7Handle {
  title: string;
  dataType: string;
  handle: FileSystemFileHandle | FileSystemDirectoryHandle;
  lastHandleModified: number;
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

export default interface BooksDbV7 extends DBSchema {
  data: {
    key: number;
    value: BooksDbV7BookData;
    indexes: {
      title: string;
    };
  };
  bookmark: {
    key: number;
    value: BooksDbV7BookmarkData;
    indexes: {
      dataId: number;
    };
  };
  annotation: {
    key: string;
    value: BooksDbV7Annotation;
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
  storageSource: {
    key: string;
    value: BooksDbV7StorageSource;
  };
  statistic: {
    key: string[];
    value: BooksDbV7Statistic;
    indexes: {
      dateKey: string;
      completedBook: (string | number | [])[];
    };
  };
  readingGoal: {
    key: string;
    value: BooksDbV7ReadingGoal;
    indexes: {
      goalEndDate: string;
    };
  };
  lastModified: {
    key: string[];
    value: BooksDbV7LastModified;
  };
  audioBook: {
    key: string;
    value: BooksDbV7AudioBook;
  };
  subtitle: {
    key: string;
    value: BooksDbV7SubtitleData;
  };
  handle: {
    key: string[];
    value: BooksDbV7Handle;
  };
}
