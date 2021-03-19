<template>
  <v-container
    fluid
    :class="{ 'pa-4': !$vuetify.breakpoint.mobile }"
  >
    <v-alert
      v-if="!$systems.find(o => o.name === 'cooldown').enabled"
      dismissible
      prominent
      dense
    >
      <div class="text-caption">
        {{ translate('this-system-is-disabled') }}
      </div>
    </v-alert>

    <h2 v-if="!$vuetify.breakpoint.mobile">
      {{ translate('menu.cooldown') }}
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
                    :headers="headersWithoutPerm"
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
                <new-item
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
              counter
            />
          </template>
        </v-edit-dialog>
      </template>

      <template #[`item.count`]="{ item }">
        <v-edit-dialog
          persistent
          large
          :return-value.sync="item.count"
          @save="update(item, false, 'count')"
        >
          {{ item.count }}s
          <template #input>
            <v-text-field
              v-model.number="item.count"
              type="number"
              :rules="rules.count"
              single-line
            >
              <template #append>
                s
              </template>
            </v-text-field>
          </template>
        </v-edit-dialog>
      </template>

      <template #[`item.type`]="{ item }">
        <v-edit-dialog
          persistent
          large
          :return-value.sync="item.type"
          @save="update(item, true, 'type')"
        >
          {{ translate(item.type) }}
          <template #input>
            <v-select
              v-model="item.type"
              :items="typeItems"
            />
          </template>
        </v-edit-dialog>
      </template>

      <template #[`item.isEnabled`]="{ item }">
        <v-simple-checkbox
          v-model="item.isEnabled"
          @click="update(item, true, 'isEnabled')"
        />
      </template>

      <template #[`item.isErrorMsgQuiet`]="{ item }">
        <v-simple-checkbox
          v-model="item.isErrorMsgQuiet"
          @click="update(item, true, 'isErrorMsgQuiet')"
        />
      </template>

      <template #[`item.isOwnerAffected`]="{ item }">
        <v-simple-checkbox
          v-model="item.isOwnerAffected"
          @click="update(item, true, 'isOwnerAffected')"
        />
      </template>

      <template #[`item.isModeratorAffected`]="{ item }">
        <v-simple-checkbox
          v-model="item.isModeratorAffected"
          @click="update(item, true, 'isModeratorAffected')"
        />
      </template>

      <template #[`item.isSubscriberAffected`]="{ item }">
        <v-simple-checkbox
          v-model="item.isSubscriberAffected"
          @click="update(item, true, 'isSubscriberAffected')"
        />
      </template>

      <template #[`item.isFollowerAffected`]="{ item }">
        <v-simple-checkbox
          v-model="item.isFollowerAffected"
          @click="update(item, true, 'isFollowerAffected')"
        />
      </template>
    </v-data-table>
  </v-container>
</template>

<script lang="ts">
import {
  computed, defineAsyncComponent, defineComponent, onMounted, ref, watch,
} from '@vue/composition-api';
import { escapeRegExp, isNil } from 'lodash-es';

import { CooldownInterface } from 'src/bot/database/entity/cooldown';
import { ButtonStates } from 'src/panel/helpers/buttonStates';
import { capitalize } from 'src/panel/helpers/capitalize';
import { error } from 'src/panel/helpers/error';
import { EventBus } from 'src/panel/helpers/event-bus';
import { getSocket } from 'src/panel/helpers/socket';
import translate from 'src/panel/helpers/translate';
import {
  minLength, minValue, required,
} from 'src/panel/helpers/validators';

const socket = getSocket('/systems/cooldown');

type CooldownInterfaceUI = CooldownInterface & { count: number };

export default defineComponent({
  components: { 'new-item': defineAsyncComponent({ loader: () => import('./components/new-item/cooldowns-newItem.vue') }) },
  setup(props, ctx) {
    const rules = { name: [required, minLength(2)], count: [required, minValue(30)] };

    const items = ref([] as CooldownInterfaceUI[]);
    const typeItems = [
      {
        text:     translate('global'),
        value:    'global',
        disabled: false,
      }, {
        text:     translate('user'),
        value:    'user',
        disabled: false,
      },
    ];
    const search = ref('');

    const selected = ref([] as CooldownInterfaceUI[]);
    const deleteDialog = ref(false);
    const newDialog = ref(false);

    const timestamp = ref(Date.now());

    watch(newDialog, () => {
      timestamp.value = Date.now();
    });

    const state = ref({
      loading: ButtonStates.progress,
      save:    ButtonStates.idle,
      pending: false,
    } as {
      loading: number;
      save: number;
      pending: boolean;
    });

    const headers = [
      { value: 'name', text: '!' + translate('command') + ' ' + translate('or') + ' ' + translate('keyword') },
      {
        value: 'count', text: translate('cooldown'), width: '7rem',
      },
      {
        value: 'type', text: translate('cooldown'), width: '7rem',
      },
      {
        value: 'isEnabled', text: capitalize(translate('enabled')), width: '6rem',
      },
      {
        value: 'isErrorMsgQuiet', text: capitalize(translate('quiet')), width: '6rem',
      },
      {
        value: 'isOwnerAffected', text: capitalize(translate('core.permissions.casters')), width: '6rem',
      },
      {
        value: 'isModeratorAffected', text: capitalize(translate('core.permissions.moderators')), width: '8rem',
      },
      {
        value: 'isSubscriberAffected', text: capitalize(translate('core.permissions.subscribers')), width: '8rem',
      },
      {
        value: 'isFollowerAffected', text: capitalize(translate('core.permissions.followers')), width: '7rem',
      },
    ];

    const headersWithoutPerm = [
      { value: 'name', text: '' },
    ];

    const fItems = computed(() => {
      if (search.value.length === 0) {
        return items.value;
      }
      return items.value.filter((o) => {
        const isSearchInKey = !isNil(o.name.match(new RegExp(escapeRegExp(search.value), 'ig')));
        return isSearchInKey;
      });
    });

    onMounted(() => {
      refresh();
    });

    const refresh = () => {
      socket.emit('generic::getAll', (err: string | null, itemsGetAll: CooldownInterfaceUI[]) => {
        if (err) {
          return error(err);
        }
        console.debug('Loaded', itemsGetAll);
        items.value = itemsGetAll;
        for (const item of items.value) {
          item.count = item.miliseconds / 1000;
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

    const saveSuccess = () => {
      refresh();
      EventBus.$emit('snack', 'success', 'Data updated.');
      newDialog.value = false;
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
            if (attr === 'count') {
              itemToUpdate.miliseconds = item.count  * 1000;
            }
            console.log('Updating', { itemToUpdate }, { attr, value: item[attr] });
            socket.emit('cooldown::save', {
              ...itemToUpdate,
              [attr]: item[attr], // save new value for all selected items
            } , () => {
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
      search,
      state,
      headers,
      headersWithoutPerm,
      selected,
      deleteSelected,
      update,
      fItems,
      newDialog,
      deleteDialog,
      translate,
      saveSuccess,
      timestamp,
      rules,
      typeItems,
    };
  },
});
</script>