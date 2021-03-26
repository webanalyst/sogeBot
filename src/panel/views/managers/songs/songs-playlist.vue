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
      {{ translate('menu.playlist') }}
    </h2>

    <v-data-table
      v-model="selected"
      :expanded.sync="expanded"
      calculate-widths
      hide-default-header
      show-select
      :loading="state.loading !== $state.success"
      :headers="headers"
      :items-per-page.sync="perPage"
      :items="fItems"
      :single-expand="true"
      show-expand
      item-key="videoId"
      :page.sync="currentPage"
      :server-items-length.sync="count"
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
                  color="red"
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
                    color="red"
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
            class="mb-2 mr-2"
            :disabled="search.length === 0"
            :loading="state.import === 1"
            @click="addSongOrPlaylist"
          >
            New Item
          </v-btn>
        </v-toolbar>
      </template>

      <template #[`body.prepend`]="{}">
        <tr>
          <td colspan="4" />
          <td>
            <v-select
              v-model="showTag"
              :items="tagsItems"
              clearable
            />
          </td>
          <td colspan="2" />
        </tr>
      </template>

      <template #[`item.title`]="{ item }">
        <div>
          {{ item.title }}
        </div>
        <div>
          <v-icon>mdi-clock-outline</v-icon> {{ item.length | formatTime }}
          <v-icon>mdi-volume-high</v-icon> {{ Number(item.volume).toFixed(1) }}%
          <v-icon>mdi-skip-previous</v-icon> {{ item.startTime | formatTime }} - {{ item.endTime | formatTime }} <v-icon>mdi-skip-next</v-icon>
          <v-icon>mdi-music</v-icon> {{ new Date(item.lastPlayedAt).toLocaleString() }}
        </div>
      </template>

      <template #[`item.tags`]="{ item }">
        <v-chip-group class="d-inline-block">
          <v-chip
            v-for="tag of item.tags"
            :key="tag"
            x-small
            @click="showTag=tag"
          >
            {{ tag }}
          </v-chip>
        </v-chip-group>
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

      <template #expanded-item="{ headers, item }">
        <td
          :colspan="headers.length"
          class="pa-2"
        >
          <v-row>
            <v-col cols="auto">
              <v-btn-toggle
                v-model="item.forceVolume"
              >
                <v-btn :value="false">
                  {{ translate('systems.songs.calculated') }}
                </v-btn>
                <v-btn :value="true">
                  {{ translate('systems.songs.set_manually') }}
                </v-btn>
              </v-btn-toggle>
            </v-col>
            <v-col>
              <v-text-field
                v-model.number="item.volume"
                :label="translate('systems.songs.settings.volume')"
                min="0"
                max="100"
                type="number"
                :rules="rules.volume"
                :disabled="!item.forceVolume"
              />
            </v-col>
          </v-row>
          <v-row>
            <v-col>
              <v-text-field
                v-model.number="item.startTime"
                :label="translate('systems.songs.startTime')"
                min="0"
                :max="Number(item.endTime) - 1"
                type="number"
                :rules="rules.time"
              >
                <template #append>
                  {{ translate('systems.songs.seconds') }}
                </template>
              </v-text-field>
            </v-col>
            <v-col>
              <v-text-field
                v-model.number="item.endTime"
                :label="translate('systems.songs.endTime')"
                :min="Number(item.startTime) + 1"
                :max="item.length"
                type="number"
                :rules="rules.time"
              >
                <template #append>
                  {{ translate('systems.songs.seconds') }}
                </template>
              </v-text-field>
            </v-col>
          </v-row>
          <v-row>
            <v-col>
              <v-combobox
                v-model="item.tags"
                :label="translate('tags')"
                multiple
                :return-object="false"
                :items="tagsItemsWithoutNull"
                @input="ensureGeneralTag(item)"
              >
                <template #no-data>
                  <v-list-item>
                    <span class="subheading">Add new tag</span>
                  </v-list-item>
                </template>
              </v-combobox>
            </v-col>
          </v-row>

          <v-btn
            color="primary"
            :loading="state.save !== 0"
            @click="updateItem(item.videoId)"
          >
            Save
          </v-btn>
        </td>
      </template>
    </v-data-table>
  </v-container>
</template>

<script lang="ts">

import { library } from '@fortawesome/fontawesome-svg-core';
import { faStepBackward, faStepForward } from '@fortawesome/free-solid-svg-icons';
import {
  computed, defineComponent, onMounted, ref, watch,
} from '@vue/composition-api';

import { SongPlaylistInterface } from 'src/bot/database/entity/song';
import { ButtonStates } from 'src/panel/helpers/buttonStates';
import { error } from 'src/panel/helpers/error';
import { EventBus } from 'src/panel/helpers/event-bus';
import { getSocket } from 'src/panel/helpers/socket';
import translate from 'src/panel/helpers/translate';
import {
  maxValue, minValue, required, 
} from 'src/panel/helpers/validators';

library.add(faStepBackward, faStepForward);
const socket = getSocket('/systems/songs');

export default defineComponent({
  filters: {
    formatTime(seconds: number) {
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      const s = seconds % 60;
      return [
        h,
        m > 9 ? m : (h ? '0' + m : m || '0'),
        s > 9 ? s : '0' + s,
      ].filter(a => a).join(':');
    },
  },
  setup() {
    const items = ref([] as SongPlaylistInterface[]);
    const search = ref('');

    const deleteDialog = ref(false);
    const selected = ref([] as SongPlaylistInterface[]);
    const expanded = ref([] as SongPlaylistInterface[]);

    const state = ref({
      loading: ButtonStates.progress,
      import:  ButtonStates.idle,
      save:    ButtonStates.idle,
    } as {
      loading: number;
      import: number;
      save: number;
    });
    const showTag = ref(null as string | null); // null === all
    const currentTag = ref('general');
    const tags = ref([] as string[]);
    const tagsItems = computed(() => {
      return [{ text: 'All playlists', value: null }, ...tags.value.map((item) => ({
        text:     currentTag.value === item ? `${item} (current)` : item,
        value:    item,
        disabled: false,
      }))];
    });
    const tagsItemsWithoutNull = computed(() => {
      const [, ...rest] = tagsItems.value;
      return rest;
    });

    const rules = {
      time:   [required],
      volume: [required, minValue(0), maxValue(100)],
    };

    const headers = [
      {
        value: 'thumbnail', text: '', align: 'left',
      },
      { value: 'videoId', text: '' },
      { value: 'title', text: '' },
      { value: 'tags', text: '' },
      {
        text: 'Actions', value: 'actions', sortable: false, align: 'end', 
      },
      { text: '', value: 'data-table-expand' },
    ];

    const headersDelete = [
      { value: 'videoId', text: '' },
      { value: 'title', text: '' },
    ];

    const currentPage = ref(1);
    const count = ref(0);
    const perPage = ref(15);
    const fItems = computed(() => items.value);

    onMounted(() => {
      refresh();
    });

    watch(showTag, () => {
      currentPage.value = 1;
      refresh();
    });

    watch([currentPage, search, perPage], () => {
      refresh();
    });

    const refresh = async () => {
      await Promise.all([
        new Promise<void>((resolve, reject) => {
          socket.emit('current.playlist.tag', (err: string | null, tag: string) => {
            if (err) {
              error(err);
              reject(err);
            }
            currentTag.value = tag;
            resolve();
          });
        }),
        new Promise<void>((resolve, reject) => {
          socket.emit('get.playlist.tags', (err: string | null, _tags: string[]) => {
            if (err) {
              error(err);
              reject(err);
            }
            tags.value = [..._tags];
            resolve();
          });
        }),
        new Promise<void>((resolve, reject) => {
          socket.emit('find.playlist', {
            page: (currentPage.value - 1), search: search.value, tag: showTag.value, perPage: perPage.value,
          }, (err: string | null, _items: SongPlaylistInterface[], _count: number) => {
            if (err) {
              error(err);
              reject(err);
            }
            for (const item of _items) {
              item.startTime = item.startTime ? item.startTime : 0;
              item.endTime = item.endTime ? item.endTime : item.length;
            }
            count.value = _count;
            items.value = _items;
            resolve();
          });
        }),
      ]);
      state.value.loading = ButtonStates.success;
      if (showTag.value && !tags.value.includes(showTag.value)) {
        showTag.value = null;
      }
    };

    const generateThumbnail = (videoId: string) => {
      return `https://img.youtube.com/vi/${videoId}/1.jpg`;
    };

    const addSongOrPlaylist = () => {
      if (search.value === '') {
        EventBus.$emit('snack', 'red', 'Cannot add empty song to ban list.');
        return;
      }
      if (state.value.import === 0) {
        state.value.import = 1;
        socket.emit(search.value.includes('playlist') ? 'import.playlist' : 'import.video', { playlist: search.value, forcedTag: showTag.value }, (err: string | null, info: (CommandResponse)[]) => {
          if (err) {
            search.value = '';
            state.value.import = 0;
            return error(err);
          } else {
            state.value.import = 0;
            refresh();
            search.value = '';
            EventBus.$emit('snack', 'success', 'Song added to playlist.');
          }
        });
      }
    };

    const updateItem = (videoId: string) => {
      state.value.save = 1;

      const item = items.value.find((o) => o.videoId === videoId);
      if (item) {
        item.volume = Number(item.volume);
        item.startTime = Number(item.startTime);
        item.endTime = Number(item.endTime);
        socket.emit('songs::save', item, (err: string | null) => {
          if (err) {
            console.error(err);
            return state.value.save = 3;
          }
          state.value.save = 2;
          refresh();
          setTimeout(() => {
            state.value.save = 0;
          }, 1000);
        });
      }
    };

    const deleteSelected = async () => {
      deleteDialog.value = false;
      await Promise.all(
        selected.value.map(async (item) => {
          return new Promise((resolve, reject) => {
            socket.emit('delete.playlist', item.videoId, (err: string | null) => {
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

    const ensureGeneralTag = (item: SongPlaylistInterface) => {
      if (item.tags.length === 0) {
        item.tags = ['general'];
      }
    };

    return {
      items,
      fItems,
      headers,
      headersDelete,
      search,
      state,
      showTag,
      currentTag,
      tagsItems,
      tagsItemsWithoutNull,
      tags,
      perPage,
      currentPage,
      count,

      generateThumbnail,
      addSongOrPlaylist,
      updateItem,

      ButtonStates,
      translate,

      deleteDialog,
      deleteSelected,
      selected,
      expanded,
      rules,
      ensureGeneralTag,
    };
  },
});
</script>

<style>
.table-p-0 td {
  padding: 0 !important;
}
.fitThumbnail {
  width: 100px;
}
</style>
