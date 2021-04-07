<template>
  <v-edit-dialog
    persistent
    large
    @open="open"
    @cancel="close"
    @save="save"
  >
    <v-chip
      x-small
      :color="item.isFollower ? 'success' : 'error'"
    >
      <v-icon
        v-if="item.haveFollowerLock"
        x-small
      >
        {{ mdiLock }}
      </v-icon>
      Follower
    </v-chip>
    <template #input>
      <v-container
        fluid
        style="max-width:fit-content"
      >
        <v-btn-toggle
          class="no-opacity"
          v-model="data"
          multiple
          dense
        >
          <v-btn
            :color="itemUpdated.haveFollowerLock ? 'success' : 'error'"
            small
          >
            <v-icon>{{ mdiLock }}</v-icon>
          </v-btn>
          <v-btn
            :color="itemUpdated.isFollower ? 'success' : 'error'"
            small
          >
            Follower
          </v-btn>
        </v-btn-toggle>
      </v-container>
    </template>
  </v-edit-dialog>
</template>
<script lang="ts">
import { mdiLock } from '@mdi/js';
import {
  computed, defineComponent, ref,
} from '@vue/composition-api';
import { cloneDeep } from 'lodash-es';

import { UserInterface } from 'src/bot/database/entity/user';

export default defineComponent({
  props: { item: Object },
  setup(props: {
    item: UserInterface,
  }, ctx) {
    let itemBackup: UserInterface = cloneDeep(props.item);
    const itemUpdated = ref(cloneDeep(props.item));
    const data = computed<number[]>({
      set(value) {
        itemUpdated.value.haveFollowerLock = value.includes(0);
        itemUpdated.value.isFollower = value.includes(1);
        return true;
      },
      get() {
        const toReturn = [];
        if (itemUpdated.value.haveFollowerLock) {
          toReturn.push(0);
        }
        if (itemUpdated.value.isFollower) {
          toReturn.push(1);
        }
        return toReturn;
      },
    });

    const open = () => {
      itemBackup = cloneDeep(props.item);
    };

    const save = () => {
      ctx.emit('save', itemUpdated.value);
    };

    const close = () => {
      ctx.emit('close');
      itemUpdated.value = itemBackup; // revert
    };

    return {
      itemUpdated,
      close,
      save,
      mdiLock,
      open,
      data,
    };
  },
});
</script>

<style scoped>
.no-opacity>.v-btn.v-btn {
  opacity: 1 !important;
}
</style>