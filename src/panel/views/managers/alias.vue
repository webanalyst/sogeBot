<template>
  <v-container>
    <v-alert
      v-if="!$systems.find(o => o.name === 'alias').enabled"
      dismissible
      prominent
      dense
    >
      <div class="text-caption">
        {{ translate('this-system-is-disabled') }}
      </div>
    </v-alert>

    <h2 v-if="!$vuetify.breakpoint.mobile">
      {{ translate('menu.alias') }}
    </h2>

    <v-data-table
      v-model="selected"
      calculate-widths
      group-by="group"
      dark
      show-select
      :search="search"
      :loading="state.loadingAls !== $state.success && state.loadingPrm !== $state.success"
      :headers="headers"
      :items-per-page="15"
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
                  dark
                  class="mb-2 pr-2"
                  v-bind="attrs"
                  v-on="on"
                >
                  Delete {{ selected.length }} Alias(es)
                </v-btn>
              </template>

              <v-card>
                <v-card-title>
                  <span class="headline">Delete {{ selected.length }} Alias(es)?</span>
                </v-card-title>

                <v-card-text>
                  <v-data-table
                    dark
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
            v-model="dialog"
            max-width="500px"
          >
            <template #activator="{ on, attrs }">
              <v-btn
                color="primary"
                dark
                class="mb-2"
                v-bind="attrs"
                v-on="on"
              >
                New Alias
              </v-btn>
            </template>

            <v-card>
              <v-card-title>
                <span class="headline">{{ formTitle }}</span>
              </v-card-title>

              <v-card-text>
                TODO
              </v-card-text>
            </v-card>
          </v-dialog>
        </v-toolbar>
      </template>

      <template #[`item.alias`]="{ item }">
        <v-edit-dialog
          :return-value.sync="item.alias"
          @save="update(item)"
        >
          {{ item.alias }}
          <template #input>
            <v-text-field
              v-model="item.alias"
              :rules="alias"
              label="Edit"
              single-line
              counter
            />
          </template>
        </v-edit-dialog>
      </template>

      <template #[`item.command`]="{ item }">
        <v-edit-dialog
          :return-value.sync="item.command"
          @save="update(item)"
        >
          {{ item.command }}
          <template #input>
            <v-text-field
              v-model="item.command"
              :rules="rules.command"
              label="Edit"
              single-line
              counter
            />
          </template>
        </v-edit-dialog>
      </template>

      <template #[`item.permission`]="{ item }">
        <v-edit-dialog
          :return-value.sync="item.permission"
          @save="update(item)"
        >
          {{ getPermissionName(item.permission, permissions) }}
          <template #input>
            <v-select
              v-model="item.permission"
              :items="permissionItems"
            />
          </template>
        </v-edit-dialog>
      </template>

      <template #[`item.enabled`]="{ item }">
        <v-simple-checkbox
          v-model="item.enabled"
          @click="update(item)"
        />
      </template>

      <template #[`item.visible`]="{ item }">
        <v-simple-checkbox
          v-model="item.visible"
          @click="update(item)"
        />
      </template>
    </v-data-table>

    <v-snackbar
      v-model="snack"
      :timeout="3000"
      :color="snackColor"
    >
      {{ snackText }}

      <template #action="{ attrs }">
        <v-btn
          v-bind="attrs"
          text
          @click="snack = false"
        >
          Close
        </v-btn>
      </template>
    </v-snackbar>
  </v-container>
</template>

<script lang="ts">

import { library } from '@fortawesome/fontawesome-svg-core';
import { faKey, faObjectGroup } from '@fortawesome/free-solid-svg-icons';
import {
  computed, defineComponent, getCurrentInstance, onMounted, ref,
} from '@vue/composition-api';
import {
  escapeRegExp, isNil, orderBy,
} from 'lodash-es';

import { AliasInterface } from 'src/bot/database/entity/alias';
import { PermissionsInterface } from 'src/bot/database/entity/permissions';
import { ButtonStates } from 'src/panel/helpers/buttonStates';
import { error } from 'src/panel/helpers/error';
import { getPermissionName } from 'src/panel/helpers/getPermissionName';
import { getSocket } from 'src/panel/helpers/socket';
import translate from 'src/panel/helpers/translate';

library.add(faKey, faObjectGroup);

const socket = {
  permission: getSocket('/core/permissions'),
  alias:      getSocket('/systems/alias'),
} as const;

export default defineComponent({
  setup(props, ctx) {
    const required = (v: string) => v.length > 0 || 'This value is required';
    const startsWithExclamation = (v: string) => v.length > 0 && v[0] === '!' || 'Must start with !';
    const startsWithExclamationOrCustomVariable = (v: string) => v.length > 0 && (v[0] === '!' || v[0] === '$') || 'Must start with ! or should be custom variable';

    const snack = ref(false);
    const snackColor = ref('');
    const snackText = ref('');

    const selected = ref([] as AliasInterface[]);
    const deleteDialog = ref(false);

    const instance = getCurrentInstance()?.proxy;

    const items = ref([] as AliasInterface[]);
    const permissions = ref([] as PermissionsInterface[]);

    const newGroupForAliasId = ref('');
    const newGroupName = ref('');
    const newGroupNameUpdated = ref(false);

    const rules = {
      alias:   [startsWithExclamation, required],
      command: [startsWithExclamationOrCustomVariable, required],
    };

    const search = ref('');
    const state = ref({
      loadingAls: ButtonStates.progress,
      loadingPrm: ButtonStates.idle,
      save:       ButtonStates.idle,
      pending:    false,
    } as {
      loadingAls: number;
      loadingPrm: number;
      save: number;
      pending: boolean;
    });
    const permissionItems = computed(() => {
      return permissions.value.map((item) => ({
        text:     item.name,
        value:    item.id,
        disabled: false,
      }));
    });

    onMounted(() => {
      refresh();
    });

    const newGroupNameValidity = computed(() => {
      if (newGroupNameUpdated.value) {
        return newGroupName.value.length > 0;
      } else {
        return null;
      }
    });
    const groups = computed(() => {
      return [null, ...new Set(items.value.filter(o => o.group !== null).map(o => o.group).sort())];
    });
    const fItems = computed(() => {
      if (search.value.length === 0) {
        return items.value;
      }
      return items.value.filter((o) => {
        const isSearchInAlias = !isNil(o.alias.match(new RegExp(escapeRegExp(search.value), 'ig')));
        const isSearchInCommand = !isNil(o.command.match(new RegExp(escapeRegExp(search.value), 'ig')));
        return isSearchInAlias || isSearchInCommand;
      });
    });

    const headers = [
      { value: 'alias', text: translate('alias') },
      {
        value: 'permission', text: translate('permission'), width: '7rem', 
      },
      {
        value: 'enabled', text: translate('enabled'), width: '6rem', 
      },
      {
        value: 'visible', text: translate('visible'), width: '6rem', 
      },
      { value: 'command', text: translate('command') },
    ];

    const headersWithoutPerm = [
      { value: 'alias', text: translate('alias') },
      { value: 'command', text: translate('command') },
    ];

    const refresh = () => {
      socket.permission.emit('permissions', (err: string | null, data: Readonly<Required<PermissionsInterface>>[]) => {
        if(err) {
          return error(err);
        }
        permissions.value = data;
        state.value.loadingPrm = ButtonStates.success;
      });
      socket.alias.emit('generic::getAll', (err: string | null, itemsGetAll: typeof items.value) => {
        items.value = orderBy(itemsGetAll, 'alias', 'asc');
        state.value.loadingAls = ButtonStates.success;
      });
    };
    const removeGroup = async (group: AliasInterface['group']) => {
      if (confirm('Do you want to delete group ' + group + '?')) {
        const promises: Promise<void>[] = [];
        for (const item of items.value.filter((o) => o.group === group)) {
          item.group = null;
          promises.push(new Promise<void>(resolve => {
            socket.alias.emit('generic::setById', { id: item.id, item }, () => {
              resolve();
            });
          }));
        }
        await Promise.all(promises);
        ctx.root.$forceUpdate();
      }
    };
    const updateGroup = (id: string, group: AliasInterface['group']) => {
      const item = items.value.find((o) => o.id === id);
      if (item) {
        item.group = group;
        socket.alias.emit('generic::setById', { id: item.id, item }, () => {
          return;
        });
        ctx.root.$forceUpdate();
      }
    };
    const updatePermission = (id: string, permission: string) => {
      const item = items.value.filter((o) => o.id === id)[0];
      item.permission = permission;
      socket.alias.emit('generic::setById', { id: item.id, item }, () => {
        return;
      });
      ctx.root.$forceUpdate();
    };
    const update = (item: typeof items.value[number]) => {
      // check validity
      for (const key of Object.keys(rules)) {
        for (const rule of (rules as any)[key]) {
          const ruleStatus = rule((item as any)[key]);
          if (ruleStatus === true) {
            continue;
          } else {
            snack.value = true;
            snackColor.value = 'red';
            snackText.value = ruleStatus;
            refresh();
            return;
          }
        }
      }
      socket.alias.emit('generic::setById', { id: item.id, item }, () => {
        snack.value = true;
        snackColor.value = 'success';
        snackText.value = 'Alias updated.';
      });
    };
    const resetModal = () => {
      newGroupName.value = '';
      newGroupNameUpdated.value = false;
    };
    const handleOk = (bvModalEvt: Event) => {
      // Prevent modal from closing
      bvModalEvt.preventDefault();
      // Trigger submit handler
      handleSubmit();
    };
    const handleSubmit = () => {
      if (!newGroupNameValidity.value) {
        return;
      }

      updateGroup(newGroupForAliasId.value, newGroupName.value);
      // Hide the modal manually
      ctx.root.$nextTick(() => {
        instance?.$bvModal.hide('create-new-group');
      });
    };
    /*const save = () =>  {
      const $v = instance?.$v;
      $v?.$touch();
      if (!$v?.$invalid) {
        state.value.save = ButtonStates.progress;

        socket.alias.emit('generic::setById', { id: ctx.root.$route.params.id, item: editationItem.value }, (err: string | null, data: AliasInterface) => {
          if (err) {
            state.value.save = ButtonStates.fail;
            return error(err);
          } else {
            console.groupCollapsed('generic::setById');
            console.log({ data });
            console.groupEnd();
            state.value.save = ButtonStates.success;
            ctx.root.$nextTick(() => {
              refresh();
              state.value.pending = false;
              ctx.root.$router.push({ name: 'aliasManagerEdit', params: { id: String(data.id) } }).catch(() => {
                return;
              });
            });
          }
          setTimeout(() => {
            state.value.save = ButtonStates.idle;
          }, 1000);
        });
      }
    };
    const del = (id: string) => {
      if (confirm('Do you want to delete alias ' + items.value.find(o => o.id === id)?.alias + '?')) {
        socket.alias.emit('generic::deleteById', id, (err: string | null) => {
          if (err) {
            return error(err);
          }
          refresh();
        });
      }
    };*/

    const deleteSelected = async () => {
      deleteDialog.value = false;
      await Promise.all(
        selected.value.map(async (item) => {
          return new Promise((resolve, reject) => {
            socket.alias.emit('generic::deleteById', item.id, (err: string | null) => {
              if (err) {
                reject(error(err));
              }
              resolve(true);
            });
          });
        }),
      );
      refresh();

      snack.value = true;
      snackColor.value = 'success';
      snackText.value = 'Data removed';
      selected.value = [];
    };

    function save () {
      snack.value = true;
      snackColor.value = 'success';
      snackText.value = 'Data saved';
    }

    return {
      items,
      permissions,
      newGroupForAliasId,
      newGroupName,
      newGroupNameUpdated,
      search,
      state,
      headers,
      headersWithoutPerm,
      newGroupNameValidity,
      groups,
      fItems,
      removeGroup,
      updateGroup,
      updatePermission,
      update,
      resetModal,
      handleOk,
      handleSubmit,
      save,
      deleteSelected,
      translate,
      getPermissionName,

      required,
      startsWithExclamation,
      snack,
      snackColor,
      snackText,
      selected,
      deleteDialog,
      permissionItems,

      rules,
    };
  },
});
</script>

<style>
.alias-table-btn button {
  padding: 6px !important;
}
</style>
