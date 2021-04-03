import VueCompositionAPI from '@vue/composition-api';
import Vue from 'vue';
import VueRouter from 'vue-router';

import vuetify from '../panel/vuetify'; // path to vuetify export

Vue.use(VueRouter);
Vue.use(VueCompositionAPI);

const init = async () => {
  const router = new VueRouter({
    mode:   'history',
    base:   __dirname,
    routes: [
      {
        path: '/login', name: 'login', component: () => import('./views/login.vue'),
      },
    ],
  });

  new Vue({
    router,
    vuetify,
    template: `
      <v-app id="app">
        <router-view class="view"></router-view>
      </v-app>
    `,
  }).$mount('#login');
};

init();
