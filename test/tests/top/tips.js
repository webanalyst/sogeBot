/* global describe it before */
const assert = require('assert');

require('../../general.js');
const { getRepository } = require('typeorm');

const currency = require('../../../dest/currency').default;
const { User, UserTip } = require('../../../dest/database/entity/user');
const { getOwner } = require('../../../dest/helpers/commons/getOwner');
const { prepare } = require('../../../dest/helpers/commons/prepare');
const top = (require('../../../dest/systems/top')).default;
const tmi = (require('../../../dest/tmi')).default;
const db = require('../../general.js').db;
const message = require('../../general.js').message;

// users
const owner = { username: '__broadcaster__' };

describe('Top - !top tips', () => {
  before(async () => {
    await db.cleanup();
    await message.prepare();
  });

  it ('Add 10 users into db and last user will don\'t have any tips', async () => {
    for (let i = 0; i < 10; i++) {
      const userId = String(Math.floor(Math.random() * 100000));
      const tips = [];
      const user = { ...await getRepository(User).save({ userId, username: 'user' + i }) };

      if (i === 0) {
        continue;
      }

      for (let j = 0; j <= i; j++) {
        tips.push({
          amount:        j,
          sortAmount:    2*j,
          currency:      'EUR',
          message:       'test',
          timestamp:     Date.now(),
          exchangeRates: currency.rates,
          userId,
        });
      }
      await getRepository(UserTip).save(tips);
    }
  });

  it('Update change rates', async() => {
    await currency.recalculateSortAmount();
  });

  it('run !top tips and expect correct output', async () => {
    const r = await top.tips({ sender: { username: getOwner() } });
    assert.strictEqual(r[0].response, 'Top 10 (tips): 1. @user9 - €45.00, 2. @user8 - €36.00, 3. @user7 - €28.00, 4. @user6 - €21.00, 5. @user5 - €15.00, 6. @user4 - €10.00, 7. @user3 - €6.00, 8. @user2 - €3.00, 9. @user1 - €1.00', owner);
  });

  it('add user1 to ignore list', async () => {
    const r = await tmi.ignoreAdd({ sender: owner, parameters: 'user1' });
    assert.strictEqual(r[0].response, prepare('ignore.user.is.added' , { username: 'user1' }));
  });

  it('run !top tips and expect correct output', async () => {
    const r = await top.tips({ sender: { username: getOwner() } });
    assert.strictEqual(r[0].response, 'Top 10 (tips): 1. @user9 - €45.00, 2. @user8 - €36.00, 3. @user7 - €28.00, 4. @user6 - €21.00, 5. @user5 - €15.00, 6. @user4 - €10.00, 7. @user3 - €6.00, 8. @user2 - €3.00', owner);
  });
});
