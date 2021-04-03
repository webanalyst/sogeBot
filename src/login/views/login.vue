<template>
  <v-container class="center">
    <h4
      v-if="error === 'must+be+caster'"
      class="red--text text-center"
    >
      <v-icon
        class="red--text"
        size="8rem"
      >
        {{ mdiCloseCircleOutline }}
      </v-icon>
      <div>Insufficient permission.</div>
      <v-row class="mt-3">
        <v-col>
          <v-btn
            block
            color="success"
            @click="login"
          >
            Login
          </v-btn>
        </v-col>
        <v-col>
          <v-btn
            block
            color="info"
            @click="publicPage"
          >
            Public page
          </v-btn>
        </v-col>
      </v-row>
    </h4>
    <h4
      v-if="error === 'logged+out'"
      class="green--text text-center"
    >
      <v-icon
        class="green--text"
        size="8rem"
      >
        {{ mdiCheckboxMarkedCircleOutline }}
      </v-icon>
      <div>You have successfully logged out.</div>
      <v-row class="mt-3">
        <v-col>
          <v-btn
            block
            color="success"
            @click="login"
          >
            Login
          </v-btn>
        </v-col>
        <v-col>
          <v-btn
            block
            color="info"
            @click="publicPage"
          >
            Public page
          </v-btn>
        </v-col>
      </v-row>
    </h4>
    <h4
      v-if="error === 'popout+must+be+logged'"
      class="red--text text-center"
    >
      <v-icon
        class="red--text"
        size="8rem"
      >
        {{ mdiCloseCircleOutline }}
      </v-icon>
      <div>Cannot access without login.</div>
      <v-row class="mt-3">
        <v-col>
          <v-btn
            block
            color="success"
            @click="login"
          >
            Login
          </v-btn>
        </v-col>
        <v-col>
          <v-btn
            block
            color="primary"
            @click="tryAgain"
          >
            Try again
          </v-btn>
        </v-col>
      </v-row>
    </h4>
  </v-container>
</template>

<script lang="ts">
import { mdiCheckboxMarkedCircleOutline, mdiCloseCircleOutline  } from '@mdi/js';
import {
  computed, defineComponent, onMounted,
} from '@vue/composition-api';

export default defineComponent({
  setup() {
    const error = computed(() => {
      const hash = window.location.hash;
      if (hash.trim().length > 0) {
        const errorFromHash = hash.match(/error=[a-zA-Z0-9+]*/);
        if (errorFromHash) {
          return errorFromHash[0].split('=')[1];
        }
      }
      return null;
    });
    const url = computed(() => window.location.origin);
    const publicPage = () => {
      window.location.assign(url.value + '/public/');
    };
    const tryAgain =  () => {
      const gotoAfterLogin = sessionStorage.getItem('goto-after-login');
      if (gotoAfterLogin) {
        window.location.assign(gotoAfterLogin);
      } else {
        // go back history
        window.history.back();
      }
    };
    const login = () => {
      window.location.assign('http://oauth.sogebot.xyz/?state=' + encodeURIComponent(window.btoa(
        JSON.stringify({
          url:      url.value,
          referrer: document.referrer,
        }),
      )));
    };
    onMounted(() => {
      const hash = window.location.hash;
      if (hash.trim().length === 0) {
        // autorefresh
        login();
      }
    });
    return {
      error, url, login, publicPage, tryAgain,

      mdiCheckboxMarkedCircleOutline,
      mdiCloseCircleOutline,
    };
  },
});
</script>

<style>
  .center {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: max-content;
  }
  .v-application {
    background: repeating-linear-gradient(
      -55deg,
      #222,
      #222 10px,
      #333 10px,
      #333 20px
    ) !important;
  }
</style>