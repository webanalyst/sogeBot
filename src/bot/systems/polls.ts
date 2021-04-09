import _ from 'lodash';
import { getRepository } from 'typeorm';

import { parserReply } from '../commons';
import currency from '../currency';
import { Poll, PollVote } from '../database/entity/poll';
import {
  command, default_permission, helper, parser, settings,
} from '../decorators';
import {
  onBit, onMessage, onStartup, onTip,
} from '../decorators/on';
import Expects from '../expects.js';
import { isStreamOnline } from '../helpers/api';
import {
  announce, getOwnerAsSender, prepare,
} from '../helpers/commons';
import { mainCurrency } from '../helpers/currency';
import { getLocalizedName } from '../helpers/getLocalized';
import { warning } from '../helpers/log.js';
import { defaultPermissions } from '../helpers/permissions/';
import { adminEndpoint } from '../helpers/socket';
import { translate } from '../translate';
import System from './_interface';

enum ERROR {
  NOT_ENOUGH_OPTIONS,
  NO_VOTING_IN_PROGRESS,
  INVALID_VOTE_TYPE,
  INVALID_VOTE,
  ALREADY_OPENED,
  ALREADY_CLOSED,
}

/*
 * !vote
 * !vote [x]
 * !poll open [-tips/-bits/-points] -title "your vote title" option | option | option
 * !poll close
 */

class Polls extends System {
  private currentMessages = 0;
  private lastMessageRemind = 0;
  private lastTimeRemind = 0;

  @settings('reminder')
  everyXMessages = 0;
  @settings('reminder')
  everyXSeconds = 0;

  @onStartup()
  onStartup() {
    setInterval(() => {
      if (isStreamOnline.value) {
        this.reminder();
      }
    }, 1000);

    this.addMenu({
      category: 'manage', name: 'polls', id: 'manage/polls', this: this,
    });
  }

  sendResponse(responses: CommandResponse[]) {
    for (let i = 0; i < responses.length; i++) {
      setTimeout(async () => {
        parserReply(await responses[i].response, { sender: responses[i].sender });
      }, i * 500);
    }
  }

  public async sockets() {
    adminEndpoint(this.nsp, 'generic::deleteById', async (id, cb) => {
      await getRepository(Poll).delete({ id: String(id) });
      cb(null);
    });
    adminEndpoint(this.nsp, 'generic::getAll', async (cb) => {
      try {
        cb(null, await getRepository(Poll).find({
          relations: ['votes'],
          order:     { openedAt: 'DESC' },
        }));
      } catch(e) {
        cb(e.stack, []);
      }
    });
    adminEndpoint(this.nsp, 'polls::save', async (vote, cb) => {
      try {
        const parameters = `-${vote.type} -title "${vote.title}" ${vote.options.filter((o) => o.trim().length > 0).join(' | ')}`;
        const response = await this.open({
          command:   this.getCommand('!poll open'),
          parameters,
          createdAt: 0,
          sender:    getOwnerAsSender(),
          attr:      { skip: false, quiet: false },
        });
        this.sendResponse(response);
        cb(null, null);
      } catch (e) {
        cb(e.stack, null);
      }
    });
    adminEndpoint(this.nsp, 'polls::close', async (vote, cb) => {
      try {
        const response = await this.close({
          command:    this.getCommand('!poll close'),
          parameters: '',
          createdAt:  0,
          sender:     getOwnerAsSender(),
          attr:       { skip: false, quiet: false },
        });
        this.sendResponse(response);
        cb(null);
      } catch (e) {
        cb(e.stack);
      }
    });
  }

  @command('!poll close')
  @default_permission(defaultPermissions.MODERATORS)
  public async close(opts: CommandOptions): Promise<CommandResponse[]> {
    const responses: CommandResponse[] = [];
    const cVote = await getRepository(Poll).findOne({
      relations: ['votes'],
      where:     { isOpened: true },
    });

    try {
      if (!cVote) {
        throw new Error(String(ERROR.ALREADY_CLOSED));
      } else {
        await getRepository(Poll).save({
          ...cVote,
          isOpened: false,
          closedAt: Date.now(),
        });

        let _total = 0;
        const count = cVote.votes.reduce((prev: { [option: number]: number } | null, cur) => {
          _total += cur.votes;
          if (!prev) {
            return { [cur.option]: cur.votes };
          } else {
            return { ...prev, [cur.option]: Number(prev[cur.option] || 0) + cur.votes };
          }
        }, null);

        // get vote status
        responses.push({ response: prepare('systems.polls.status_closed', { title: cVote.title }), ...opts });
        for (const index of Object.keys(cVote.options)) {
          const option = cVote.options[Number(index)];
          const votesCount = count ? count[Number(index)] || 0 : 0;
          const percentage = Number((100 / _total) * votesCount || 0).toFixed(2);
          if (cVote.type === 'normal') {
            responses.push({ response: this.getCommand('!vote') + ` ${Number(index) + 1} - ${option} - ${votesCount} ${getLocalizedName(votesCount, translate('systems.polls.votes'))}, ${percentage}%`, ...opts });
          } else if (cVote.type === 'numbers') {
            responses.push({ response: `${Number(index) + 1} - ${option} - ${votesCount} ${getLocalizedName(votesCount, translate('systems.polls.votes'))}, ${percentage}%`, ...opts });
          } else if (cVote.type === 'tips') {
            responses.push({ response: `#vote${Number(index) + 1} - ${option} - ${Number(votesCount).toFixed(2)} ${getLocalizedName(votesCount, translate('systems.polls.votes'))}, ${percentage}%`, ...opts });
          } else {
            responses.push({ response: `#vote${Number(index) + 1} - ${option} - ${votesCount} ${getLocalizedName(votesCount, translate('systems.polls.votes'))}, ${percentage}%`, ...opts });
          }
        }
      }
    } catch (e) {
      switch (e.message) {
        case String(ERROR.ALREADY_CLOSED):
          responses.push({ response: translate('systems.polls.notInProgress'), ...opts });
          break;
      }
    }
    return responses;
  }

  @command('!poll open')
  @default_permission(defaultPermissions.MODERATORS)
  public async open(opts: CommandOptions): Promise<CommandResponse[]> {
    const cVote = await getRepository(Poll).findOne({ isOpened: true });

    try {
      const responses: CommandResponse[] = [];
      if (cVote) {
        throw new Error(String(ERROR.ALREADY_OPENED));
      }

      const [type, title, options] = new Expects(opts.parameters)
        .switch({
          name: 'type', values: ['tips', 'bits', 'normal', 'numbers'], optional: true, default: 'normal',
        })
        .argument({
          name: 'title', optional: false, multi: true,
        })
        .list({ delimiter: '|' })
        .toArray();
      if (options.length < 2) {
        throw new Error(String(ERROR.NOT_ENOUGH_OPTIONS));
      }

      await getRepository(Poll).save({
        title:    title,
        isOpened: true,
        options:  options,
        type:     type,
        openedAt: Date.now(),
      });

      const translations = `systems.polls.opened_${type}`;
      responses.push({
        response: prepare(translations, {
          title,
          command: this.getCommand('!vote'),
        }), ...opts,
      });
      for (const index of Object.keys(options)) {
        if (type === 'normal') {
          responses.push({ response: this.getCommand('!vote') + ` ${(Number(index) + 1)} => ${options[index]}`, ...opts });
        } else {
          responses.push({ response: `#vote${(Number(index) + 1)} => ${options[index]}`, ...opts });
        }
      }

      this.lastTimeRemind = Date.now();
      return responses;
    } catch (e) {
      switch (e.message) {
        case String(ERROR.NOT_ENOUGH_OPTIONS):
          return [{ response: translate('voting.notEnoughOptions'), ...opts }];
          break;
        case String(ERROR.ALREADY_OPENED):
          if (!cVote) {
            return [];
          }
          const translations = 'systems.polls.alreadyOpened' + (cVote.type.length > 0 ? `_${cVote.type}` : '');
          const responses: CommandResponse[] = [];

          responses.push({
            response: prepare(translations, {
              title:   cVote.title,
              command: this.getCommand('!vote'),
            }), ...opts,
          });
          for (const index of Object.keys(cVote.options)) {
            if (cVote.type === 'normal') {
              responses.push({ response: this.getCommand('!poll open') + ` ${index} => ${cVote.options[Number(index)]}`, ...opts });
            } else if (cVote.type === 'numbers') {
              responses.push({ response: `${index} => ${cVote.options[Number(index)]}`, ...opts });
            } else {
              responses.push({ response: `#vote${(Number(index) + 1)} => ${cVote.options[Number(index)]}`, ...opts });
            }
          }
          return responses;
        default:
          warning(e.stack);
          return [{ response: translate('core.error'), ...opts }];
      }
    }
  }

  @command('!vote')
  @helper()
  public async main(opts: CommandOptions): Promise<CommandResponse[]> {
    const cVote = await getRepository(Poll).findOne({
      relations: ['votes'],
      where:     { isOpened: true },
    });
    let index: number;

    try {
      const responses: CommandResponse[] = [];
      if (opts.parameters.length === 0 && cVote) {
        let _total = 0;
        const count = cVote.votes.reduce((prev: { [option: number]: number } | null, cur) => {
          _total += cur.votes;
          if (!prev) {
            return { [cur.option]: cur.votes };
          } else {
            return { ...prev, [cur.option]: Number(prev[cur.option] || 0) + cur.votes };
          }
        }, null);
        // get vote status
        responses.push({ response: prepare('systems.polls.status', { title: cVote.title }), ...opts });
        for (const i of Object.keys(cVote.options)) {
          const option = cVote.options[Number(i)];
          const votesCount = count ? count[Number(i)] || 0 : 0;
          const percentage = Number((100 / _total) * votesCount || 0).toFixed(2);
          if (cVote.type === 'normal') {
            responses.push({ response: this.getCommand('!vote') + ` ${Number(i) + 1} - ${option} - ${votesCount} ${getLocalizedName(votesCount, translate('systems.polls.votes'))}, ${percentage}%`, ...opts });
          } else if (cVote.type === 'tips') {
            responses.push({ response: `#vote${Number(i) + 1} - ${option} - ${Number(votesCount).toFixed(2)} ${getLocalizedName(votesCount, translate('systems.polls.votes'))}, ${percentage}%`, ...opts });
          } else if (cVote.type === 'numbers') {
            responses.push({ response: `${Number(i) + 1} - ${option} - ${votesCount} ${getLocalizedName(votesCount, translate('systems.polls.votes'))}, ${percentage}%`, ...opts });
          } else {
            responses.push({ response: `#vote${Number(i) + 1} - ${option} - ${votesCount} ${getLocalizedName(votesCount, translate('systems.polls.votes'))}, ${percentage}%`, ...opts });
          }
        }
      } else if (!cVote) {
        throw new Error(String(ERROR.NO_VOTING_IN_PROGRESS));
      } else if (cVote.type === 'normal') {
        // we expects number
        [index] = new Expects(opts.parameters)
          .number()
          .toArray();
        index = index - 1;
        if (cVote.options.length < index + 1 || index < 0) {
          throw new Error(String(ERROR.INVALID_VOTE));
        } else {
          const vote = cVote.votes.find(o => o.votedBy === opts.sender.username);
          if (vote) {
            vote.option = index;
            await getRepository(Poll).save(cVote);
          } else {
            await getRepository(PollVote).save({
              poll:    cVote,
              votedBy: opts.sender.username,
              votes:   1,
              option:  index,
            });
          }
        }
      } else {
        throw new Error(String(ERROR.INVALID_VOTE_TYPE));
      }
      return responses;
    } catch (e) {
      switch (e.message) {
        case String(ERROR.NO_VOTING_IN_PROGRESS):
          return [{ response: prepare('systems.polls.notInProgress'), ...opts }];
      }
    }
    return [];
  }

  @parser()
  async participateByNumber(opts: ParserOptions) {
    try {
      if (opts.message.match(/^(\d+)$/)) {
        const cVote = await getRepository(Poll).findOne({ isOpened: true, type: 'numbers' });
        if (!cVote) {
          return true; // do nothing if no vote in progress
        }
        const vote = await getRepository(PollVote).findOne({ poll: cVote, votedBy: opts.sender.username });
        if (Number(opts.message) > 0 && Number(opts.message) <= cVote.options.length) {
          if (vote) {
            await getRepository(PollVote).save({
              ...vote,
              option: Number(opts.message) - 1,
            });
          } else {
            await getRepository(PollVote).save({
              poll:    cVote,
              option:  Number(opts.message) - 1,
              votes:   1,
              votedBy: opts.sender.username,
            });
          }
        }
      }
    } catch (e) {
      warning(e.stack);
    }
    return true;
  }

  @onBit()
  protected async parseBit(opts: { username: string; amount: number; message: string }): Promise<void> {
    const cVote = await getRepository(Poll).findOne({ isOpened: true });

    if (cVote && cVote.type === 'bits') {
      for (let i = cVote.options.length; i > 0; i--) {
        // we are going downwards because we are checking include and 1 === 10
        if (opts.message.includes('#vote' + i)) {
          // no update as we will not switch vote option as in normal vote
          await getRepository(PollVote).save({
            poll:    cVote,
            option:  i - 1,
            votes:   opts.amount,
            votedBy: opts.username,
          });
          break;
        }
      }
    }
  }

  @onTip()
  protected async parseTip(opts: { username: string; amount: number; message: string; currency: currency }): Promise<void> {
    const cVote = await getRepository(Poll).findOne({ isOpened: true });

    if (cVote && cVote.type === 'tips') {
      for (let i = cVote.options.length; i > 0; i--) {
        // we are going downwards because we are checking include and 1 === 10
        if (opts.message.includes('#vote' + i)) {
          // no update as we will not switch vote option as in normal vote
          await getRepository(PollVote).save({
            poll:    cVote,
            option:  i - 1,
            votes:   Number(currency.exchange(opts.amount, opts.currency, mainCurrency.value)),
            votedBy: opts.username,
          });
          break;
        }
      }
    }
  }

  @onMessage()
  protected async countMessage() {
    this.currentMessages = this.currentMessages + 1;
  }

  private async reminder() {
    const vote = await getRepository(Poll).findOne({ isOpened: true });
    const shouldRemind = { messages: false, time: false };

    if (this.everyXMessages === 0 && this.everyXSeconds === 0 || !vote) {
      this.lastMessageRemind = this.currentMessages;
      this.lastTimeRemind = 0;
      return; // reminder is disabled
    }

    if (this.everyXMessages === 0) {
      shouldRemind.messages = true;
    } else {
      if (this.currentMessages - this.lastMessageRemind >= this.everyXMessages) {
        shouldRemind.messages = true;
      } else {
        shouldRemind.messages = false;
      }
    }

    if (this.everyXSeconds === 0) {
      shouldRemind.time = true;
    } else {
      if (new Date().getTime() - new Date(this.lastTimeRemind).getTime() > this.everyXSeconds * 1000) {
        shouldRemind.time = true;
      } else {
        shouldRemind.time = false;
      }
    }

    if (_.every(shouldRemind)) {
      // update last remind data
      this.lastMessageRemind = this.currentMessages;
      this.lastTimeRemind = Date.now();

      const translations = `systems.polls.opened_${vote.type}`;
      announce(prepare(translations, {
        title:   vote.title,
        command: this.getCommand('!vote'),
      }), 'polls');
      for (const index of Object.keys(vote.options)) {
        setTimeout(() => {
          if (vote.type === 'numbers') {
            announce(`${(Number(index) + 1)} => ${vote.options[Number(index)]}`, 'polls');
          } else if (vote.type === 'normal') {
            announce(this.getCommand('!vote') + ` ${(Number(index) + 1)} => ${vote.options[Number(index)]}`, 'polls');
          } else {
            announce(`#vote${(Number(index) + 1)} => ${vote.options[Number(index)]}`, 'polls');
          }
        }, 300 * (Number(index) + 1));
      }
    }
  }
}

export default new Polls();
