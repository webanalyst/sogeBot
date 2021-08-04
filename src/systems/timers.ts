'use strict';

import { SECOND } from '@sogebot/ui-helpers/constants';
import * as _ from 'lodash';
import { sortBy } from 'lodash';
import { getRepository } from 'typeorm';

import {
  Timer, TimerResponse, TimerResponseInterface,
} from '../database/entity/timer';
import { command, default_permission } from '../decorators';
import Expects from '../expects';
import { isStreamOnline } from '../helpers/api';
import { announce } from '../helpers/commons';
import { isDbConnected } from '../helpers/database';
import { linesParsed } from '../helpers/parser';
import { defaultPermissions } from '../helpers/permissions/';
import { adminEndpoint } from '../helpers/socket';
import { translate } from '../translate';
import System from './_interface';

/*
 * !timers                                                                                                                                 - gets an info about timers usage
 * !timers set -name [name-of-timer] -messages [num-of-msgs-to-trigger|default:0] -seconds [trigger-every-x-seconds|default:60] [-offline] - add new timer
 * !timers unset -name [name-of-timer]                                                                                                     - remove timer
 * !timers add -name [name-of-timer] -response '[response]'                                                                                - add new response to timer
 * !timers rm -id [response-id]                                                                                                            - remove response by id
 * !timers toggle -name [name-of-timer]                                                                                                    - enable/disable timer by name
 * !timers toggle -id [id-of-response]                                                                                                     - enable/disable response by id
 * !timers list                                                                                                                            - get timers list
 * !timers list -name [name-of-timer]                                                                                                      - get list of responses on timer
 */

class Timers extends System {
  constructor () {
    super();

    this.addMenu({
      category: 'manage', name: 'timers', id: 'manage/timers', this: this,
    });
    this.init();
  }

  sockets () {
    adminEndpoint(this.nsp, 'generic::getAll', async (callback) => {
      try {
        const timers = await getRepository(Timer).find({ relations: ['messages'] });
        callback(null, timers);
      } catch(e) {
        callback(e, []);
      }
    });
    adminEndpoint(this.nsp, 'generic::getOne', async (id, callback) => {
      try {
        const timer = await getRepository(Timer).findOne({
          relations: ['messages'],
          where:     { id },
        });
        callback(null, timer);
      } catch (e) {
        callback(e);
      }
    });
    adminEndpoint(this.nsp, 'generic::deleteById', async (id, callback) => {
      try {
        const timer = await getRepository(Timer).findOne({ where: { id } });
        if (timer) {
          await getRepository(Timer).remove(timer);
        }
        callback(null);
      } catch (e) {
        callback(e);
      }
    });
    adminEndpoint(this.nsp, 'generic::setById', async (opts, cb) => {
      try {
        const item = await getRepository(Timer).save({ ...(await getRepository(Timer).findOne({ id: String(opts.id) })), ...opts.item });
        cb(null, item);
      } catch (e) {
        cb(e.stack, null);
      }
    });
  }

  @command('!timers')
  @default_permission(defaultPermissions.CASTERS)
  main (opts: CommandOptions): CommandResponse[] {
    let url = 'http://sogehige.github.io/sogeBot/#/systems/timers';
    if ((process.env?.npm_package_version ?? 'x.y.z-SNAPSHOT').includes('SNAPSHOT')) {
      url = 'http://sogehige.github.io/sogeBot/#/_master/systems/timers';
    }
    return [{ response: translate('core.usage') + ' => ' + url, ...opts }];
  }

  async init () {
    if (!isDbConnected) {
      setTimeout(() => this.init(), 1000);
      return;
    }
    const timers = await getRepository(Timer).find({ relations: ['messages'] });
    for (const timer of timers) {
      await getRepository(Timer).save({
        ...timer, triggeredAtMessages: 0, triggeredAtTimestamp: Date.now(),
      });
    }
    this.check();
  }

  async check () {
    clearTimeout(this.timeouts.timersCheck);

    if (!isStreamOnline.value) {
      await getRepository(Timer).update({ tickOffline: false }, { triggeredAtMessages: linesParsed, triggeredAtTimestamp: Date.now() });
    }

    const timers = await getRepository(Timer).find({
      relations: ['messages'],
      where:     isStreamOnline.value ? { isEnabled: true } : { isEnabled: true, tickOffline: true },
    });

    for (const timer of timers) {
      if (timer.triggerEveryMessage > 0 && timer.triggeredAtMessages - linesParsed + timer.triggerEveryMessage > 0) {
        continue;
      } // not ready to trigger with messages
      if (timer.triggerEverySecond > 0 && new Date().getTime() - timer.triggeredAtTimestamp < timer.triggerEverySecond * 1000) {
        continue;
      } // not ready to trigger with seconds

      const announceResponse = (responses: TimerResponseInterface[]) => {
        // check if at least one response is enabled
        if (responses.filter(o => o.isEnabled).length === 0) {
          return;
        }

        responses = _.orderBy(responses, 'timestamp', 'asc');
        const response = responses.shift();
        if (response) {
          getRepository(TimerResponse).update({ id: response.id }, { timestamp: Date.now() });
          if (!response.isEnabled) {
            // go to next possibly enabled response
            announceResponse(responses);
          } else {
            announce(response.response, 'timers');
          }
        }
      };
      announceResponse(timer.messages);
      await getRepository(Timer).update({ id: timer.id }, { triggeredAtMessages: linesParsed, triggeredAtTimestamp: Date.now() });
    }
    this.timeouts.timersCheck = global.setTimeout(() => this.check(), SECOND); // this will run check 1s after full check is correctly done
  }

  @command('!timers set')
  @default_permission(defaultPermissions.CASTERS)
  async set (opts: CommandOptions): Promise<CommandResponse[]> {
    // -name [name-of-timer] -messages [num-of-msgs-to-trigger|default:0] -seconds [trigger-every-x-seconds|default:60] -offline
    const nameMatch = opts.parameters.match(/-name ([a-zA-Z0-9_]+)/);
    const messagesMatch = opts.parameters.match(/-messages ([0-9]+)/);
    const secondsMatch = opts.parameters.match(/-seconds ([0-9]+)/);
    const tickOffline = !!opts.parameters.match(/-offline/);

    let name = '';
    let messages = 0;
    let seconds = 0;

    if (_.isNil(nameMatch)) {
      return [{ response: translate('timers.name-must-be-defined'), ...opts }];
    } else {
      name = nameMatch[1];
    }

    messages = _.isNil(messagesMatch) ? 0 : parseInt(messagesMatch[1], 10);
    seconds = _.isNil(secondsMatch) ? 60 : parseInt(secondsMatch[1], 10);

    if (messages === 0 && seconds === 0) {
      return [{ response: translate('timers.cannot-set-messages-and-seconds-0'), ...opts }];
    }
    const timer = await getRepository(Timer).findOne({
      relations: ['messages'],
      where:     { name },
    });
    await getRepository(Timer).save({
      ...timer,
      tickOffline,
      name:                 name,
      triggerEveryMessage:  messages,
      triggerEverySecond:   seconds,
      isEnabled:            true,
      triggeredAtMessages:  linesParsed,
      triggeredAtTimestamp: Date.now(),
    });

    return [{
      response: translate(tickOffline ? 'timers.timer-was-set-with-offline-flag' : 'timers.timer-was-set')
        .replace(/\$name/g, name)
        .replace(/\$messages/g, messages)
        .replace(/\$seconds/g, seconds), ...opts,
    }];
  }

  @command('!timers unset')
  @default_permission(defaultPermissions.CASTERS)
  async unset (opts: CommandOptions): Promise<CommandResponse[]> {
    // -name [name-of-timer]
    const nameMatch = opts.parameters.match(/-name ([\S]+)/);
    let name = '';
    if (_.isNil(nameMatch)) {
      return [{ response: translate('timers.name-must-be-defined'), ...opts }];
    } else {
      name = nameMatch[1];
    }

    const timer = await getRepository(Timer).findOne({ name: name });
    if (!timer) {
      return [{ response: translate('timers.timer-not-found').replace(/\$name/g, name), ...opts }];
    }

    await getRepository(Timer).remove(timer);
    return [{ response: translate('timers.timer-deleted').replace(/\$name/g, name), ...opts }];
  }

  @command('!timers rm')
  @default_permission(defaultPermissions.CASTERS)
  async rm (opts: CommandOptions): Promise<CommandResponse[]> {
    // -id [id-of-response]
    try {
      const id = new Expects(opts.parameters).argument({ type: 'uuid', name: 'id' }).toArray()[0];
      await getRepository(TimerResponse).delete({ id });
      return [{
        response: translate('timers.response-deleted')
          .replace(/\$id/g, id), ...opts,
      }];
    } catch (e) {
      return [{ response: translate('timers.id-must-be-defined'), ...opts }];
    }
  }

  @command('!timers add')
  @default_permission(defaultPermissions.CASTERS)
  async add (opts: CommandOptions): Promise<CommandResponse[]> {
    // -name [name-of-timer] -response '[response]'
    const nameMatch = opts.parameters.match(/-name ([\S]+)/);
    const responseMatch = opts.parameters.match(/-response ['"](.+)['"]/);
    let name = '';
    let response = '';
    if (_.isNil(nameMatch)) {
      return [{ response: translate('timers.name-must-be-defined'), ...opts }];
    } else {
      name = nameMatch[1];
    }

    if (_.isNil(responseMatch)) {
      return [{ response: translate('timers.response-must-be-defined'), ...opts }];
    } else {
      response = responseMatch[1];
    }
    const timer = await getRepository(Timer).findOne({
      relations: ['messages'],
      where:     { name },
    });
    if (!timer) {
      return [{
        response: translate('timers.timer-not-found')
          .replace(/\$name/g, name), ...opts,
      }];
    }

    const item = await getRepository(TimerResponse).save({
      isEnabled: true,
      timestamp: Date.now(),
      response:  response,
      timer:     timer,
    });

    return [{
      response: translate('timers.response-was-added')
        .replace(/\$id/g, item.id)
        .replace(/\$name/g, name)
        .replace(/\$response/g, response), ...opts,
    }];
  }

  @command('!timers list')
  @default_permission(defaultPermissions.CASTERS)
  async list (opts: CommandOptions): Promise<CommandResponse[]> {
    // !timers list -name [name-of-timer]
    const nameMatch = opts.parameters.match(/-name ([\S]+)/);
    let name = '';

    if (_.isNil(nameMatch)) {
      const timers = await getRepository(Timer).find();
      return [{ response: translate('timers.timers-list').replace(/\$list/g, _.orderBy(timers, 'name').map((o) => (o.isEnabled ? '⚫' : '⚪') + ' ' + o.name).join(', ')), ...opts }];
    } else {
      name = nameMatch[1];
    }

    const timer = await getRepository(Timer).findOne({
      relations: ['messages'],
      where:     { name },
    });
    if (!timer) {
      return [{
        response: translate('timers.timer-not-found')
          .replace(/\$name/g, name), ...opts,
      }];
    }
    const responses: CommandResponse[] = [];
    responses.push({ response: translate('timers.responses-list').replace(/\$name/g, name), ...opts });
    for (const response of sortBy(timer.messages, 'response')) {
      responses.push({ response: (response.isEnabled ? '⚫ ' : '⚪ ') + `${response.id} - ${response.response}`, ...opts });
    }
    return responses;
  }

  @command('!timers toggle')
  @default_permission(defaultPermissions.CASTERS)
  async toggle (opts: CommandOptions): Promise<CommandResponse[]> {
    // -name [name-of-timer] or -id [id-of-response]
    const [id, name] = new Expects(opts.parameters)
      .argument({
        type: 'uuid', name: 'id', optional: true,
      })
      .argument({
        type: String, name: 'name', optional: true,
      })
      .toArray();

    if ((_.isNil(id) && _.isNil(name)) || (!_.isNil(id) && !_.isNil(name))) {
      return [{ response: translate('timers.id-or-name-must-be-defined'), ...opts }];
    }

    if (!_.isNil(id)) {
      const response = await getRepository(TimerResponse).findOne({ id });
      if (!response) {
        return [{ response: translate('timers.response-not-found').replace(/\$id/g, id), ...opts }];
      }

      await getRepository(TimerResponse).save({ ...response, isEnabled: !response.isEnabled });
      return [{
        response: translate(!response.isEnabled ? 'timers.response-enabled' : 'timers.response-disabled')
          .replace(/\$id/g, id), ...opts,
      }];
    }

    if (!_.isNil(name)) {
      const timer = await getRepository(Timer).findOne({ name: name });
      if (!timer) {
        return [{ response: translate('timers.timer-not-found').replace(/\$name/g, name), ...opts }];
      }

      await getRepository(Timer).save({ ...timer, isEnabled: !timer.isEnabled });
      return [{
        response: translate(!timer.isEnabled ? 'timers.timer-enabled' : 'timers.timer-disabled')
          .replace(/\$name/g, name), ...opts,
      }];
    }
    return [];
  }
}

export default new Timers();
