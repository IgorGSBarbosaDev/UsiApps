function gtgpBuildDashboardXlsx_(payload) {
  var selected = gtgpValidateExportPayload_(payload);
  var dashboard = gtgpBuildDashboardData_();
  var fieldsByKey = new Map();
  var peopleById = new Map();

  dashboard.fields.forEach(function (field) {
    fieldsByKey.set(field.key, field);
  });
  dashboard.people.forEach(function (person) {
    peopleById.set(person.id, person);
  });

  var fields = selected.fields.map(function (key) {
    var field = fieldsByKey.get(key);
    if (!field) gtgpRaise_('INVALID_EXPORT_FIELDS');
    return field;
  });
  var people = selected.ids.map(function (id) {
    var person = peopleById.get(id);
    if (!person) gtgpRaise_('INVALID_EXPORT_IDS');
    return person;
  });

  return {
    name: gtgpConfig.xlsxFilePrefix + new Date().toISOString().slice(0, 10) + '.xlsx',
    mimeType: gtgpConfig.xlsxMimeType,
    contentBase64: gtgpBase64Encode_(gtgpBuildXlsxBytes_(fields, people))
  };
}

function gtgpValidateExportPayload_(payload) {
  if (
    !gtgpIsObject_(payload) ||
    !gtgpHasOwn_(payload, 'ids') ||
    !gtgpHasOwn_(payload, 'fields') ||
    Object.keys(payload).some(function (key) {
      return key !== 'ids' && key !== 'fields';
    })
  ) {
    gtgpRaise_('INVALID_EXPORT_PAYLOAD');
  }

  if (
    !Array.isArray(payload.ids) ||
    payload.ids.some(function (id) {
      return typeof id !== 'string' || !id;
    }) ||
    new Set(payload.ids).size !== payload.ids.length
  ) {
    gtgpRaise_('INVALID_EXPORT_IDS');
  }

  if (
    !Array.isArray(payload.fields) ||
    payload.fields.some(function (key) {
      return typeof key !== 'string' || !key;
    }) ||
    new Set(payload.fields).size !== payload.fields.length
  ) {
    gtgpRaise_('INVALID_EXPORT_FIELDS');
  }

  return { ids: payload.ids.slice(), fields: payload.fields.slice() };
}

function gtgpBuildXlsxBytes_(fields, people) {
  var headerRow = '<row r="1">' + fields.map(function (field, index) {
    return gtgpCellXml_(gtgpColumnName_(index) + '1', field.label, field.key);
  }).join('') + '</row>';
  var rows = people.map(function (person, rowIndex) {
    var rowNumber = rowIndex + 2;
    return '<row r="' + rowNumber + '">' + fields.map(function (field, index) {
      return gtgpCellXml_(
        gtgpColumnName_(index) + rowNumber,
        gtgpText_(person.values[field.key]),
        field.key
      );
    }).join('') + '</row>';
  }).join('');

  var files = {
    '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
      '</Types>',
    '_rels/.rels': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
      '</Relationships>',
    'xl/workbook.xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
      'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
      '<sheet name="' + gtgpXmlText_(gtgpConfig.xlsxSheetName) + '" sheetId="1" r:id="rId1"/>' +
      '</sheets></workbook>',
    'xl/_rels/workbook.xml.rels': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
      '</Relationships>',
    'xl/worksheets/sheet1.xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>' +
      headerRow + rows + '</sheetData></worksheet>'
  };

  return gtgpZipStore_(files);
}

function gtgpCellXml_(reference, value, key) {
  var text = gtgpText_(value);
  if (!text) return '<c r="' + reference + '"/>';

  var isNumericField = gtgpConfig.numericFieldKeys.indexOf(key) >= 0;
  var numberText = isNumericField ? gtgpNumberText_(text) : null;
  if (numberText !== null) {
    return '<c r="' + reference + '"><v>' + numberText + '</v></c>';
  }
  return '<c r="' + reference + '" t="inlineStr"><is><t xml:space="preserve">' +
    gtgpXmlText_(text) + '</t></is></c>';
}

function gtgpXmlText_(value) {
  return String(value)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function gtgpColumnName_(index) {
  var result = '';
  var value = index + 1;
  while (value > 0) {
    var remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }
  return result;
}

function gtgpZipStore_(files) {
  var output = [];
  var entries = [];

  Object.keys(files).forEach(function (name) {
    var nameBytes = gtgpUtf8Bytes_(name);
    var dataBytes = gtgpUtf8Bytes_(files[name]);
    var crc = gtgpCrc32_(dataBytes);
    var localOffset = output.length;

    gtgpZipWrite32_(output, 0x04034b50);
    gtgpZipWrite16_(output, 20);
    gtgpZipWrite16_(output, 0x0800);
    gtgpZipWrite16_(output, 0);
    gtgpZipWrite16_(output, 0);
    gtgpZipWrite16_(output, 0);
    gtgpZipWrite32_(output, crc);
    gtgpZipWrite32_(output, dataBytes.length);
    gtgpZipWrite32_(output, dataBytes.length);
    gtgpZipWrite16_(output, nameBytes.length);
    gtgpZipWrite16_(output, 0);
    gtgpZipWriteBytes_(output, nameBytes);
    gtgpZipWriteBytes_(output, dataBytes);

    entries.push({
      nameBytes: nameBytes,
      crc: crc,
      size: dataBytes.length,
      localOffset: localOffset
    });
  });

  var centralOffset = output.length;
  entries.forEach(function (entry) {
    gtgpZipWrite32_(output, 0x02014b50);
    gtgpZipWrite16_(output, 20);
    gtgpZipWrite16_(output, 20);
    gtgpZipWrite16_(output, 0x0800);
    gtgpZipWrite16_(output, 0);
    gtgpZipWrite16_(output, 0);
    gtgpZipWrite16_(output, 0);
    gtgpZipWrite32_(output, entry.crc);
    gtgpZipWrite32_(output, entry.size);
    gtgpZipWrite32_(output, entry.size);
    gtgpZipWrite16_(output, entry.nameBytes.length);
    gtgpZipWrite16_(output, 0);
    gtgpZipWrite16_(output, 0);
    gtgpZipWrite16_(output, 0);
    gtgpZipWrite16_(output, 0);
    gtgpZipWrite32_(output, 0);
    gtgpZipWrite32_(output, entry.localOffset);
    gtgpZipWriteBytes_(output, entry.nameBytes);
  });
  var centralSize = output.length - centralOffset;

  gtgpZipWrite32_(output, 0x06054b50);
  gtgpZipWrite16_(output, 0);
  gtgpZipWrite16_(output, 0);
  gtgpZipWrite16_(output, entries.length);
  gtgpZipWrite16_(output, entries.length);
  gtgpZipWrite32_(output, centralSize);
  gtgpZipWrite32_(output, centralOffset);
  gtgpZipWrite16_(output, 0);

  return output;
}

function gtgpZipWriteBytes_(target, bytes) {
  for (var index = 0; index < bytes.length; index += 1) {
    target.push(bytes[index]);
  }
}

function gtgpZipWrite16_(target, value) {
  target.push(value & 0xff, (value >>> 8) & 0xff);
}

function gtgpZipWrite32_(target, value) {
  target.push(
    value & 0xff,
    (value >>> 8) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 24) & 0xff
  );
}

function gtgpCrc32_(bytes) {
  var crc = 0xffffffff;
  for (var index = 0; index < bytes.length; index += 1) {
    crc ^= bytes[index];
    for (var bit = 0; bit < 8; bit += 1) {
      crc = (crc & 1) ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}
