/* global describe it before */

const assert = require('assert');

const { getRepository } = require('typeorm');

const { User } = require('../../../dest/database/entity/user');
const { prepare } = require('../../../dest/helpers/commons/prepare');
const eventlist = (require('../../../dest/overlays/eventlist')).default;
const twitch = (require('../../../dest/twitch')).default;
const db = require('../../general.js').db;
const time = require('../../general.js').time;
const message = require('../../general.js').message;
const user = require('../../general.js').user;

require('../../general.js');

describe('lib/twitch - subs()', () => {
  before(async () => {
    await db.cleanup();
    await message.prepare();
    await user.prepare();
  });

  it('Set viewer, viewer2, viewer3 as subs', async () => {
    for (const u of [user.viewer, user.viewer2, user.viewer3]) {
      await getRepository(User).save({
        userId: u.userId, username: u.username, isSubscriber: true,
      });
    }
  });

  it('add user.viewer to event', async () => {
    await time.waitMs(100);
    await eventlist.add({
      event:  'sub',
      userId: user.viewer.userId,
    });
  });

  it('add user.viewer2 to event', async () => {
    await time.waitMs(100);
    await eventlist.add({
      event:  'sub',
      userId: user.viewer2.userId,
    });
  });

  it('!subs should return user.viewer2', async () => {
    const r = await twitch.subs({ sender: user.viewer });
    assert.strictEqual(r[0].response, prepare('subs', {
      lastSubAgo:      'a few seconds ago',
      lastSubUsername: user.viewer2.username,
      onlineSubCount:  0,
    }));
  });

  it('add user.viewer3 to events', async () => {
    await time.waitMs(100);
    await eventlist.add({
      event:  'sub',
      userId: user.viewer3.userId,
    });
  });

  it('!subs should return user.viewer3', async () => {
    const r = await twitch.subs({ sender: user.viewer });
    assert.strictEqual(r[0].response, prepare('subs', {
      lastSubAgo:      'a few seconds ago',
      lastSubUsername: user.viewer3.username,
      onlineSubCount:  0,
    }));
  });

  it('Add user.viewer, user.viewer2, user.viewer3 to online users', async () => {
    await getRepository(User).update({}, { isOnline: true });
  });

  it('!subs should return user.viewer3 and 3 online subs', async () => {
    const r = await twitch.subs({ sender: user.viewer });
    assert.strictEqual(r[0].response, prepare('subs', {
      lastSubAgo:      'a few seconds ago',
      lastSubUsername: user.viewer3.username,
      onlineSubCount:  3,
    }));
  });
});
