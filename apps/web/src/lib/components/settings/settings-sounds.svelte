<script lang="ts">
  import { faPlay } from '@fortawesome/free-solid-svg-icons';
  import Fa from 'svelte-fa';
  import {
    pageTurnSoundEnabled$,
    pageSoundStyle$,
    soundDesign,
    soundEnabled$,
    soundVolume$
  } from '$lib/data/sound-design';
  import type { SoundCue } from '$lib/functions/sound-engine';
  import {
    pageSoundOptions,
    normalizePageSoundStyle,
    type PageSoundStyle
  } from '$lib/functions/page-sounds';
  import SettingsItemGroup from './settings-item-group.svelte';

  const previews: { cue: SoundCue; label: string; description: string }[] = [
    { cue: 'click', label: 'Buttons', description: 'A crisp, definite pulse' },
    { cue: 'open', label: 'Menus', description: 'Two notes unfolding' },
    { cue: 'book', label: 'Open a book', description: 'A melodic welcome' },
    { cue: 'page', label: 'Page movement', description: 'A short electronic glide' },
    { cue: 'save', label: 'Save', description: 'A bright two-note confirmation' },
    { cue: 'complete', label: 'Finish a book', description: 'A rising melodic phrase' }
  ];

  $: selectedPageSound = normalizePageSoundStyle($pageSoundStyle$);
  $: pageSoundDescription = pageSoundOptions.find(
    (option) => option.id === selectedPageSound
  )?.description;

  function previewPage(style: PageSoundStyle) {
    soundDesign.unlock();
    soundDesign.play('page', style);
  }

  function preview(cue: SoundCue) {
    soundDesign.unlock();
    soundDesign.play(cue);
  }

  function enableSound() {
    $soundEnabled$ = !$soundEnabled$;
    if ($soundEnabled$) preview('toggle');
  }
</script>

<SettingsItemGroup title="App sounds">
  <div class="sound-control">
    <button
      type="button"
      class="app-button"
      data-sound="none"
      aria-pressed={$soundEnabled$}
      on:click={enableSound}>{$soundEnabled$ ? 'Sound on' : 'Sound off'}</button
    >
    <p class="sound-hint">You can also mute from the library or reader toolbar.</p>
  </div>
</SettingsItemGroup>

<SettingsItemGroup title="Volume">
  <div class="sound-control">
    <label class="sound-volume" for="sound-volume">
      <span>Sound volume</span>
      <output for="sound-volume">{Math.round($soundVolume$)}%</output>
    </label>
    <input
      id="sound-volume"
      type="range"
      min="0"
      max="100"
      step="1"
      bind:value={$soundVolume$}
      disabled={!$soundEnabled$}
      on:change={() => preview('click')}
    />
  </div>
</SettingsItemGroup>

<SettingsItemGroup title="Page movement">
  <div class="sound-control">
    <button
      type="button"
      class="app-button"
      aria-pressed={$pageTurnSoundEnabled$}
      disabled={!$soundEnabled$}
      on:click={() => ($pageTurnSoundEnabled$ = !$pageTurnSoundEnabled$)}
      >{$pageTurnSoundEnabled$ ? 'Page cues on' : 'Page cues off'}</button
    >
    <p class="sound-hint">Keep the interface lively while reading in silence, if you prefer.</p>
  </div>
</SettingsItemGroup>

<div class="sound-design-panels">
  <SettingsItemGroup title="Sound palette">
    <div class="sound-previews" data-sound="none">
      {#each previews as { cue, label, description }}
        <button
          type="button"
          class="sound-preview"
          disabled={!$soundEnabled$ ||
            !$soundVolume$ ||
            (cue === 'page' && !$pageTurnSoundEnabled$)}
          aria-label={`Preview ${label.toLowerCase()} sound`}
          on:click={() => preview(cue)}
        >
          <span class="sound-preview-icon" aria-hidden="true"><Fa icon={faPlay} /></span>
          <span class="sound-preview-copy">
            <span class="sound-preview-label">{label}</span>
            <small>{cue === 'page' ? pageSoundDescription : description}</small>
          </span>
        </button>
      {/each}
    </div>
  </SettingsItemGroup>

  <div class="page-samples-section">
    <SettingsItemGroup title="Page sound samples">
      <div class="page-sample-grid" role="radiogroup" aria-label="Page sound" data-sound="none">
        {#each pageSoundOptions as { id, label, description }}
          <div class="page-sample" class:page-sample--selected={selectedPageSound === id}>
            <button
              type="button"
              class="page-sample-play sound-preview-icon"
              disabled={!$soundEnabled$ || !$soundVolume$ || !$pageTurnSoundEnabled$}
              aria-label={`Preview ${label} page sound`}
              on:click={() => previewPage(id)}><Fa icon={faPlay} /></button
            >
            <label class="sound-preview-copy" for={`page-sound-${id}`}>
              <span class="sound-preview-label">{label}</span>
              <small>{description}</small>
            </label>
            <input
              id={`page-sound-${id}`}
              type="radio"
              name="page-sound"
              value={id}
              bind:group={$pageSoundStyle$}
              aria-label={label}
            />
          </div>
        {/each}
      </div>
    </SettingsItemGroup>
  </div>
</div>

<style>
  .sound-design-panels {
    display: grid;
    grid-column: 1 / -1;
    grid-template-columns: minmax(0, 1fr);
    gap: 1rem;
  }
  .sound-design-panels :global(.settings-item-control) {
    align-items: flex-start;
  }
  @media (min-width: 640px) {
    .sound-design-panels {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
  .page-samples-section {
    min-width: 0;
  }
  .page-sample-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 0.75rem;
    width: 100%;
  }
  .sound-control,
  .sound-previews {
    width: 100%;
  }
  .sound-hint {
    margin-top: 0.65rem;
    color: var(--app-chrome-muted);
    font-size: 0.85rem;
    line-height: 1.6;
  }
  .sound-volume {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
  }
  input[type='range'] {
    width: 100%;
    margin-top: 1rem;
    accent-color: var(--font-color);
  }
  .sound-previews {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.6rem;
  }
  .sound-preview,
  .page-sample {
    display: grid;
    grid-template-columns: 1rem minmax(0, 1fr);
    align-items: start;
    gap: 0.75rem;
    width: 100%;
    padding: 0.75rem;
    text-align: left;
    border: 1px solid var(--app-chrome-border);
    border-radius: 0.5rem;
  }
  .sound-preview-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 1.5rem;
    font-size: 0.7rem;
  }
  .sound-preview-copy {
    min-width: 0;
  }
  .sound-preview-label {
    display: block;
    line-height: 1.5rem;
  }
  .page-sample {
    position: relative;
  }
  .page-sample label {
    cursor: pointer;
  }
  .page-sample input {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
    border: 0;
  }
  .page-sample-play {
    padding: 0;
  }
  .page-sample--selected {
    border-color: color-mix(in srgb, var(--app-accent) 70%, var(--app-surface-border));
    background: var(--app-accent-soft);
  }
  .sound-preview:hover:enabled {
    background: var(--app-chrome-hover);
  }
  .sound-preview:focus-visible,
  .page-sample:has(input:focus-visible),
  .page-sample-play:focus-visible {
    outline: 2px solid var(--font-color);
    outline-offset: 2px;
  }
  .sound-preview:disabled,
  .page-sample-play:disabled {
    opacity: 0.45;
  }
  .sound-preview-copy small {
    display: block;
    margin-top: 0.25rem;
    color: var(--app-chrome-muted);
    line-height: 1.5;
  }
</style>
