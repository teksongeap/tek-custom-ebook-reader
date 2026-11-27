/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import 'fake-indexeddb/auto';
import { openDB, deleteDB } from 'idb';
import type BooksDb from '../../src/lib/data/database/books-db/versions/books-db.ts';
import type { BooksDbBookData } from '../../src/lib/data/database/books-db/versions/books-db.ts';
import {
  detectBookLanguage,
  sampleBookText
} from '../../src/lib/functions/book-language/detect-book-language.ts';
import {
  languageDetectionVersion,
  needsBookLanguageResolution,
  normalizeLanguageCode
} from '../../src/lib/functions/book-language/language-metadata.ts';
import { resolveBookLanguage } from '../../src/lib/functions/book-language/resolve-book-language.ts';
import { backfillBookLanguages } from '../../src/lib/functions/book-language/backfill-book-languages.ts';

export const passages = {
  en: 'The reader opened the book and began to read the first chapter. Outside the window, the morning light fell across the garden. She remembered the words her mother had spoken many years before, and wondered whether she would ever find her way back to the house where she had grown up. ',
  fr: 'Dans cette histoire, nous découvrons les pensées et les sentiments des personnages. Chaque jour, la lumière du soleil éclaire les rues de la ville et les jardins où les enfants jouent ensemble. Il est difficile de comprendre ce qui se passe dans la vie des autres, mais nous pouvons toujours essayer de les écouter avec attention. ',
  de: 'Die Leserin öffnete das Buch und begann das erste Kapitel zu lesen. Draußen fiel das Licht des Morgens auf den Garten. Sie erinnerte sich an die Worte ihrer Mutter und fragte sich, ob sie jemals den Weg zurück zu dem Haus finden würde, in dem sie aufgewachsen war. ',
  es: 'La lectora abrió el libro y comenzó a leer el primer capítulo. Afuera, la luz de la mañana iluminaba el jardín. Recordó las palabras que su madre había pronunciado muchos años antes y se preguntó si alguna vez encontraría el camino de regreso a la casa donde había crecido. ',
  ja: '彼女は窓の外を見ながら、昨日読んだ本のことを考えていた。街には朝の光が差し込み、人々はそれぞれの仕事に向かって歩いている。この物語は、ある小さな町で暮らす人々の日常を描いたものである。何も変わらないように見える生活の中にも、たくさんの大切な出来事が隠れている。',
  zh: '她望着窗外，回想起昨天读过的那本书。清晨的阳光洒在街道上，人们各自走向工作的地方。这个故事讲述了一座小城市里普通人的日常生活。看似平静的生活中，也隐藏着许多重要的事情。我们每个人都在寻找属于自己的道路，希望能够理解这个世界以及身边的人。',
  ru: 'Она открыла книгу и начала читать первую главу. За окном утренний свет падал на деревья в саду. Она вспоминала слова своей матери и думала о том, сможет ли когда-нибудь найти дорогу обратно к дому, в котором прошло её детство. В этом небольшом городе каждый человек хранил свои воспоминания и надежды. ',
  ar: 'فتحت القارئة الكتاب وبدأت تقرأ الفصل الأول. كان ضوء الصباح يدخل من النافذة ويضيء الأشجار في الحديقة. تذكرت الكلمات التي قالتها أمها منذ سنوات طويلة وتساءلت إن كانت ستجد يوما طريق العودة إلى البيت الذي نشأت فيه. في هذه المدينة الصغيرة كان لكل إنسان ذكرياته وأحلامه الخاصة. '
};

test('detects common Latin and non-Latin book languages deterministically', () => {
  for (const [expected, passage] of Object.entries(passages)) {
    const samples = sampleBookText(passage.repeat(50));
    assert.equal(detectBookLanguage(samples), expected, expected);
    assert.equal(detectBookLanguage(samples), expected, `${expected} repeated`);
    assert.ok(samples.length <= 7);
    assert.ok(samples.every((sample) => sample.length <= 2048));
  }
});

test('samples the body across the book so foreign front matter does not decide its language', () => {
  const text = passages.en.repeat(10) + passages.fr.repeat(150);
  assert.equal(detectBookLanguage(sampleBookText(text)), 'fr');
});

test('does not invent a primary language for empty text, tiny samples, or balanced bilingual text', () => {
  for (const text of ['', 'Hello world', '12345 '.repeat(500), '... '.repeat(500)])
    assert.equal(detectBookLanguage(sampleBookText(text)), 'und');
  assert.equal(
    detectBookLanguage(
      [passages.en.slice(0, 250), passages.fr.slice(0, 250)].map((text) =>
        text.replace(/[^\p{L}]/gu, ' ').padEnd(300)
      )
    ),
    'und'
  );
});

test('declarations require text analysis; completed detection is reused, including undetermined results', async () => {
  const explicit = {
    elementHtml: '<p>English text</p>',
    language: 'ja',
    languageSource: 'metadata' as const
  };
  assert.equal(needsBookLanguageResolution(explicit), true);
  assert.equal(needsBookLanguageResolution({ ...explicit, languageDetectionVersion }), true);
  for (const language of ['en', 'und']) {
    const resolved = { elementHtml: '<p>Text</p>', language, languageDetectionVersion };
    assert.equal(await resolveBookLanguage(resolved, {} as Document), resolved);
    assert.equal(needsBookLanguageResolution(resolved), false);
  }
  assert.equal(needsBookLanguageResolution({ elementHtml: '', language: '' }), false);
  assert.equal(needsBookLanguageResolution({ elementHtml: '<p>Text</p>', language: 'ja' }), true);
  assert.equal(needsBookLanguageResolution({ elementHtml: '<p>Texte</p>', language: 'fr' }), true);
  assert.equal(normalizeLanguageCode(' fr_FR '), 'fr-FR');
  for (const invalid of [undefined, ['en'], {}, 'not a language', 'und'])
    assert.equal(normalizeLanguageCode(invalid), '');
});

function book(id: number, extra: Partial<BooksDbBookData> = {}): BooksDbBookData {
  return {
    id,
    title: `Book ${id}`,
    elementHtml: '<p>Book text</p>',
    styleSheet: '',
    blobs: {},
    hasThumb: false,
    characters: 1000,
    lastBookOpen: 10,
    lastBookModified: 20,
    ...extra
  };
}

async function setup() {
  const name = `language-test-${crypto.randomUUID()}`;
  const db = await openDB<BooksDb>(name, 1, {
    upgrade(db) {
      db.createObjectStore('data', { keyPath: 'id' });
    }
  });
  return {
    db,
    async close() {
      db.close();
      await deleteDB(name);
    }
  };
}

test('backfill persists both detected and undetermined results and does no repeat analysis on reload', async () => {
  const state = await setup();
  try {
    const books = [book(1), book(2), book(3, { elementHtml: '' })];
    for (const item of books) await state.db.put('data', item);
    let calls = 0;
    const updates: number[] = [];
    const resolve = async (item: BooksDbBookData): Promise<BooksDbBookData> => {
      calls++;
      return {
        ...item,
        language: item.id === 1 ? 'fr' : 'und',
        languageSource: item.id === 1 ? 'detected' : 'undetermined',
        languageDetectionVersion
      };
    };
    await backfillBookLanguages(state.db, books, resolve, (book) => updates.push(book.id));
    assert.equal(calls, 2);
    assert.deepEqual(updates, [1, 2]);
    assert.equal((await state.db.get('data', 1))?.language, 'fr');
    assert.equal((await state.db.get('data', 2))?.language, 'und');
    await backfillBookLanguages(state.db, await state.db.getAll('data'), resolve, () =>
      assert.fail('already resolved')
    );
    assert.equal(calls, 2);
    const placeholder = await state.db.get('data', 3);
    assert.equal(placeholder?.languageDetectionVersion, undefined);
  } finally {
    await state.close();
  }
});

test('backfill retains concurrent reading updates and never revives deleted or replaces newly imported books', async () => {
  const state = await setup();
  try {
    const books = [book(1), book(2), book(3)];
    for (const item of books) await state.db.put('data', item);
    await backfillBookLanguages(
      state.db,
      books,
      async (item) => {
        if (item.id === 1) await state.db.put('data', { ...item, lastBookOpen: 999 });
        if (item.id === 2) await state.db.delete('data', 2);
        if (item.id === 3)
          await state.db.put('data', { ...item, elementHtml: '<p>A replacement</p>' });
        return { ...item, language: 'fr', languageSource: 'detected', languageDetectionVersion };
      },
      () => {}
    );
    assert.equal((await state.db.get('data', 1))?.lastBookOpen, 999);
    assert.equal((await state.db.get('data', 1))?.lastBookModified, 20);
    assert.equal(await state.db.get('data', 2), undefined);
    assert.equal((await state.db.get('data', 3))?.language, undefined);
  } finally {
    await state.close();
  }
});
