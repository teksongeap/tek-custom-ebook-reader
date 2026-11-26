<script lang="ts">
  import { StorageDataType } from '$lib/data/storage/storage-types';
  import { faCheck } from '@fortawesome/free-solid-svg-icons';
  import Fa from 'svelte-fa';

  export let dataToReplicate: StorageDataType[];

  const contentOptions = [
    { value: StorageDataType.DATA, label: 'Book data', description: 'Text, images, and covers' },
    {
      value: StorageDataType.PROGRESS,
      label: 'Reading progress',
      description: 'Bookmarks and reading position'
    },
    {
      value: StorageDataType.ANNOTATIONS,
      label: 'Annotations',
      description: 'Highlights and notes'
    },
    {
      value: StorageDataType.STATISTICS,
      label: 'Statistics',
      description: 'Reading time and history'
    },
    {
      value: StorageDataType.READING_GOALS,
      label: 'Reading goals',
      description: 'Your goals and targets'
    },
    { value: StorageDataType.AUDIOBOOK, label: 'Audiobook', description: 'Playback position' },
    { value: StorageDataType.SUBTITLE, label: 'Subtitles', description: 'Saved subtitle data' }
  ];
</script>

<fieldset>
  <legend>Include</legend>
  <div class="content-options">
    {#each contentOptions as option (option.value)}
      <label class="content-option">
        <input
          type="checkbox"
          aria-label={option.label}
          value={option.value}
          bind:group={dataToReplicate}
        />
        <span class="checkmark" aria-hidden="true"><Fa icon={faCheck} /></span>
        <span class="option-copy"
          ><span class="option-label">{option.label}</span><span class="option-description"
            >{option.description}</span
          ></span
        >
      </label>
    {/each}
  </div>
</fieldset>

<style>
  fieldset {
    min-width: 0;
  }
  legend {
    padding: 0;
    margin-bottom: 0.7rem;
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--app-chrome-muted);
  }
  .content-options {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.5rem;
  }
  .content-option {
    position: relative;
    display: flex;
    align-items: center;
    gap: 0.65rem;
    min-height: 64px;
    padding: 0.65rem 0.75rem;
    border: 1px solid var(--app-surface-border);
    border-radius: 0.6rem;
    cursor: pointer;
  }
  .content-option:hover {
    background: var(--app-chrome-hover);
  }
  .content-option:has(input:checked) {
    background: var(--app-accent-soft);
  }
  .content-option:has(input:focus-visible) {
    outline: 2px solid var(--font-color);
    outline-offset: 2px;
  }
  input {
    position: absolute;
    width: 1px;
    height: 1px;
    opacity: 0;
  }
  .checkmark {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 18px;
    height: 18px;
    border: 1px solid color-mix(in srgb, var(--font-color) 35%, transparent);
    border-radius: 0.3rem;
    font-size: 0.65rem;
    background: var(--background-color);
  }
  .checkmark :global(svg) {
    opacity: 0;
  }
  input:checked + .checkmark {
    background: var(--app-accent);
    color: var(--app-accent-contrast);
    border-color: var(--app-accent);
  }
  input:checked + .checkmark :global(svg) {
    opacity: 1;
  }
  .option-copy {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    min-width: 0;
  }
  .option-label {
    font-size: 0.8rem;
    font-weight: 550;
  }
  .option-description {
    font-size: 0.7rem;
    color: var(--app-chrome-muted);
    line-height: 1.35;
  }
  @media (max-width: 639px) {
    .content-options {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
