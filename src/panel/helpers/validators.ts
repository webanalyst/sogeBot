const required = (v?: string) => (typeof v === 'string' && v.length > 0) || 'This value is required';
const minLength = (length: number) => {
  return (v?: string) => (typeof v === 'string' && v.length > length) || 'Min length of this value is ' + length;
};

const startsWithExclamation = (v?: string) => (typeof v === 'string' && v.length > 0 && v[0] === '!') || 'Must start with !';
const startsWithExclamationOrCustomVariable = (v?: string) => (typeof v === 'string' && v.length > 0 && (v[0] === '!' || v[0] === '$')) || 'Must start with ! or should be custom variable';

export {
  required, minLength, startsWithExclamation, startsWithExclamationOrCustomVariable, 
};