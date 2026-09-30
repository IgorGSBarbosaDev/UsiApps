function gtgpText_(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}

function gtgpNormalizeFieldKey_(value) {
  return gtgpText_(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function gtgpNormalizeId_(value) {
  return gtgpText_(value).replace(/\s+/g, '').toUpperCase();
}

function gtgpIsObject_(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function gtgpHasOwn_(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}
