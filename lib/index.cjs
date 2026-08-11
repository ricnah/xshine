'use strict';
const makeWASocket = async (...args) => {
    const mod = await import('./index.js');
    return mod.default(...args);
};
module.exports = makeWASocket;
module.exports.default = makeWASocket;
module.exports.makeWASocket = makeWASocket;
module.exports.ShineBaileys = makeWASocket;
