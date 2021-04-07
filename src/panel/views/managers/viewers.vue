<template>
  <v-container
    fluid
    :class="{ 'pa-4': !$vuetify.breakpoint.mobile }"
  >
    <h2 v-if="!$vuetify.breakpoint.mobile">
      {{ translate('menu.viewers') }}
    </h2>

    <v-data-table
      v-model="selected"
      :expanded.sync="expanded"
      show-select
      :loading="state.loading !== $state.success"
      :headers="headers"
      :items-per-page.sync="perPage"
      :sort-by.sync="sortBy"
      :sort-desc.sync="sortDesc"
      :items="fItems"
      item-key="userId"
      :page.sync="currentPage"
      :server-items-length.sync="count"
      show-expand
      :single-expand="true"
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
        </v-toolbar>
      </template>

      <template #[`item.username`]="{ item }">
        {{ item.username }}<small class="grey--text pl-2">{{ item.userId }}</small>
        <div>
          <v-chip x-small :color="item.isOnline ? 'success' : 'error'">Active</v-chip>
          <v-chip x-small :color="item.isVIP ? 'success' : 'error'">VIP</v-chip>
          <div class="d-inline-flex">
            <followers-chip :key="item.userId + 'follow' + timestamp" :item="item" @save="item.isFollower = $event.isFollower; item.haveFollowerLock = $event.haveFollowerLock; update(item, true, 'isFollower')" @close="timestamp = Date.now()"/>
          </div>
          <div class="d-inline-flex">
            <subscribers-chip :key="item.userId + 'sub' + timestamp" :item="item" @save="item.isSubscriber = $event.isSubscriber; item.haveSubscriberLock = $event.haveSubscriberLock; update(item, true, 'isSubscriber')" @close="timestamp = Date.now()"/>
          </div>
        </div>
      </template>

      <!--template #[`item.command`]="{ item }">
        <v-edit-dialog
          persistent
          large
          :return-value.sync="item.command"
          @save="update(item, false, 'command')"
        >
          <span :class="{ 'text-decoration-line-through': item.command !== item.defaultValue }">{{ item.defaultValue }}</span>
          <span v-if="item.command !== item.defaultValue"><v-icon class="d-inline-block">{{ mdiArrowRightBold }}</v-icon> {{ item.command }}</span>
          <template #input>
            <v-text-field
              v-model="item.command"
              :rules="rules.command"
              single-line
              counter
            />
          </template>
        </v-edit-dialog>
      </template-->
    </v-data-table>
  </v-container>
</template>

<script lang="ts">
import { mdiMagnify } from '@mdi/js';
import {
  computed,
  defineAsyncComponent,
  defineComponent, onMounted, ref, watch,
} from '@vue/composition-api';
import { capitalize, orderBy } from 'lodash-es';

import { UserInterface } from 'src/bot/database/entity/user';
import { ButtonStates } from 'src/panel/helpers/buttonStates';
import { EventBus } from 'src/panel/helpers/event-bus';
import translate from 'src/panel/helpers/translate';

import { getSocket } from '../../helpers/socket';

const socket = {
  users:     getSocket('/core/users'),
  eventlist: getSocket('/overlays/eventlist'),
} as const;

export default defineComponent({
  components: {
    followersChip: defineAsyncComponent({ loader: () => import ('./components/viewers/followersChip.vue') }),
    subscribersChip: defineAsyncComponent({ loader: () => import ('./components/viewers/subscribersChip.vue') }),
  },
  setup(props, ctx) {
    const rules = {  };

    const search = ref('');
    const items = ref([] as UserInterface[]);
    const selected = ref([] as UserInterface[]);
    const expanded = ref([] as UserInterface[]);

    const timestamp = ref(Date.now());
    const state = ref({
      forceCheckFollowedAt: ButtonStates.idle,
      loading:              ButtonStates.progress,
    } as {
      forceCheckFollowedAt: number;
      loading: number;
    });

    const currentPage = ref(1);
    const count = ref(0);
    const perPage = ref(15);
    const sortBy = ref('username');
    const sortDesc = ref(false);

    const filter = ref({
      followers:   null,
      subscribers: null,
      vips:        null,
      active:      null,
    });

    const fItems = computed(() => {
      if (search.value === '') {
        return items.value;
      } else {
        return items.value.filter(item => {
          const userId = item.userId.toLowerCase().includes(search.value.toLowerCase());
          const userName = item.username.toLowerCase().includes(search.value.toLowerCase());
          return userId || userName;
        });
      }
    });

    watch([currentPage, sortBy, sortDesc, filter, search, perPage], () => {
      refresh();
    }, { deep: true });

    const headers = [
      { value: 'username', text: capitalize(translate('username')) },
      { text: '', value: 'data-table-expand' },
    ];

    const refresh = () => {
      state.value.loading = ButtonStates.progress;
      console.time('find.viewers');
      socket.users.emit('find.viewers', {
        perPage: perPage.value, page: (currentPage.value - 1), order: { orderBy: sortBy.value, sortOrder: sortDesc.value ? 'DESC' : 'ASC' }, filter: filter.value, search: search.value.length > 0 ? search.value : undefined,
      }, (err: string | null, items_: Required<UserInterface>[], count_: number) => {
        if (err) {
          return console.error(err);
        }
        items.value = items_;
        count.value = count_;
        state.value.loading = ButtonStates.success;

        // we also need to reset selection values
        if (selected.value.length > 0) {
          selected.value.forEach((selectedItem, index) => {
            selectedItem = items.value.find(o => o.userId === selectedItem.userId) || selectedItem;
            selected.value[index] = selectedItem;
          });
        }
        console.timeEnd('find.viewers');
        timestamp.value = Date.now();
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
            const toUpdate: Record<string, any> = {}
            if (attr === 'isFollower') {
              toUpdate.isFollower = item.isFollower;
              toUpdate.haveFollowerLock = item.haveFollowerLock;
            } if (attr === 'isSubscriber') {
              toUpdate.isSubscriber = item.isSubscriber;
              toUpdate.haveSubscriberLock = item.haveSubscriberLock;
            } else {
              toUpdate[attr] = item[attr];
            }
            console.log('Updating', itemToUpdate.userId, { toUpdate });

            socket.users.emit('viewers::update', [itemToUpdate.userId, toUpdate], (err: string | null) => {
              if (err) {
                console.error(err);
              }
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
      currentPage,
      sortBy,
      perPage,
      sortDesc,
      count,
      state,
      selected,
      expanded,
      translate,
      rules,
      saveSuccess,
      update,
      refresh,
      capitalize,
      fItems,
      timestamp,
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
