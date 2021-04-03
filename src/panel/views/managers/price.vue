<template>
  <v-container
    fluid
    :class="{ 'pa-4': !$vuetify.breakpoint.mobile }"
  >
    <v-alert
      v-if="!$systems.find(o => o.name === 'price').enabled"
      dismissible
      prominent
      dense
    >
      <div class="text-caption">
        {{ translate('this-system-is-disabled') }}
      </div>
    </v-alert>

    <h2 v-if="!$vuetify.breakpoint.mobile">
      {{ translate('menu.price') }}
    </h2>

    <v-data-table
      v-model="selected"
      calculate-widths
      show-select
      sort-by="command"
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

      <template #[`item.command`]="{ item }">
        <v-edit-dialog
          persistent
          large
          :return-value.sync="item.command"
          @save="update(item, false, 'command')"
        >
          {{ item.command }}
          <template #input>
            <v-text-field
              v-model="item.command"
              :rules="rules.command"
              single-line
              counter
            />
          </template>
        </v-edit-dialog>
      </template>

      <template #[`item.price`]="{ item }">
        <v-edit-dialog
          persistent
          large
          @save="update(item, false, 'price');"
        >
          <div v-html="priceFormatter(item)" />

          <template #input>
            <v-text-field
              v-model.number="item.price"
              class="d-inline-block"
              type="number"
              :rules="rules.price"
              single-line
              :error="!isAtLeastOneValueAboveZero(item)"
            >
              <template #append>
                {{ getLocalizedName(2, $store.state.configuration.systems.Points.customization.name) }}
              </template>
            </v-text-field>
            {{ translate('or') }}
            <v-text-field
              v-model.number="item.priceBits"
              class="d-inline-block"
              :error="!isAtLeastOneValueAboveZero(item)"
              :error-messages="!isAtLeastOneValueAboveZero(item) ? ['Points or bits price needs to be set.'] : []"
              type="number"
              :rules="rules.priceBits"
              single-line
            >
              <template #append>
                {{ getLocalizedName(2, translate('bot.bits')) }}
              </template>
            </v-text-field>
          </template>
        </v-edit-dialog>
      </template>

      <template #[`item.emitRedeemEvent`]="{ item }">
        <v-simple-checkbox
          v-model="item.emitRedeemEvent"
          @click="update(item, true, 'emitRedeemEvent')"
        />
      </template>

      <template #[`item.enabled`]="{ item }">
        <v-simple-checkbox
          v-model="item.enabled"
          @click="update(item, true, 'enabled')"
        />
      </template>
    </v-data-table>
  </v-container>
</template>

<script lang="ts">
import { mdiMagnify } from '@mdi/js';
import {
  defineAsyncComponent,
  defineComponent, onMounted, ref, watch,
} from '@vue/composition-api';
import { capitalize } from 'lodash-es';

import type { PriceInterface } from 'src/bot/database/entity/price';
import { getLocalizedName } from 'src/bot/helpers/getLocalized';
import { ButtonStates } from 'src/panel/helpers/buttonStates';
import { error } from 'src/panel/helpers/error';
import { EventBus } from 'src/panel/helpers/event-bus';
import { getSocket } from 'src/panel/helpers/socket';
import translate from 'src/panel/helpers/translate';
import {
  minLength, minValue, required, startsWithExclamation,
} from 'src/panel/helpers/validators';

const socket = getSocket('/systems/price');
export default defineComponent({
  components: { 'new-item': defineAsyncComponent({ loader: () => import('./components/new-item/price-newItem.vue') }) },
  setup(props, ctx) {
    const timestamp = ref(Date.now());
    const search = ref('');
    const items = ref([] as PriceInterface[]);
    const selected = ref([] as PriceInterface[]);
    const deleteDialog = ref(false);
    const newDialog = ref(false);

    const state = ref({ loading: ButtonStates.progress } as {
      loading: number;
    });

    // add oneIsAboveZero validation
    const rules = {
      price:     [minValue(0), required],
      priceBits: [minValue(0), required],
      command:   [required, minLength(2), startsWithExclamation],
    };

    const headers = [
      { value: 'command', text: translate('command') },
      {
        value: 'enabled', text: translate('enabled'), width: '6rem',
      },
      {
        value: 'emitRedeemEvent', text: translate('systems.price.emitRedeemEvent'), width: '15rem',
      },
      { value: 'price', text: capitalize(translate('systems.price.price.name')) },
    ];
    const headersDelete = [
      { value: 'command', text: translate('command') },
    ];

    watch(newDialog, () => {
      timestamp.value = Date.now();
    });

    onMounted(() => {
      refresh();
    });

    const refresh = () => {
      socket.emit('generic::getAll', (err: string | null, itemsGetAll: PriceInterface[]) => {
        if (err) {
          return error(err);
        }
        items.value = itemsGetAll;
        console.debug({ items: itemsGetAll });

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
      if (!isAtLeastOneValueAboveZero(item)) {
        EventBus.$emit('snack', 'red', `[price] - Points or bits price needs to be set.`);
        refresh();
        return;
      }

      await Promise.all(
        [item, ...(multi ? selected.value : [])].map(async (itemToUpdate) => {
          return new Promise((resolve) => {
            console.log('Updating', { itemToUpdate }, { attr, value: item[attr] });
            socket.emit('price::save', {
              ...itemToUpdate,
              [attr]: item[attr], // save new value for all selected items
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

    const isAtLeastOneValueAboveZero = (item: PriceInterface) => {
      return item.price > 0 || item.priceBits > 0;
    };

    const priceFormatter = (item: PriceInterface) => {
      const output = [];
      if (item.price !== 0) {
        output.push(`${item.price} ${getLocalizedName(item.price, ctx.root.$store.state.configuration.systems.Points.customization.name)}`);
      }
      if (item.priceBits !== 0) {
        output.push(`${item.priceBits} ${getLocalizedName(item.priceBits, translate('bot.bits'))}`);
      }
      return output.join(` ${translate('or')} `);
    };

    return {
      search,
      items,
      state,
      headers,
      headersDelete,
      update,
      getLocalizedName,
      translate,
      isAtLeastOneValueAboveZero,
      priceFormatter,

      selected,
      deleteDialog,
      newDialog,
      saveSuccess,
      timestamp,
      rules,
      deleteSelected,
      mdiMagnify,
    };
  },
});
</script>
