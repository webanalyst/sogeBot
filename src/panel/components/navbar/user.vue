<template>
  <v-list
    nav
    dense
  >
    <template v-if="isViewerLoaded && $store.state.loggedUser">
      <v-speed-dial
        v-model="menu"
        fixed
        top
        right
        direction="bottom"
        transition="slide-x-reverse-transition"
      >
        <template #activator>
          <v-btn>
            <v-list-item
              class="px-0"
              style="height: 72px"
            >
              <v-list-item-avatar>
                <v-avatar>
                  <v-img :src="$store.state.loggedUser.profile_image_url" />
                </v-avatar>
              </v-list-item-avatar>
              <v-list-item-content>
                <v-list-item-title>{{ $store.state.loggedUser.login }}</v-list-item-title>
                <v-list-item-subtitle v-if="viewer.permission">
                  {{ viewer.permission.name }}
                </v-list-item-subtitle>
              </v-list-item-content>
            </v-list-item>
          </v-btn>
        </template>

        <v-btn
          v-if="!isPublicPage && viewer.permission.id === defaultPermissions.CASTERS"
          text
          @click="joinBot"
        >
          &nbsp;{{ translate('join-channel') }}
        </v-btn>

        <v-btn
          v-if="!isPublicPage && viewer.permission.id === defaultPermissions.CASTERS"
          text
          @click="leaveBot"
        >
          &nbsp;{{ translate('leave-channel') }}
        </v-btn>

        <v-btn
          v-if="isPublicPage && viewer.permission.id === defaultPermissions.CASTERS"
          text
          href="/"
        >
          <v-icon>
            mdi-account-cog
          </v-icon>
          &nbsp;{{ translate('go-to-admin') }}
        </v-btn>

        <v-btn
          v-if="!isPublicPage"
          text
          href="/public/"
        >
          <v-icon>
            mdi-earth
          </v-icon>
          &nbsp;{{ translate('go-to-public') }}
        </v-btn>

        <theme />

        <div class="font-weight-medium text-center">
          {{ Intl.NumberFormat($store.state.configuration.lang).format(viewer.points) }}
          <span class="font-weight-thin">
            {{ translate('points') }}
          </span>
        </div>

        <div class="font-weight-medium text-center">
          {{ Intl.NumberFormat($store.state.configuration.lang).format(viewer.messages) }}
          <span class="font-weight-thin">
            {{ translate('messages') }}
          </span>
        </div>

        <div class="font-weight-medium text-center">
          {{ Intl.NumberFormat($store.state.configuration.lang).format(viewer.aggregatedBits) }}
          <span class="font-weight-thin">
            {{ translate('bits') }}
          </span>
        </div>

        <div class="font-weight-medium text-center">
          {{ Intl.NumberFormat($store.state.configuration.lang, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(viewer.watchedTime / 1000 / 60 / 60) }} h
          <span class="font-weight-thin">
            {{ translate('watched-time') }}
          </span>
        </div>

        <div class="font-weight-medium text-center">
          {{ Intl.NumberFormat($store.state.configuration.lang, { style: 'currency', currency: $store.state.configuration.currency }).format(viewer.aggregatedTips) }}
          <span class="font-weight-thin">
            {{ translate('tips') }}
          </span>
        </div>

        <v-btn
          color="danger"
          text
          @click="logout"
        >
          <v-icon class="red--text">
            mdi-logout
          </v-icon>
          {{ translate('logout') }}
        </v-btn>
      </v-speed-dial>
    </template>
    <template v-else>
      <v-btn
        fixed
        top
        right
        text
        @click="login"
      >
        <v-icon>
          mdi-login
        </v-icon>
        &nbsp;{{ translate('not-logged-in') }}
      </v-btn>
    </template>
  </v-list>
</template>

<script lang="ts">
import {
  computed, defineAsyncComponent, defineComponent, onMounted, onUnmounted, ref,
} from '@vue/composition-api';
import type { Ref } from '@vue/composition-api';

import { defaultPermissions } from 'src/bot/helpers/permissions/defaultPermissions';
import { getSocket } from 'src/panel/helpers/socket';
import translate from 'src/panel/helpers/translate';

import { PermissionsInterface } from '../../../bot/database/entity/permissions';
import { UserInterface } from '../../../bot/database/entity/user';

const socket = getSocket('/core/users', true);
let interval = 0;

const theme = defineAsyncComponent({ loader: () => import('src/panel/components/navbar/theme.vue') });

export default defineComponent({
  components: { theme },
  setup(props, context) {
    const menu = ref(false);
    const isViewerLoaded = ref(false);
    const viewer: Ref<(Required<UserInterface> & { aggregatedTips: number; aggregatedBits: number; permission: PermissionsInterface }) | null> = ref(null);
    const viewerIs = computed(() => {
      const status: string[] = [];
      const isArray = ['isFollower', 'isSubscriber', 'isVIP'] as const;
      isArray.forEach((item: typeof isArray[number]) => {
        if (viewer.value && viewer.value[item]) {
          status.push(item.replace('is', ''));
        }
      });
      return status;
    });
    const isPublicPage = computed(() => window.location.href.includes('public'));

    onMounted(() => {
      refreshViewer();
      interval = window.setInterval(() => {
        refreshViewer();
      }, 60000);
    });
    onUnmounted(() => clearInterval(interval));

    const logout = () => {
      socket.emit('logout', {
        accessToken:  localStorage.getItem('accessToken'),
        refreshToken: localStorage.getItem('refreshToken'),
      });
      localStorage.setItem('code', '');
      localStorage.setItem('accessToken', '');
      localStorage.setItem('refreshToken', '');
      localStorage.setItem('userType', 'unauthorized');
      window.location.assign(window.location.origin + '/login#error=logged+out');
    };
    const login = () => window.location.assign(window.location.origin + '/login');
    const refreshViewer = () => {
      if (typeof context.root.$store.state.loggedUser === 'undefined'|| context.root.$store.state.loggedUser === null) {
        return;
      }
      socket.emit('viewers::findOne', context.root.$store.state.loggedUser.id, (err: string| number, recvViewer: Readonly<Required<UserInterface>> & { aggregatedTips: number; aggregatedBits: number; permission: PermissionsInterface }) => {
        if (err) {
          return console.error(err);
        }
        if (recvViewer) {
          console.log('Logged in as', recvViewer);
          viewer.value = recvViewer;
          isViewerLoaded.value = true;
        } else {
          console.error('Cannot find user data, try to write something in chat to load data');
        }
      });
    };

    const joinBot = () => socket.emit('joinBot');
    const leaveBot = () => socket.emit('leaveBot');

    return {
      menu, defaultPermissions, isViewerLoaded, viewer, viewerIs, isPublicPage, logout, login, translate, joinBot, leaveBot,
    };
  },
});
</script>

<style>
.v-speed-dial__list {
  width: auto;
}
</style>