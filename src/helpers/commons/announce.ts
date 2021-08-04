import { TextChannel } from 'discord.js';

import { chatOut } from '../log';
import { botId } from '../oauth/botId';
import { botUsername } from '../oauth/botUsername';
import { getBotSender } from './getBotSender';

/**
 * Announce in all channels (discord, twitch)
 * @param messageToAnnounce
 *
 * announce('Lorem Ipsum Dolor', 'timers);
 */
export const announceTypes = ['bets', 'duel', 'heist', 'timers', 'songs', 'scrim', 'raffles', 'polls', 'general'] as const;
export async function announce(messageToAnnounce: string, type: typeof announceTypes[number], replaceCustomVariables = true) {
  // importing here as we want to get rid of import loops
  const Discord = (require('../../integrations/discord') as typeof import('../../integrations/discord')).default;
  const Message = (require('../../message') as typeof import('../../message')).Message;
  const sendMessage = (require('./sendMessage') as typeof import('./sendMessage')).sendMessage;

  messageToAnnounce = await new Message(messageToAnnounce).parse({ sender: getBotSender(), replaceCustomVariables }) as string;
  sendMessage(messageToAnnounce, {
    username:       botUsername.value,
    displayName:    botUsername.value,
    userId:         botId.value,
    emotes:         [],
    badges:         {},
    'message-type': 'chat',
  }, { force: true, skip: true });

  if (Discord.sendAnnouncesToChannel[type].length > 0 && Discord.client) {
    // search discord channel by ID
    for (const [ id, channel ] of Discord.client.channels.cache) {
      if (channel.type === 'text') {
        if (id === Discord.sendAnnouncesToChannel[type] || (channel as TextChannel).name === Discord.sendAnnouncesToChannel[type]) {
          const ch = Discord.client.channels.cache.find(o => o.id === id);
          if (ch) {
            (ch as TextChannel).send(await Discord.replaceLinkedUsernameInMessage(messageToAnnounce));
            chatOut(`#${(ch as TextChannel).name}: ${messageToAnnounce} [${Discord.client.user?.tag}]`);
          }
        }
      }
    }
  }
}