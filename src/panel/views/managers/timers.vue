<template>
  <v-container
    fluid
    :class="{ 'pa-4': !$vuetify.breakpoint.mobile }"
  >
    <v-alert
      v-if="!$systems.find(o => o.name === 'timers').enabled"
      dismissible
      prominent
      dense
    >
      <div class="text-caption">
        {{ translate('this-system-is-disabled') }}
      </div>
    </v-alert>

    <h2 v-if="!$vuetify.breakpoint.mobile">
      {{ translate('menu.timers') }}
    </h2>

    <v-data-table
      v-model="selected"
      calculate-widths
      show-select
      :search="search"
      :loading="state.loading !== $state.success"
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
                    :items-per-page="-1"
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

      <template #[`item.name`]="{ item }">
        <v-edit-dialog
          persistent
          large
          :return-value.sync="item.name"
          @save="update(item, false, 'name')"
        >
          {{ item.name }}
          <template #input>
            <v-text-field
              v-model="item.name"
              :rules="rules.name"
              single-line
              :clearable="true"
              counter
            />
          </template>
        </v-edit-dialog>
      </template>

      <template #[`item.triggerEveryMessage`]="{ item }">
        <v-edit-dialog
          persistent
          large
          :return-value.sync="item.triggerEveryMessage"
          @save="update(item, false, 'triggerEveryMessage')"
        >
          {{ item.triggerEveryMessage }}
          <template #input>
            <v-text-field
              v-model.number="item.triggerEveryMessage"
              type="number"
              min="0"
              :rules="rules.triggerEveryMessage"
              single-line
              :clearable="true"
            />
          </template>
        </v-edit-dialog>
      </template>

      <template #[`item.triggerEverySecond`]="{ item }">
        <v-edit-dialog
          persistent
          large
          :return-value.sync="item.triggerEverySecond"
          @save="update(item, false, 'triggerEverySecond')"
        >
          {{ item.triggerEverySecond }}
          <template #input>
            <v-text-field
              v-model.number="item.triggerEverySecond"
              min="0"
              type="number"
              :rules="rules.triggerEverySecond"
              single-line
              :clearable="true"
            />
          </template>
        </v-edit-dialog>
      </template>

      <template #[`item.messages`]="{ item }">
        <responses
          :responses="item.messages"
          :name="item.name"
          @save="item.messages = $event.map(item => ({...item, timestamp: item.order})); update(item, false, 'messages')"
        />
      </template>

      <template #[`item.isEnabled`]="{ item }">
        <v-simple-checkbox
          v-model="item.isEnabled"
          @click="update(item, true, 'isEnabled')"
        />
      </template>

      <template #[`item.tickOffline`]="{ item }">
        <v-simple-checkbox
          v-model="item.tickOffline"
          @click="update(item, true, 'tickOffline')"
        />
      </template>
    </v-data-table>
  </v-container>
</template>

<script lang="ts">
import { mdiMagnify } from '@mdi/js';
import {
  defineAsyncComponent, defineComponent, onMounted, ref, watch,
} from '@vue/composition-api';
import { capitalize, orderBy } from 'lodash-es';

import { TimerInterface } from 'src/bot/database/entity/timer';
import { ButtonStates } from 'src/panel/helpers/buttonStates';
import { error } from 'src/panel/helpers/error';
import { EventBus } from 'src/panel/helpers/event-bus';
import translate from 'src/panel/helpers/translate';
import {
  minLength, minValue, mustBeCompliant, required,
} from 'src/panel/helpers/validators';

import { getSocket } from '../../helpers/socket';

const socket = { timers: getSocket('/systems/timers') } as const;

export default defineComponent({
  components: {
    'new-item':  defineAsyncComponent({ loader: () => import('./components/new-item/timers-newItem.vue') }),
    'responses': defineAsyncComponent({ loader: () => import('./components/timers-responses.vue') }),
  },
  setup(props, ctx) {
    const rules = {
      name:                [required, minLength(2), mustBeCompliant('a-zA-Z0-9_')],
      triggerEveryMessage: [required, minValue(0)],
      triggerEverySecond:  [required, minValue(0)],
    };

    const search = ref('');
    const items = ref([] as Required<TimerInterface>[]);
    const selected = ref([] as TimerInterface[]);
    const deleteDialog = ref(false);
    const newDialog = ref(false);
    const timestamp = ref(Date.now());

    const state = ref({ loading: ButtonStates.progress } as {
      loading: number;
    });

    watch(newDialog, () => {
      timestamp.value = Date.now();
    });

    const headers = [
      { value: 'name', text: translate('timers.dialog.name') },
      { value: 'tickOffline', text: translate('timers.dialog.tickOffline') },
      { value: 'isEnabled', text: translate('enabled') },
      // virtual attributes
      { value: 'triggerEveryMessage', text: translate('messages') },
      { value: 'triggerEverySecond', text: capitalize(translate('seconds')) },
      { value: 'messages', text: translate('timers.dialog.responses') },
    ];

    const headersDelete = [
      { value: 'name', text: translate('timers.dialog.name') },
    ];

    const refresh = () => {
      socket.timers.emit('generic::getAll', (err: string | null, _items: Required<TimerInterface>[]) => {
        items.value.length = 0;
        for (const item of _items) {
          items.value.push({
            ...item,
            messages: orderBy(item.messages, 'timestamp', 'asc'),
          });
        }
        state.value.loading = ButtonStates.success;
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

    const saveSuccess = () => {
      refresh();
      EventBus.$emit('snack', 'success', 'Data updated.');
      newDialog.value = false;
    };

    const deleteSelected = async () => {
      deleteDialog.value = false;
      await Promise.all(
        selected.value.map(async (item) => {
          return new Promise((resolve, reject) => {
            socket.timers.emit('generic::deleteById', item.id, (err: string | null) => {
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
            if (attr === 'messages') {
              for (let i = 0; i < item[attr].length; i++) {
                item[attr][i].timestamp = i;
              }
            }
            console.log('Updating', { itemToUpdate }, { attr, value: item[attr] });
            socket.timers.emit('generic::setById', {
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

    return {
      orderBy,
      headers,
      search,
      items,
      state,
      deleteDialog,
      selected,
      translate,
      timestamp,
      rules,
      headersDelete,
      newDialog,
      saveSuccess,
      deleteSelected,
      update,
      refresh,
      capitalize,
      mdiMagnify,
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
