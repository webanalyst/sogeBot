<template>
  <v-form
    ref="form"
    v-model="valid"
    lazy-validation
  >
    <v-textarea
      v-model="newItemCommand"
      hide-details="auto"
      :label="translate('keyword')"
      :rows="1"
      :rules="rule"
      counter
      :clearable="true"
      auto-grow
      required
      @keydown.enter.prevent
    />

    <v-btn
      class="mr-4"
      :loading="newItemSaving"
      :disabled="!valid"
      @click="newItem"
    >
      submit
    </v-btn>

    <v-btn
      class="mr-4"
      @click="closeDlg"
    >
      close
    </v-btn>
  </v-form>
</template>

<script lang="ts">
import { defineComponent, ref } from '@vue/composition-api';
import { v4 as uuid } from 'uuid';

import type { KeywordInterface } from 'src/bot/database/entity/keyword';
import { getSocket } from 'src/panel/helpers/socket';
import translate from 'src/panel/helpers/translate';
import {
  isValidRegex, minLength, required, 
} from 'src/panel/helpers/validators';

const socket = { keyword: getSocket('/systems/keywords') } as const;

export default defineComponent({
  setup(props, ctx) {
    const newItemCommand = ref('');
    const newItemSaving = ref(false);
    const valid = ref(true);

    const form = ref(null);

    const rule = [
      minLength(2), required, isValidRegex,
    ];

    const newItem = async () => {
      newItemSaving.value = true;
      if ((form.value as unknown as HTMLFormElement).validate()) {
        await new Promise((resolve) => {
          const item: KeywordInterface = {
            id:        uuid(),
            keyword:   newItemCommand.value,
            responses: [],
            enabled:   true,
          };
          console.log('Saving', { item });
          socket.keyword.emit('generic::setById', { id: item.id, item }, () => {
            resolve(true);
            ctx.emit('save');
          });
        });
      }

      newItemSaving.value = false;
    };

    const closeDlg = () => {
      ctx.emit('close');
    };

    return {
      translate,
      required,
      newItemCommand,
      newItemSaving,
      newItem,
      valid,
      rule,
      closeDlg,
      form,
    };
  },
});
</script>

<style>
tr:nth-of-type(odd) {
  background-color: rgba(0, 0, 0, .05);
}
</style>
