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
        {{ Intl.NumberFormat($store.state.configuration.lang).format(sum) }}
      </div>
    </template>

    <v-card>
      <v-card-title class="headline">
        Update <code class="mx-2">{{ username }}</code> {{ translate('bits').toLowerCase() }}
      </v-card-title>

      <v-card-text>
        <v-data-table
          :headers="headers"
          :items="bits"
          sort-by="cheeredAt"
          :sort-desc="true"
          hide-default-header
        >
          <template #top>
            <v-btn
              @click="bits.push({
                id: uuid(),
                amount: 0,
                message: '',
                cheeredAt: Date.now(),
              })"
            >
              add bit
            </v-btn>
          </template>

          <template #[`item.cheeredAt`]="{ item }">
            <v-edit-dialog
              persistent
              large
              :return-value.sync="item.cheeredAt"
            >
              {{ dayjs(item.cheeredAt).format('LL') }} {{ dayjs(item.cheeredAt).format('LTS') }}
              <template #input>
                <v-time-picker
                  :use-seconds="true"
                  :key="userId + 'cheeredAtTime' + timestamp"
                  class="timePicker"
                  :value="(item.cheeredAt > 0 ? item.cheeredAt : Date.now()) | timeToTime"
                  @input="value => setAttr(item, 'cheeredAtTime', value)"
                />

                <v-date-picker
                  :key="userId + 'cheeredAtDate' + timestamp"
                  :max="new Date().toISOString()"
                  :value="(item.cheeredAt > 0 ? item.cheeredAt : Date.now()) | timeToDate"
                  @input="value => setAttr(item, 'cheeredAtDate', value)"
                />
              </template>
            </v-edit-dialog>
          </template>

          <template #[`item.amount`]="{ item }">
            <v-edit-dialog
              persistent
              large
              :return-value.sync="item.amount"
            >
              {{ Intl.NumberFormat($store.state.configuration.lang).format(item.amount) }}
              <template #input>
                <v-text-field
                  v-model="item.amount"
                  type="number"
                  min="0"
                  step="1"
                  :rules="rules.amount"
                  single-line
                />
              </template>
            </v-edit-dialog>
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
import {
  defineComponent, ref, watch,
} from '@vue/composition-api';
import { orderBy } from 'lodash-es';
import { capitalize } from 'lodash-es';
import { v4 as uuid } from 'uuid';

import { UserInterface } from 'src/bot/database/entity/user';
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
    const bits = ref([] as UserInterface['bits']);
    const username = ref('');
    const dialog = ref(false);
    const timestamp = ref(Date.now());
    const currencyBackup = ref('USD');
    const rules = {
      amount: [required, minValue(0)],
    }

    const headers = [
      { value: 'cheeredAt', text: '' },
      { value: 'amount', text: '' },
      { value: 'message', text: '' },
    ];

    watch(dialog, (val) => {
      if (val) {
        socket.users.emit('viewers::findOne', props.userId, (error: null | string, viewer: UserInterface) => {
          console.log('User loaded', viewer);
          username.value = viewer.username;
          bits.value = viewer.bits;
        });
      }
    });

    const save = () => {
      ctx.emit('save', bits.value);
      dialog.value = false;
    };

    const close = () => {
      ctx.emit('close');
      dialog.value = false;
    };

    const remove = (idx: number) => {
      console.log({ idx });
      bits.value.splice(idx, 1);
    };

    const setAttr = (item: any, attr: any, value: any) => {
      if (['cheeredAtDate'].includes(attr)) {
        (item as any)[attr.replace('Date', '')] = Date.parse(`${value} ${timeToTime(item.cheeredAt ?? 0)}`);
        const time = timeToTime(item[attr.replace('Date', '')] ?? Date.now());
        if (time.includes('00:')) {
          // we need to +1 day as day is setting back
          const dateToUpdate = new Date(Date.parse(value));
          dateToUpdate.setDate(dateToUpdate.getDate() + 1);
          value = timeToDate(dateToUpdate.getTime());
        }
        (item as any)[attr.replace('Date', '')] = Date.parse(`${value} ${time}`);
      } else if (['cheeredAtTime'].includes(attr)) {
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
      bits,
      headers,
      uuid,
      dayjs,
      setAttr,
      timestamp,
      currencyBackup,
      rules,
    };
  },
});
</script>
