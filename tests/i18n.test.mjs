import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const read = name => fs.readFileSync(new URL(name, root), 'utf8');
const source = read('i18n.js');
const pages = ['index.html', 'blossom-box.html', 'blue-moon.html', 'shahadati.html', 'velora-beauty.html'];
const dictionaries = vm.runInNewContext(source.split('(() => {')[0] + '\ntranslations;');
assert.deepEqual(Object.keys(dictionaries.ar).sort(), Object.keys(dictionaries.en).sort());

// Dependency-free DOM fixture exercises the language module, including async templates.
class Element {
    constructor(attrs = {}, text = '') { this.attrs = {...attrs}; this.textContent = text; this.nodeType = 1; }
    getAttribute(name) { return this.attrs[name] ?? null; }
    setAttribute(name, value) { this.attrs[name] = String(value); }
    querySelectorAll() { return []; }
    get dataset() { return {language: this.attrs['data-language']}; }
    closest() { return this.attrs['data-language'] ? this : null; }
}
function boot(saved = null, blocked = false) {
    const handlers = {}, windowHandlers = {}, storage = new Map(saved === null ? [] : [['language', saved]]);
    const elements = [new Element({'data-i18n': 'text52'}), new Element({'data-i18n-alt': 'text144', alt: dictionaries.ar.text144})];
    const buttons = [new Element({'data-language': 'ar'}), new Element({'data-language': 'en'})];
    let observer;
    const document = {
        documentElement: {}, body: {},
        addEventListener(name, handler) { handlers[name] = handler; },
        querySelectorAll(selector) { return selector === '[data-language]' ? buttons : elements; }
    };
    const window = {addEventListener(name, handler) { windowHandlers[name] = handler; }};
    vm.runInNewContext(source, {
        document, window, console: {warn() {}},
        localStorage: {
            getItem(key) { if (blocked) throw new Error('Storage blocked'); return storage.get(key) ?? null; },
            setItem(key, value) { if (blocked) throw new Error('Storage blocked'); storage.set(key, value); }
        },
        MutationObserver: class { constructor(callback) { observer = callback; } observe() {} }
    });
    handlers.DOMContentLoaded();
    return {document, window, elements, buttons, storage, handlers, windowHandlers, observe: records => observer(records)};
}
const first = boot();
assert.equal(first.document.documentElement.lang, 'ar');
assert.equal(first.document.documentElement.dir, 'rtl');
assert.equal(first.elements[0].textContent, dictionaries.ar.text52);
first.handlers.click({target: first.buttons[1]});
assert.equal(first.document.documentElement.lang, 'en');
assert.equal(first.document.documentElement.dir, 'ltr');
assert.equal(first.storage.get('language'), 'en');
assert.equal(first.elements[0].textContent, dictionaries.en.text52);
assert.equal(first.buttons[1].getAttribute('aria-pressed'), 'true');
assert.equal(boot(first.storage.get('language')).document.documentElement.lang, 'en');
const lateHeader = new Element({'data-i18n': 'text66'});
first.observe([{type: 'childList', addedNodes: [lateHeader]}]);
assert.equal(lateHeader.textContent, dictionaries.en.text66);
first.elements[1].setAttribute('alt', dictionaries.ar.text145);
first.observe([{type: 'attributes', target: first.elements[1]}]);
assert.equal(first.elements[1].getAttribute('alt'), dictionaries.en.text145);
first.handlers.click({target: first.buttons[0]});
assert.equal(first.document.documentElement.dir, 'rtl');
assert.equal(first.elements[1].getAttribute('alt'), dictionaries.ar.text145);
assert.equal(first.storage.get('language'), 'ar');
first.windowHandlers.storage({key: 'language', newValue: 'en'});
assert.equal(first.document.documentElement.lang, 'en');
assert.equal(boot('invalid').document.documentElement.lang, 'ar');
const restricted = boot(null, true);
restricted.window.portfolioI18n.setLanguage('en');
assert.equal(restricted.document.documentElement.dir, 'ltr');

let scripts = 0, references = 0;
for (const file of [...pages, 'header.html', 'footer.html']) {
    const html = read(file);
    if (pages.includes(file)) {
        assert.match(html, /<html lang="ar" dir="rtl">/);
        assert.equal((html.match(/src="i18n.js"/g) || []).length, 1);
    }
    for (const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) {
        new vm.Script(match[1], {filename: file}); scripts++;
    }
    for (const match of html.matchAll(/data-i18n(?:-[\w-]+)?="([^"]+)"/g)) {
        assert.ok(dictionaries.ar[match[1]], `${file}: Arabic key ${match[1]}`);
        assert.ok(dictionaries.en[match[1]], `${file}: English key ${match[1]}`);
        references++;
    }
    for (const match of html.matchAll(/(?:src|href)="([^"#]+)(?:#[^"]*)?"/g)) {
        if (/^(https?:|mailto:|tel:|data:)/.test(match[1])) continue;
        assert.ok(fs.existsSync(new URL(match[1], root)), `${file}: missing ${match[1]}`);
    }
}
console.log(`PASS: default language, switching, persistence, blocked storage, async templates, gallery descriptions, ${scripts} scripts, ${references} translation references and local paths.`);
