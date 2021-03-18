<template>
  <div class="d-inline-block">
    <v-menu
      v-model="menu"
      :close-on-content-click="false"
    >
      <template #activator="{ on, attrs }">
        <v-btn
          dark
          v-bind="attrs"
          icon
          v-on="on"
          @click="filterToAdd = ''"
        >
          <v-icon>mdi-variable</v-icon>
        </v-btn>
      </template>

      <v-combobox
        autofocus
        class="ma-2"
        label="Select variable"
        :search-input.sync="filterToAdd"
        :return-object="false"
        :items="filterItems"
        @change="addVariable($event)"
      />
    </v-menu>
  </div>
</template>
<script lang="ts">
import {
  computed, defineComponent, ref,
} from '@vue/composition-api';

import translate from 'src/panel/helpers/translate';

export default defineComponent({
  props: { filters: Array },
  setup(props, ctx) {
    const filterToAdd = ref('');
    const menu = ref(false);

    const globalFilters = [
      'title', 'game', 'viewers', 'views', 'followers',
      'subscribers', 'spotifySong', 'ytSong', 'latestFollower',
      'latestSubscriber', 'latestSubscriberMonths', 'latestSubscriberStreak',
      'latestTipAmount', 'latestTipCurrency', 'latestTipMessage', 'latestTip',
      'toptip.overall.username', 'toptip.overall.amount', 'toptip.overall.currency',
      'toptip.overall.message', 'toptip.stream.username', 'toptip.stream.amount',
      'toptip.stream.currency', 'toptip.stream.message', 'latestCheerAmount', 'latestCheerMessage',
      'latestCheer', 'isBotSubscriber',
    ];

    const filterItems = computed(() => {
      return [...new Set([...globalFilters, ...(props.filters ?? [])])].map(item => ({
        text:     translate('responses.variable.' + item),
        value:    `$${item}`,
        disabled: false,
      }));
    });

    const addVariable = (input: string | null) => {
      if (input === null) {
        return;
      }
      if ([...globalFilters, ...(props.filters ?? [])].includes(input.replace('$', ''))) {
        console.log('add ' + input);
        ctx.emit('input', input);
        menu.value = false;
      }
    };

    return {
      filterItems, filterToAdd, addVariable, menu,
    };
  },
});
</script>

<style>
/* workaround for transparent menu */
.theme--dark .v-menu__content {
  background-color: rgb(30, 30, 30);
}
.theme--light .v-menu__content {
  background-color: #ffffff;
}
</style>