// eslint-disable-next-line
import LoadScript from 'vue-plugin-load-script';

import VueCompositionAPI from '@vue/composition-api';
import { get } from 'lodash-es';
import Vue from 'vue';
import VueRouter from 'vue-router';
import Vuelidate from 'vuelidate';

import { setLocale } from 'src/bot/helpers/dayjs';

import { ButtonStates, states } from './helpers/buttonStates';
import type { getListOfReturn } from './helpers/getListOf';
import { getListOf, populateListOf } from './helpers/getListOf';
import { isBotStarted } from './helpers/isBotStarted';
import { isUserLoggedIn } from './helpers/isUserLoggedIn';
import { getConfiguration, getTranslations } from './helpers/socket';
import { store } from './helpers/store';
import urlParam from './helpers/urlParam';
import vuetify from './vuetify'; // path to vuetify export

Vue.use(Vuelidate);
Vue.use(LoadScript);
Vue.use(VueCompositionAPI);

/* import widely used components */
Vue.component('Panel', () => import('./components/panel.vue'));
Vue.component('HoldButton', () => import('./components/holdButton.vue'));
Vue.component('ButtonWithIcon', () => import('./components/button.vue'));
Vue.component('StateButton', () => import('./components/stateButton.vue'));
Vue.component('TextareaWithTags', () => import('./components/textareaWithTags.vue'));

declare module 'vue/types/vue' {
  interface Vue {
    $loadScript: (script: string) => Promise<void>;
    $unloadScript: (script: string) => Promise<void>;
    $state: states;
    urlParam(key: string): string | null;
    $systems: getListOfReturn['systems'];
    $core: getListOfReturn['core'];
    $integrations: getListOfReturn['integrations'];
  }
}

Vue.use(VueRouter);

const main = async () => {
  // init prototypes
  Vue.prototype.urlParam = (v: string) => urlParam(v);
  store.commit('setLoggedUser', await isUserLoggedIn());

  Vue.prototype.$state = ButtonStates;

  const router = new VueRouter({
    mode:   'hash',
    base:   __dirname,
    routes: [
      {
        path: '/', name: 'Dashboard', component: () => import('./views/dashboard/empty.vue'),
      },
      {
        path: '/stats/api', name: 'APIStats', component: () => import('./views/stats/api.vue'),
      },
      {
        path: '/stats/commandcount', name: 'CommandCountStats', component: () => import('./views/stats/commandcount.vue'),
      },
      {
        path: '/stats/tips', name: 'TipsStats', component: () => import('./views/stats/tips.vue'),
      },
      {
        path: '/stats/bits', name: 'BitsStats', component: () => import('./views/stats/bits.vue'),
      },
      {
        path: '/stats/profiler', name: 'ProfilerStats', component: () => import('./views/stats/profiler.vue'),
      },

      { path: '/manage/alias/', redirect: '/manage/alias/list' },
      {
        path: '/manage/alias/list', name: 'aliasManager', component: () => import('./views/managers/alias.vue'),
      },
      {
        path: '/manage/alias/edit/:id?', name: 'aliasManagerEdit', component: () => import('./views/managers/alias.vue'),
      },
      { path: '/manage/commands/', redirect: '/manage/commands/list' },
      {
        path: '/manage/commands/list', name: 'CommandsManagerList', component: () => import('./views/managers/commands.vue'),
      },
      {
        path: '/manage/commands/edit/:id?', name: 'CommandsManagerEdit', component: () => import('./views/managers/commands.vue'),
      },
      { path: '/manage/cooldowns/', redirect: '/manage/cooldowns/list' },
      {
        path: '/manage/cooldowns/list', name: 'cooldownsManager', component: () => import('./views/managers/cooldowns.vue'),
      },
      {
        path: '/manage/cooldowns/edit/:id?', name: 'cooldownsManagerEdit', component: () => import('./views/managers/cooldowns.vue'),
      },
      {
        path: '/manage/highlights', name: 'HighlightsManager', component: () => import('./views/managers/highlights.vue'),
      },
      {
        path: '/manage/hltb', name: 'HLTBManager', component: () => import('./views/managers/hltb.vue'),
      },
      {
        path: '/manage/polls', name: 'PollsManager', component: () => import('./views/managers/polls.vue'),
      },
      { path: '/manage/events/', redirect: '/manage/events/list' },
      {
        path: '/manage/events/list', name: 'EventsManagerList', component: () => import('./views/managers/events.vue'),
      },
      {
        path: '/manage/events/edit/:id?', name: 'EventsManagerEdit', component: () => import('./views/managers/events.vue'),
      },
      { path: '/manage/keywords/', redirect: '/manage/keywords/list' },
      {
        path: '/manage/keywords/list', name: 'KeywordsManagerList', component: () => import('./views/managers/keyword.vue'),
      },
      {
        path: '/manage/keywords/edit/:id?', name: 'KeywordsManagerEdit', component: () => import('./views/managers/keyword.vue'),
      },
      { path: '/manage/price/', redirect: '/manage/price/list' },
      {
        path: '/manage/price/list', name: 'PriceManager', component: () => import('./views/managers/price.vue'),
      },
      {
        path: '/manage/price/edit/:id?', name: 'PriceManagerEdit', component: () => import('./views/managers/price.vue'),
      },
      { path: '/manage/quotes/', redirect: '/manage/quotes/list' },
      {
        path: '/manage/quotes/list', name: 'QuotesManagerList', component: () => import('./views/managers/quotes.vue'),
      },
      {
        path: '/manage/quotes/edit/:id?', name: 'QuotesManagerEdit', component: () => import('./views/managers/quotes.vue'),
      },
      { path: '/manage/ranks/', redirect: '/manage/ranks/list' },
      {
        path: '/manage/ranks/list', name: 'RanksManagerList', component: () => import('./views/managers/ranks.vue'),
      },
      {
        path: '/manage/ranks/edit/:id?', name: 'RanksManagerEdit', component: () => import('./views/managers/ranks.vue'),
      },
      {
        path: '/manage/songs/playlist', name: 'songsManagerPlaylist', component: () => import('./views/managers/songs/songs-playlist.vue'),
      },
      {
        path: '/manage/songs/bannedsongs', name: 'songsManagerBannedsongs', component: () => import('./views/managers/songs/songs-bannedsongs.vue'),
      },
      {
        path: '/manage/spotify/bannedsongs', name: 'spotifyManagerBannedsongs', component: () => import('./views/managers/spotify/spotify-bannedsongs.vue'),
      },
      {
        path: '/manage/timers/list', name: 'TimersManagerList', component: () => import('./views/managers/timers/timers-list.vue'),
      },
      {
        path: '/manage/timers/edit/:id?', name: 'TimersManagerEdit', component: () => import('./views/managers/timers/timers-list.vue'),
      },
      { path: '/manage/viewers/', redirect: '/manage/viewers/list' },
      {
        path: '/manage/viewers/list', name: 'viewersManagerList', component: () => import('./views/managers/viewers.vue'),
      },
      {
        path: '/manage/viewers/edit/:id?', name: 'viewersManagerEdit', component: () => import('./views/managers/viewers.vue'),
      },

      {
        path: '/settings/permissions/:id?', name: 'PermissionsSettings', component: () => import('./views/settings/permissions.vue'),
      },
      {
        path: '/settings/translations', name: 'TranslationsSettings', component: () => import('./views/settings/translations.vue'),
      },
      {
        path: '/settings/:type/:id?', name: 'InterfaceSettings', component: () => import('./views/settings/interface.vue'),
      },

      {
        path: '/registry/alerts/list', name: 'alertsList', component: () => import('./views/registries/alerts/alerts-list.vue'),
      },
      {
        path: '/registry/alerts/edit/:id?', name: 'alertsEdit', component: () => import('./views/registries/alerts/alerts-edit.vue'),
      },
      {
        path: '/registry/customvariables/list', name: 'CustomVariableList', component: () => import('./views/registries/custom-variables/custom-variables-list.vue'),
      },
      {
        path: '/registry/customvariables/edit/:id?', name: 'CustomVariableEdit', component: () => import('./views/registries/custom-variables/custom-variables-edit.vue'),
      },
      {
        path: '/registry/carousel/list', name: 'carouselRegistryList', component: () => import('./views/registries/carousel-overlay/carousel-overlay-list.vue'),
      },
      {
        path: '/registry/carousel/edit/:id?', name: 'carouselRegistryEdit', component: () => import('./views/registries/carousel-overlay/carousel-overlay-edit.vue'),
      },
      {
        path: '/registry/obswebsocket/list', name: 'OBSWebsocketRegistryList', component: () => import('./views/registries/obswebsocket.vue'),
      },
      {
        path: '/registry/obswebsocket/edit/:id?', name: 'OBSWebsocketRegistryEdit', component: () => import('./views/registries/obswebsocket.vue'),
      },
      {
        path: '/registry/overlays/list', name: 'overlaysList', component: () => import('./views/registries/overlays/overlays.vue'),
      },
      {
        path: '/registry/randomizer/list', name: 'RandomizerRegistryList', component: () => import('./views/registries/randomizer/randomizer-list.vue'),
      },
      {
        path: '/registry/randomizer/edit/:id?', name: 'RandomizerRegistryEdit', component: () => import('./views/registries/randomizer/randomizer-edit.vue'),
      },
      {
        path: '/registry/textoverlay/list', name: 'TextOverlayList', component: () => import('./views/registries/text-overlay/text-overlay-list.vue'),
      },
      {
        path: '/registry/textoverlay/edit/:id?', name: 'TextOverlayEdit', component: () => import('./views/registries/text-overlay/text-overlay-edit.vue'),
      },
      {
        path: '/registry/gallery/list', name: 'galleryRegistryEdit', component: () => import('./views/registries/gallery/gallery-list.vue'),
      },
      {
        path: '/registry/goals/list', name: 'GoalsRegistryList', component: () => import('./views/registries/goals/goals-list.vue'),
      },
      {
        path: '/registry/goals/edit/:id?', name: 'GoalsRegistryEdit', component: () => import('./views/registries/goals/goals-edit.vue'),
      },
    ],
  });

  const VueApp = new Vue({
    store,
    router,
    vuetify,
    components: {
      dashboard:        () => import('./views/dashboard/dashboard.vue'),
      navbar:           () => import('./components/navbar/navbar.vue'),
      statsbar:         () => import('./components/statsbar/statsbar.vue'),
      changegamedialog: () => import('./components/dialog/changegamedialog.vue'),
      footerbar:        () => import('./components/footer.vue'),
    },
    created() {
      // set proper dayjs locale
      setLocale(get(this.$store.state, 'configuration.lang', 'en'));
    },
    template: `
      <v-app id="app">
        <template v-if="$store.state.isUILoaded">
          <navbar/>
          <v-main>
            <!--statsbar/>
            <dashboard
              class="view pt-1"
              :style="{
                visibility: $route.path === '/' ? 'visible' : 'hidden',
                position: $route.path === '/' ? 'inherit' : 'absolute'
              }"
            />
            <router-view
              class="view pt-1"
              :style="{
                visibility: $route.path !== '/' ? 'visible' : 'hidden',
                position: $route.path !== '/' ? 'inherit' : 'absolute'
              }"
            />
            <footerbar/-->
          </v-main>
        </template>
        <v-overlay :value="!$store.state.isUILoaded" :dark="$vuetify.theme.dark">
          <v-row>
            <v-col class="text-center">
              <v-progress-circular indeterminate size="48"></v-progress-circular>
            </v-col>
          </v-row>
          <v-row>
            <v-col class="font-weight-light">
              {{ $store.state.loadingMsg }}
            </v-col>
          </v-row>
        </v-overlay>
      </v-app>
    `,
  }).$mount('#app');

  VueApp.$vuetify.theme.dark = (localStorage.getItem('theme') || 'dark') === 'dark';
  await isBotStarted();

  await getTranslations();
  store.commit('setConfiguration', await getConfiguration());
  await populateListOf('core');
  await populateListOf('systems');
  await populateListOf('integrations');

  Vue.prototype.$core = await getListOf('core');
  Vue.prototype.$systems = getListOf('systems');
  Vue.prototype.$integrations = await getListOf('integrations');

  console.debug({
    core:         Vue.prototype.$core,
    systems:      Vue.prototype.$systems,
    integrations: Vue.prototype.$integrations,
  });

  await getTranslations();
  store.commit('setLoggedUser', await isUserLoggedIn(false, false));

  const configuration = await getConfiguration();
  store.commit('setConfiguration', configuration);
  setLocale(configuration.lang as string);
  store.commit('setUILoaded');
};

main();
