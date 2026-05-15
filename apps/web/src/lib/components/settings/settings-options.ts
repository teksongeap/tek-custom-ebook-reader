/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import {
  TrackerAutoPause,
  TrackerSkipThresholdAction
} from '$lib/components/book-reader/book-reading-tracker/book-reading-tracker';
import type { ToggleOption } from '$lib/components/button-toggle-group/toggle-option';
import { BlurMode } from '$lib/data/blur-mode';
import { FuriganaStyle } from '$lib/data/furigana-style';
import { ImportHTMLFixMode } from '$lib/data/import-html-fix-mode';
import { MergeMode } from '$lib/data/merge-mode';
import { PaginationTransitionMode } from '$lib/data/pagination-transition-mode';
import type { TextMarginMode } from '$lib/data/text-margin-mode';
import type { VerticalTextOrientation } from '$lib/data/vertical-text-orientation';
import { ViewMode } from '$lib/data/view-mode';
import type { WritingMode } from '$lib/data/writing-mode';
import {
  AutoReplicationType,
  ReplicationSaveBehavior
} from '$lib/functions/replication/replication-options';

export const optionsForFuriganaStyle: ToggleOption<FuriganaStyle>[] = [
  { id: FuriganaStyle.Hide, text: 'Hide' },
  { id: FuriganaStyle.Partial, text: 'Partial' },
  { id: FuriganaStyle.Toggle, text: 'Toggle' },
  { id: FuriganaStyle.Full, text: 'Full' }
];

export const optionsForWritingMode: ToggleOption<WritingMode>[] = [
  { id: 'horizontal-tb', text: 'Horizontal' },
  { id: 'vertical-rl', text: 'Vertical' }
];

export const optionsForVerticalTextOrientation: ToggleOption<VerticalTextOrientation>[] = [
  { id: 'mixed', text: 'Mixed' },
  { id: 'upright', text: 'Upright' }
];

export const optionsForTextMarginMode: ToggleOption<TextMarginMode>[] = [
  { id: 'auto', text: 'Auto' },
  { id: 'manual', text: 'Manual' }
];

export const optionsForViewMode: ToggleOption<ViewMode>[] = [
  { id: ViewMode.Continuous, text: 'Continuous' },
  { id: ViewMode.Paginated, text: 'Paginated' }
];

export const optionsForPaginationTransitionMode: ToggleOption<PaginationTransitionMode>[] = [
  { id: PaginationTransitionMode.Glide, text: 'Glide' },
  { id: PaginationTransitionMode.Instant, text: 'Instant' }
];

export const optionsForBlurMode: ToggleOption<BlurMode>[] = [
  { id: BlurMode.ALL, text: 'All' },
  { id: BlurMode.AFTER_TOC, text: 'After ToC' }
];

export const optionsForImportHTMLFixes: ToggleOption<ImportHTMLFixMode>[] = [
  { id: ImportHTMLFixMode.OFF, text: 'Off' },
  { id: ImportHTMLFixMode.STANDARD, text: 'Standard' },
  { id: ImportHTMLFixMode.EXTENDED, text: 'Extended' }
];

export const optionsForAutoReplicationType: ToggleOption<AutoReplicationType>[] = [
  { id: AutoReplicationType.Off, text: 'Off' },
  { id: AutoReplicationType.Up, text: 'Up' },
  { id: AutoReplicationType.Down, text: 'Down' },
  { id: AutoReplicationType.All, text: 'All' }
];

export const optionsForReplicationSaveBehavior: ToggleOption<ReplicationSaveBehavior>[] = [
  { id: ReplicationSaveBehavior.NewOnly, text: 'New Only' },
  { id: ReplicationSaveBehavior.Overwrite, text: 'Overwrite' }
];

export const optionsForTrackerAutoPause: ToggleOption<TrackerAutoPause>[] = [
  { id: TrackerAutoPause.OFF, text: 'Off' },
  { id: TrackerAutoPause.MODERATE, text: 'Moderate' },
  { id: TrackerAutoPause.STRICT, text: 'Strict' }
];

export const optionsForTrackerSkipThresholdAction: ToggleOption<TrackerSkipThresholdAction>[] = [
  { id: TrackerSkipThresholdAction.IGNORE, text: 'Ignore' },
  { id: TrackerSkipThresholdAction.PAUSE, text: 'Pause Tracker' }
];

export const optionsForMergeMode: ToggleOption<MergeMode>[] = [
  { id: MergeMode.MERGE, text: 'Merge' },
  { id: MergeMode.REPLACE, text: 'Replace' }
];
