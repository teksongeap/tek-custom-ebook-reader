/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { Subject } from 'rxjs';
import type { ReaderTarget } from './epub-reference';

export interface ReaderTargetNavigation {
  target: ReaderTarget;
  highlight?: boolean;
}

export const readerTargetNavigation$ = new Subject<ReaderTargetNavigation>();
