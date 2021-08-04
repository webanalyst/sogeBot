import { getRepository } from 'typeorm';

import { Variable } from '../../database/entity/variable';
import { announce, prepare } from '../commons';
import { setValueOf } from './setValueOf';

async function postURL(req: any, res: any) {
  try {
    const variable = (await getRepository(Variable).find({ relations: ['urls'] }))
      .find(v => {
        return v.urls.find(url => url.id === req.params.id);
      });
    if (variable) {
      if (variable.urls.find(url => url.id === req.params.id)?.POST) {
        const value = await setValueOf(variable, req.body.value, { sender: null, readOnlyBypass: true });
        if (value.isOk) {
          if (variable.urls.find(url => url.id === req.params.id)?.showResponse) {
            if (value.updated.responseType === 0) {
              announce(prepare('filters.setVariable', { value: value.setValue, variable: variable.variableName }), 'general', false);
            } else if (value.updated.responseType === 1) {
              if (value.updated.responseText) {
                announce(value.updated.responseText.replace('$value', value.setValue), 'general');
              }
            }
          }
          return res.status(200).send({ oldValue: variable.currentValue, value: value.setValue });
        } else {
          return res.status(400).send({ error: 'This value is not applicable for this endpoint', code: 400 });
        }
      } else {
        return res.status(403).send({ error: 'This endpoint is not enabled for POST', code: 403 });
      }
    } else {
      return res.status(404).send({ error: 'Variable not found', code: 404 });
    }
  } catch (e) /* istanbul ignore next */ {
    res.status(500).send({ error: 'Internal Server Error', code: 500 });
    throw e;
  }
}

export { postURL };