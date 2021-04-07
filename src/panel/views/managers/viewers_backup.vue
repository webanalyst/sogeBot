<template>
  <b-container fluid>
    <b-row>
      <b-col>
        <span class="title text-default mb-2">
          {{ translate('menu.manage') }}
          <small><fa icon="angle-right" /></small>
          {{ translate('menu.viewers') }}
        </span>
      </b-col>
    </b-row>

    <panel
      search
      @search="search = $event"
    >
      <template #left>
        <b-dropdown
          no-caret
          variant="primary"
        >
          <template #button-content>
            <span class="dropdown-icon">
              <template v-if="sort === 'user.points'">{{ translate('points') }}</template>
              <template v-if="sort === 'user.messages'">{{ translate('messages') }}</template>
              <template v-if="sort === 'sumTips'">{{ translate('tips') }}</template>
              <template v-if="sort === 'sumBits'">{{ translate('bits') }}</template>
              <template v-if="sort === 'user.giftedSubscribes'">{{ translate('subgifts') }}</template>
              <template v-if="sort === 'user.subscribeCumulativeMonths'">{{ translate('subCumulativeMonths') }}</template>
              <template v-if="sort === 'user.subscribeStreak'">{{ translate('subStreak') }}</template>
              <fa
                icon="sort-down"
                fixed-width
              />
            </span>
          </template>
          <b-dropdown-item @click="sort = 'user.username'; sortDesc = false">
            {{ translate('username') }}
          </b-dropdown-item>
          <b-dropdown-item @click="sort = 'user.seenAt'; sortDesc = true">
            {{ translate('last-seen') }}
          </b-dropdown-item>
          <b-dropdown-item @click="sort = 'user.watchedTime'; sortDesc = true">
            {{ translate('watched-time') }}
          </b-dropdown-item>
          <b-dropdown-item @click="sort = 'user.followedAt'; sortDesc = true">
            {{ translate('followed-since') }}
          </b-dropdown-item>
          <b-dropdown-item @click="sort = 'user.subscribedAt'; sortDesc = true">
            {{ translate('subscribed-since') }}
          </b-dropdown-item>
          <b-dropdown-item @click="sort = 'user.points'; sortDesc = true">
            {{ translate('points') }}
          </b-dropdown-item>
          <b-dropdown-item @click="sort = 'user.messages'; sortDesc = true">
            {{ translate('messages') }}
          </b-dropdown-item>
          <b-dropdown-item @click="sort = 'sumTips'; sortDesc = true">
            {{ translate('tips') }}
          </b-dropdown-item>
          <b-dropdown-item @click="sort = 'sumBits'; sortDesc = true">
            {{ translate('bits') }}
          </b-dropdown-item>
          <b-dropdown-item @click="sort = 'user.giftedSubscribes'; sortDesc = true">
            {{ translate('subgifts') }}
          </b-dropdown-item>
          <b-dropdown-item @click="sort = 'user.subscribeCumulativeMonths'; sortDesc = true">
            {{ translate('subCumulativeMonths') }}
          </b-dropdown-item>
          <b-dropdown-item @click="sort = 'user.subscribeStreak'; sortDesc = true">
            {{ translate('subStreak') }}
          </b-dropdown-item>
        </b-dropdown>

        <b-button
          variant="primary"
          @click="sortDesc = !sortDesc"
        >
          <fa
            :icon="'sort-alpha-' + (sortDesc ? 'up' : 'down')"
            fixed-width
          />
        </b-button>

        <b-dropdown
          no-caret
          variant="primary"
        >
          <template #button-content>
            <span class="dropdown-icon">
              {{ capitalize(translate('commons.reset')) }}
              <fa
                icon="sort-down"
                fixed-width
              />
            </span>
          </template>
          <b-dropdown-item @click="resetPoints">
            {{ translate('points') }}
          </b-dropdown-item>
          <b-dropdown-item @click="resetWatchedTime">
            {{ translate('watched-time') }}
          </b-dropdown-item>
          <b-dropdown-item @click="resetMessages">
            {{ translate('messages') }}
          </b-dropdown-item>
          <b-dropdown-item @click="resetBits">
            {{ translate('bits') }}
          </b-dropdown-item>
          <b-dropdown-item @click="resetTips">
            {{ translate('tips') }}
          </b-dropdown-item>
          <b-dropdown-item @click="resetSubgifts">
            {{ translate('subgifts') }}
          </b-dropdown-item>
        </b-dropdown>
      </template>

      <template #right>
        <b-pagination
          v-model="currentPage"
          class="m-0"
          :total-rows="count"
          :per-page="perPage"
          aria-controls="my-table"
        />

        <b-btn-group>
          <button
            v-if="filter.vips === null"
            class="btn border-0 btn-outline-dark"
            @click="filter.vips = true"
          >
            <fa
              icon="question"
              fixed-width
            /> <strong style="margin: 0px 0px 3px; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">vip</strong>
          </button>
          <button
            v-else-if="filter.vips"
            class="btn border-0 btn-outline-success"
            @click="filter.vips = false"
          >
            <fa
              icon="check"
              fixed-width
            /> <strong style="margin: 0px 0px 3px; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">vip</strong>
          </button>
          <button
            v-else
            class="btn border-0 btn-outline-danger"
            @click="filter.vips = null"
          >
            <fa
              icon="exclamation"
              fixed-width
            /> <strong style="margin: 0px 0px 3px; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">vip</strong>
          </button>

          <button
            v-if="filter.active === null"
            class="btn border-0 btn-outline-dark"
            @click="filter.active = true"
          >
            <fa
              icon="question"
              fixed-width
            /> <strong style="margin: 0px 0px 3px; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">active</strong>
          </button>
          <button
            v-else-if="filter.active"
            class="btn border-0 btn-outline-success"
            @click="filter.active = false"
          >
            <fa
              icon="check"
              fixed-width
            /> <strong style="margin: 0px 0px 3px; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">active</strong>
          </button>
          <button
            v-else
            class="btn border-0 btn-outline-danger"
            @click="filter.active = null"
          >
            <fa
              icon="exclamation"
              fixed-width
            /> <strong style="margin: 0px 0px 3px; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">active</strong>
          </button>

          <button
            v-if="filter.subscribers === null"
            class="btn border-0 btn-outline-dark"
            @click="filter.subscribers = true"
          >
            <fa
              icon="question"
              fixed-width
            /> <strong style="margin: 0px 0px 3px; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">subscribers</strong>
          </button>
          <button
            v-else-if="filter.subscribers"
            class="btn border-0 btn-outline-success"
            @click="filter.subscribers = false"
          >
            <fa
              icon="check"
              fixed-width
            /> <strong style="margin: 0px 0px 3px; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">subscribers</strong>
          </button>
          <button
            v-else
            class="btn border-0 btn-outline-danger"
            @click="filter.subscribers = null"
          >
            <fa
              icon="exclamation"
              fixed-width
            /> <strong style="margin: 0px 0px 3px; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">subscriber</strong>
          </button>

          <button
            v-if="filter.followers === null"
            class="btn border-0 btn-outline-dark"
            @click="filter.followers = true"
          >
            <fa
              icon="question"
              fixed-width
            /> <strong style="margin: 0px 0px 3px; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">followers</strong>
          </button>
          <button
            v-else-if="filter.followers"
            class="btn border-0 btn-outline-success"
            @click="filter.followers = false"
          >
            <fa
              icon="check"
              fixed-width
            /> <strong style="margin: 0px 0px 3px; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">followers</strong>
          </button>
          <button
            v-else
            class="btn border-0 btn-outline-danger"
            @click="filter.followers = null"
          >
            <fa
              icon="exclamation"
              fixed-width
            /> <strong style="margin: 0px 0px 3px; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">follower</strong>
          </button>
        </b-btn-group>
      </template>
    </panel>

    <loading
      v-if="state.loading !== $state.success"
      slow
    />
    <template v-else>
      <b-table
        hover
        striped
        small
        style="cursor: pointer;"
        :fields="fields"
        :items="items"
        :sort-by.sync="sort"
        :sort-desc.sync="sortDesc"
        @row-clicked="linkTo($event)"
      >
        <template #cell(username)="data">
          <div class="text-primary font-bigger">
            {{ data.item.username }}
          </div>
          <b-badge
            :class="[ data.item.isOnline ? 'badge-success' : 'badge-danger' ]"
            style="margin: 0px 0px 3px; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;"
          >
            active
          </b-badge>
          <b-badge
            :class="[ data.item.isVIP ? 'badge-success' : 'badge-danger' ]"
            style="margin: 0px 0px 3px; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;"
          >
            vip
          </b-badge>
          <b-badge
            :class="[ data.item.isFollower ? 'badge-success' : 'badge-danger' ]"
            style="margin: 0px 0px 3px; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;"
          >
            <fa
              v-if="data.item.haveFollowerLock"
              icon="fa-lock"
            />
            follower
          </b-badge>
          <b-badge
            :class="[ data.item.isSubscriber ? 'badge-success' : 'badge-danger' ]"
            style="margin: 0px 0px 3px; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;"
          >
            <fa
              v-if="data.item.haveSubscriberLock"
              icon="fa-lock"
            />
            subscriber
          </b-badge>
        </template>
        <template #cell(date)="data">
          <div v-if="Number(data.item.seenAt) !== 0">
            <strong style="margin: 0px 0px 3px; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">
              {{ translate('last-seen') }}:
            </strong>
            {{ dayjs(Number(data.item.seenAt)).format('LLL') }}
          </div>
          <div v-if="data.item.isFollower && Number(data.item.followedAt) !== 0">
            <strong style="margin: 0px 0px 3px; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">
              <fa
                v-if="data.item.haveFollowedAtLock"
                icon="fa-lock"
              />
              {{ translate('followed-since') }}:
            </strong>
            {{ dayjs(Number(data.item.followedAt)).format('LLL') }}
          </div>
          <div v-if="data.item.isSubscriber && Number(data.item.subscribedAt) !== 0">
            <strong style="margin: 0px 0px 3px; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">
              <fa
                v-if="data.item.haveSubscribedAtLock"
                icon="fa-lock"
              />
              {{ translate('subscribed-since') }}:
            </strong>
            {{ dayjs(Number(data.item.subscribedAt)).format('LLL') }}
          </div>
        </template>
        <template #cell(stats)="data">
          <div>
            <strong style="margin: 0px 0px 3px; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">
              {{ translate('messages') }}:
            </strong>
            {{ Intl.NumberFormat($store.state.configuration.lang).format(data.item.messages) }}
          </div>
          <div>
            <strong style="margin: 0px 0px 3px; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">
              {{ translate('points') }}:
            </strong>
            {{ Intl.NumberFormat($store.state.configuration.lang).format(data.item.points) }}
          </div>
          <div>
            <strong style="margin: 0px 0px 3px; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">
              {{ translate('watched-time') }}:
            </strong>
            {{ Intl.NumberFormat($store.state.configuration.lang, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(data.item.watchedTime / 1000 / 60 / 60) }} h
          </div>
          <div>
            <strong style="margin: 0px 0px 3px; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">
              {{ translate('tips') }}:
            </strong>
            {{ Intl.NumberFormat($store.state.configuration.lang, { style: 'currency', currency: $store.state.configuration.currency }).format(data.item.sumTips) }}
          </div>
        </template>
        <template #cell(stats2)="data">
          <div>
            <strong style="margin: 0px 0px 3px; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">
              {{ translate('bits') }}:
            </strong>
            {{ Intl.NumberFormat($store.state.configuration.lang).format(data.item.sumBits) }}
          </div>
          <div v-if="data.item.isSubscriber">
            <strong style="margin: 0px 0px 3px; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">
              {{ translate('tier') }}:
            </strong>
            {{ data.item.subscribeTier }}
          </div>
          <div>
            <strong style="margin: 0px 0px 3px; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">
              {{ translate('subgifts') }}:
            </strong>
            {{ Intl.NumberFormat($store.state.configuration.lang).format(data.item.giftedSubscribes) }}
          </div>
          <div>
            <strong style="margin: 0px 0px 3px; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">
              {{ translate('subStreak') }}:
            </strong>
            {{ Intl.NumberFormat($store.state.configuration.lang).format(data.item.subscribeStreak) }}
          </div>
          <div>
            <strong style="margin: 0px 0px 3px; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">
              {{ translate('subCumulativeMonths') }}:
            </strong>
            {{ Intl.NumberFormat($store.state.configuration.lang).format(data.item.subscribeCumulativeMonths) }}
          </div>
        </template>
      </b-table>
    </template>
  </b-container>
</template>

<script lang="ts">
import { library } from '@fortawesome/fontawesome-svg-core';
import {
  faLock, faSortAlphaDown, faSortAlphaUp, faSortDown, faSortUp, faSync, faUnlock,
} from '@fortawesome/free-solid-svg-icons';
import {
  defineComponent, getCurrentInstance, onMounted, ref, watch,
} from '@vue/composition-api';
import {
  capitalize, get, orderBy, xor,
} from 'lodash-es';
import VueFlatPickr from 'vue-flatpickr-component';
import { validationMixin } from 'vuelidate';
import { minValue, required } from 'vuelidate/lib/validators';

import { EventListInterface } from 'src/bot/database/entity/eventList';
import { UserInterface } from 'src/bot/database/entity/user';
import { dayjs } from 'src/bot/helpers/dayjs';
import { ButtonStates } from 'src/panel/helpers/buttonStates';
import { error, success } from 'src/panel/helpers/error';
import { getSocket } from 'src/panel/helpers/socket';
import translate from 'src/panel/helpers/translate';

import 'flatpickr/dist/flatpickr.css';

library.add(faSortDown, faSortUp, faSortAlphaUp, faSortAlphaDown, faLock, faUnlock, faSync);

const socket = getSocket('/core/users');
const socketEventList = getSocket('/overlays/eventlist');
export default defineComponent({
  components: {
    'loading':      () => import('src/panel/components/loading.vue'),
    datetime:       VueFlatPickr,
    'label-inside': () => import('src/panel/components/label-inside.vue'),
  },
  mixins:      [ validationMixin ],
  validations: {
    editationItem: {
      messages: { required, minValue: minValue(0) },
      points:   { required, minValue: minValue(0) },
    },
    editationItemWatchedTime: { required, minValue: minValue(0) },
  },
  setup(props, ctx) {
    const sortDesc = ref(false);
    const sort = ref('user.username');

    const filter = ref({
      followers:   null,
      subscribers: null,
      vips:        null,
      active:      null,
    });

    const fields = [
      { key: 'username', label: '' },
      { key: 'date', label: '' },
      { key: 'stats', label: '' },
      { key: 'stats2', label: '' },
    ];
    const historyFields = [
      { key: 'timestamp', sortable: true },
      { key: 'event' },
      { key: 'info', label: '' },
    ];

    const dateTimePickerConfig = {
      enableTime: true,
      formatDate: (val: any) => {
        return dayjs(Number(val)).format('LLL');
      },
      enableSeconds: true,
      maxDate:       Date.now(),
      allowInput:    true,
    } as const;

    const dateTimePickerConfigBitsTips = {
      enableTime: true,
      formatDate: (val: any) => {
        return dayjs(Number(val)).format('LLL');
      },
      enableSeconds: true,
      maxDate:       Date.now(),
      allowInput:    true,
    } as const;

    const refresh = () => {
      state.value.loading = ButtonStates.progress;
      console.time('find.viewers');
      socket.emit('find.viewers', {
        page: (currentPage.value - 1), order: { orderBy: sort.value, sortOrder: sortDesc.value ? 'DESC' : 'ASC' }, filter: filter.value, search: search.value.length > 0 ? search.value : undefined,
      }, (err: string | null, items_: Required<UserInterface>[], count_: number) => {
        if (err) {
          return console.error(err);
        }
        items.value = items_;
        count.value = count_;
        state.value.loading = ButtonStates.success;
        console.timeEnd('find.viewers');
      });
    };

    watch([currentPage, sort, sortDesc, filter, search], () => {
      refresh();
    }, { deep: true });

    watch(() => ctx.root.$route.params.id, (val) => {
      const $v = instance?.$v;
      $v?.$reset();
      if (val) {
        isSidebarVisible.value = true;
      } else {
        state.value.pending = false;
      }
    });
    watch(editationItem, (val, oldVal) => {
      if (val !== null && oldVal !== null) {
        state.value.pending = true;
      }

      if (val) {
        const locale = get(ctx.root.$store.state, 'configuration.lang', 'en');
        if (typeof val.subscribedAt === 'string' && editationItem.value) {
          editationItem.value.subscribedAt = dayjs(val.subscribedAt, 'LLL', locale).unix() * 1000;
        }
        if (typeof val.followedAt === 'string' && editationItem.value) {
          editationItem.value.followedAt = dayjs(val.followedAt, 'LLL', locale).unix() * 1000;
        }
      }
    }, { deep: true });

    watch(editationItemWatchedTime, (val: number) => {
      if (editationItem.value) {
        editationItem.value.watchedTime = val * 60 * 60 * 1000;
      }
    });

    // we need to remap editationItem.followedAt to timestamp
    watch(() => editationItem.value?.followedAt, (value) => {
      if (typeof value === 'string' && editationItem.value) {
        const locale = get(ctx.root.$store.state, 'configuration.lang', 'en');
        editationItem.value.followedAt = dayjs(value, 'LLL', locale).unix() * 1000;
      }
    });

    // we need to remap editationItem bits and tips to timestamp
    watch([() => editationItem.value?.bits, () => editationItem.value?.tips], (value) => {
      if (editationItem.value) {
        const locale = get(ctx.root.$store.state, 'configuration.lang', 'en');
        for (const bit of editationItem.value.bits) {
          if (typeof bit.cheeredAt === 'string') {
            bit.cheeredAt = dayjs(bit.cheeredAt, 'LLL', locale).unix() * 1000;
          }
        }
        for (const tip of editationItem.value.tips) {
          if (typeof tip.tippedAt === 'string') {
            tip.tippedAt = dayjs(tip.tippedAt, 'LLL', locale).unix() * 1000;
          }
        }
      }
    }, { deep: true });

    onMounted(() => {
      refresh();
      loadEditationItem();
      if (ctx.root.$route.params.id) {
        isSidebarVisible.value = true;
      }
    });

    const resetPoints = () => {
      socket.emit('viewers::resetPointsAll', () => {
        refresh();
      });
    };

    const resetWatchedTime = () => {
      socket.emit('viewers::resetWatchedTimeAll', () => {
        refresh();
      });
    };

    const resetMessages = () => {
      socket.emit('viewers::resetMessagesAll', () => {
        refresh();
      });
    };

    const resetBits = () => {
      socket.emit('viewers::resetBitsAll', () => {
        refresh();
      });
    };

    const resetTips = () => {
      socket.emit('viewers::resetTipsAll', () => {
        refresh();
      });
    };

    const resetSubgifts = () => {
      socket.emit('viewers::resetSubgiftsAll', () => {
        refresh();
      });
    };

    const linkTo = (item: Required<UserInterface>) => {
      console.debug('Clicked', item.userId);
      ctx.root.$router.push({ name: 'viewersManagerEdit', params: { id: String(item.userId) } });
    };

    const isSidebarVisibleChange = (isVisible: boolean, ev: any) => {
      if (!isVisible) {
        if (state.value.pending) {
          const isOK = confirm('You will lose your pending changes. Do you want to continue?');
          if (!isOK) {
            sidebarSlideEnabled.value = false;
            isSidebarVisible.value = false;
            ctx.root.$nextTick(() => {
              isSidebarVisible.value = true;
              setTimeout(() => {
                sidebarSlideEnabled.value = true;
              }, 300);
            });
            return;
          }
        }
        isSidebarVisible.value = isVisible;
        ctx.root.$router.push({ name: 'viewersManagerList' }).catch(() => {
          return;
        });
      } else {
        state.value.save = ButtonStates.idle;
        if (sidebarSlideEnabled.value) {
          editationItem.value = null;
          editationItemEvents.value = null;
          loadEditationItem();
        }
      }
    };

    const loadEditationItem = async () => {
      if (!ctx.root.$route.params.id) {
        return;
      }
      await new Promise<void>((resolve, reject) => {
        socket.emit('viewers::findOne', ctx.root.$route.params.id, (err: string | null, data: Readonly<Required<UserInterface>> & { aggregatedTips: number; aggregatedBits: number; permission: string }) => {
          if (err) {
            reject(console.error(err));
          }
          console.log('Loaded viewer', data);
          editationItem.value = {
            ...data,
            tips: orderBy(data.tips, 'tippedAt', 'desc'),
            bits: orderBy(data.bits, 'cheeredAt', 'desc'),
          };

          editationItemWatchedTime.value = Number((data.watchedTime / (60 * 60 * 1000)).toFixed(1));
          resolve();
        });
      });
      await new Promise<void>((resolve, reject) => {
        if (editationItem.value) {
          socketEventList.emit('eventlist::getUserEvents', editationItem.value.userId, (err: string | null, events: Required<EventListInterface>[]) => {
            if (err) {
              return console.error(err);
            }
            editationItemEvents.value = events;
            resolve();
          });
        } else {
          resolve();
        }
      });

      ctx.root.$nextTick(() => {
        state.value.pending = false;
      });
    };

    const forceCheckFollowedAt = () => {
      if (editationItem.value) {
        state.value.pending = true;
        state.value.forceCheckFollowedAt = ButtonStates.progress;
        socket.emit('viewers::followedAt', editationItem.value.userId, (err: string | null, followed_at: number) => {
          state.value.forceCheckFollowedAt = ButtonStates.idle;
          if (err) {
            if (err.includes('Not a follower') && editationItem.value) {
              editationItem.value.followedAt = 0;
            }
            return console.error(err);
          } else if (editationItem.value) {
            editationItem.value.followedAt = followed_at;
          }
        });
      }
    };

    const del = () => {
      if (!editationItem.value) {
        return;
      }

      const h = ctx.root.$createElement;
      // Using HTML string
      const titleVNode = h('div', { domProps: { innerHTML: `Are you sure you want to delete <strong>ALL DATA</strong> from user <strong>${editationItem.value.username}</strong> <small>(${editationItem.value.userId})</small>` } });
      ctx.root.$bvModal.msgBoxConfirm([titleVNode], { okVariant: 'danger' })
        .then(value => {
          if (value && editationItem.value) {
            const userId = editationItem.value.userId;
            const username = editationItem.value.username;
            socket.emit('viewers::remove', editationItem.value, () => {
              refresh();
              ctx.root.$router.push({ name: 'viewersManagerList' }).catch(() => {
                return;
              });
              success(`User <strong>${username}</strong> <small>(${userId})</small> was deleted from database.`, `User ${username}#${userId} deleted`);
              isSidebarVisible.value = false;
            });
          }
        })
        .catch(err => {
          error(err);
          // An error occurred
        });
    };

    const save = () => {
      if (!editationItem.value) {
        return;
      }

      const $v = instance?.$v;
      $v?.$touch();
      if (!$v?.$invalid) {
        state.value.save = ButtonStates.progress;
        socket.emit('viewers::save', editationItem.value, (err: string | null, viewer: UserInterface) => {
          if (err) {
            console.error(err);
            return state.value.save = ButtonStates.fail;
          }
          state.value.save = ButtonStates.success;
          editationItem.value = viewer; // replace with new data (e.g. ids on tips etc)
          ctx.root.$nextTick(() => {
            refresh();
            state.value.pending = false;
          });
          setTimeout(() => {
            state.value.save = ButtonStates.idle;
          }, 1000);
        });
      }
    };

    const removeBits = (id: number) => {
      if (editationItem.value) {
        editationItem.value.bits.splice(id, 1);
        ctx.root.$forceUpdate();
      }
      state.value.pending = true;
    };

    const removeTips = (id: number) => {
      if (editationItem.value) {
        editationItem.value.tips.splice(id, 1);
        ctx.root.$forceUpdate();
      }
      state.value.pending = true;
    };

    return {
      fields,
      historyFields,
      items,
      perPage,
      editationItem,
      editationItemEvents,
      editationItemWatchedTime,
      editingTipsIds,
      editingBitsIds,
      state,
      sort,
      sortDesc,
      count,
      currentPage,
      filter,
      search,
      dateTimePickerConfig,
      dateTimePickerConfigBitsTips,
      historyCurrentPage,
      historyPerPage,

      sidebarSlideEnabled,
      isSidebarVisibleChange,
      isSidebarVisible,

      linkTo,
      resetTips,
      resetBits,
      resetMessages,
      resetWatchedTime,
      resetPoints,
      removeTips,
      removeBits,
      resetSubgifts,
      forceCheckFollowedAt,
      save,
      del,

      get,
      capitalize,
      dayjs,
      translate,
      xor,
      ButtonStates,
    };
  },
});
</script>
