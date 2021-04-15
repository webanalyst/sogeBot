/* eslint-disable @typescript-eslint/no-var-requires */
const assert = require('assert');

require('../../general.js');

const { getRepository } = require('typeorm');

const { EventList } = require('../../../dest/database/entity/eventList');
const { User } = require('../../../dest/database/entity/user');
const Message = require('../../../dest/message').default;
const eventlist = require('../../../dest/overlays/eventlist.js').default;
const db = require('../../general.js').db;
const message = require('../../general.js').message;

// users
const owner = { username: '__broadcaster__' };

describe('Message - https://discordapp.com/channels/317348946144002050/619437014001123338/706756329204613160 - latest global variables are not correct', () => {
  before(async () => {
    await db.cleanup();
    await message.prepare();
    for (let i = 10000000; i < 10000040; i++) {
      await getRepository(User).save({ username: `user${i}`, userId: String(i) });
    }

  });

  it ('Add 10 follow events', async () => {
    for (let i = 10000000; i < 10000010; i++) {
      await getRepository(EventList).save({
        isTest:      false,
        event:       'follow',
        timestamp:   1000 * i,
        userId:      `${i}`,
        values_json: '{}',
      });
    }
  });

  it ('Add 10 sub/resub/subgift events', async () => {
    for (let i = 10000010; i < 10000020; i++) {
      await getRepository(EventList).save({
        isTest:      false,
        event:       ['sub', 'resub', 'subgift'][Math.floor(Math.random() * 3)],
        timestamp:   2000 * i,
        userId:      `${i}`,
        values_json: '{}',
      });
    }
  });

  it ('Add 10 tips events', async () => {
    for (let i = 10000020; i < 10000030; i++) {
      await getRepository(EventList).save({
        isTest:      false,
        event:       'tip',
        timestamp:   3000 * i,
        userId:      `${i}`,
        values_json: JSON.stringify({
          amount:   i,
          currency: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'][i-10000020],
          message:  `message${i-20}`,
        }),
      });
    }
  });

  it ('Add 10 cheer events', async () => {
    for (let i = 10000030; i < 10000040; i++) {
      await eventlist.add({
        event:     'cheer',
        userId:    String(i),
        bits:      i,
        message:   `message${i-30}`,
        timestamp: Date.now(),
      });
    }
  });

  it ('$latestFollower should have correct user10000009', async () => {
    const parsed = await new Message('$latestFollower').parse({ sender: owner });
    assert.strictEqual(parsed, 'user10000009');
  });

  it ('$latestSubscriber should have correct user10000019', async () => {
    const parsed = await new Message('$latestSubscriber').parse({ sender: owner });
    assert.strictEqual(parsed, 'user10000019');
  });

  it ('$latestTip should have correct user10000029', async () => {
    const parsed = await new Message('$latestTip').parse({ sender: owner });
    assert.strictEqual(parsed, 'user10000029');
  });

  it ('$latestTipAmount should have correct 10000029', async () => {
    const parsed = await new Message('$latestTipAmount').parse({ sender: owner });
    assert.strictEqual(parsed, '10000029.00');
  });

  it ('$latestTipCurrency should have correct j', async () => {
    const parsed = await new Message('$latestTipCurrency').parse({ sender: owner });
    assert.strictEqual(parsed, 'j');
  });

  it ('$latestTipMessage should have correct message10000009', async () => {
    const parsed = await new Message('$latestTipMessage').parse({ sender: owner });
    assert.strictEqual(parsed, 'message10000009');
  });

  it ('$latestCheer should have correct user10000039', async () => {
    const parsed = await new Message('$latestCheer').parse({ sender: owner });
    assert.strictEqual(parsed, 'user10000039');
  });

  it ('$latestCheerAmount should have correct 10000039', async () => {
    const parsed = await new Message('$latestCheerAmount').parse({ sender: owner });
    assert.strictEqual(parsed, '10000039');
  });

  it ('$latestCheerMessage should have correct message10000009', async () => {
    const parsed = await new Message('$latestCheerMessage').parse({ sender: owner });
    assert.strictEqual(parsed, 'message10000009');
  });
});
