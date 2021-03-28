<template>
  <v-container
    fluid
    :class="{ 'pa-4': !$vuetify.breakpoint.mobile }"
  >
    <v-alert
      v-if="!$systems.find(o => o.name === 'songs').enabled"
      dismissible
      prominent
      dense
    >
      <div class="text-caption">
        {{ translate('this-system-is-disabled') }}
      </div>
    </v-alert>

    <h2 v-if="!$vuetify.breakpoint.mobile">
      {{ translate('menu.bannedsongs') }}
    </h2>

    <v-data-table
      v-model="selected"
      calculate-widths
      hide-default-header
      show-select
      :loading="state.loading !== $state.success"
      :headers="headers"
      :items-per-page="-1"
      item-key="videoId"
      :items="fItems"
    >
      <template #top>
        <v-toolbar
          flat
        >
          <v-text-field
            v-model="search"
            append-icon="mdi-magnify"
            label="Search or add by link/id"
            single-line
            hide-details
            class="pr-2"
          />

          <template v-if="selected.length > 0">
            <v-dialog
              v-model="deleteDialog"
              max-width="500px"
            >
              <template #activator="{ on, attrs }">
                <v-btn
                  color="error"
                  class="mb-2 mr-1"
                  v-bind="attrs"
                  v-on="on"
                >
                  Delete {{ selected.length }} Item(s)
                </v-btn>
              </template>

              <v-card>
                <v-card-title>
                  <span class="headline">Delete {{ selected.length }} Item(s)?</span>
                </v-card-title>

                <v-card-text>
                  <v-data-table
                    dense
                    :items="selected"
                    :headers="headersDelete"
                    hide-default-header
                    hide-default-footer
                  />
                </v-card-text>
                <v-card-actions>
                  <v-spacer />
                  <v-btn
                    text
                    @click="deleteDialog = false"
                  >
                    Cancel
                  </v-btn>
                  <v-btn
                    color="error"
                    text
                    @click="deleteSelected"
                  >
                    Delete
                  </v-btn>
                </v-card-actions>
              </v-card>
            </v-dialog>
          </template>

          <v-btn
            color="primary"
            class="mb-2"
            :disabled="search.length === 0"
            :loading="state.import === 1"
            @click="addSong"
          >
            New Item
          </v-btn>
        </v-toolbar>
      </template>

      <template #[`item.thumbnail`]="{ item }">
        <v-img
          :aspect-ratio="16/9"
          :width="100"
          :src="generateThumbnail(item.videoId)"
        />
      </template>
      <template #[`item.actions`]="{ item }">
        <v-btn
          plain
          :href="'http://youtu.be/' + item.videoId"
          target="_blank"
        >
          <v-icon>
            mdi-link
          </v-icon>
        </v-btn>
      </template>
    </v-data-table>
  </v-container>
</template>

<script lang="ts">
import {
  computed, defineComponent, onMounted, ref,
} from '@vue/composition-api';
import { escapeRegExp, isNil } from 'lodash-es';

import { SongBanInterface } from 'src/bot/database/entity/song';
import { ButtonStates } from 'src/panel/helpers/buttonStates';
import { error } from 'src/panel/helpers/error';
import { EventBus } from 'src/panel/helpers/event-bus';
import { getSocket } from 'src/panel/helpers/socket';
import translate from 'src/panel/helpers/translate';

const socket = getSocket('/systems/songs');

export default defineComponent({
  setup() {
    const items = ref([] as SongBanInterface[]);
    const search = ref('');

    const deleteDialog = ref(false);
    const selected = ref([] as SongBanInterface[]);

    const state = ref({
      loading: ButtonStates.progress,
      import:  ButtonStates.idle,
    } as {
      loading: number;
      import: number;
    });

    const headers = [
      {
        value: 'thumbnail', text: '', align: 'left',
      },
      { value: 'videoId', text: '' },
      { value: 'title', text: '' },
      {
        text: 'Actions', value: 'actions', sortable: false, align: 'end',
      },
    ];

    const headersDelete = [
      { value: 'videoId', text: '' },
      { value: 'title', text: '' },
    ];

    const fItems = computed(() => {
      if (search.value.length === 0) {
        return items.value;
      }
      return items.value.filter((o) => {
        const isSearchInTitle = !isNil(o.title.match(new RegExp(escapeRegExp(search.value), 'ig')));
        const isSearchInVideoId = !isNil(o.videoId.match(new RegExp(escapeRegExp(search.value), 'ig')));
        return isSearchInTitle || isSearchInVideoId;
      });
    });

    onMounted(() => {
      refresh();
    });

    const refresh = () => {
      socket.emit('songs::getAllBanned', {}, (err: string | null, getAllBanned: SongBanInterface[]) => {
        items.value = getAllBanned;
        state.value.loading = ButtonStates.success;
      });
    };

    const generateThumbnail = (videoId: string) => {
      return `https://img.youtube.com/vi/${videoId}/1.jpg`;
    };

    const addSong = () => {
      if (search.value === '') {
        EventBus.$emit('snack', 'red', 'Cannot add empty song to ban list.');
        return;
      }
      if (state.value.import === 0) {
        state.value.import = 1;
        socket.emit('import.ban', search.value, (err: string | null, info: CommandResponse[]) => {
          if (err) {
            search.value = '';
            state.value.import = 0;
            return error(err);
          }
          state.value.import = 0;
          EventBus.$emit('snack', 'success', 'Song added to ban list.');
          refresh();
          search.value = '';
        });
      }
    };

    const deleteSelected = async () => {
      deleteDialog.value = false;
      await Promise.all(
        selected.value.map(async (item) => {
          return new Promise((resolve, reject) => {
            socket.emit('delete.ban', item.videoId, (err: string | null) => {
              if (err) {
                reject(error(err));
              }
              resolve(true);
            });
          });
        }),
      );
      refresh();

      EventBus.$emit('snack', 'success', 'Data removed.');
      selected.value = [];
    };

    return {
      items,
      fItems,
      headers,
      headersDelete,
      state,
      search,

      generateThumbnail,
      addSong,

      translate,
      ButtonStates,

      deleteDialog,
      deleteSelected,
      selected,
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
