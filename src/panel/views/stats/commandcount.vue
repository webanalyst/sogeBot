<template>
  <v-container
    fluid
    :class="{ 'pa-4': !$vuetify.breakpoint.mobile }"
  >
    <h2 v-if="!$vuetify.breakpoint.mobile">
      {{ translate('menu.commandcount') }}
    </h2>

    <v-data-table
      :loading="state.loading !== $state.success"
      :headers="headers"
      :search="search"
      :items="items"
      sort-by="day"
    >
      <template #top>
        <v-toolbar
          flat
        >
          <v-text-field
            v-model="search"
            :append-icon="mdiMagnify"
            label="Search"
            hide-details
          />
        </v-toolbar>

        <line-chart
          :key="timeRange"
          class="pa-2"
          :data="generateChartData()"
        />
        <v-slider
          v-model="timeRange"
          :tick-labels="ticksLabels"
          :max="7"
          step="1"
          tick-size="4"
        />
      </template>

      <template #[`item.button`]="{ item }">
        <v-icon
          :class="[!showChartCommands.includes(item.command) ? 'green--text' : 'red--text']"
          @click="toggleCommandChart(item.command)"
        >
          {{ !showChartCommands.includes(item.command) ? mdiPlusThick : mdiMinusThick }}
        </v-icon>
      </template>
    </v-data-table>
  </v-container>
</template>

<script lang="ts">
import {
  mdiMagnify, mdiMinusThick, mdiPlusThick, 
} from '@mdi/js';
import {
  computed, defineComponent,
  onMounted, ref, watch,
} from '@vue/composition-api';
import Chart from 'chart.js';
import {
  capitalize, countBy, orderBy,
} from 'lodash-es';
import Vue from 'vue';
import Chartkick from 'vue-chartkick';

import { dayjs } from 'src/bot/helpers/dayjs';
import { ButtonStates } from 'src/panel/helpers/buttonStates';
import translate from 'src/panel/helpers/translate';

import { getPermissionName } from '../../helpers/getPermissionName';
import { getSocket } from '../../helpers/socket';

Vue.use(Chartkick.use(Chart));

const socket = getSocket('/stats/commandcount');

export default defineComponent({
  setup(props, ctx) {
    const search = ref('');
    const showChartCommands = ref([] as string[]);
    watch(showChartCommands, () => {
      localStorage.setItem('/stats/commandcount/showChartCommands', JSON.stringify(showChartCommands.value));
    });

    const timeRange = ref(Number(localStorage.getItem('/stats/commandcount/timeRange') ?? 0));
    watch(timeRange, () => {
      localStorage.setItem('/stats/commandcount/timeRange', JSON.stringify(timeRange.value));
    });

    const ticksLabels = [
      'Unlimited',
      'An year',
      '6 months',
      '3 months',
      'A month',
      '2 weeks',
      '1 week',
      '1 day',
    ];

    const items = ref([] as {
      command: string,
      hour: number,
      day: number,
      week: number,
      month: number,
      year: number,
      total: number,
    }[]);
    const commands = computed(() => {
      return [...new Set(items.value.map(o => o.command))];
    });
    const commandsUsage = ref([] as { command: string, timestamp: number, _id: string }[]);

    const state = ref({ loading: ButtonStates.progress } as {
      loading: number;
    });

    const headers = [
      { value: 'command', text: capitalize(translate('command')) },
      { value: 'hour', text: capitalize(translate('stats.commandcount.hour')) },
      { value: 'day', text: capitalize(translate('stats.commandcount.day')) },
      { value: 'week', text: capitalize(translate('stats.commandcount.week')) },
      { value: 'month', text: capitalize(translate('stats.commandcount.month')) },
      { value: 'year', text: capitalize(translate('stats.commandcount.year')) },
      { value: 'total', text: capitalize(translate('stats.commandcount.total')) },
      {
        value: 'button', text: '', sortable: false,
      },
    ];

    const refresh = () => {
      socket.emit('commands::count', (err: string | null, val: { command: string, timestamp: number, _id: string }[]) => {
        if (err) {
          return console.error(err);
        }

        const cacheShowChartCommands = localStorage.getItem('/stats/commandcount/showChartCommands');
        if (!cacheShowChartCommands) {
          showChartCommands.value = val.splice(0, 5).map(o => o.command);
          localStorage.setItem('/stats/commandcount/showChartCommands', JSON.stringify(showChartCommands.value));
        } else {
          showChartCommands.value = JSON.parse(cacheShowChartCommands);
        }

        for (const command of val.map(o => o.command)) {
          if (!items.value.find(o => o.command === command)) {
            items.value.push({
              command,
              hour:  totalInInterval(command, 1000 * 60 * 60, val),
              day:   totalInInterval(command, 1000 * 60 * 60 * 24, val),
              week:  totalInInterval(command, 1000 * 60 * 60 * 24 * 7, val),
              month: totalInInterval(command, 1000 * 60 * 60 * 24 * 30, val),
              year:  totalInInterval(command, 1000 * 60 * 60 * 24 * 365, val),
              total: total(command, val),
            });
          }
        }
        commandsUsage.value = val;
        state.value.loading = ButtonStates.success;
      });
    };

    onMounted(() => {
      refresh();
    });

    const totalInInterval = (command: string, interval: number, values: { command: string, timestamp: number, _id: string }[]): number => {
      return values.filter(o => {
        const isCorrectCommand = o.command === command;
        const isInInterval = Date.now() - interval <= o.timestamp;
        return isCorrectCommand && isInInterval;
      }).length;
    };
    const total = (command: string, values: { command: string, timestamp: number, _id: string }[]): number => {
      return values.filter(o => o.command === command).length;
    };
    const toggleCommandChart = (command: string) => {
      if (showChartCommands.value.includes(command)) {
        showChartCommands.value = showChartCommands.value.filter((o) => o !== command);
      } else {
        showChartCommands.value.push(command);
      }
    };
    const from = computed(() => {
      // oldest timestamp
      const oldestTimestamp = Math.min(...commandsUsage.value.map(o=>o.timestamp));
      switch (timeRange.value) {
        case 1:
          return Math.max(oldestTimestamp, dayjs().subtract(1, 'year').valueOf());
        case 2:
          return Math.max(oldestTimestamp, dayjs().subtract(6, 'month').valueOf());
        case 3:
          return Math.max(oldestTimestamp, dayjs().subtract(3, 'month').valueOf());
        case 4:
          return Math.max(oldestTimestamp, dayjs().subtract(1, 'month').valueOf());
        case 5:
          return Math.max(oldestTimestamp, dayjs().subtract(2, 'week').valueOf());
        case 6:
          return Math.max(oldestTimestamp, dayjs().subtract(1, 'week').valueOf());
        case 7:
          return Math.max(oldestTimestamp, dayjs().subtract(1, 'day').valueOf());
        default:
          return Math.max(oldestTimestamp, 0);
      }
    });
    const timestampList = computed((): number[] => {
      const to = Date.now();
      const list: number[] = [];
      for (
        let timestamp = (from.value / (timestampSmooth.value) * (timestampSmooth.value));
        timestamp <= (to / (timestampSmooth.value) * (timestampSmooth.value));
        timestamp = timestamp + (timestampSmooth.value)) {
        list.push(timestamp);
      }
      return list;
    });
    const timestampSmooth = computed((): number => {
      const to = Date.now();
      const list: number[] = [];
      for (
        let timestamp = (from.value / (1000 * 60 * 30) * (1000 * 60 * 30));
        timestamp <= (to / (1000 * 60 * 30) * (1000 * 60 * 30));
        timestamp = timestamp + (1000 * 60 * 30)) {
        list.push(timestamp);
      }

      if (list.length <= (48 /*day*/ * 1)) {
        return 1000 * 60 * 30; // half hour
      } else if (list.length <= (48 /*day*/ * 2)) {
        return 1000 * 60 * 60; // hour
      } else if (list.length <= (48 /*day*/ * 3)) {
        return 1000 * 60 * 60 * 2; // 2 hours
      } else if (list.length <= (48 /*day*/ * 6)) {
        return 1000 * 60 * 60 * 4; // 4 hours
      } else if (list.length <= (48 /*day*/ * 12)) {
        return 1000 * 60 * 60 * 8; // 8 hours
      } else if (list.length <= (48 /*day*/ * 21)) {
        return 1000 * 60 * 60 * 12; // 12 hours
      } else if (list.length <= (48 /*day*/ * 30)) {
        return 1000 * 60 * 60 * 24; // day
      } else if (list.length <= (48 /*day*/ * 365)) {
        return 1000 * 60 * 60 * 24 * 30; // month
      } else {
        return 1000 * 60 * 60 * 24 * 30 * 12; // year
      }
    });
    const generateChartData = (): {
      name: string; data: { [x: string]: number };
    }[] => {
      const data: {
        name: string; data: { [x: string]: number };
      }[] = [];

      const to = Date.now();

      for (const command of commands.value) {
        if (!showChartCommands.value.includes(command)) {
          continue;
        }
        const timestamps = commandsUsage.value
          .filter(o => {
            const isCommand = o.command === command;
            const isHigherThanFromDate = o.timestamp >= from.value;
            const isLowerThanToDate = o.timestamp <= to;
            return isCommand && isHigherThanFromDate && isLowerThanToDate;
          })
          .map(o => {
            // find smooth timestamp
            let timestamp = from.value;
            while(timestamp <= o.timestamp) {
              timestamp += timestampSmooth.value;
            }
            if (timestamp > to) {
              timestamp = to;
            }
            return timestamp;
          });
        const countByTimestamps = countBy(timestamps);
        for (const t of timestampList.value) {
          if (!countByTimestamps[t]) {
            countByTimestamps[t] = 0;
          }
        }
        const countByTimestampsOrdered: any = {};
        for (const k of Object.keys(countByTimestamps).sort()) {
          countByTimestampsOrdered[new Date(Number(k)).toLocaleString()] = countByTimestamps[k];
        }
        data.push({
          name: command,
          data: countByTimestampsOrdered,
        });
      }
      return data;
    };

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
      toggleCommandChart,
      generateChartData,
      showChartCommands,
      mdiMagnify, mdiPlusThick, mdiMinusThick,
      timeRange, ticksLabels,
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
