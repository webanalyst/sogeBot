<template>
  <v-container
    fluid
    :class="{ 'pa-4': !$vuetify.breakpoint.mobile }"
  >
    <h2 v-if="!$vuetify.breakpoint.mobile">
      {{ translate('menu.botcommands') }}
    </h2>

    <v-data-table
      v-model="selected"
      show-select
      :loading="state.loading !== $state.success || state.loadingPrm !== $state.success"
      :headers="headers"
      :items-per-page="-1"
      :items="fItems"
      sort-by="name"
      group-by="type"
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
        </v-toolbar>
      </template>

      <template #[`group.header`]="{ items, isOpen, toggle }">
        <th colspan="7">
          <v-icon
            @click="toggle"
          >
            {{ isOpen ? 'mdi-minus' : 'mdi-plus' }}
          </v-icon>

          {{ items[0].type }}
        </th>
      </template>

      <template #[`item.command`]="{ item }">
        <v-edit-dialog
          persistent
          large
          :return-value.sync="item.command"
          @save="update(item, false, 'command')"
        >
          <span :class="{ 'text-decoration-line-through': item.command !== item.defaultValue }">{{ item.defaultValue }}</span>
          <span v-if="item.command !== item.defaultValue"><v-icon class="d-inline-block">mdi-arrow-right-bold</v-icon> {{ item.command }}</span>
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

      <template #[`item.permission`]="{ item }">
        <v-edit-dialog
          persistent
          large
          :return-value.sync="item.permission"
          @save="update(item, true, 'permission')"
        >
          <span :class="{ 'text--lighten-1': item.permission === null, 'red--text': item.permission === null }">
            {{ getPermissionName(item.permission, permissions) }}
          </span>
          <template #input>
            <v-select
              v-model="item.permission"
              :items="permissionItems"
            />
          </template>
        </v-edit-dialog>
      </template>
    </v-data-table>
  </v-container>
</template>

<script lang="ts">
import {
  computed,
  defineComponent, onMounted, ref,
} from '@vue/composition-api';
import { capitalize, orderBy } from 'lodash-es';

import type { PermissionsInterface } from 'src/bot/database/entity/permissions';
import { ButtonStates } from 'src/panel/helpers/buttonStates';
import { error } from 'src/panel/helpers/error';
import { EventBus } from 'src/panel/helpers/event-bus';
import translate from 'src/panel/helpers/translate';
import {
  minLength, required, startsWithExclamation,
} from 'src/panel/helpers/validators';

import { getPermissionName } from '../../helpers/getPermissionName';
import { getSocket } from '../../helpers/socket';

const socket = {
  permission: getSocket('/core/permissions'),
  command:    getSocket('/core/general'),
} as const;

type CommandsInterface = {
  id: string,
  defaultValue: string,
  type: string,
  name: string,
  command: string,
  permission: string | null,
};

export default defineComponent({
  setup(props, ctx) {
    const rules = { command: [startsWithExclamation, required, minLength(2)] };

    const search = ref('');
    const items = ref([] as CommandsInterface[]);
    const permissions = ref([] as Required<PermissionsInterface>[]);

    const selected = ref([] as CommandsInterface[]);

    const state = ref({
      loadingPrm: ButtonStates.progress,
      loading:    ButtonStates.progress,
    } as {
      loadingPrm: number;
      loading: number;
    });

    const fItems = computed(() => {
      if (search.value === '') {
        return items.value;
      } else {
        return items.value.filter(item => {
          const inCommand = item.command.toLowerCase().includes(search.value.toLowerCase());
          const inOriginal = item.defaultValue.toLowerCase().includes(search.value.toLowerCase());
          const inName = item.name.toLowerCase().includes(search.value.toLowerCase());
          return inOriginal || inCommand || inName;
        });
      }
    });

    const headers = [
      { value: 'command', text: translate('command') },
      {
        value: 'type', text: capitalize(translate('type')), width: '12rem',
      },
      {
        value: 'name', text: capitalize(translate('name')), width: '12rem',
      },
      {
        value: 'permission', text: translate('permission'), width: '7rem',
      },
    ];

    const refresh = () => {
      socket.permission.emit('permissions', (err: string | null, data: Readonly<Required<PermissionsInterface>>[]) => {
        if(err) {
          return error(err);
        }
        permissions.value = data;
        state.value.loadingPrm = ButtonStates.success;
      });
      socket.command.emit('generic::getCoreCommands', (err: string | null, commands: Required<CommandsInterface>[] ) => {
        if (err) {
          return error(err);
        }
        console.debug({ commands });
        items.value.length = 0;
        for (const command of commands) {
          items.value.push({ ...command });
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

    const saveSuccess = () => {
      refresh();
      EventBus.$emit('snack', 'success', 'Data updated.');
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
            socket.command.emit('generic::setCoreCommand', {
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

    const permissionItems = computed(() => {
      return [...permissions.value, { name: 'Disabled', id: null }].map((item) => ({
        text:     item.name,
        value:    item.id,
        disabled: false,
      }));
    });

    return {
      orderBy,
      headers,
      search,
      items,
      state,
      permissionItems,
      permissions,
      getPermissionName,
      selected,
      translate,
      rules,
      saveSuccess,
      update,
      refresh,
      capitalize,
      fItems,
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
