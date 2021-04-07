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
            :append-icon="mdiMagnify"
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
                New Item
              </v-btn>
            </template>

            <v-card>
              <v-card-title>
                <span class="headline">New item</span>
              </v-card-title>

              <v-card-text :key="timestamp">
                <new-item
                  :rules="rules"
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
        <responses
          :permissions="permissions"
          :responses="item.responses"
          :name="item.keyword"
          @save="item.responses = $event; update(item, false, 'responses')"
        />
      </template>
    </v-data-table>
  </v-container>
</template>

<script lang="ts">
import { mdiMagnify } from '@mdi/js';
import {
  defineAsyncComponent, defineComponent, onMounted, ref,
} from '@vue/composition-api';
import { orderBy } from 'lodash-es';
import { capitalize } from 'lodash-es';

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
    newItem:   defineAsyncComponent({ loader: () => import('./components/new-item/keyword-newItem.vue') }),
    responses: defineAsyncComponent({ loader: () => import('./components/responses.vue') }),
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
    } as {
      loadingPrm: number;
      loading: number;
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
        items.value.length = 0;
        for (const keyword of keywordsGetAll) {
          items.value.push({
            ...keyword,
            responses: orderBy(keyword.responses, 'order', 'asc'),
          });
        }
        console.debug({ keywordsGetAll, items: items.value });

        // we also need to reset selection values
        if (selected.value.length > 0) {
          selected.value.forEach((selectedItem, index) => {
            selectedItem = items.value.find(o => o.id === selectedItem.id) || selectedItem;
            selected.value[index] = selectedItem;
          });
        }

        state.value.loading = ButtonStates.success;
        timestamp.value = Date.now();
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
      mdiMagnify,
    };
  },
});
</script>
