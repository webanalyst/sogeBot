/* global describe it before */
const {
  isMainThread,
} = require('worker_threads');
if (!isMainThread) {
  process.exit();
}


require('../../general.js');

const db = require('../../general.js').db;
const variable = require('../../general.js').variable;
const message = require('../../general.js').message;
const user = require('../../general.js').user;
const assert = require('chai').assert;

const tests = {
  'timeout': [
    { message: 'AAAAAAAAAAAAAAAAAAAAAA', sender: user.viewer },
    { message: 'ЙЦУЦЙУЙЦУЙЦУЙЦУЙЦУЙЦ', sender: user.viewer },
    { message: 'AAAAAAAAAAAAAaaaaaaaaaaaa', sender: user.viewer },
    { message: 'SomeMSG SomeMSG', sender: user.viewer },
  ],
  'ok': [
    { message: 'SomeMSG SomeMSg', sender: user.viewer },
    { message: '123123123213123123123123213123', sender: user.viewer },
    { message: 'zdarec KAPOW KAPOW', sender: { ...user.viewer, emotes: [{ id: '133537', start: 7, end: 11 }, { id: '133537', start: 13, end: 17 }] } },
    { message: '😀 😁 😂 🤣 😃 😄 😅 😆 😉 😊 😋 😎 😍 😘 😗 😙 😚 🙂 🤗 🤩 🤔 🤨 😐 😑 😶 🙄 😏 😣 😥 😮 🤐 😯 😪 😫 😴 😌 😛 😜 😝 🤤 😒 😓 😔 😕 🙃 🤑 😲 ☹️ 🙁 😖 😞 😟 😤 😢 😭 😦 😧 😨 😩 🤯 😬 😰 😱', sender: user.viewer },
  ],
};

describe('systems/moderation - Caps()', () => {
  describe('moderationCaps=false', async () => {
    before(async () => {
      await db.cleanup();
      await message.prepare();
      await user.prepare();
      global.systems.moderation.cCapsEnabled = false;
      await variable.isEqual('global.systems.moderation.cCapsEnabled', false);
    });

    for (const test of tests.timeout) {
      it(`message '${test.message}' should not timeout`, async () => {
        assert.isTrue(await global.systems.moderation.caps({ sender: test.sender, message: test.message }));
      });
    }

    for (const test of tests.ok) {
      it(`message '${test.message}' should not timeout`, async () => {
        assert.isTrue(await global.systems.moderation.caps({ sender: test.sender, message: test.message }));
      });
    }
  });
  describe('moderationCaps=true', async () => {
    before(async () => {
      await message.prepare();
      global.systems.moderation.cCapsEnabled = true;
      await variable.isEqual('global.systems.moderation.cCapsEnabled', true);
    });

    for (const test of tests.timeout) {
      it(`message '${test.message}' should timeout`, async () => {
        assert.isFalse(await global.systems.moderation.caps({ sender: test.sender, message: test.message }));
      });
    }

    for (const test of tests.ok) {
      it(`message '${test.message}' should not timeout`, async () => {
        assert.isTrue(await global.systems.moderation.caps({ sender: test.sender, message: test.message }));
      });
    }
  });
});
