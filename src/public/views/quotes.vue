<template>
  <v-container
    ref="quotesRef"
    style="min-height: 100vh"
  >
    <h2 v-if="!$vuetify.breakpoint.mobile">
      {{ translate('menu.quotes') }}
    </h2>

    <v-text-field
      v-model="search"
      :append-icon="mdiMagnify"
      label="Search"
      single-line
      hide-details
    />

    <v-data-table
      :loading="state.loading !== $state.success"
      :headers="headers"
      :search="search"
      :items="items"
    >
      <template #[`item.createdAt`]="{ item }">
        {{ dayjs(item.createdAt).format('LL') }} {{ dayjs(item.createdAt).format('LTS') }}
      </template>
      <template #[`item.tags`]="{ item }">
        <v-chip
          v-for="tag of item.tags"
          :key="tag"
          small
          color="orange"
          class="ma-1"
        >
          {{ tag }}
        </v-chip>
      </template>
    </v-data-table>
  </v-container>
</template>

<script lang="ts">
import { mdiMagnify } from '@mdi/js';
import {
  defineComponent, onMounted, ref,
} from '@vue/composition-api';

import { QuotesInterface } from 'src/bot/database/entity/quotes';
import { dayjs } from 'src/bot/helpers/dayjs';
import { ButtonStates } from 'src/panel/helpers/buttonStates';
import { getSocket } from 'src/panel/helpers/socket';
import translate from 'src/panel/helpers/translate';

const socket = getSocket('/systems/quotes', true);
export default defineComponent({
  setup(props, ctx) {
    const items = ref([] as QuotesInterface[]);
    const quotesRef = ref(null as Element | null);
    const search = ref('');

    const state = ref({ loading: ButtonStates.progress } as {
      loading: number;
    });

    const headers = [
      { value: 'createdAt', text: translate('systems.quotes.date.name') },
      { value: 'quote', text: translate('systems.quotes.quote.name') },
      { value: 'tags', text: translate('systems.quotes.tags.name') },
      { value: 'quotedByName', text: translate('systems.quotes.by.name') },
    ];

    const moveTo = async () => {
      const scroll = await ctx.root.$vuetify.goTo(quotesRef.value as HTMLElement);
      if (!scroll) {
        setTimeout(() => {
          moveTo();
        }, 200);
      }
    };

    onMounted(() => {
      state.value.loading = ButtonStates.progress;
      socket.emit('quotes:getAll', {}, (err: string | null, itemsGetAll: QuotesInterface[]) => {
        console.debug('Loaded', { items });
        items.value = itemsGetAll;
        state.value.loading = ButtonStates.success;
      });
      moveTo();
    });

    return {
      dayjs,
      search,
      headers,
      items,
      state,
      translate,
      quotesRef,
      mdiMagnify,
    };
  },
});
</script>