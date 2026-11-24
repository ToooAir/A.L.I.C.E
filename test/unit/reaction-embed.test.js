'use strict';
const {src} = require('../helpers/setup');
const test = require('node:test');
const assert = require('node:assert/strict');
const {reactionEmbed} = src('plugin/embed/reactionEmbed');

// Characters Discord counts toward the 6000-character embed limit.
function embedLength(embed) {
    const json = embed.toJSON();
    return (json.title ?? '').length + (json.description ?? '').length + (json.footer?.text ?? '').length
        + (json.author?.name ?? '').length + json.fields.reduce((sum, f) => sum + f.name.length + f.value.length, 0);
}

// Run a search and page through every result with ➡; returns the embeds shown, in order.
async function showAllPages(rows) {
    const shown = [];
    let onCollect;
    const message = {
        react: async () => {},
        edit: async payload => shown.push(payload.embeds[0]),
        reactions: {cache: {find: () => ({users: {remove: async () => {}}})}},
        createReactionCollector: () => ({on: (event, fn) => { if (event === 'collect') onCollect = fn; }}),
    };
    const interaction = {
        user: {id: '11'},
        reply: async payload => {
            assert.equal(payload.withResponse, true);
            shown.push(payload.embeds[0]);
            return {resource: {message}};
        },
    };
    await reactionEmbed(interaction, rows);
    const total = Number(shown[0].toJSON().footer.text.split('/')[1]);
    for (let i = 0; i < total + 1; i++) await onCollect({emoji: {name: '➡'}}, {id: '11'}); // one extra press past the end
    return shown;
}

test('short results show 10 per page', async () => {
    const pages = await showAllPages(Array.from({length: 23}, (_, i) => ({input: 'k' + i, output: '短'})));
    assert.deepEqual(pages.map(p => p.toJSON().fields.length), [10, 10, 3]);
    assert.equal(pages[2].toJSON().footer.text, 'page3/3');
});

test('long results split by size so no page exceeds 6000 characters', async () => {
    const rows = Array.from({length: 25}, (_, i) => ({input: ('k' + i).padEnd(256, '字'), output: '回'.repeat(1024)}));
    const pages = await showAllPages(rows);
    assert.equal(pages.length, 7); // 4 max-size results per page
    assert.ok(pages.every(p => embedLength(p) <= 6000));
});

test('mixed lengths keep every result and stay within limits', async () => {
    const rows = Array.from({length: 40}, (_, i) => ({input: 'k' + i, output: 'x'.repeat((i * 397) % 1024 + 1)}));
    const pages = await showAllPages(rows);
    assert.ok(pages.every(p => embedLength(p) <= 6000 && p.toJSON().fields.length <= 10));
    assert.equal(pages.reduce((sum, p) => sum + p.toJSON().fields.length, 0), 40);
});
