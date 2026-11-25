<script lang="ts">
  import { renderAnnotationMarkdown } from './annotation-markdown';

  export let text = '';

  $: html = renderAnnotationMarkdown(text);

  function isolateLinks(node: HTMLElement) {
    const stopLinkPropagation = (event: Event) => {
      if (event.target instanceof Element && event.target.closest('a')) {
        event.stopPropagation();
      }
    };

    node.addEventListener('click', stopLinkPropagation);
    node.addEventListener('keydown', stopLinkPropagation);

    return {
      destroy() {
        node.removeEventListener('click', stopLinkPropagation);
        node.removeEventListener('keydown', stopLinkPropagation);
      }
    };
  }
</script>

<div class="annotation-markdown" use:isolateLinks>{@html html}</div>

<style lang="scss">
  .annotation-markdown {
    min-width: 0;
    overflow-wrap: anywhere;
    white-space: normal;
    line-height: 1.6;
  }

  .annotation-markdown :global(p),
  .annotation-markdown :global(ul),
  .annotation-markdown :global(ol),
  .annotation-markdown :global(blockquote),
  .annotation-markdown :global(pre),
  .annotation-markdown :global(table) {
    margin: 0.65em 0;
  }

  .annotation-markdown > :global(:first-child) {
    margin-top: 0;
  }

  .annotation-markdown > :global(:last-child) {
    margin-bottom: 0;
  }

  .annotation-markdown :global(h1),
  .annotation-markdown :global(h2),
  .annotation-markdown :global(h3),
  .annotation-markdown :global(h4),
  .annotation-markdown :global(h5),
  .annotation-markdown :global(h6) {
    margin: 1em 0 0.4em;
    color: var(--reader-page-text);
    font-weight: 700;
    line-height: 1.3;
    text-wrap: pretty;
  }

  .annotation-markdown :global(h1) {
    font-size: 1.3em;
  }

  .annotation-markdown :global(h2) {
    font-size: 1.18em;
  }

  .annotation-markdown :global(h3),
  .annotation-markdown :global(h4),
  .annotation-markdown :global(h5),
  .annotation-markdown :global(h6) {
    font-size: 1.05em;
  }

  .annotation-markdown :global(strong) {
    color: var(--reader-page-text);
    font-weight: 700;
  }

  .annotation-markdown :global(em) {
    font-style: italic;
  }

  .annotation-markdown :global(del) {
    text-decoration: line-through;
  }

  .annotation-markdown :global(ul),
  .annotation-markdown :global(ol) {
    padding-inline-start: 1.4em;
  }

  .annotation-markdown :global(ul) {
    list-style-type: disc;
  }

  .annotation-markdown :global(ol) {
    list-style-type: decimal;
  }

  .annotation-markdown :global(li + li) {
    margin-top: 0.25em;
  }

  .annotation-markdown :global(li > p) {
    margin: 0.3em 0;
  }

  .annotation-markdown :global(li::marker) {
    color: color-mix(in srgb, var(--reader-page-text) 55%, transparent);
  }

  .annotation-markdown :global(input[type='checkbox']) {
    margin-inline-end: 0.4em;
    accent-color: var(--app-accent);
  }

  .annotation-markdown :global(blockquote) {
    border-inline-start: 0.18em solid color-mix(in srgb, var(--app-accent) 45%, transparent);
    padding: 0.15em 0 0.15em 0.85em;
    color: color-mix(in srgb, var(--reader-page-text) 72%, var(--reader-page-bg));
  }

  .annotation-markdown :global(blockquote > :first-child) {
    margin-top: 0;
  }

  .annotation-markdown :global(blockquote > :last-child) {
    margin-bottom: 0;
  }

  .annotation-markdown :global(code) {
    border-radius: 0.3em;
    background: color-mix(in srgb, var(--reader-page-text) 8%, transparent);
    padding: 0.12em 0.3em;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.88em;
  }

  .annotation-markdown :global(pre) {
    max-width: 100%;
    overflow-x: auto;
    border: 1px solid color-mix(in srgb, var(--reader-page-text) 10%, transparent);
    border-radius: 0.5em;
    background: color-mix(in srgb, var(--reader-page-text) 5%, var(--reader-page-bg));
    padding: 0.7em 0.85em;
    white-space: pre;
  }

  .annotation-markdown :global(pre code) {
    border-radius: 0;
    background: transparent;
    padding: 0;
  }

  .annotation-markdown :global(a) {
    color: color-mix(in srgb, var(--app-accent) 86%, currentColor);
    text-decoration: underline;
    text-decoration-thickness: 0.08em;
    text-underline-offset: 0.16em;
  }

  .annotation-markdown :global(a:hover) {
    color: var(--app-accent);
  }

  .annotation-markdown :global(a:focus-visible) {
    border-radius: 0.15em;
    outline: 2px solid var(--app-accent);
    outline-offset: 2px;
  }

  .annotation-markdown :global(table) {
    display: block;
    max-width: 100%;
    overflow-x: auto;
    border-collapse: collapse;
    font-size: 0.92em;
  }

  .annotation-markdown :global(th),
  .annotation-markdown :global(td) {
    border: 1px solid color-mix(in srgb, var(--reader-page-text) 16%, transparent);
    padding: 0.4em 0.65em;
  }

  .annotation-markdown :global(th) {
    background: color-mix(in srgb, var(--reader-page-text) 6%, transparent);
    color: var(--reader-page-text);
    font-weight: 650;
  }

  .annotation-markdown :global(hr) {
    margin: 1em 0;
    border: 0;
    border-top: 1px solid color-mix(in srgb, var(--reader-page-text) 16%, transparent);
  }

  .annotation-markdown :global(img) {
    display: block;
    max-width: 100%;
    height: auto;
    margin: 0.65em 0;
    border-radius: 0.4em;
  }
</style>
