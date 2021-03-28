<template>
  <v-list
    nav
    dense
  >
    <v-list-item
      v-for="item of menu.filter(o => typeof o.category === 'undefined')"
      :key="item.name"
      :href="'#/' + item.id.replace(/\./g, '/')"
    >
      <v-list-item-icon>
        <v-icon>{{ icons.get(item.name) }}</v-icon>
      </v-list-item-icon>
      <v-list-item-title>{{ translate('menu.' + item.name) }}</v-list-item-title>
    </v-list-item>
    <v-list-group
      v-for="category of categories"
      :key="category"
      :value="false"
      :prepend-icon="icons.get(category)"
    >
      <template #activator>
        <v-list-item-title>{{ translate('menu.' + category) }}</v-list-item-title>
      </template>

      <v-list-item
        v-for="item of menu.filter(o => o.category === category)"
        :key="item.name"
        :href="'#/' + item.id.replace(/\./g, '/')"
      >
        <v-list-item-title
          :class="{
            'grey--text': !item.enabled,
            'darken-3': !item.enabled,
          }"
        >
          {{ translate('menu.' + item.name) }}
        </v-list-item-title>
      </v-list-item>
    </v-list-group>
  </v-list>
</template>

<script lang="ts">
import {
  defineComponent, onMounted, ref,
} from '@vue/composition-api';

import type { menu as menuType } from 'src/bot/helpers/panel';
import { getSocket } from 'src/panel/helpers/socket';
import translate from 'src/panel/helpers/translate';

type menuWithEnabled = Omit<typeof menuType[number], 'this'> & { enabled: boolean };

const socket = getSocket('/');

const icons = new Map<string, string>([
  ['dashboard', 'mdi-view-dashboard'],
  ['commands', 'mdi-exclamation-thick'],
  ['settings', 'mdi-cog'],
  ['manage', 'mdi-wrench'],
  ['stats', 'mdi-information-variant'],
  ['registry', 'mdi-format-list-bulleted-square'],
]);

export default defineComponent({
  setup() {
    const menu = ref([] as menuWithEnabled[]);
    const categories = ['commands', 'manage', 'settings', 'registry', /* 'logs', */ 'stats'];
    const isDisabledHidden = ref(true);

    onMounted(async () => {
      const isLoaded = await Promise.race([
        new Promise<boolean>(resolve => {
          socket.emit('menu', (err: string | null, data: menuWithEnabled[]) => {
            if (err) {
              return console.error(err);
            }
            console.groupCollapsed('menu::menu');
            console.log({ data });
            console.groupEnd();
            for (const item of data.sort((a, b) => {
              return translate('menu.' + a.name).localeCompare(translate('menu.' + b.name));
            })) {
              menu.value.push(item);
            }
            resolve(true);
          });
        }),
        new Promise<boolean>(resolve => {
          setTimeout(() => resolve(false), 4000);
        }),
      ]);

      if (!isLoaded) {
        console.error('menu not loaded, refreshing page');
        location.reload();
      }
    });

    return {
      menu, categories, isDisabledHidden, translate, icons,
    };
  },
});

</script>
<style>
.ps__rail-x {
  height: 0;
  position: relative;
  top: 2px;
}
.ps__thumb-x {
  height: 4px;
}
.ps__rail-x:hover > .ps__thumb-x, .ps__rail-x:focus > .ps__thumb-x, .ps__rail-x.ps--clicking .ps__thumb-x {
  height: 6px;
}
</style>