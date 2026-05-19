/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { Subject } from 'rxjs';
import type { ReaderLinkReference, ReaderTarget } from './epub-reference';

export interface ReaderFootnoteRequest {
  reference: ReaderLinkReference;
  target: ReaderTarget;
}

export const readerFootnoteRequest$ = new Subject<ReaderFootnoteRequest>();
