<template>
  <v-btn
    :color="color(_value)"
    @click="toggleValue"
  >
    <v-icon class="pr-2">
      <template v-if="_value === true">
        {{ mdiCheck }}
      </template>
      <template v-else-if="_value === false">
        {{ mdiExclamationThick }}
      </template>
      <template v-else>
        {{ mdiHelp }}
      </template>
    </v-icon>
    <slot />
  </v-btn>
</template>

<script lang="ts">
import {
  mdiHelp, mdiCheck, mdiExclamationThick,
} from '@mdi/js';
import {
  defineComponent, ref, watch,
} from '@vue/composition-api';

export default defineComponent({
  props: { value: [Boolean, Object] },
  setup(props, ctx) {
    const _value = ref(props.value);

    watch(_value, (val) => {
      ctx.emit('save', val);
    });

    const toggleValue = () => {
      if (_value.value === true) {
        _value.value = false;
      } else if (_value.value === false) {
        _value.value = null;
      } else if (_value.value === null) {
        _value.value = true;
      }
    };

    const color = (value: null | boolean) => {
      if (value === true) {
        return 'success';
      } else if (value === false) {
        return 'error';
      } else {
        return 'grey darken-4';
      }
    }

    return {
      toggleValue,
      _value,
      color,
      mdiExclamationThick, mdiCheck, mdiHelp,
    };
  },
});
</script>
