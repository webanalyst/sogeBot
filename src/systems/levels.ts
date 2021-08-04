'use strict';

import { MINUTE, SECOND } from '@sogebot/ui-helpers/constants';
import { evaluate as mathJsEvaluate, round } from 'mathjs';
import { getRepository } from 'typeorm';

import { User, UserInterface } from '../database/entity/user';
import {
  command, default_permission, parser, permission_settings, settings, ui,
} from '../decorators';
import { onStartup } from '../decorators/on';
import Expects from '../expects';
import general from '../general';
import { isStreamOnline } from '../helpers/api';
import { ResponseError } from '../helpers/commandError';
import { prepare } from '../helpers/commons';
import { getAllOnlineUsernames } from '../helpers/getAllOnlineUsernames';
import { debug, error } from '../helpers/log';
import { getUserHighestPermission } from '../helpers/permissions/';
import { defaultPermissions } from '../helpers/permissions/';
import { getPointsName } from '../helpers/points';
import { setImmediateAwait } from '../helpers/setImmediateAwait';
import { adminEndpoint } from '../helpers/socket';
import {
  bigIntMax, serialize, unserialize,
} from '../helpers/type';
import { isBot } from '../helpers/user/isBot';
import { translate } from '../translate';
import users from '../users';
import System from './_interface';
import points from './points';

let cachedLevelsHash = '';
const cachedLevels: bigint[] = [];

class Levels extends System {
  @settings('conversion')
  conversionRate = 10;

  @settings('levels')
  firstLevelStartsAt = 100;

  @settings('levels')
  nextLevelFormula = '$prevLevelXP + ($prevLevelXP * 1.5)';

  @ui({ type: 'levels-showcase', emit: 'getLevelsExample' }, 'levels')
  levelShowcase = null;
  @ui({ type: 'helpbox' }, 'levels')
  levelShowcaseHelp = null;

  @settings('xp')
  xpName = 'XP';

  @permission_settings('xp')
  interval = 10;

  @permission_settings('xp')
  perInterval = 10;

  @permission_settings('xp')
  offlineInterval = 0;

  @permission_settings('xp')
  perOfflineInterval = 0;

  @permission_settings('xp')
  messageInterval = 5;

  @permission_settings('xp')
  perMessageInterval = 1;

  @permission_settings('xp')
  messageOfflineInterval = 0;

  @permission_settings('xp')
  perMessageOfflineInterval = 0;

  sockets () {
    adminEndpoint(this.nsp, 'getLevelsExample', (cb) => {
      try {
        this.getLevelFromCache(21);
        cb(null, cachedLevels.map(xp => `${Intl.NumberFormat(general.lang).format(xp)} ${this.xpName}`));
      } catch (e) {
        cb(e.stack, []);
      }
    });
  }

  @onStartup()
  async update () {
    if (!this.enabled) {
      debug('levels.update', 'Disabled, next check in 5s');
      setTimeout(() => this.update(), 5 * SECOND);
      return;
    }

    const [interval, offlineInterval, perInterval, perOfflineInterval] = await Promise.all([
      this.getPermissionBasedSettingsValue('interval'),
      this.getPermissionBasedSettingsValue('offlineInterval'),
      this.getPermissionBasedSettingsValue('perInterval'),
      this.getPermissionBasedSettingsValue('perOfflineInterval'),
    ]);

    try {
      debug('levels.update', `Started XP adding, isOnline: ${isStreamOnline.value}`);
      let i = 0;
      for (const username of (await getAllOnlineUsernames())) {
        if (isBot(username)) {
          continue;
        }
        await this.process(username, {
          interval, offlineInterval, perInterval, perOfflineInterval, isOnline: isStreamOnline.value,
        });
        if ( i % 10 === 0) {
          await setImmediateAwait();
        }
        i++;
      }
    } catch (e) {
      error(e);
      error(e.stack);
    } finally {
      debug('levels.update', 'Finished xp adding, triggering next check in 60s');
      setTimeout(() => this.update(), MINUTE);
    }
  }

  getLevelFromCache(levelFromCache: number) {
    const hash = `${this.nextLevelFormula} + ${this.firstLevelStartsAt}`;
    if (hash !== cachedLevelsHash) {
      cachedLevelsHash = hash;
      cachedLevels.length = 0;
      // level 0
      cachedLevels.push(BigInt(0));
    }

    if (!cachedLevels[levelFromCache]) {
      // recalculate from level (length is +1 as we start with level 0)
      let level = cachedLevels.length;

      if (levelFromCache >= 1) {
        for (; level <= levelFromCache; level++) {
          const xp = this.getLevelXP(level, true);
          debug('levels.update', `Recalculating level ${level} - ${xp} XP`);
          cachedLevels.push(xp);
        }
      }
    }
    return cachedLevels[levelFromCache];
  }

  private async process(username: string, opts: {interval: {[permissionId: string]: any}; offlineInterval: {[permissionId: string]: any}; perInterval: {[permissionId: string]: any}; perOfflineInterval: {[permissionId: string]: any}; isOnline: boolean}): Promise<void> {
    const userId = await users.getIdByName(username);
    if (!userId) {
      debug('levels.update', `User ${username} missing userId`);
      return; // skip without id
    }

    // get user max permission
    const permId = await getUserHighestPermission(userId);
    if (!permId) {
      debug('levels.update', `User ${username}#${userId} permId not found`);
      return; // skip without id
    }

    const interval_calculated = opts.isOnline ? opts.interval[permId] * 60 * 1000 : opts.offlineInterval[permId]  * 60 * 1000;
    const ptsPerInterval = opts.isOnline ? opts.perInterval[permId]  : opts.perOfflineInterval[permId] ;

    const user = await getRepository(User).findOne({ username });
    if (!user) {
      debug('levels.update', `new user in db ${username}#${userId}[${permId}]`);
      await getRepository(User).save({
        userId,
        username,
      });
    } else {
      const chat = await users.getChatOf(userId, true);
      const chatOffline = await users.getChatOf(userId, false);

      // we need to save if extra.levels are not defined
      if (typeof user.extra?.levels === 'undefined') {
        debug('levels.update', `${user.username}#${userId}[${permId}] -- initial data --`);
        const levels: NonNullable<UserInterface['extra']>['levels'] = {
          xp:                serialize(BigInt(0)),
          xpOfflineGivenAt:  chatOffline,
          xpOfflineMessages: 0,
          xpOnlineGivenAt:   chat,
          xpOnlineMessages:  0,
        };
        await getRepository(User).update({ userId: user.userId },
          {
            extra: {
              ...user.extra,
              levels,
            },
          });
      }

      if (interval_calculated !== 0 && ptsPerInterval[permId] !== 0) {
        const givenAt = opts.isOnline
          ? user.extra?.levels?.xpOnlineGivenAt ?? chat
          : user.extra?.levels?.xpOfflineGivenAt ?? chat;
        debug('levels.update', `${user.username}#${userId}[${permId}] ${chat} | ${givenAt}`);
        let modifier = 0;
        let userTimeXP = givenAt + interval_calculated;
        for (; userTimeXP <= chat; userTimeXP += interval_calculated) {
          modifier++;
        }

        if (modifier > 0) {
          debug('levels.update', `${user.username}#${userId}[${permId}] +${Math.floor(ptsPerInterval * modifier)}`);
          const levels: NonNullable<UserInterface['extra']>['levels'] = {
            xp:                serialize(BigInt(Math.floor(ptsPerInterval * modifier)) + (unserialize<bigint>(user.extra?.levels?.xp) ?? BigInt(0))),
            xpOfflineGivenAt:  !opts.isOnline ? userTimeXP : user.extra?.levels?.xpOfflineGivenAt ?? chatOffline,
            xpOfflineMessages: user.extra?.levels?.xpOfflineMessages ?? 0,
            xpOnlineGivenAt:   opts.isOnline ? userTimeXP : user.extra?.levels?.xpOnlineGivenAt ?? chat,
            xpOnlineMessages:  user.extra?.levels?.xpOnlineMessages ?? 0,
          };
          await getRepository(User).update({ userId: user.userId },
            {
              extra: {
                ...user.extra,
                levels,
              },
            });
        }
      } else {
        const levels: NonNullable<UserInterface['extra']>['levels'] = {
          xp:                serialize(BigInt(ptsPerInterval) + (unserialize<bigint>(user.extra?.levels?.xp) ?? BigInt(0))),
          xpOfflineGivenAt:  !opts.isOnline ? chat : user.extra?.levels?.xpOfflineGivenAt ?? chat,
          xpOfflineMessages: user.extra?.levels?.xpOfflineMessages ?? 0,
          xpOnlineGivenAt:   opts.isOnline ? chat : user.extra?.levels?.xpOnlineGivenAt ?? chat,
          xpOnlineMessages:  user.extra?.levels?.xpOnlineMessages ?? 0,
        };
        await getRepository(User).update({ userId: user.userId },
          {
            extra: {
              ...user.extra,
              levels,
            },
          });
        debug('levels.update', `${user.username}#${userId}[${permId}] levels disabled or interval is 0, settint levels time to chat`);
      }
    }
  }

  @parser({ fireAndForget: true })
  async messageXP (opts: ParserOptions) {
    if (opts.skip || opts.message.startsWith('!')) {
      return true;
    }

    const [perMessageInterval, messageInterval, perMessageOfflineInterval, messageOfflineInterval] = await Promise.all([
      this.getPermissionBasedSettingsValue('perMessageInterval'),
      this.getPermissionBasedSettingsValue('messageInterval'),
      this.getPermissionBasedSettingsValue('perMessageOfflineInterval'),
      this.getPermissionBasedSettingsValue('messageOfflineInterval'),
    ]);

    // get user max permission
    const permId = await getUserHighestPermission(opts.sender.userId);
    if (!permId) {
      return true; // skip without permission
    }

    const interval_calculated = isStreamOnline.value ? messageInterval[permId] : messageOfflineInterval[permId];
    const ptsPerInterval = isStreamOnline.value ? perMessageInterval[permId] : perMessageOfflineInterval[permId];

    if (interval_calculated === 0 || ptsPerInterval === 0) {
      return true;
    }

    const user = await getRepository(User).findOne({ userId: opts.sender.userId });
    if (!user) {
      return true;
    }

    // next message count (be it offline or online)
    const messages = 1 + ((isStreamOnline.value
      ? user.extra?.levels?.xpOnlineMessages
      : user.extra?.levels?.xpOfflineMessages) ?? 0);
    const chat = await users.getChatOf(user.userId, isStreamOnline.value);

    // default level object
    const levels: NonNullable<UserInterface['extra']>['levels'] = {
      xp:                serialize(unserialize<bigint>(user.extra?.levels?.xp) ?? BigInt(0)),
      xpOfflineGivenAt:  user.extra?.levels?.xpOfflineGivenAt ?? chat,
      xpOfflineMessages: !isStreamOnline.value
        ? 0
        : user.extra?.levels?.xpOfflineMessages ?? 0,
      xpOnlineGivenAt:  user.extra?.levels?.xpOnlineGivenAt ?? chat,
      xpOnlineMessages: isStreamOnline.value
        ? 0
        : user.extra?.levels?.xpOnlineMessages ?? 0,
    };

    if (messages >= interval_calculated) {
      // add xp and set offline/online messages to 0
      await getRepository(User).update({ userId: user.userId },
        {
          extra: {
            ...user.extra,
            levels: {
              ...levels,
              [isStreamOnline.value ? 'xpOnlineMessages' : 'xpOfflineMessages']: 0,
              xp:                                                                serialize(BigInt(ptsPerInterval) + (unserialize<bigint>(user.extra?.levels?.xp) ?? BigInt(0))),
            },
          },
        });
    } else {
      await getRepository(User).update({ userId: user.userId },
        {
          extra: {
            ...user.extra,
            levels: {
              ...levels,
              [isStreamOnline.value ? 'xpOnlineMessages' : 'xpOfflineMessages']: messages,
            },
          },
        });
    }
    return true;
  }

  getLevelXP(level: number, calculate = false) {
    let prevLevelXP = BigInt(this.firstLevelStartsAt);

    if (level === 0) {
      return BigInt(0);
    }
    if (level === 1) {
      return BigInt(this.firstLevelStartsAt);
    }

    for (let i = 1; i < level; i++) {
      const expr = this.nextLevelFormula
        .replace(/\$prevLevelXP/g, String(prevLevelXP))
        .replace(/\$prevLevel/g, String(i));
      const formula = !calculate
        ? this.getLevelFromCache(i + 1)
        : BigInt(round(mathJsEvaluate(expr)));
      if (formula <= prevLevelXP && i > 1) {
        error('Next level cannot be equal or less than previous level');
        return BigInt(0);
      }
      prevLevelXP = formula;
    }
    return bigIntMax(prevLevelXP, BigInt(0));
  }

  getLevelOf(user: UserInterface | undefined): number {
    if (!user) {
      return 0;
    }

    const currentXP = unserialize<bigint>(user.extra?.levels?.xp) ?? BigInt(0);

    if (currentXP < this.firstLevelStartsAt) {
      return 0;
    }

    let levelXP: BigInt = BigInt(this.firstLevelStartsAt);
    let level = 1;
    for (; currentXP > 0; level++) {
      if (level > 1) {
        const formula = this.getLevelFromCache(level);
        levelXP = formula;
        if (formula === BigInt(0)) {
          error('Formula of level calculation is returning 0, please adjust.');
          return 0;
        }
      }
      if (BigInt(currentXP) < levelXP) {
        level--;
        break;
      }
    }
    return level;
  }

  @command('!level buy')
  async buy (opts: CommandOptions): Promise<CommandResponse[]> {
    try {
      if (!points.enabled) {
        throw new Error('Point system disabled.');
      }

      const user = await getRepository(User).findOneOrFail({ userId: opts.sender.userId });
      const availablePoints = user.points;
      const currentLevel = this.getLevelOf(user);
      const xp = this.getLevelXP(currentLevel + 1);
      const xpNeeded = xp - (unserialize<bigint>(user.extra?.levels?.xp) ?? BigInt(0));
      const neededPoints = Number(xpNeeded * BigInt(this.conversionRate));

      if (neededPoints >= availablePoints) {
        throw new ResponseError(
          prepare('systems.levels.notEnoughPointsToBuy', {
            points:     neededPoints,
            pointsName: getPointsName(neededPoints),
            amount:     xpNeeded,
            level:      currentLevel + 1,
            xpName:     this.xpName,
          }),
        );
      }

      const chat = await users.getChatOf(user.userId, isStreamOnline.value);
      const levels: NonNullable<UserInterface['extra']>['levels'] = {
        xp:                serialize(xp),
        xpOfflineGivenAt:  user.extra?.levels?.xpOfflineGivenAt ?? chat,
        xpOfflineMessages: user.extra?.levels?.xpOfflineMessages ?? 0,
        xpOnlineGivenAt:   user.extra?.levels?.xpOnlineGivenAt ?? chat,
        xpOnlineMessages:  user.extra?.levels?.xpOnlineMessages ?? 0,
      };
      await getRepository(User).update({ userId: user.userId },
        {
          points: user.points - neededPoints,
          extra:  {
            ...user.extra,
            levels,
          },
        });

      const response = prepare('systems.levels.XPBoughtByPoints', {
        points:     neededPoints,
        pointsName: getPointsName(neededPoints),
        level:      currentLevel + 1,
        amount:     xpNeeded,
        xpName:     this.xpName,
      });
      return [{ response, ...opts }];
    } catch (e) {
      if (e instanceof ResponseError) {
        return [{ response: e.message, ...opts }];
      } else {
        if (e.message === 'Point system disabled.') {
          error(e.stack);
        }
        return [{ response: translate('systems.levels.somethingGetWrong').replace('$command', opts.command), ...opts }];
      }
    }
  }

  @command('!level change')
  @default_permission(defaultPermissions.CASTERS)
  async add (opts: CommandOptions): Promise<CommandResponse[]> {
    try {
      const [username, xp] = new Expects(opts.parameters).username().number({ minus: true }).toArray();
      const user = await getRepository(User).findOneOrFail({ username });
      const chat = await users.getChatOf(user.userId, isStreamOnline.value);

      const levels: NonNullable<UserInterface['extra']>['levels'] = {
        xp:                serialize(bigIntMax(BigInt(xp) + (unserialize<bigint>(user.extra?.levels?.xp) ?? BigInt(0)), BigInt(0))),
        xpOfflineGivenAt:  user.extra?.levels?.xpOfflineGivenAt ?? chat,
        xpOfflineMessages: user.extra?.levels?.xpOfflineMessages ?? 0,
        xpOnlineGivenAt:   user.extra?.levels?.xpOnlineGivenAt ?? chat,
        xpOnlineMessages:  user.extra?.levels?.xpOnlineMessages ?? 0,
      };
      await getRepository(User).update({ userId: user.userId },
        {
          extra: {
            ...user.extra,
            levels,
          },
        });

      const response = prepare('systems.levels.changeXP', {
        username,
        amount: xp,
        xpName: this.xpName,
      });
      return [{ response, ...opts }];
    } catch (e) {
      return [{ response: translate('systems.levels.somethingGetWrong').replace('$command', opts.command), ...opts }];
    }
  }

  @command('!level')
  async main (opts: CommandOptions): Promise<CommandResponse[]> {
    try {
      const [username] = new Expects(opts.parameters).username({ optional: true, default: opts.sender.username }).toArray();
      const user = await getRepository(User).findOneOrFail({ username });

      let currentLevel = this.firstLevelStartsAt === 0 ? 1 : 0;
      let nextXP = await this.getLevelXP(currentLevel + 1);
      let currentXP = BigInt(0);

      if (user.extra?.levels) {
        currentXP = unserialize<bigint>(user.extra?.levels.xp) ?? BigInt(0);
        currentLevel = this.getLevelOf(user);
        nextXP = await this.getLevelXP(currentLevel + 1);
      }

      const response = prepare('systems.levels.currentLevel', {
        username,
        currentLevel,
        nextXP: bigIntMax(nextXP - currentXP, BigInt(0)),
        currentXP,
        xpName: this.xpName,
      });
      return [{ response, ...opts }];
    } catch (e) {
      return [{ response: translate('systems.levels.somethingGetWrong').replace('$command', opts.command), ...opts }];
    }
  }
}

export default new Levels();
