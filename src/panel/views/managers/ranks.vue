<template>
  <v-container
    fluid
    :class="{ 'pa-4': !$vuetify.breakpoint.mobile }"
  >
    <v-alert
      v-if="!$systems.find(o => o.name === 'ranks').enabled"
      dismissible
      prominent
      dense
    >
      <div class="text-caption">
        {{ translate('this-system-is-disabled') }}
      </div>
    </v-alert>

    <h2 v-if="!$vuetify.breakpoint.mobile">
      {{ translate('menu.ranks') }}
    </h2>

    <v-data-table
      v-model="selected"
      calculate-widths
      show-select
      :search="search"
      :loading="state.loading !== $state.success"
      :headers="headers"
      group-by="typeToBeShownInTable"
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
                  >
                    <template #[`item.type`]="{ item }">
                      <span
                        v-if="item.type === null"
                        class="red--text text--lighten-1"
                      >
                        Pending (not saved)
                      </span>
                      <span v-else>
                        {{ typeItems.find(o => o.value === item.type).text }}
                      </span>
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
                  @save="value=>{items.push(value);saveSuccess()}"
                />
              </v-card-text>
            </v-card>
          </v-dialog>
        </v-toolbar>
      </template>

      <template #[`group.header`]="{ items, isOpen, toggle }">
        <th colspan="4">
          <v-icon
            @click="toggle"
          >
            {{ isOpen ? mdiMinus : mdiPlus }}
          </v-icon>

          <v-simple-checkbox
            class="d-inline-block px-4"
            style="transform: translateY(5px)"
            inline
            :value="isTypeSelected(items[0].type)"
            @click="toggleTypeSelection(items[0].type)"
          />

          <span v-if="items[0].type === null">
            Pending (not saved)
          </span>
          <span v-else>
            {{ typeItems.find(o => o.value === items[0].type).text }}
          </span>
        </th>
      </template>

      <template #[`item.value`]="{ item }">
        <v-edit-dialog
          persistent
          large
          :return-value.sync="item.value"
          @save="update(item, false, 'value')"
        >
          {{ item.value }} {{ item.type === 'viewer' ? translate('hours') : translate('months') }}
          <template #input>
            <v-text-field
              v-model.number="item.value"
              :min="0"
              type="number"
              :rules="rules.value"
              single-line
              :suffix=" item.type === 'viewer' ? translate('hours') : translate('months')"
            />
          </template>
        </v-edit-dialog>
      </template>

      <template #[`item.rank`]="{ item }">
        <v-edit-dialog
          persistent
          large
          :return-value.sync="item.rank"
          @save="update(item, false, 'rank')"
        >
          {{ item.rank }}
          <template #input>
            <v-text-field
              v-model="item.rank"
              :rules="rules.rank"
              single-line
              counter
            />
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
          <span
            v-if="item.type === null"
            class="red--text text--lighten-1"
          >
            Pending (not saved)
          </span>
          <span v-else>
            {{ typeItems.find(o => o.value === item.type).text }}
          </span>
          <template #input>
            <v-select
              v-model="item.type"
              :items="typeItems"
            />
          </template>
        </v-edit-dialog>
      </template>
    </v-data-table>
  </v-container>
</template>

<script lang="ts">
import {
  mdiMagnify, mdiMinus, mdiPlus,
} from '@mdi/js';
import {
  defineAsyncComponent, defineComponent, onMounted, ref, watch,
} from '@vue/composition-api';
import { capitalize } from 'lodash-es';

import { RankInterface } from 'src/bot/database/entity/rank';
import { ButtonStates } from 'src/panel/helpers/buttonStates';
import { error } from 'src/panel/helpers/error';
import { EventBus } from 'src/panel/helpers/event-bus';
import { getSocket } from 'src/panel/helpers/socket';
import translate from 'src/panel/helpers/translate';
import { minValue, required } from 'src/panel/helpers/validators';

const socket = getSocket('/systems/ranks');

type RankInterfaceUI = RankInterface & { typeToBeShownInTable: string };

export default defineComponent({
  components: { 'new-item': defineAsyncComponent({ loader: () => import('./components/new-item/ranks-newItem.vue') }) },
  setup(props, ctx) {
    const rules = { value: [required, minValue(0)], rank: [required] };

    const items = ref([] as RankInterfaceUI[]);
    const typeItems = [
      {
        text:     'Pending (not saved)',
        value:    null,
        disabled: true,
      },
      {
        text:  'Watch time',
        value: 'viewer',
      }, {
        text:  'Follow time',
        value: 'follower',
      }, {
        text:  'Sub time',
        value: 'subscriber',
      },
    ];
    const search = ref('');

    const selected = ref([] as RankInterfaceUI[]);
    const deleteDialog = ref(false);
    const newDialog = ref(false);

    const timestamp = ref(Date.now());

    watch(newDialog, () => {
      timestamp.value = Date.now();
    });

    const state = ref({ loading: ButtonStates.progress } as {
      loading: number;
    });

    const headers = [
      { value: 'value', text: capitalize(translate('responses.variable.value')) },
      { value: 'rank', text: translate('rank') },
      { value: 'type', text: translate('type') },
    ];

    const headersDelete = [
      { value: 'rank', text: '' },
      { value: 'type', text: '' },
    ];

    onMounted(() => {
      refresh();
    });

    const refresh = () => {
      socket.emit('generic::getAll', (err: string | null, itemsGetAll: RankInterfaceUI[]) => {
        if (err) {
          return error(err);
        }
        items.value = [...itemsGetAll, ...JSON.parse(sessionStorage.getItem('ranks-pending') ?? '[]')];
        console.debug('Loaded', items.value);
        for (const item of items.value) {
          item.typeToBeShownInTable = item.type;
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
      // save pending
      sessionStorage.setItem('ranks-pending', JSON.stringify(items.value.filter(o => (o.type as any) === null)));

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

      // check if is unique
      if (items.value.filter(o => o.type === item.type && o.value === item.value).length > 1) {
        EventBus.$emit('snack', 'red', `[value] - Value is not unique.`);
        refresh();
        return;
      }

      await Promise.all(
        [item, ...(multi ? selected.value : [])].map(async (itemToUpdate) => {
          return new Promise((resolve) => {
            if (itemToUpdate.type !== null) {
              console.log('Updating', { itemToUpdate }, { attr, value: item[attr] });
              socket.emit('ranks::save', {
                ...itemToUpdate,
                [attr]: item[attr], // save new value for all selected items
              } , () => {
                // remove from pending if needed
                sessionStorage.setItem('ranks-pending', JSON.stringify(
                  JSON.parse(sessionStorage.getItem('ranks-pending') ?? '[]').filter((o: RankInterface) => o.id !== itemToUpdate.id),
                ));
                resolve(true);
              });
            } else {
              // resave pending
              console.log('Updating pending', { itemToUpdate }, { attr, value: item[attr] });
              sessionStorage.setItem('ranks-pending', JSON.stringify(
                [
                  ...JSON.parse(sessionStorage.getItem('ranks-pending') ?? '[]').filter((o: RankInterface) => o.id !== itemToUpdate.id),
                  itemToUpdate,
                ],
              ));
            }
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
          if ((item.type as any) === null) {
            sessionStorage.setItem('ranks-pending', JSON.stringify(
              JSON.parse(sessionStorage.getItem('ranks-pending') ?? '[]').filter((o: RankInterface) => o.id !== item.id),
            ));
          }
          return new Promise((resolve, reject) => {
            socket.emit('ranks::remove', item.id, (err: string | null) => {
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

    const isTypeSelected = (type: string) => {
      for (const item of items.value.filter(o => o.type === type)) {
        if (!selected.value.find(o => o.id === item.id)) {
          return false;
        }
      }
      return true;
    };
    const toggleTypeSelection = (type: string) => {
      if (isTypeSelected(type)) {
        // deselect all
        selected.value = selected.value.filter(o => o.type !== type);
      } else {
        for (const item of items.value.filter(o => o.type === type)) {
          if (!selected.value.find(o => o.id === item.id)) {
            selected.value.push(item);
          }
        }
      }
    };

    return {
      items,
      isTypeSelected, toggleTypeSelection,
      search,
      state,
      headers,
      headersDelete,
      selected,
      deleteSelected,
      update,
      newDialog,
      deleteDialog,
      translate,
      saveSuccess,
      timestamp,
      rules,
      typeItems,
      mdiMagnify, mdiMinus, mdiPlus,
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
