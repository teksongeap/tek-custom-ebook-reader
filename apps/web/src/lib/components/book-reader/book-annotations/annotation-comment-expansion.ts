export const annotationCommentCollapsedLineCount = 2;

export function shouldOfferAnnotationCommentExpansionBeforeMeasurement(
  comment: string,
  collapsedLineCount = annotationCommentCollapsedLineCount
) {
  return getCommentLineCount(comment.trim()) > collapsedLineCount;
}

export function hasAnnotationCommentOverflow(
  element: HTMLElement,
  collapsedLineCount = annotationCommentCollapsedLineCount
) {
  const rect = element.getBoundingClientRect();
  const collapsedHeight = getCollapsedCommentHeight(element, collapsedLineCount);

  if (element.scrollHeight > collapsedHeight + 1 || element.scrollWidth > element.clientWidth + 1) {
    return true;
  }

  if (rect.width <= 0 || rect.height <= 0) {
    return false;
  }

  const clone = element.cloneNode(true) as HTMLElement;
  clone.setAttribute('aria-hidden', 'true');
  clone.style.position = 'absolute';
  clone.style.visibility = 'hidden';
  clone.style.pointerEvents = 'none';
  clone.style.left = '-10000px';
  clone.style.top = '0';
  clone.style.width = `${rect.width}px`;
  clone.style.height = 'auto';
  clone.style.maxHeight = 'none';
  clone.style.minHeight = '0';
  clone.style.overflow = 'visible';
  clone.style.display = 'block';
  clone.style.setProperty('-webkit-line-clamp', 'unset');
  clone.style.setProperty('line-clamp', 'unset');
  clone.style.setProperty('-webkit-box-orient', 'initial');

  const host = element.parentElement ?? document.body;
  host.appendChild(clone);
  const naturalHeight = Math.max(clone.scrollHeight, clone.getBoundingClientRect().height);
  clone.remove();

  return (
    naturalHeight > collapsedHeight + 1 ||
    isCommentLikelyWrappedPastClamp(element, collapsedLineCount)
  );
}

function getCommentLineCount(comment: string) {
  return comment ? comment.split(/\r?\n/).length : 0;
}

function getCollapsedCommentHeight(element: HTMLElement, collapsedLineCount: number) {
  const style = window.getComputedStyle(element);
  const lineHeight = Number.parseFloat(style.lineHeight);
  const fontSize = Number.parseFloat(style.fontSize);
  const fallbackLineHeight = Number.isFinite(fontSize) ? fontSize * 1.45 : 29;

  return (Number.isFinite(lineHeight) ? lineHeight : fallbackLineHeight) * collapsedLineCount;
}

function isCommentLikelyWrappedPastClamp(element: HTMLElement, collapsedLineCount: number) {
  const text = element.textContent?.trim();
  const width = element.clientWidth || element.getBoundingClientRect().width;

  if (!text || width <= 0) {
    return false;
  }

  const context = getCommentMeasurementContext();
  if (!context) {
    return false;
  }

  const style = window.getComputedStyle(element);
  context.font = [
    style.fontStyle,
    style.fontVariant,
    style.fontWeight,
    style.fontSize,
    style.fontFamily
  ]
    .filter(Boolean)
    .join(' ');

  return getEstimatedWrappedLineCount(text, context, width) > collapsedLineCount;
}

let commentMeasurementCanvas: HTMLCanvasElement | undefined;

function getCommentMeasurementContext() {
  commentMeasurementCanvas ??= document.createElement('canvas');

  return commentMeasurementCanvas.getContext('2d') ?? undefined;
}

function getEstimatedWrappedLineCount(
  text: string,
  context: CanvasRenderingContext2D,
  width: number
) {
  return text
    .split(/\r?\n/)
    .reduce(
      (lineCount, paragraph) =>
        lineCount + getEstimatedWrappedParagraphLineCount(paragraph, context, width),
      0
    );
}

function getEstimatedWrappedParagraphLineCount(
  paragraph: string,
  context: CanvasRenderingContext2D,
  width: number
) {
  if (!paragraph) {
    return 1;
  }

  let lineCount = 1;
  let currentLineWidth = 0;

  for (const character of Array.from(paragraph)) {
    const characterWidth = context.measureText(character).width;

    if (currentLineWidth > 0 && currentLineWidth + characterWidth > width) {
      lineCount += 1;
      currentLineWidth = characterWidth;
    } else {
      currentLineWidth += characterWidth;
    }
  }

  return lineCount;
}
