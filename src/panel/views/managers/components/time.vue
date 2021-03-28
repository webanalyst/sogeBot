<template>
  <v-row
    justify="space-between"
    style="max-width: 300px"
    dense
    no-gutters
  >
    <v-col
      cols="12"
      md="4"
      class="px-1"
    >
      <v-text-field
        v-model.number="hours"
        type="number"
        single-line
        suffix="h"
      />
    </v-col>
    <v-col
      cols="12"
      md="4"
      class="px-1"
    >
      <v-text-field
        v-model.number="minutes"
        type="number"
        single-line
        suffix="m"
      />
    </v-col>
    <v-col
      cols="12"
      md="4"
      class="px-1"
    >
      <v-text-field
        v-model.number="seconds"
        type="number"
        single-line
        suffix="s"
      />
    </v-col>
  </v-row>
</template>

<script lang="ts">
import {
  defineComponent, ref, watch, 
} from '@vue/composition-api';

import {
  HOUR, MINUTE, SECOND, 
} from 'src/bot/constants';

export default defineComponent({
  model: {
    prop:  'value',
    event: 'change',
  },
  props: { value: Number },
  setup(props, ctx) {
    const value = props.value ?? 0;
    const hours = ref(Math.floor(value / HOUR));
    const minutes = ref(Math.floor(value / MINUTE) % 60);
    const seconds = ref(Math.floor((props.value ?? 0) / SECOND) % 60);

    watch([hours, minutes, seconds], () => {
      if (hours.value < 0) {
        hours.value = 0;
        return;
      }
      if (minutes.value < 0) {
        minutes.value = 0;
        return;
      }
      if (seconds.value < 0) {
        seconds.value = 0;
        return;
      }

      if (seconds.value > 59) {
        seconds.value = 0;
        minutes.value++;
        return;
      }

      if (minutes.value > 59) {
        minutes.value = 0;
        hours.value++;
        return;
      }
      ctx.emit('change', (hours.value * HOUR) + (minutes.value * MINUTE) + (seconds.value * SECOND));
    });
    return {
      hours, minutes, seconds, 
    };
  },
});
</script>
