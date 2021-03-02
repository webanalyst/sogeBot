<template>
  <v-container
    ref="songrequestsRef"
    style="min-height: 100vh"
  >
    <h2 :class="{ 'pl-6': $store.state.isMobile }">
      {{ translate('song-requests') }}
    </h2>

    <v-text-field
      v-model="search"
      append-icon="mdi-magnify"
      label="Search"
      single-line
      hide-details
    />

    <v-data-table
      hide-default-header
      hide-default-footer
      :search="search"
      :loading="state.loading !== $state.success"
      :headers="headers"
      :items="requests"
      @click:row="linkTo($event)"
    >
      <template #[`item.thumbnail`]="{ item }">
        <v-img
          class="fitThumbnail"
          :src="generateThumbnail(item.videoId)"
        />
      </template>
    </v-data-table>
  </v-container>
</template>

<script lang="ts">
import {
  defineComponent, onMounted, ref, watch,
} from '@vue/composition-api';

import { SongRequestInterface } from 'src/bot/database/entity/song';
import { ButtonStates } from 'src/panel/helpers/buttonStates';
import { getSocket } from 'src/panel/helpers/socket';
import translate from 'src/panel/helpers/translate';

const socket = getSocket('/systems/songs', true);

export default defineComponent({
  setup(props, ctx) {
    const requests = ref([] as SongRequestInterface[]);
    const search = ref('');

    const songrequestsRef = ref(null as Element | null);

    const state = ref({ loading: ButtonStates.progress } as {
      loading: number;
    });

    const headers = [
      {
        value: 'thumbnail', label: '', tdClass: 'fitThumbnail',
      },
      { value: 'title', label: '' },
      { value: 'username', label: '' },
    ];

    watch([search], () => refresh(), { deep: true });

    const moveTo = async () => {
      const scroll = await ctx.root.$vuetify.goTo(songrequestsRef.value as HTMLElement);
      if (!scroll) {
        setTimeout(() => {
          moveTo();
        }, 200);
      }
    };

    onMounted(() => {
      refresh();
      moveTo();
    });
    const refresh = () => {
      state.value.loading = ButtonStates.progress;
      setInterval(() => {
        socket.emit('songs::getAllRequests', {}, (err: string | null, items: SongRequestInterface[]) => {
          console.debug('Loaded', { requests: items });
          requests.value = items;
          state.value.loading = ButtonStates.success;
        });
      }, 2000);
    };

    const generateThumbnail = (videoId: string) => {
      return `https://img.youtube.com/vi/${videoId}/1.jpg`;
    };

    const linkTo = (item: SongRequestInterface) => {
      console.debug('Clicked', item.videoId);
      window.location.href = `http://youtu.be/${item.videoId}`;
    };

    return {
      search,
      generateThumbnail,
      linkTo,
      headers,
      requests,
      songrequestsRef,
      state,
      translate,
    };
  },
});
</script>

<style>
.fitThumbnail {
  width: 100px;
  margin: 2px;
}
</style>
