<script lang="ts">
  export let text = '';

  interface TextSegment {
    id: string;
    text: string;
    href?: string;
  }

  const urlCandidatePattern = /\b(?:https?:\/\/|mailto:|www\.)[^\s<>"']+/giu;
  const trailingPunctuation = new Set([
    '.',
    ',',
    '!',
    '?',
    ';',
    ':',
    '。',
    '，',
    '、',
    '！',
    '？',
    '；',
    '：',
    ')',
    ']',
    '}',
    '）',
    '】',
    '」',
    '』',
    '"',
    "'",
    '”',
    '’'
  ]);
  const allowedProtocols = new Set(['http:', 'https:', 'mailto:']);

  $: segments = getTextSegments(text);

  function getTextSegments(value: string) {
    const nextSegments: TextSegment[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    urlCandidatePattern.lastIndex = 0;

    while ((match = urlCandidatePattern.exec(value))) {
      const candidate = match[0];
      const matchIndex = match.index;
      const { linkText, trailingText } = trimTrailingPunctuation(candidate);
      const href = getSafeHref(linkText);

      if (!href) {
        continue;
      }

      if (matchIndex > lastIndex) {
        nextSegments.push({
          id: `${nextSegments.length}-text`,
          text: value.slice(lastIndex, matchIndex)
        });
      }

      nextSegments.push({
        id: `${nextSegments.length}-link`,
        text: linkText,
        href
      });

      if (trailingText) {
        nextSegments.push({
          id: `${nextSegments.length}-trailing`,
          text: trailingText
        });
      }

      lastIndex = matchIndex + candidate.length;
    }

    if (lastIndex < value.length) {
      nextSegments.push({
        id: `${nextSegments.length}-text-end`,
        text: value.slice(lastIndex)
      });
    }

    return nextSegments;
  }

  function trimTrailingPunctuation(candidate: string) {
    let linkText = candidate;
    let trailingText = '';

    while (linkText) {
      const trailingCharacter = linkText[linkText.length - 1];

      if (!shouldTrimTrailingCharacter(linkText, trailingCharacter)) {
        break;
      }

      trailingText = trailingCharacter + trailingText;
      linkText = linkText.slice(0, -1);
    }

    return { linkText, trailingText };
  }

  function shouldTrimTrailingCharacter(value: string, character: string) {
    if (character === ')') {
      return countCharacter(value, ')') > countCharacter(value, '(');
    }

    if (character === ']') {
      return countCharacter(value, ']') > countCharacter(value, '[');
    }

    if (character === '}') {
      return countCharacter(value, '}') > countCharacter(value, '{');
    }

    return trailingPunctuation.has(character);
  }

  function countCharacter(value: string, character: string) {
    return Array.from(value).filter((item) => item === character).length;
  }

  function getSafeHref(value: string) {
    const href = value.toLowerCase().startsWith('www.') ? `https://${value}` : value;

    try {
      const url = new URL(href);

      return allowedProtocols.has(url.protocol) ? href : undefined;
    } catch (_) {
      return undefined;
    }
  }
</script>

{#each segments as segment (segment.id)}
  {#if segment.href}
    <a
      class="annotation-comment-link"
      data-annotation-panel-control
      href={segment.href}
      target="_blank"
      rel="noopener noreferrer"
      on:click|stopPropagation={() => {}}
      on:keydown|stopPropagation={() => {}}
    >
      {segment.text}
    </a>
  {:else}
    {segment.text}
  {/if}
{/each}

<style lang="scss">
  .annotation-comment-link {
    color: color-mix(in srgb, var(--app-accent) 86%, currentColor);
    overflow-wrap: anywhere;
    text-decoration: underline;
    text-decoration-thickness: 0.08em;
    text-underline-offset: 0.16em;
  }

  .annotation-comment-link:hover,
  .annotation-comment-link:focus-visible {
    color: var(--app-accent);
    outline: none;
  }
</style>
