<template>
  <v-btn
    text
    @click="toggleTheme"
  >
    <v-icon
      v-if="theme === 'light'"
      style="color: rgb(253, 177, 0)"
    >
      mdi-weather-sunny
    </v-icon>
    <v-icon
      v-else
      style="color: #d0d5d2"
    >
      mdi-moon-waxing-crescent
    </v-icon>
  </v-btn>
</template>

<script lang="ts">
import {
  defineComponent, onMounted, ref,
} from '@vue/composition-api';
import { get } from 'lodash-es';

import { isUserLoggedIn } from 'src/panel/helpers/isUserLoggedIn';
import { getSocket } from 'src/panel/helpers/socket';

const socket = getSocket('/core/users', true);

export default defineComponent({
  setup(props, context) {
    const theme = ref('light');

    const toggleTheme = () => {
      const _theme = localStorage.getItem('theme');
      if (_theme === null || _theme === 'light') {
        localStorage.setItem('theme', 'dark');
      }
      if (_theme === 'dark') {
        localStorage.setItem('theme', 'light');
      }
      loadTheme(localStorage.getItem('theme') || 'dark');
    };

    const loadTheme = async (themeArg: string) => {
      if (!['light', 'dark'].includes(themeArg)) {
        console.error(`Unknown theme ${themeArg}, setting light theme`);
        themeArg = 'light';
      }

      context.root.$vuetify.theme.dark = themeArg === 'dark';
      theme.value = themeArg;

      // we need to save users preferred theme
      const user = await isUserLoggedIn(false, false);
      if (user) {
        socket.emit('theme::set', { theme: themeArg, userId: user.id }, () => {
          return;
        });
      }
      localStorage.setItem('theme', themeArg);
    };

    onMounted(async () => {
      const user = await isUserLoggedIn(false, false);
      if (user) {
        socket.emit('theme::get', { userId: user.id }, (err: string | null, themeArg: string | null) => {
          loadTheme(themeArg || get(context.root.$store.state.configuration, 'core.ui.theme', 'light'));
        });
      } else {
        loadTheme(localStorage.getItem('theme') || get(context.root.$store.state.configuration, 'core.ui.theme', 'light'));
      }
    });
    return { theme, toggleTheme };
  },
});
</script>