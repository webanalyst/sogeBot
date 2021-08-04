/* global describe it before */
/* global describe it before */
const assert = require('assert');

require('../../general.js');
const { getRepository } = require('typeorm');

const currency = require('../../../dest/currency').default;
const { User, UserBit } = require('../../../dest/database/entity/user');
const { getOwner } = require('../../../dest/helpers/commons/getOwner');
const { prepare } = require('../../../dest/helpers/commons/prepare');
const top = (require('../../../dest/systems/top')).default;
const tmi = (require('../../../dest/tmi')).default;
const db = require('../../general.js').db;
const message = require('../../general.js').message;

// users
const owner = { username: '__broadcaster__' };

describe('Top - !top bits', () => {
  before(async () => {
    await db.cleanup();
    await message.prepare();
  });

  it ('Add 10 users into db and last user will don\'t have any bits', async () => {
    for (let i = 0; i < 10; i++) {
      const userId = String(Math.floor(Math.random() * 100000));
      const bits = [];
      const user = { ...await getRepository(User).save({ userId, username: 'user' + i }) };

      if (i === 0) {
        continue;
      }

      for (let j = 0; j <= i; j++) {
        bits.push({
          amount:    j,
          cheeredAt: Date.now(),
          message:   '',
          userId,
        });
      }
      await getRepository(UserBit).save(bits);
    }
  });

  it('run !top bits and expect correct output', async () => {
    const r = await top.bits({ sender: { username: getOwner() } });
    assert.strictEqual(r[0].response, 'Top 10 (bits): 1. @user9 - 45, 2. @user8 - 36, 3. @user7 - 28, 4. @user6 - 21, 5. @user5 - 15, 6. @user4 - 10, 7. @user3 - 6, 8. @user2 - 3, 9. @user1 - 1');
  });

  it('add user1 to ignore list', async () => {
    const r = await tmi.ignoreAdd({ sender: owner, parameters: 'user1' });
    assert.strictEqual(r[0].response, prepare('ignore.user.is.added' , { username: 'user1' }));
  });

  it('run !top bits and expect correct output', async () => {
    const r = await top.bits({ sender: { username: getOwner() } });
    assert.strictEqual(r[0].response, 'Top 10 (bits): 1. @user9 - 45, 2. @user8 - 36, 3. @user7 - 28, 4. @user6 - 21, 5. @user5 - 15, 6. @user4 - 10, 7. @user3 - 6, 8. @user2 - 3');
  });
});
