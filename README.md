<img src="assets/readme/icon.png" align="left" style="margin-right: 1rem;" alt="logo">

## とく Ebook Reader

とく Ebook Reader is a customized browser ebook reader for Japanese reading, progress tracking, and dictionary lookup workflows. It is based on [TTU Reader](https://github.com/ttu-ttu/ebook-reader) and keeps compatibility with TTU-style book data and the default `ttu-reader-data` storage root.

The app runs fully in the browser, can be installed as a PWA, and is designed to work well with extensions such as Yomitan, DeepL, and Read Aloud. Enjoy, king.

## Features

- Import EPUB, HTMLZ, and plain text books from files or folders.
- Read in continuous or paginated mode with horizontal or vertical writing.
- Navigate with keyboard, swipe, wheel, tap-to-flip margins, table of contents, chapter jumps, bookmarks, and character-position jumps.
- Use auto-scroll in continuous mode and glide or instant page transitions in paginated mode.
- Customize themes, custom themes, bundled Japanese fonts, user-uploaded fonts, font size, line height, paragraph spacing, page columns, reader margins, vertical kerning, VPAL, text orientation, justification, and pretty wrapping.
- Tune Japanese-learning behavior with furigana hiding modes, spoiler image blur, hover focus, custom reading points, selection-to-bookmark, avoid-page-break pagination, and a character counter.
- Highlight selected text with color-coded annotations, optional comments, an annotation list, jump-to-highlight, edit, delete, and export/sync support.
- Track reading time, characters read, speed, completion, session history, freeze positions, idle rollback, skip thresholds, dictionary popup detection, reading goals, and completion behavior.
- Review statistics with date ranges, title filters, overview charts, summaries, heatmaps, aggregation modes, copy/export actions, and selective deletion.
- Manage a local library with covers, progress, sorting, selection, deletion, import/export, external placeholders, and bug-report logs.
- Import, export, and sync book data, bookmarks, annotations, statistics, reading goals, audiobook progress, and subtitles.
- Store data in the browser, ZIP backups, Google Drive, OneDrive, or a browser-supported filesystem source.
- Configure automatic import/export up, down, or both ways with new-only or overwrite behavior.
- Request persistent browser storage, use offline/installable PWA support, and optionally keep the screen awake while reading.

## Usage

Open the app and import books from the manager by selecting files, selecting a folder on supported desktop browsers, or dragging files/folders onto the page. The manager stores local books in the browser database unless you import from or open an external source.

Reader controls are available from the reader header and footer. The header includes table of contents, bookmarks, completion, statistics, image gallery, settings, and library actions. The footer shows tracker state, sync state, and reading progress.

For EPUBs with malformed HTML, enable `Settings -> Data -> Epub Import Fixes` and reimport the book. Plain text imports use the file name as the title, split paragraphs around Japanese punctuation, and split sections around 10,000 characters.

Most reading data is local-first. Export or configure sync if you want a backup or want to move between devices.

## Keybinds

Keys are bound by physical key code where available.

| Key                                     | Action                         |
| --------------------------------------- | ------------------------------ |
| <kbd>Space</kbd>                        | Toggle auto-scroll             |
| <kbd>A</kbd> / <kbd>D</kbd>             | Change auto-scroll speed       |
| <kbd>B</kbd>                            | Save bookmark                  |
| <kbd>R</kbd>                            | Return to bookmark             |
| <kbd>T</kbd>                            | Select custom reading point    |
| <kbd>P</kbd>                            | Toggle tracker                 |
| <kbd>F</kbd>                            | Toggle tracker freeze position |
| <kbd>PageDown</kbd> / <kbd>PageUp</kbd> | Next or previous page/image    |
| <kbd>N</kbd> / <kbd>M</kbd>             | Previous or next chapter       |
| <kbd>Esc</kbd>                          | Close image gallery            |
| <kbd>Alt</kbd> + <kbd>H</kbd>           | Toggle hover focus             |

## Storage And Sync

Available targets:

- Browser database for the local library.
- ZIP backup files for portable import/export.
- Google Drive and OneDrive through OAuth.
- Filesystem storage on browsers that support the File System Access API.

Exports can include:

- Book data
- Bookmarks/progress
- Annotations
- Statistics
- Reading goals
- Audiobook playback positions for [ttu-whispersync](https://github.com/Renji-XD/ttu-whispersync)
- Persisted subtitles from compatible audiobook workflows

Automatic import/export can run when opening or reading books. `New Only` uses modification times, so keep device clocks reasonably aligned when syncing across devices.

## Security

This app has no backend. External storage credentials and refresh tokens are stored locally in the browser. For custom Google Drive or OneDrive sources, the app can encrypt source data with a password that is not stored. Losing that password means the source cannot be recovered.

The browser password manager option is convenient but shifts trust to the browser and any software that can trigger credential requests. The safest setup is to keep local encryption enabled and enter the password only when storage actions need it.

Browser storage can still be evicted by the browser or operating system. Enable persistent storage where supported, and keep backups or sync targets for data you care about.

## Local Development

Requirements: Node.js and pnpm.
cd into the main folder and run:
```sh
pnpm install
pnpm dev
```

The dev server runs the web app from `apps/web`.

Useful checks:

```sh
pnpm --dir apps/web check
pnpm check
pnpm check:pretty
```

Build the static app:

```sh
pnpm build
```

The production build is written to `apps/web/build`.

## Self Hosting

### Docker

```sh
docker build -t toku-ebook-reader -f apps/web/Dockerfile .
docker run --name toku-ebook-reader -d -p 8080:80 toku-ebook-reader
```

Open [http://localhost:8080](http://localhost:8080).

### Docker Compose

```sh
docker-compose up
```

Open [http://localhost:9010](http://localhost:9010).

### Static Hosting

```sh
pnpm install
pnpm build
```

Serve `apps/web/build` with any static HTTP server.

## Environment

For self-hosted external storage, create OAuth apps with redirect URLs that match your deployment, then set the needed values in `apps/web/.env.local`.

```sh
VITE_BASE_PATH="https://your-reader.example"
VITE_STORAGE_ROOT_NAME="ttu-reader-data"

VITE_GDRIVE_CLIENT_ID=""
VITE_GDRIVE_CLIENT_SECRET=""
VITE_GDRIVE_AUTH_ENDPOINT="https://accounts.google.com/o/oauth2/v2/auth"
VITE_GDRIVE_TOKEN_ENDPOINT="https://oauth2.googleapis.com/token"
VITE_GDRIVE_REFRESH_ENDPOINT="https://oauth2.googleapis.com/token"
VITE_GDRIVE_REVOKE_ENDPOINT="https://oauth2.googleapis.com/revoke"
VITE_GDRIVE_SCOPE="https://www.googleapis.com/auth/drive.file"

VITE_ONEDRIVE_CLIENT_ID=""
VITE_ONEDRIVE_CLIENT_SECRET=""
VITE_ONEDRIVE_AUTH_ENDPOINT="https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize"
VITE_ONEDRIVE_TOKEN_ENDPOINT="https://login.microsoftonline.com/consumers/oauth2/v2.0/token"
VITE_ONEDRIVE_DISCOVERY="https://login.microsoftonline.com/consumers/v2.0/.well-known/openid-configuration"
VITE_ONEDRIVE_SCOPE="files.readwrite"
```

Google Drive and OneDrive sources are scoped to the OAuth client that created them, so data created with one client may not be visible to another.

## License

BSD-3-Clause. See [LICENSE](LICENSE).
