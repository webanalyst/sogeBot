<template>
  <v-snackbar
    v-model="snack"
    :timeout="3000"
    :color="snackColor"
  >
    {{ snackText }}

    <template #action="{ attrs }">
      <v-btn
        v-bind="attrs"
        text
        @click="snack = false"
      >
        Close
      </v-btn>
    </template>
  </v-snackbar>
</template>

<script lang="ts">
import {
  defineComponent, onMounted, ref,
} from '@vue/composition-api';

import { EventBus } from '../helpers/event-bus';

export default defineComponent({
  setup(props, ctx) {
    const snack = ref(false);
    const snackColor = ref('');
    const snackText = ref('');

    onMounted(() => {
      EventBus.$on('snack', (color: string, text:string) => {
        snack.value = true;
        snackColor.value = color;
        snackText.value = text;
      });
    });

    return {
      snack,
      snackColor,
      snackText,
    };
  },
});
</script>