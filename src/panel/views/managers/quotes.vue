<template>
  <v-container
    fluid
    :class="{ 'pa-4': !$vuetify.breakpoint.mobile }"
  >
    <v-alert
      v-if="!$systems.find(o => o.name === 'quotes').enabled"
      dismissible
      prominent
      dense
    >
      <div class="text-caption">
        {{ translate('this-system-is-disabled') }}
      </div>
    </v-alert>

    <h2 v-if="!$vuetify.breakpoint.mobile">
      {{ translate('menu.quotes') }}
    </h2>

    <v-data-table
      v-model="selected"
      calculate-widths
      show-select
      :search="search"
      :loading="state.loading !== $state.success"
      :headers="headers"
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
            :clearable="true"
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

          <v-dialog
            v-model="newDialog"
            max-width="500px"
          >
            <template #activator="{ on, attrs }">
              <v-btn
                color="primary"
                class="mb-2"
                v-bind="attrs"
                v-on="on"
              >
                New item
              </v-btn>
            </template>

            <v-card>
              <v-card-title>
                <span class="headline">New item</span>
              </v-card-title>

              <v-card-text :key="timestamp">
                <new-item
                  :rules="rules"
                  :tags="tagsItemsWithoutNull"
                  @close="newDialog = false"
                  @save="saveSuccess"
                />
              </v-card-text>
            </v-card>
          </v-dialog>
        </v-toolbar>
      </template>

      <template #[`item.quote`]="{ item }">
        <v-edit-dialog
          persistent
          large
          :return-value.sync="item.quote"
          @save="update(item, false, 'quote')"
        >
          {{ item.quote }}
          <template #input>
            <v-lazy>
              <v-textarea
                v-model="item.quote"
                hide-details="auto"
                :label="capitalize(translate('systems.quotes.quote.name'))"
                :rows="1"
                counter
                auto-grow
                @keydown.enter.prevent
              />
            </v-lazy>
          </template>
        </v-edit-dialog>
      </template>

      <template #[`item.createdAt`]="{ item }">
        {{ dayjs(item.createdAt).format('LL') }} {{ dayjs(item.createdAt).format('LTS') }}
      </template>

      <template #[`item.quotedByName`]="{ item }">
        <router-link :to="{ name: 'viewersManagerEdit', params: { id: item.quotedBy }}">
          {{ item.quotedByName }}&nbsp;<small>{{ item.quotedBy }}</small>
        </router-link>
      </template>

      <template #[`item.tags`]="{ item }">
        <v-row
          no-gutters
          dense
        >
          <v-col cols="auto">
            <v-chip-group>
              <v-chip
                v-for="tag of item.tags"
                :key="tag"
                x-small
                @click="showTag=tag"
              >
                {{ tag }}
              </v-chip>
            </v-chip-group>
          </v-col>
          <v-col cols="auto">
            <v-edit-dialog
              persistent
              large
              :return-value.sync="item.tags"
              @save="update(item, false, 'tags')"
            >
              <v-icon
                small
                class="pa-2"
                @click="tagsSearch = ''"
              >
                mdi-tag-plus
              </v-icon>
              <template #input>
                <v-combobox
                  v-model="item.tags"
                  hide-selected
                  small-chips
                  clearable
                  :search-input.sync="tagsSearch"
                  :return-object="false"
                  multiple
                  dense
                  :items="tagsItemsWithoutNull"
                >
                  <template #no-data>
                    <v-list-item>
                      <span class="subheading">Add new tag</span>
                      <strong class="pl-2">{{ tagsSearch }}</strong>
                    </v-list-item>
                  </template>
                </v-combobox>
              </template>
            </v-edit-dialog>
          </v-col>
        </v-row>
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
    </v-data-table>
  </v-container>
</template>

<script lang="ts">
import {
  computed, defineAsyncComponent, defineComponent, onMounted, ref,
} from '@vue/composition-api';
import {
  capitalize, flatten, orderBy, uniq,
} from 'lodash-es';

import { QuotesInterface } from 'src/bot/database/entity/quotes';
import { dayjs } from 'src/bot/helpers/dayjs';
import { ButtonStates } from 'src/panel/helpers/buttonStates';
import { error } from 'src/panel/helpers/error';
import { EventBus } from 'src/panel/helpers/event-bus';
import { getSocket } from 'src/panel/helpers/socket';
import translate from 'src/panel/helpers/translate';
import { required } from 'src/panel/helpers/validators';

const socket = getSocket('/systems/quotes');

export default defineComponent({
  components: { 'new-item': defineAsyncComponent({ loader: () => import('./components/new-item/quotes-newItem.vue') }) },
  setup(props, ctx) {
    const timestamp = ref(Date.now());

    const selected = ref([] as QuotesInterface[]);
    const deleteDialog = ref(false);
    const newDialog = ref(false);

    const saveSuccess = () => {
      refresh();
      EventBus.$emit('snack', 'success', 'Data updated.');
      newDialog.value = false;
    };

    const rules = { quote: [required] };

    const items = ref([] as QuotesInterface[]);
    const search = ref('');
    const showTag = ref(null as null | string);
    const tagsSearch = ref('');

    const headers = [
      {
        value: 'id', text: '', sortable: true,
      },
      {
        value: 'createdAt', text: translate('systems.quotes.date.name'), sortable: true,
      },
      {
        value: 'quote', text: translate('systems.quotes.quote.name'), sortable: true,
      },
      {
        value: 'tags', text: translate('systems.quotes.tags.name'), sortable: false,
      },
      {
        value: 'quotedByName', text: translate('systems.quotes.by.name'), sortable: true,
      },
    ];

    const headersDelete = [
      {
        value: 'quote', text: translate('systems.quotes.quote.name'), sortable: true,
      },
      {
        value: 'quotedByName', text: translate('systems.quotes.by.name'), sortable: true,
      },
    ];

    const state = ref({ loading: ButtonStates.progress } as {
      loading: number,
    });

    onMounted(() => {
      refresh();
    });

    const refresh = () => {
      socket.emit('quotes:getAll', {}, async (err: string | null, data: QuotesInterface[]) => {
        items.value = data;
        state.value.loading = ButtonStates.success;
      });
    };

    const fItems = computed(() => {
      let quotesFilteredBySearch: QuotesInterface[] = [];
      if (search.value.trim().length > 0) {
        for (const quote of items.value) {
          if (quote.quote.toLowerCase().includes(search.value)) {
            quotesFilteredBySearch.push(quote);
          }
        }
      } else {
        quotesFilteredBySearch = items.value;
      }
      if (showTag.value === null) {
        return quotesFilteredBySearch;
      } else {
        const quotesFilteredByTags: QuotesInterface[] = [];
        for (const quote of quotesFilteredBySearch) {
          for (const tag of quote.tags) {
            if (showTag.value === tag) {
              quotesFilteredByTags.push(quote);
              break;
            }
          }
        }
        return quotesFilteredByTags;
      }
    });

    const tags = computed(() => {
      const _tags: string[][] = [];
      for (const quote of items.value) {
        _tags.push(quote.tags);
      }
      return orderBy(uniq(flatten(_tags)));
    });
    const tagsItems = computed(() => {
      return [{ text: 'Not filtered', value: null }, ...tags.value.map((item) => ({
        text:     item,
        value:    item,
        disabled: false,
      }))];
    });
    const tagsItemsWithoutNull = computed(() => {
      const [, ...rest] = tagsItems.value;
      return rest;
    });

    const update = async (item: typeof items.value[number], multi = false, attr: keyof typeof items.value[number]) => {
      // check validity
      for (const key of Object.keys(rules)) {
        for (const rule of (rules as any)[key]) {
          const ruleStatus = rule((item as any)[key]);
          if (ruleStatus === true) {
            continue;
          } else {
            EventBus.$emit('snack', 'red', `[${key}] - ${ruleStatus}`);
            refresh();
            return;
          }
        }
      }

      await Promise.all(
        [item, ...(multi ? selected.value : [])].map(async (itemToUpdate) => {
          return new Promise((resolve) => {
            console.log('Updating', { itemToUpdate }, { attr, value: item[attr] });
            socket.emit('generic::setById', {
              id:   itemToUpdate.id, item: {
                ...itemToUpdate,
                [attr]: item[attr], // save new value for all selected items
              },
            }, () => {
              resolve(true);
            });
          });
        }),
      );
      refresh();
      EventBus.$emit('snack', 'success', 'Data updated.');
    };

    const deleteSelected = async () => {
      deleteDialog.value = false;
      await Promise.all(
        selected.value.map(async (item) => {
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

    return {
      items,
      fItems,
      tags,
      tagsItems,
      tagsItemsWithoutNull,
      headers,
      headersDelete,
      state,
      search,
      update,
      showTag,
      capitalize,
      tagsSearch,

      newDialog,
      deleteDialog,
      deleteSelected,
      selected,
      timestamp,
      saveSuccess,
      rules,

      dayjs,
      translate,
    };
  },
});
</script>
