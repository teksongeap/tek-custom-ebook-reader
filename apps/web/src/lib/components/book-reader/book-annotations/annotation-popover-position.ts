/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

export type AnnotationRect = Pick<
  DOMRect,
  'left' | 'right' | 'top' | 'bottom' | 'width' | 'height'
>;
export type AnnotationPoint = { x: number; y: number };
export type AnnotationViewport = { left: number; top: number; width: number; height: number };

/** Choose a visible text fragment, rather than the union of several reading columns. */
export function getAnnotationAnchorIndex(
  rects: ReadonlyArray<AnnotationRect>,
  viewport: AnnotationViewport,
  vertical: boolean,
  point?: AnnotationPoint
) {
  const visible = rects.flatMap((rect, index) => {
    const left = Math.max(rect.left, viewport.left);
    const right = Math.min(rect.right, viewport.left + viewport.width);
    const top = Math.max(rect.top, viewport.top);
    const bottom = Math.min(rect.bottom, viewport.top + viewport.height);
    if (rect.width <= 0 || rect.height <= 0 || right <= left || bottom <= top) return [];
    const distance = point
      ? Math.max(left - point.x, 0, point.x - right) ** 2 +
        Math.max(top - point.y, 0, point.y - bottom) ** 2
      : 0;
    return [{ index, left, right, top, distance }];
  });
  visible.sort(
    (a, b) =>
      a.distance - b.distance ||
      (vertical ? b.right - a.right || a.top - b.top : a.top - b.top || a.left - b.left)
  );
  return visible[0]?.index ?? -1;
}

export function getAnnotationPopoverPosition({
  anchor,
  viewport,
  width,
  height,
  vertical,
  point
}: {
  anchor: AnnotationRect;
  viewport: AnnotationViewport;
  width: number;
  height: number;
  vertical: boolean;
  point?: AnnotationPoint;
}) {
  const margin = 12;
  const gap = 14;
  const minLeft = viewport.left + margin;
  const minTop = viewport.top + margin;
  const right = viewport.left + viewport.width - margin;
  const bottom = viewport.top + viewport.height - margin;
  const clamp = (value: number, min: number, max: number) =>
    Math.max(min, Math.min(value, Math.max(min, max)));
  const anchorY = point ? clamp(point.y, anchor.top, anchor.bottom) : anchor.top;

  if (vertical) {
    // Keep the card's header near the word that opened it, even on a full-height line.
    const top = clamp(anchorY - 24, minTop, bottom - height);
    if (anchor.right + gap + width <= right) {
      return { left: Math.max(minLeft, anchor.right + gap), top, placement: 'right' as const };
    }
    if (anchor.left - gap - width >= minLeft) {
      return { left: anchor.left - gap - width, top, placement: 'left' as const };
    }
  }

  // Small screens may fit neither side. Fall back near the hovered word, not the
  // bottom of a paragraph-sized union rectangle, and keep the card on screen.
  const anchorTop = vertical && point ? anchorY - anchor.width / 2 : anchor.top;
  const anchorBottom = vertical && point ? anchorY + anchor.width / 2 : anchor.bottom;
  const spaceAbove = anchorTop - gap - minTop;
  const spaceBelow = bottom - anchorBottom - gap;
  const above = spaceAbove >= height || (spaceBelow < height && spaceAbove >= spaceBelow);
  return {
    left: clamp(anchor.left + anchor.width / 2 - width / 2, minLeft, right - width),
    top: clamp(above ? anchorTop - height - gap : anchorBottom + gap, minTop, bottom - height),
    placement: above ? ('top' as const) : ('bottom' as const)
  };
}
