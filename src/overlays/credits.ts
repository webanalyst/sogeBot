import _ from 'lodash';
import { getRepository, MoreThanOrEqual } from 'typeorm';

import api from '../api';
import currency from '../currency';
import { EventList, EventListInterface } from '../database/entity/eventList';
import {
  isStreamOnline, stats, streamStatusChangeSince,
} from '../helpers/api';
import { mainCurrency } from '../helpers/currency';
import { publicEndpoint } from '../helpers/socket';
import oauth from '../oauth';
import users from '../users';
import Overlay from './_interface';

class Credits extends Overlay {
  sockets () {
    publicEndpoint(this.nsp, 'getClips', async(opts, cb) => {
      cb(opts.show ? await api.getTopClips({
        period: opts.period, days: opts.periodValue, first: opts.numOfClips,
      }) : [],
      );
    });
    publicEndpoint(this.nsp, 'load', async (cb) => {
      const when = isStreamOnline.value ? streamStatusChangeSince.value : Date.now() - 50000000000;
      const timestamp = new Date(when).getTime();
      const events: (EventListInterface & { username?: string, values?: {
        currency: currency; amount: number;
      };})[] = await getRepository(EventList).find({
        order: { timestamp: 'DESC' },
        where: { timestamp: MoreThanOrEqual(timestamp) },
      });

      // we need to map usernames
      const mapping = await users.getUsernamesFromIds(events.map(o => o.userId));
      for (const event of events) {
        event.username = mapping.get(event.userId) ?? 'n/a';
      }

      // change tips if neccessary for aggregated events (need same currency)
      for (const event of events) {
        event.values = JSON.parse(event.values_json);
        if (event.values) {
          if (!_.isNil(event.values.amount) && !_.isNil(event.values.currency)) {
            event.values.amount = currency.exchange(event.values.amount, event.values.currency, mainCurrency.value);
            event.values.currency = mainCurrency.value;
          }
        }
      }

      cb(null, {
        streamer: oauth.broadcasterUsername,
        game:     stats.value.currentGame,
        title:    stats.value.currentTitle,
        events,
      });
    });
  }
}

export default new Credits();
