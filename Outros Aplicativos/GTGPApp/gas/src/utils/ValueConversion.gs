function gtgpNumberText_(value) {
  var raw = gtgpText_(value);
  if (!raw) return null;

  var normalized = raw.indexOf(',') >= 0
    ? raw.replace(/\./g, '').replace(',', '.')
    : raw;

  return Number.isFinite(Number(normalized)) ? normalized : null;
}

function gtgpUtf8Bytes_(value) {
  var bytes = Utilities.newBlob(String(value), 'text/plain').getBytes();
  for (var index = 0; index < bytes.length; index += 1) {
    if (bytes[index] < 0) bytes[index] += 256;
  }
  return bytes;
}

function gtgpBase64Encode_(unsignedBytes) {
  var signedBytes = unsignedBytes.map(function (value) {
    return value > 127 ? value - 256 : value;
  });
  return Utilities.base64Encode(signedBytes);
}
