import { persistent } from '../core/persistent';

const gameCache = persistent({
  value:     '',
  name:      'gameCache',
  namespace: '/core/api',
});

const rawStatus = persistent({
  value:     '',
  name:      'rawStatus',
  namespace: '/core/api',
});

export { rawStatus, gameCache };