<template>
  <v-speed-dial
    bottom
    right
    fixed
    open-on-hover
  >
    <template #activator>
      <v-chip
        x-small
        @dblclick="setDebug()"
      >
        {{ version }}
      </v-chip>
    </template>
    <div :title="'API ' + title(data.API)">
      <v-icon :color="color(data.API)">
        mdi-checkbox-blank-circle
      </v-icon>
      API
    </div>
    <div :title="'TMI ' + title(data.TMI)">
      <v-icon :color="color(data.TMI)">
        mdi-checkbox-blank-circle
      </v-icon>
      TMI
    </div>
    <div :title="'SOC ' + title(data.SOC)">
      <v-icon :color="colorMod(data.SOC)">
        mdi-checkbox-blank-circle
      </v-icon>
      SOC
    </div>
    <div :title="'MOD ' + title(data.MOD)">
      <v-icon :color="colorMod(data.MOD)">
        mdi-checkbox-blank-circle
      </v-icon>
      MOD
    </div>
  </v-speed-dial>
</template>

<script lang="ts">
import {
  defineComponent, onMounted, reactive, ref,
} from '@vue/composition-api';

import { getSocket } from '../helpers/socket';

const socket = getSocket('/');

function colorMod(is: boolean) {
  return is ? 'success' : 'red';
}

function color (status: 0 | 1 | 2 | 3) {
  switch (status) {
    case 0:
      return 'red';
    case 1:
      return 'orange';
    case 2:
      return 'orange';
    case 3:
      return 'success';
  }
}

function title(status: 0 | 1 | 2 | 3) {
  switch (status) {
    case 0:
      return 'disconnected';
    case 1:
      return 'connecting';
    case 2:
      return 'reconnecting';
    case 3:
      return 'connected';
  }
}

const setDebug = () => {
  socket.emit('debug::get', (err: null, debugEnv: string) => {
    const debug = prompt('Set debug', debugEnv);
    if (debug !== null) {
      socket.emit('debug::set', debug);
    }
  });
};

export default defineComponent({
  setup() {
    const version = ref('');
    const data: {
      SOC: boolean;
      MOD: boolean;
      API: 0 | 1 | 2 | 3;
      TMI: 0 | 1 | 2 | 3;
    } = reactive({
      SOC: false,
      MOD: false,
      API: 0,
      TMI: 0,
    });

    const refresh = () => {
      socket.emit('connection_status', (dataFromSocket: {
        SOC: boolean;
        MOD: boolean;
        RES: number;
        API: 0 | 1 | 2 | 3;
        TMI: 0 | 1 | 2 | 3;
      }) => {
        data.SOC = true;
        data.MOD = dataFromSocket.MOD;
        data.API = dataFromSocket.API;
        data.TMI = dataFromSocket.TMI;
        setTimeout(() => refresh(), 1000);
      });
    };

    onMounted(() => {
      socket.emit('version', (recvVersion: string) => version.value = recvVersion);
      refresh();
    });

    return {
      version, data, colorMod, color, title, setDebug,
    };
  },
});
</script>
