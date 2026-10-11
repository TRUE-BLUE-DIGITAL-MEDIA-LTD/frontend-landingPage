import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { applyI18nSubstitution } from './substitute-i18n';

const translations = {
  en: { strings: { k0: 'Buy now', k1: 'Limited offer' }, title: '', description: '' },
  es: { strings: { k0: 'Compra ahora', k1: 'Oferta limitada' }, title: '', description: '' },
  fr: { strings: { k0: 'Acheter' /* k1 missing */ }, title: '', description: '' },
};

describe('applyI18nSubstitution', () => {
  it('replaces text content using the target language', () => {
    const dom = new JSDOM('<h1 data-i18n="k0">Buy now</h1>');
    applyI18nSubstitution(dom.window.document, translations, 'es', 'en');
    assert.equal(dom.window.document.querySelector('h1')?.textContent, 'Compra ahora');
  });

  it('falls back to the primary language when a key is missing in target', () => {
    const dom = new JSDOM('<h1 data-i18n="k1">Limited offer</h1>');
    applyI18nSubstitution(dom.window.document, translations, 'fr', 'en');
    assert.equal(dom.window.document.querySelector('h1')?.textContent, 'Limited offer');
  });

  it('leaves text unchanged when neither target nor primary has the key', () => {
    const dom = new JSDOM('<h1 data-i18n="k99">Untouched</h1>');
    applyI18nSubstitution(dom.window.document, translations, 'es', 'en');
    assert.equal(dom.window.document.querySelector('h1')?.textContent, 'Untouched');
  });

  it('is a no-op when translations is null', () => {
    const dom = new JSDOM('<h1 data-i18n="k0">Buy now</h1>');
    applyI18nSubstitution(dom.window.document, null, 'es', 'en');
    assert.equal(dom.window.document.querySelector('h1')?.textContent, 'Buy now');
  });

  it('is a no-op when target language has no entry and primary also lacks it', () => {
    const dom = new JSDOM('<h1 data-i18n="k0">Buy now</h1>');
    applyI18nSubstitution(
      dom.window.document,
      { es: { strings: {}, title: '', description: '' } } as any,
      'es',
      'jp' as any,
    );
    assert.equal(dom.window.document.querySelector('h1')?.textContent, 'Buy now');
  });

  it('keeps styled child elements of a keyed parent (mixed content)', () => {
    const dom = new JSDOM(
      '<p data-i18n="p0">Get <span data-i18n="s0" style="color:orange">50% off</span> today</p>',
    );
    applyI18nSubstitution(
      dom.window.document,
      {
        en: { strings: { p0: 'Get  today', s0: '50% off' }, title: '', description: '' },
        es: { strings: { p0: 'Hoy', s0: '50% de descuento' }, title: '', description: '' },
      } as any,
      'es',
      'en',
    );
    const span = dom.window.document.querySelector('span');
    assert.ok(span, 'styled span must survive');
    assert.equal(span?.getAttribute('style'), 'color:orange');
    assert.equal(span?.textContent, '50% de descuento');
    assert.equal(dom.window.document.querySelector('p')?.textContent, 'Hoy 50% de descuento ');
  });

  it('leaves mixed content untouched when showing the primary text', () => {
    const html = '<p data-i18n="p0">Get <b>50%</b> today</p>';
    const dom = new JSDOM(html);
    applyI18nSubstitution(
      dom.window.document,
      { en: { strings: { p0: 'Get  today' }, title: '', description: '' } } as any,
      'en',
      'en',
    );
    assert.equal(dom.window.document.body.innerHTML, html);
  });

  it('keeps <br> and attributes on the keyed element', () => {
    const dom = new JSDOM('<h1 data-i18n="k0" style="color:orange" class="t">Buy now<br></h1>');
    applyI18nSubstitution(dom.window.document, translations, 'es', 'en');
    const h1 = dom.window.document.querySelector('h1');
    assert.equal(h1?.innerHTML, 'Compra ahora<br>');
    assert.equal(h1?.getAttribute('style'), 'color:orange');
  });

  it('does not touch <script> contents even if they have data-i18n', () => {
    const dom = new JSDOM('<script data-i18n="k0">window.foo = 1;</script>');
    applyI18nSubstitution(dom.window.document, translations, 'es', 'en');
    assert.equal(dom.window.document.querySelector('script')?.textContent, 'window.foo = 1;');
  });
});
