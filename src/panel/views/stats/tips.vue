<template>
  <v-container
    fluid
    :class="{ 'pa-4': !$vuetify.breakpoint.mobile }"
  >
    <h2 v-if="!$vuetify.breakpoint.mobile">
      {{ translate('menu.tips') }}
    </h2>

    <v-data-table
      :loading="state.loading !== $state.success"
      :headers="headers"
      :items="fItems"
      sort-by="tippedAt"
    >
      <template #top>
        <v-toolbar
          flat
        >
          <v-container
            class="pt-10 px-0"
            fluid
          >
            <v-row>
              <v-col>
                <v-text-field
                  v-model="search"
                  :append-icon="mdiMagnify"
                  label="Search"
                  hide-details
                />
              </v-col>
              <v-col cols="auto">
                <v-select
                  :value="selectedYear"
                  :label="capitalize(translate('bot.years').split('|')[0])"
                  :items="yearItems"
                />
              </v-col>
            </v-row>
          </v-container>
        </v-toolbar>
        <column-chart
          class="pa-2"
          :data="generateChartData"
          :ytitle="$store.state.configuration.currency"
        />
      </template>

      <template #[`item.tippedAt`]="{ item }">
        {{ dayjs(item.tippedAt).format('LL') }} {{ dayjs(item.tippedAt).format('LTS') }}
      </template>

      <template #[`item.sortAmount`]="{ item }">
        {{ Intl.NumberFormat($store.state.configuration.lang, { style: 'currency', currency: item.currency }).format(item.amount) }}
      </template>
      <template #[`item.user`]="{ item }">
        <router-link :to="{ name: 'viewersManagerEdit', params: { id: item.user.userId }}">
          {{ item.user.username }}&nbsp;<small class="text-muted">{{ item.user.userId }}</small>
        </router-link>
      </template>
    </v-data-table>
  </v-container>
</template>

<script lang="ts">
import { mdiMagnify } from '@mdi/js';
import {
  computed,
  defineComponent, onMounted, ref,
} from '@vue/composition-api';
import Chart from 'chart.js';
import { capitalize, orderBy } from 'lodash-es';
import Vue from 'vue';
import Chartkick from 'vue-chartkick';

import { UserTipInterface } from 'src/bot/database/entity/user';
import { dayjs } from 'src/bot/helpers/dayjs';
import { ButtonStates } from 'src/panel/helpers/buttonStates';
import translate from 'src/panel/helpers/translate';

import { getPermissionName } from '../../helpers/getPermissionName';
import { getSocket } from '../../helpers/socket';

Vue.use(Chartkick.use(Chart));

const socket = getSocket('/stats/tips');

export default defineComponent({
  setup(props, ctx) {
    const search = ref('');
    const selectedYear = ref(String((new Date()).getFullYear()));
    const items = ref([] as Required<UserTipInterface>[]);
    const fItems = computed(() => {
      if (search.value === '') {
        return items.value;
      } else {
        return items.value.filter(item => {
          const message = item.message.toLowerCase().includes(search.value.toLowerCase());
          const userid = item.user.userId.toLowerCase().includes(search.value.toLowerCase());
          const username = item.user.username.toLowerCase().includes(search.value.toLowerCase());
          return message || userid || username;
        });
      }
    });

    const state = ref({ loading: ButtonStates.progress } as {
      loading: number;
    });

    const headers = [
      { value: 'tippedAt', text: capitalize(translate('date')) },
      { value: 'sortAmount', text: capitalize(translate('responses.variable.amount')) },
      {
        value: 'message', text: capitalize(translate('message')), sortable: false,
      },
      { value: 'user', text: capitalize(translate('user')) },
    ];

    const refresh = () => {
      socket.emit('generic::getAll', (err: string | null, val: Required<UserTipInterface>[]) => {
        if (err) {
          return console.error(err);
        }
        items.value = val;
        state.value.loading = ButtonStates.success;
      });
    };

    onMounted(() => {
      refresh();
    });

    const years = computed(() => {
      return Object.keys(tipsByYear.value);
    });
    const tipsByYear = computed(() => {
      const d: { [year: number]: Required<UserTipInterface>[] } = { [new Date().getFullYear()]: [] };
      for (const tip of items.value) {
        const year = new Date(tip.tippedAt).getFullYear();
        if (d[year]) {
          d[year].push(tip);
        } else {
          d[year] = [ tip ];
        }
      }
      return d;
    });
    const tipsByMonth = computed(() => {
      const d: { [month: number]: Required<UserTipInterface>[] } = {
        0:  [], 1:  [], 2:  [], 3:  [], 4:  [], 5:  [],
        6:  [], 7:  [], 8:  [], 9:  [], 10: [], 11: [],
      };
      for (const tip of tipsByYear.value[Number(selectedYear.value)]) {
        const month = new Date(tip.tippedAt).getMonth();
        if (d[month]) {
          d[month].push(tip);
        } else {
          d[month] = [ tip ];
        }
      }
      return d;
    });

    const generateChartData = computed(() => {
      const data: [ string, number ][] = [];

      for (const [month, tips] of Object.entries(tipsByMonth.value)) {
        const monthFullName = dayjs().month(Number(month)).format('MMMM');

        data.push([
          monthFullName,
          Number(tips.reduce((a, b) => {
            return a + b.sortAmount;
          }, 0).toFixed(2)),
        ]);
      }
      return data;
    });

    const yearItems = computed(() => {
      return years.value.map((item: any) => ({
        text:  item,
        value: item,
      }));
    });

    return {
      orderBy,
      headers,
      search,
      items,
      state,
      getPermissionName,
      translate,
      refresh,
      capitalize,
      mdiMagnify,
      dayjs,
      fItems,
      generateChartData,
      yearItems,
      selectedYear,
    };
  },
});
</script>

<style>
tr:nth-of-type(odd) {
  background-color: rgba(0, 0, 0, .05);
}
v-small-dialog__activator__content {
    word-break: break-word;
}
</style>
