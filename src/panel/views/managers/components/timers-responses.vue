<template>
  <v-dialog
    v-model="dialog"
    transition="dialog-bottom-transition"
    fullscreen
    hide-overlay
    large
  >
    <template #activator="{ on, attrs }">
      <div
        v-bind="attrs"
        v-on="on"
      >
        <span
          v-if="responsesUpdated.length === 0"
          class="text--lighten-1  red--text"
        >{{ translate('systems.customcommands.no-responses-set') }}</span>
        <span v-else>
          {{ responsesUpdated.length }}
        </span>
      </div>
    </template>

    <v-card>
      <v-card-title class="headline">
        Update <code class="mx-2">{{ name }}</code> {{ translate('response').toLowerCase() }}
      </v-card-title>

      <v-card-text>
        <draggable
          v-model="responsesUpdated"
          draggable=".item"
          handle=".handle"
        >
          <v-list-item
            v-for="(r, i) of responsesUpdated"
            :key="'response' + i"
            class="item"
          >
            <v-list-item-content>
              <v-row>
                <v-col
                  cols="12"
                >
                  <v-lazy>
                    <v-textarea
                      v-model="responsesUpdated[i].response"
                      hide-details="auto"
                      :label="translate('response') + '#' + (i + 1)"
                      :rows="1"
                      counter
                      auto-grow
                      :autofocus="i === 0"
                      @keydown.enter.prevent
                    >
                      <template #prepend>
                        <v-icon class="handle">
                          {{ mdiDrag }}
                        </v-icon>
                      </template>
                      <template #append>
                        <input-variables
                          :filters="['sender']"
                          @input="responsesUpdated[i].response = responsesUpdated[i].response + $event"
                        />
                      </template>
                      <template #append-outer>
                        <v-btn
                          icon
                          @click="responsesUpdated[i].isEnabled = !responsesUpdated[i].isEnabled"
                        >
                          <v-icon v-if="responsesUpdated[i].isEnabled">
                            {{ mdiCheckboxMarkedCircle }}
                          </v-icon>
                          <v-icon v-else>
                            {{ mdiCheckboxBlankCircleOutline }}
                          </v-icon>
                        </v-btn>
                        <v-btn
                          icon
                          @click="remove(i)"
                        >
                          <v-icon>{{ mdiTrashCan }}</v-icon>
                        </v-btn>
                      </template>
                    </v-textarea>
                  </v-lazy>
                </v-col>
              </v-row>
            </v-list-item-content>
          </v-list-item>
        </draggable>
      </v-card-text>

      <v-card-actions>
        <v-btn @click="responsesUpdated.push({ order: Date.now(), response: '', isEnabled: true })">
          {{ translate('systems.customcommands.addResponse') }}
        </v-btn>
        <v-spacer />
        <v-btn
          color="blue darken-1"
          text
          @click="close"
        >
          Close
        </v-btn>
        <v-btn
          color="blue darken-1"
          text
          @click="save"
        >
          Save
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script lang="ts">
import {
  mdiCheckboxBlankCircleOutline, mdiCheckboxMarkedCircle, mdiDrag, mdiTrashCan, 
} from '@mdi/js';
import {
  defineAsyncComponent, defineComponent, ref, watch,
} from '@vue/composition-api';
import { cloneDeep } from 'lodash-es';
import { capitalize } from 'lodash-es';
import draggable from 'vuedraggable';

import { TimerResponseInterface } from 'src/bot/database/entity/timer';
import translate from 'src/panel/helpers/translate';

export default defineComponent({
  components: {
    draggable,
    'input-variables': defineAsyncComponent({ loader: () => import('src/panel/components/inputVariables.vue') }),
  },
  props: { responses: Array, name: String },
  setup(props, ctx) {
    let responsesBackup: any[] = [];
    const responsesUpdated = ref((props.responses ?? []) as TimerResponseInterface[]);
    const dialog = ref(false);

    watch(dialog, (val) => {
      if (val) {
        responsesBackup = cloneDeep(props.responses ?? []);
      }
    });

    const save = () => {
      responsesUpdated.value = responsesUpdated.value.filter(item => item.response.trim().length > 0);
      ctx.emit('save', responsesUpdated.value);
      dialog.value = false;
    };

    const close = () => {
      ctx.emit('close');
      responsesUpdated.value = responsesBackup; // revert
      dialog.value = false;
    };

    const remove = (idx: number) => {
      console.log({ idx });
      responsesUpdated.value.splice(idx, 1);
    };

    return {
      translate,
      dialog,
      capitalize,
      close,
      save,
      remove,
      responsesUpdated,
      mdiDrag, mdiTrashCan, mdiCheckboxMarkedCircle, mdiCheckboxBlankCircleOutline,
    };
  },
});
</script>
