<template>
  <v-form
    ref="form"
    v-model="valid"
    lazy-validation
  >
    <v-textarea
      v-model="newItemCommand"
      hide-details="auto"
      :label="translate('command')"
      :rows="1"
      :rules="rules.command"
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

import { PriceInterface } from 'src/bot/database/entity/price';
import { getSocket } from 'src/panel/helpers/socket';
import translate from 'src/panel/helpers/translate';
import {
  minLength,required, startsWithExclamation,
} from 'src/panel/helpers/validators';

const socket = { command: getSocket('/systems/price') } as const;

export default defineComponent({
  setup(props, ctx) {
    const newItemCommand = ref('');
    const newItemSaving = ref(false);
    const valid = ref(true);

    const form = ref(null);

    const rules = { command: [startsWithExclamation, minLength(2)] };

    const newItem = async () => {
      newItemSaving.value = true;
      if ((form.value as unknown as HTMLFormElement).validate()) {
        await new Promise((resolve) => {
          const item: PriceInterface = {
            id:              uuid(),
            command:         newItemCommand.value,
            priceBits:       0,
            price:           100,
            enabled:         true,
            emitRedeemEvent: false,
          };
          console.log('Saving', { item });
          socket.command.emit('price::save', item, () => {
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
      startsWithExclamation,
      newItemCommand,
      newItemSaving,
      newItem,
      valid,
      rules,
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
