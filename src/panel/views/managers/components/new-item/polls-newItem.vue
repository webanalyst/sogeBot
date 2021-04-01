<template>
  <v-form
    ref="form"
    v-model="valid"
    lazy-validation
  >
    <v-text-field
      v-model="title"
      :label="capitalize(translate('systems.polls.title'))"
      :rules="rules.title"
      hide-details="auto"
      required
      counter
    />

    <v-select
      v-model="type"
      :items="typeItems"
      :label="capitalize(translate('systems.polls.votingBy'))"
      :return-object="false"
    />
    <v-text-field
      v-for="(option, index) of options"
      :key="'poll-option-' + index"
      v-model="options[index]"
      :label="'Answer ' + String(index + 1)"
      hide-details="auto"
      counter
      :error="isDirtyOptions && validOptions !== true"
      :error-messages="typeof validOptions === 'string' && validOptions.length > 0 && index === 4 ? [validOptions] : undefined"
      @keypress="isDirtyOptions = true"
    />

    <v-btn
      class="mr-4"
      :loading="newItemSaving"
      :disabled="!valid && validOptions !== true"
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
import {
  computed, defineComponent, ref, 
} from '@vue/composition-api';
import { capitalize } from 'lodash-es';

import { PollInterface } from 'src/bot/database/entity/poll';
import { getSocket } from 'src/panel/helpers/socket';
import translate from 'src/panel/helpers/translate';

const socket = { quote: getSocket('/systems/polls') } as const;

export default defineComponent({
  props: { tags: Array, rules: Object },
  setup(props, ctx) {
    const title = ref('');
    const type = ref('normal');
    const options = ref(['', '', '', '', ''] as string[]);
    const isDirtyOptions = ref(false);
    const validOptions = computed((): boolean | string => {
      let valid = true;
      if (isDirtyOptions.value) {
        for (const validator of props.rules?.options) {
          if (!valid) {
            break;
          }
          valid = validator(options.value);
        }
      }
      return valid;
    });

    const typeItems = [
      {
        text:     translate('systems.polls.normal'),
        value:    'normal',
        disabled: false,
      },
      {
        text:     translate('systems.polls.tips'),
        value:    'tips',
        disabled: false,
      },
      {
        text:     translate('systems.polls.numbers'),
        value:    'numbers',
        disabled: false,
      },
      {
        text:     translate('systems.polls.bits'),
        value:    'bits',
        disabled: false,
      },
    ];

    const newItemSaving = ref(false);
    const valid = ref(true);

    const form = ref(null);

    const newItem = async () => {
      isDirtyOptions.value = true;
      if ((form.value as unknown as HTMLFormElement).validate() && validOptions.value === true) {
        newItemSaving.value = true;
        await new Promise((resolve) => {
          const item: PollInterface = {
            id:       undefined,
            type:     (type.value as any),
            title:    title.value,
            options:  options.value.filter(o => o.length > 0),
            isOpened: true,
            openedAt: Date.now(),
          };
          console.log('Saving', { item });
          socket.quote.emit('polls::save', item, () => {
            resolve(true);
            ctx.emit('save');
            newItemSaving.value = false;
          });
        });
      }

    };

    const closeDlg = () => {
      ctx.emit('close');
    };

    return {
      translate,
      title,
      type,
      typeItems,
      newItemSaving,
      newItem,
      valid,
      closeDlg,
      form,
      capitalize,
      options,
      validOptions,
      isDirtyOptions,
    };
  },
});
</script>

<style>
tr:nth-of-type(odd) {
  background-color: rgba(0, 0, 0, .05);
}
</style>
