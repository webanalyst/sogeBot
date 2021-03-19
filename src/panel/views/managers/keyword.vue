<template>
  <v-container
    fluid
    :class="{ 'pa-4': !$vuetify.breakpoint.mobile }"
  >
    <v-alert
      v-if="!$systems.find(o => o.name === 'keywords').enabled"
      dismissible
      prominent
      dense
    >
      <div class="text-caption">
        {{ translate('this-system-is-disabled') }}
      </div>
    </v-alert>

    <h2 v-if="!$vuetify.breakpoint.mobile">
      {{ translate('menu.keywords') }}
    </h2>

    <v-data-table
      v-model="selected"
      calculate-widths
      show-select
      :search="search"
      :loading="state.loading !== $state.success && state.loadingPrm !== $state.success"
      :headers="headers"
      :items-per-page="-1"
      :items="items"
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
                New Item
              </v-btn>
            </template>

            <v-card>
              <v-card-title>
                <span class="headline">New item</span>
              </v-card-title>

              <v-card-text :key="timestamp">
                <command-new-item
                  @close="newDialog = false"
                  @save="saveSuccess"
                />
              </v-card-text>
            </v-card>
          </v-dialog>
        </v-toolbar>
      </template>

      <template #[`item.keyword`]="{ item }">
        <v-edit-dialog
          persistent
          large
          :return-value.sync="item.keyword"
          @save="update(item, false, 'keyword')"
        >
          {{ item.keyword }}
          <template #input>
            <v-text-field
              v-model="item.keyword"
              :rules="rules.keyword"
              single-line
              counter
            />
          </template>
        </v-edit-dialog>
      </template>

      <template #[`item.enabled`]="{ item }">
        <v-simple-checkbox
          v-model="item.enabled"
          @click="update(item, true, 'enabled')"
        />
      </template>

      <template #[`item.response`]="{ item }">
        <v-edit-dialog
          persistent
          large
          :return-value.sync="item.responses"
          @cancel="refresh"
          @save="update(item, false, 'responses')"
        >
          <span
            v-if="item.responses.length === 0"
            class="text--lighten-1  red--text"
          >{{ translate('systems.customcommands.no-responses-set') }}</span>
          <template v-for="(r, i) of orderBy(item.responses)">
            <div
              :key="i"
            >
              <v-divider
                v-if="i > 0"
                class="ma-2"
              />
              <v-row>
                <v-col
                  cols="auto"
                  class="caption"
                  style="line-height: 2.5rem;"
                >
                  {{ translate('response') }}#{{ i + 1 }}
                </v-col>
                <v-col
                  cols="auto"
                  class="caption"
                  style="line-height: 2.5rem;"
                >
                  <v-icon>mdi-key</v-icon>
                  {{ getPermissionName(r.permission, permissions) }}
                </v-col>
                <v-col
                  cols="auto"
                  class="caption"
                  style="line-height: 2.5rem;"
                >
                  <v-icon v-if="r.stopIfExecuted">
                    mdi-pause
                  </v-icon>
                  <v-icon v-else>
                    mdi-play
                  </v-icon>
                  {{ r.stopIfExecuted ? translate('commons.stop-if-executed') : translate('commons.continue-if-executed') }}
                </v-col>
                <v-col
                  v-if="r.filter.length > 0"
                  cols="auto"
                  class="caption"
                  style="line-height: 2.5rem;"
                >
                  <v-icon>
                    mdi-filter
                  </v-icon>
                  <text-with-tags
                    class="d-inline-block"
                    :value="r.filter"
                  />
                </v-col>
              </v-row>
              <text-with-tags :value="r.response" />
            </div>
          </template>

          <template #input>
            <draggable
              v-model="item.responses"
              draggable=".item"
              handle=".handle"
            >
              <v-list-item
                v-for="(r, i) of item.responses"
                :key="item.id + '-response' + i"
                class="item"
              >
                <v-list-item-content>
                  <v-row>
                    <v-col
                      cols="12"
                      md="8"
                    >
                      <v-lazy>
                        <v-textarea
                          v-model="item.responses[i].response"
                          hide-details="auto"
                          :label="translate('response') + '#' + (i + 1)"
                          :rows="1"
                          counter
                          auto-grow
                          :autofocus="i === 0"
                          @keydown.enter.prevent
                        >
                          <template #prepend>
                            <v-icon class="handle">
                              mdi-drag
                            </v-icon>
                          </template>
                          <template #append>
                            <input-variables
                              :filters="['sender', 'param', '!param', 'touser']"
                              @input="item.responses[i].response = item.responses[i].response + $event"
                            />
                          </template>
                          <template #append-outer>
                            <input-permissions
                              :permissions="permissions"
                              :permission="item.responses[i].permission"
                              @input="item.responses[i].permission = $event"
                            />
                            <v-btn
                              small
                              plain
                              @click="item.responses[i].stopIfExecuted = !item.responses[i].stopIfExecuted"
                            >
                              {{ item.responses[i].stopIfExecuted ? translate('commons.stop-if-executed') : translate('commons.continue-if-executed') }}
                            </v-btn>
                          </template>
                        </v-textarea>
                      </v-lazy>
                    </v-col>
                    <v-col
                      cols="12"
                      md="4"
                    >
                      <v-lazy>
                        <v-textarea
                          v-model="item.responses[i].filter"
                          hide-details="auto"
                          :label="capitalize(translate('systems.customcommands.filter.name'))"
                          :rows="1"
                          counter
                          auto-grow
                          @keydown.enter.prevent
                        >
                          <template #append>
                            <input-variables
                              :filters="['sender', 'source', 'param', 'haveParam', 'is.moderator', 'is.subscriber', 'is.vip', 'is.follower', 'is.broadcaster', 'is.bot', 'is.owner', 'rank', 'game', 'language', 'title', 'views', 'followers', 'subscribers', 'isBotSubscriber']"
                              @input="item.responses[i].filter = item.responses[i].filter + $event"
                            />
                          </template>
                          <template #append-outer>
                            <v-btn
                              icon
                              @click:append-outer="item.responses.splice(i, 1)"
                            >
                              <v-icon>mdi-trash-can</v-icon>
                            </v-btn>
                          </template>
                        </v-textarea>
                      </v-lazy>
                    </v-col>
                  </v-row>
                </v-list-item-content>
              </v-list-item>
            </draggable>
            <v-btn @click="item.responses.push({ filter: '', order: item.responses.length, response: '', stopIfExecuted: false, permission: orderBy(permissions, 'order', 'asc').pop().id })">
              {{ translate('systems.customcommands.addResponse') }}
            </v-btn>
          </template>
        </v-edit-dialog>
      </template>
    </v-data-table>
  </v-container>
</template>

<script lang="ts">
import {
  defineAsyncComponent, defineComponent, onMounted, ref,
} from '@vue/composition-api';
import { orderBy } from 'lodash-es';
import { capitalize } from 'lodash-es';
import draggable from 'vuedraggable';

import type { KeywordInterface } from 'src/bot/database/entity/keyword';
import type { PermissionsInterface } from 'src/bot/database/entity/permissions';
import { ButtonStates } from 'src/panel/helpers/buttonStates';
import { error } from 'src/panel/helpers/error';
import { EventBus } from 'src/panel/helpers/event-bus';
import translate from 'src/panel/helpers/translate';
import {
  isValidRegex, minLength, required,
} from 'src/panel/helpers/validators';

import { getPermissionName } from '../../helpers/getPermissionName';
import { getSocket } from '../../helpers/socket';

const socket = {
  permission: getSocket('/core/permissions'),
  keyword:    getSocket('/systems/keywords'),
} as const;

export default defineComponent({
  components: {
    draggable,
    commandNewItem:      defineAsyncComponent({ loader: () => import('./components/new-item/keyword-newItem.vue') }),
    'input-variables':   defineAsyncComponent({ loader: () => import('../../components/inputVariables.vue') }),
    'input-permissions': defineAsyncComponent({ loader: () => import('../../components/inputPermissions.vue') }),
    'text-with-tags':    defineAsyncComponent({ loader: () => import('../../components/textWithTags.vue') }),
  },
  setup(props, ctx) {
    const search = ref('');
    const items = ref([] as Required<KeywordInterface>[]);
    const permissions = ref([] as Required<PermissionsInterface>[]);

    const timestamp = ref(Date.now());
    const selected = ref([] as KeywordInterface[]);
    const deleteDialog = ref(false);
    const newDialog = ref(false);

    const rules = {
      keyword: [
        minLength(2), required, isValidRegex,
      ],
    };

    const state = ref({
      loadingPrm: ButtonStates.progress,
      loading:    ButtonStates.progress,
      save:       ButtonStates.idle,
    } as {
      loadingPrm: number;
      loading: number;
      save: number;
    });

    const headers = [
      { value: 'keyword', text: translate('keyword') },
      {
        value: 'enabled', text: translate('enabled'), width: '6rem',
      },
      {
        value: 'response', text: translate('response'), sortable: false,
      },
    ];

    const headersDelete = [
      { value: 'keyword', text: translate('keyword') },
    ];

    const refresh = () => {
      socket.permission.emit('permissions', (err: string | null, data: Readonly<Required<PermissionsInterface>>[]) => {
        if(err) {
          return error(err);
        }
        permissions.value = data;
        state.value.loadingPrm = ButtonStates.success;
      });
      socket.keyword.emit('generic::getAll', (err: string | null, keywordsGetAll: Required<KeywordInterface>[] ) => {
        if (err) {
          return error(err);
        }
        console.debug({ keywordsGetAll });
        items.value.length = 0;
        for (const keyword of keywordsGetAll) {
          items.value.push({
            ...keyword,
            responses: orderBy(keyword.responses, 'order', 'asc'),
          });
        }

        // we also need to reset selection values
        if (selected.value.length > 0) {
          selected.value.forEach((selectedItem, index) => {
            selectedItem = items.value.find(o => o.id === selectedItem.id) || selectedItem;
            selected.value[index] = selectedItem;
          });
        }

        state.value.loading = ButtonStates.success;
      });
    };

    onMounted(() => {
      refresh();
    });

    const deleteSelected = async () => {
      deleteDialog.value = false;
      await Promise.all(
        selected.value.map(async (item) => {
          return new Promise((resolve, reject) => {
            socket.keyword.emit('generic::deleteById', item.id, (err: string | null) => {
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

            if (attr === 'responses' && itemToUpdate.responses) {
              // reorder by array
              for (let i = 0; i < itemToUpdate.responses.length; i++) {
                console.log(itemToUpdate.responses[i].response + ' --- ' + itemToUpdate.responses[i].order + ' => ' + i);
                itemToUpdate.responses[i].order = i;
              }
            }

            socket.keyword.emit('generic::setById', {
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

    const saveSuccess = () => {
      refresh();
      EventBus.$emit('snack', 'success', 'Data updated.');
      newDialog.value = false;
    };

    return {
      orderBy,
      search,
      headers,
      items,
      state,
      permissions,
      getPermissionName,
      translate,
      newDialog,
      deleteDialog,
      timestamp,
      deleteSelected,
      update,
      selected,
      saveSuccess,
      capitalize,
      rules,
      refresh,
      headersDelete,
    };
  },
});
</script>
