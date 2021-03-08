<template>
  <span>
    <v-app-bar v-if="$vuetify.breakpoint.mobile" fixed app dense>
      <v-app-bar-nav-icon
        @click.stop="drawer = !drawer"
      />
      <v-toolbar-title>{{translate('menu.' + $route.name.toLowerCase())}}</v-toolbar-title>
    </v-app-bar>
    <v-navigation-drawer
      v-model="drawer"
      app
      bottom
    >
      <vue-headful :title="name.toUpperCase() + '@' + channelName" />
      <user />

      <v-spacer />

      <navmenu />
    </v-navigation-drawer>
  </span>
</template>

<script lang="ts">
import {
  defineAsyncComponent, defineComponent, onMounted, ref,
} from '@vue/composition-api';
import vueHeadful from 'vue-headful';

import { isMobile } from 'src/panel/helpers/isMobile';
import { getSocket } from 'src/panel/helpers/socket';
import translate from 'src/panel/helpers/translate';

const socket = getSocket('/', true);

const navmenu = defineAsyncComponent({ loader: () => import('src/public/components/navbar/menu.vue') });
const user = defineAsyncComponent({ loader: () => import('src/panel/components/navbar/user.vue') });

export default defineComponent({
  components: {
    vueHeadful,
    navmenu,
    user,
  },
  setup(props, ctx) {
    const name = ref('');
    const channelName = ref('');

    const drawer = ref(!ctx.root.$vuetify.breakpoint.mobile);

    onMounted(() => {
      socket.emit('name', (recvName: string) => name.value = recvName );
      socket.emit('channelName', (recvName: string) => channelName.value = recvName );
    });

    return {
      name, channelName, drawer, translate, isMobile
    };
  },
});
</script>