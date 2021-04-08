<template>
  <v-dialog
    v-model="dialog"
    persistent
    max-width="600px"
    transition="dialog-bottom-transition"
  >
    <template #activator="{ on, attrs }">
      <div
        v-bind="attrs"
        v-on="on"
      >
        {{ Intl.NumberFormat($store.state.configuration.lang, { style: 'currency', currency: $store.state.configuration.currency }).format(sum) }}
      </div>
    </template>

    <v-card>
      <v-card-title class="headline">
        Update <code class="mx-2">{{ username }}</code> {{ translate('tips').toLowerCase() }}
      </v-card-title>

      <v-card-text>
        <v-data-table
          :headers="headers"
          :items="tips"
          sort-by="tippedAt"
          :sort-desc="true"
          hide-default-header
        >
          <template #top>
            <v-btn
              @click="tips.push({
                id: uuid(),
                amount: 0,
                currency: $store.state.configuration.currency,
                message: '',
                tippedAt: Date.now(),
              })"
            >
              add tip
            </v-btn>
          </template>

          <template #[`item.tippedAt`]="{ item }">
            <v-edit-dialog
              persistent
              large
              :return-value.sync="item.tippedAt"
            >
              {{ dayjs(item.tippedAt).format('LL') }} {{ dayjs(item.tippedAt).format('LTS') }}
              <template #input>
                <v-time-picker
                  :key="userId + 'tippedAtTime' + timestamp"
                  :use-seconds="true"
                  class="timePicker"
                  :value="(item.tippedAt > 0 ? item.tippedAt : Date.now()) | timeToTime"
                  @input="value => setAttr(item, 'tippedAtTime', value)"
                />

                <v-date-picker
                  :key="userId + 'tippedAtDate' + timestamp"
                  :max="new Date().toISOString()"
                  :value="(item.tippedAt > 0 ? item.tippedAt : Date.now()) | timeToDate"
                  @input="value => setAttr(item, 'tippedAtDate', value)"
                />
              </template>
            </v-edit-dialog>
          </template>

          <template #[`item.amount`]="{ item }">
            <v-edit-dialog
              persistent
              large
              :return-value.sync="item.amount"
              @open="currencyBackup = item.currency"
              @close="item.currency = currencyBackup"
              @save="currencyBackup = item.currency"
            >
              {{ Intl.NumberFormat($store.state.configuration.lang, { style: 'currency', currency: item.currency }).format(item.amount) }}
              <template #input>
                <v-text-field
                  v-model="item.amount"
                  type="number"
                  min="0"
                  step="0.01"
                  :rules="rules.amount"
                  single-line
                />
                <v-select
                  v-model="item.currency"
                  :items="currencyItems"
                />
              </template>
            </v-edit-dialog>
          </template>

          <template #[`item.button`]="{ item }">
            <v-icon @click="remove(item)">
              {{ mdiDelete }}
            </v-icon>
          </template>

          <template #[`item.message`]="{ item }">
            <v-edit-dialog
              persistent
              large
              :return-value.sync="item.message"
            >
              <span :class="{ 'text--lighten-1': item.message.trim().length === 0, 'red--text': item.message.trim().length === 0 }">
                {{ item.message.trim().length === 0 ? 'no message' : item.message }}
              </span>
              <template #input>
                <v-lazy>
                  <v-textarea
                    v-model="item.message"
                    :rows="1"
                    single-line
                    counter
                    auto-grow
                    autofocus
                    @keydown.enter.prevent
                  />
                </v-lazy>
              </template>
            </v-edit-dialog>
          </template>
        </v-data-table>
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn
          color="blue darken-1"
          text
          @click="close"
        >
          Close
        </v-btn>
        <v-btn
          color="blue darken-1"
          text
          @click="save"
        >
          Save
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script lang="ts">
import { mdiDelete } from '@mdi/js';
import {
  defineComponent, ref, watch,
} from '@vue/composition-api';
import { orderBy } from 'lodash-es';
import { capitalize } from 'lodash-es';
import { v4 as uuid } from 'uuid';

import { UserInterface, UserTipInterface } from 'src/bot/database/entity/user';
import { dayjs } from 'src/bot/helpers/dayjs';
import { getSocket } from 'src/panel/helpers/socket';
import translate from 'src/panel/helpers/translate';
import { minValue, required } from 'src/panel/helpers/validators';

const socket = { users: getSocket('/core/users') } as const;

const timeToDate = (value: number) => {
  return new Date(value).toISOString().substr(0, 10);
};
const timeToTime = (value: number) => {
  return dayjs(value).format('HH:mm:ss');
};
export default defineComponent({
  filters: {
    timeToDate,
    timeToTime,
  },
  props: { sum: Number, userId: String },
  setup(props, ctx) {
    const tips = ref([] as UserInterface['tips']);
    const username = ref('');
    const dialog = ref(false);
    const timestamp = ref(Date.now());
    const currencyBackup = ref('USD');
    const rules = { amount: [required, minValue(0)] };

    const headers = [
      { value: 'tippedAt', text: '' },
      { value: 'amount', text: '' },
      { value: 'message', text: '' },
      { value: 'button', text: '' },
    ];

    const currencyItems = [
      { value: 'USD', text: 'USD' },
      { value: 'AUD', text: 'AUD' },
      { value: 'BGN', text: 'BGN' },
      { value: 'BRL', text: 'BRL' },
      { value: 'CAD', text: 'CAD' },
      { value: 'CHF', text: 'CHF' },
      { value: 'CNY', text: 'CNY' },
      { value: 'CZK', text: 'CZK' },
      { value: 'DKK', text: 'DKK' },
      { value: 'EUR', text: 'EUR' },
      { value: 'GBP', text: 'GBP' },
      { value: 'HKD', text: 'HKD' },
      { value: 'HRK', text: 'HRK' },
      { value: 'HUF', text: 'HUF' },
      { value: 'IDR', text: 'IDR' },
      { value: 'ILS', text: 'ILS' },
      { value: 'INR', text: 'INR' },
      { value: 'ISK', text: 'ISK' },
      { value: 'JPY', text: 'JPY' },
      { value: 'KRW', text: 'KRW' },
      { value: 'MXN', text: 'MXN' },
      { value: 'MYR', text: 'MYR' },
      { value: 'NOK', text: 'NOK' },
      { value: 'NZD', text: 'NZD' },
      { value: 'PHP', text: 'PHP' },
      { value: 'PLN', text: 'PLN' },
      { value: 'RON', text: 'RON' },
      { value: 'RUB', text: 'RUB' },
      { value: 'SEK', text: 'SEK' },
      { value: 'SGD', text: 'SGD' },
      { value: 'THB', text: 'THB' },
      { value: 'TRY', text: 'TRY' },
      { value: 'ZAR', text: 'ZAR' },
    ];

    watch(dialog, (val) => {
      if (val) {
        // load tips
        socket.users.emit('viewers::findOne', props.userId, (error: null | string, viewer: UserInterface) => {
          console.log('User loaded', viewer);
          username.value = viewer.username;
          tips.value = viewer.tips;
        });
      }
    });

    const save = () => {
      ctx.emit('save', tips.value);
      dialog.value = false;
    };

    const close = () => {
      ctx.emit('close');
      dialog.value = false;
    };

    const remove = (item: UserTipInterface) => {
      tips.value.splice(tips.value.findIndex(o => o.id === item.id), 1);
    };

    const setAttr = (item: any, attr: any, value: any) => {
      if (['tippedAtDate'].includes(attr)) {
        (item as any)[attr.replace('Date', '')] = Date.parse(`${value} ${timeToTime(item.tippedAt ?? 0)}`);
        const time = timeToTime(item[attr.replace('Date', '')] ?? Date.now());
        if (time.includes('00:')) {
          // we need to +1 day as day is setting back
          const dateToUpdate = new Date(Date.parse(value));
          dateToUpdate.setDate(dateToUpdate.getDate() + 1);
          value = timeToDate(dateToUpdate.getTime());
        }
        (item as any)[attr.replace('Date', '')] = Date.parse(`${value} ${time}`);
      } else if (['tippedAtTime'].includes(attr)) {
        const attrValue = item[attr.replace('Time', '')] === 0 ? Date.now() : item[attr.replace('Time', '')];
        let date = timeToDate(attrValue);
        if (value.includes('00:')) {
          // we need to +1 day as day is setting back
          const dateToUpdate = new Date(Date.parse(date));
          dateToUpdate.setDate(dateToUpdate.getDate() + 1);
          date = timeToDate(dateToUpdate.getTime());
        }
        (item as any)[attr.replace('Time', '')] = Date.parse(`${date} ${value}`);
      } else {
        throw new Error('Unknown attr ' + attr);
      }
    };

    return {
      orderBy,
      translate,
      username,
      dialog,
      capitalize,
      close,
      save,
      remove,
      tips,
      headers,
      uuid,
      dayjs,
      setAttr,
      timestamp,
      currencyItems,
      currencyBackup,
      rules,
      mdiDelete,
    };
  },
});
</script>
