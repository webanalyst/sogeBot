<template>
  <v-container
    fluid
    :class="{ 'pa-4': !$vuetify.breakpoint.mobile }"
  >
    <v-alert
      v-if="!$systems.find(o => o.name === 'highlights').enabled"
      dismissible
      prominent
      dense
    >
      <div class="text-caption">
        {{ translate('this-system-is-disabled') }}
      </div>
    </v-alert>

    <h2 v-if="!$vuetify.breakpoint.mobile">
      {{ translate('menu.highlights') }}
    </h2>

    <v-data-table
      v-model="selected"
      calculate-widths
      hide-default-header
      show-select
      :loading="state.loading !== $state.success"
      :headers="headers"
      sort-by="createdAt"
      :sort-desc="true"
      :items-per-page="-1"
      :items="fItems"
    >
      <template #top>
        <v-toolbar
          flat
        >
          <v-text-field
            v-model="search"
            append-icon="mdi-magnify"
            label="Search"
            single-line
            hide-details
            class="pr-2"
          />

          <v-btn
            color="error"
            class="mb-2 mr-1"
            @click="deleteExpired"
          >
            Delete Expired
          </v-btn>

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
                  >
                    <template #[`item.timestamp`]="{ item }">
                      {{ timestampToString(item.timestamp) }}
                    </template>
                    <template #[`item.createdAt`]="{ item }">
                      {{ dayjs(item.createdAt).format('LL') }} {{ dayjs(item.createdAt).format('LTS') }}
                    </template>
                    <template #[`item.expired`]="{ item }">
                      <span
                        v-if="item.expired"
                        class="green--text text--lighten-1"
                      >Available</span>
                      <span
                        v-else
                        class="red--text text--lighten-1"
                      >Expired</span>
                    </template>
                  </v-data-table>
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
        </v-toolbar>
      </template>

      <template #[`item.thumbnail`]="{ item }">
        <v-img
          :aspect-ratio="16/9"
          :width="60"
          :src="generateThumbnail(item.game)"
        />
      </template>
      <template #[`item.actions`]="{ item }">
        <v-btn
          v-if="!item.expired"
          plain
          :href="'https://www.twitch.tv/videos/' + item.videoId + '?t=' + timestampToString(item.timestamp)"
          target="_blank"
        >
          <v-icon>
            mdi-link
          </v-icon>
        </v-btn>
        <span
          v-else
          class="red--text text--lighten-1"
        >Expired</span>
      </template>
      <template #[`item.timestamp`]="{ item }">
        {{ timestampToString(item.timestamp) }}
      </template>
      <template #[`item.createdAt`]="{ item }">
        {{ dayjs(item.createdAt).format('LL') }} {{ dayjs(item.createdAt).format('LTS') }}
      </template>
    </v-data-table>
  </v-container>
</template>

<script lang="ts">

import {
  computed, defineComponent, onMounted, ref,
} from '@vue/composition-api';
import { escapeRegExp, isNil } from 'lodash-es';

import { dayjs } from 'src/bot/helpers/dayjs';
import { ButtonStates } from 'src/panel/helpers/buttonStates';
import { error } from 'src/panel/helpers/error';
import { EventBus } from 'src/panel/helpers/event-bus';
import { getSocket } from 'src/panel/helpers/socket';
import translate from 'src/panel/helpers/translate';

import { HighlightInterface } from '../../../bot/database/entity/highlight';

const socket = getSocket('/systems/highlights');

export default defineComponent({
  setup() {
    const items = ref([] as HighlightInterface[]);
    const search = ref('');

    const fItems = computed(() => {
      if (search.value.length === 0) {
        return items.value;
      }
      return items.value.filter((o) => {
        const title = !isNil(o.title.match(new RegExp(escapeRegExp(search.value), 'ig')));
        const game = !isNil(o.game.match(new RegExp(escapeRegExp(search.value), 'ig')));
        return title || game;
      });
    });

    const deleteDialog = ref(false);
    const selected = ref([] as HighlightInterface[]);

    const state = ref({ loading: ButtonStates.progress } as {
      loading: number;
    });

    const headers = [
      {
        value: 'thumbnail', text: '', align: 'left',
      },
      { value: 'game', text: '' },
      { value: 'title', text: '' },
      { value: 'createdAt', text: '' },
      { value: 'timestamp', text: '' },
      {
        text: 'Actions', value: 'actions', sortable: false, align: 'end',
      },
    ];

    const headersDelete = [
      { value: 'game', text: '' },
      { value: 'timestamp', text: '' },
      { value: 'createdAt', text: '' },
      { value: 'title', text: '' },
    ];

    onMounted(() => {
      refresh();
    });

    const refresh = async () => {
      socket.emit('generic::getAll', (err: string | null, _items: HighlightInterface[]) => {
        if (err) {
          return error(err);
        }
        console.debug({ _items });
        items.value = _items;
        state.value.loading = ButtonStates.success;
      });
    };

    const timestampToString = (value: { hours: number; minutes: number; seconds: number }) => {
      const string = (value.hours ? `${value.hours}h` : '')
        + (value.minutes ? `${value.minutes}m` : '')
        + (value.seconds ? `${value.seconds}s` : '');
      return string;
    };

    const deleteExpired = async () => {
      await Promise.all(
        items.value.filter(o => o.expired).map(async (item) => {
          console.debug('Deleting', item);
          return new Promise((resolve, reject) => {
            socket.emit('generic::deleteById', item.id, (err: string | null) => {
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
    };

    const deleteSelected = async () => {
      deleteDialog.value = false;
      await Promise.all(
        selected.value.map(async (item) => {
          console.debug('Deleting', item);
          return new Promise((resolve, reject) => {
            socket.emit('generic::deleteById', item.id, (err: string | null) => {
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

    const generateThumbnail = (game: string) => {
      const template = 'https://static-cdn.jtvnw.net/ttv-boxart/./%{game}-60x80.jpg';
      return template.replace('%{game}', encodeURI(game));
    };

    return {
      items,
      fItems,
      headers,
      headersDelete,
      state,
      search,

      generateThumbnail,
      timestampToString,

      translate,
      ButtonStates,

      deleteDialog,
      deleteSelected,
      deleteExpired,
      selected,

      dayjs,
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
