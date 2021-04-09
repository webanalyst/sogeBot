<template>
  <v-form
    ref="form"
    v-model="valid"
    lazy-validation
  >
    <v-text-field
      v-model="rank"
      :label="translate('rank')"
      :rules="rules.rank"
      hide-details="auto"
      :clearable="true"
      required
      counter
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

import { RankInterface } from 'src/bot/database/entity/rank';
import translate from 'src/panel/helpers/translate';

export default defineComponent({
  props: { rules: Object },
  setup(props, ctx) {
    const rank = ref('');
    const newItemSaving = ref(false);
    const valid = ref(true);

    const form = ref(null);

    const newItem = async () => {
      if ((form.value as unknown as HTMLFormElement).validate()) {
        newItemSaving.value = true;
        const item: RankInterface<null> = {
          id:    uuid(),
          value: 0,
          rank:  rank.value,
          type:  null,
        };
        console.log('Saving', { item });
        ctx.emit('save', item);
        newItemSaving.value = false;
      }

    };

    const closeDlg = () => {
      ctx.emit('close');
    };

    return {
      translate,
      rank,
      newItemSaving,
      newItem,
      valid,
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
