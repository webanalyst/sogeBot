<template>
  <span>
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
    <v-app-bar-nav-icon
      style="z-index: 4; position: fixed; transform: translateY(13px)"
      @click.stop="drawer = !drawer"
    />
  </span>
</template>

<script lang="ts">
import {
  defineAsyncComponent, defineComponent, onMounted, ref,
} from '@vue/composition-api';
import vueHeadful from 'vue-headful';

import { isMobile } from 'src/panel/helpers/isMobile';
import { getSocket } from 'src/panel/helpers/socket';

const socket = getSocket('/', true);

const navmenu = defineAsyncComponent({ loader: () => import('src/panel/components/navbar/menu.vue') });
const user = defineAsyncComponent({ loader: () => import('src/panel/components/navbar/user.vue') });

export default defineComponent({
  components: {
    vueHeadful,
    navmenu,
    user,
  },
  setup() {
    const name = ref('');
    const channelName = ref('');
    const drawer = ref(!isMobile);

    onMounted(() => {
      socket.emit('name', (recvName: string) => name.value = recvName );
      socket.emit('channelName', (recvName: string) => channelName.value = recvName );
    });

    return {
      name, channelName, drawer,
    };
  },
});
</script>