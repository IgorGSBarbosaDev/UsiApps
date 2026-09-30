function gtgpBuildDashboardData_() {
  var workbook = gtgpReadWorkbook_();
  var baseRows = gtgpGetNonEmptyRows_(workbook.baseSheet);
  var quality = {
    rowCount: baseRows.length,
    duplicateIds: gtgpDuplicateCount_(baseRows),
    missingIds: gtgpMissingIdCount_(baseRows),
    blankNames: baseRows.filter(function (row) {
      return !gtgpText_(row.values[gtgpConfig.nameKey]);
    }).length
  };

  return {
    source: {
      fileName: workbook.fileName,
      sheetName: workbook.baseSheet.name,
      version: workbook.version,
      simulated: workbook.simulated
    },
    fields: gtgpBuildFields_(workbook.baseSheet),
    people: gtgpBuildPeople_(baseRows, workbook.baseSheet.name),
    quality: quality
  };
}

function gtgpGetNonEmptyRows_(sheet) {
  return sheet.rows
    .map(function (row, index) {
      var values = {};
      sheet.headers.forEach(function (header) {
        values[header.key] = gtgpText_(row[header.key]);
      });
      return { values: values, sourceIndex: index };
    })
    .filter(function (row) {
      return Object.keys(row.values).some(function (key) {
        return row.values[key] !== '';
      });
    });
}

function gtgpDuplicateCount_(rows) {
  var seen = new Set();
  var duplicates = 0;
  rows.forEach(function (row) {
    var id = gtgpNormalizeId_(row.values[gtgpConfig.joinKey]);
    if (!id) return;
    if (seen.has(id)) duplicates += 1;
    else seen.add(id);
  });
  return duplicates;
}

function gtgpMissingIdCount_(rows) {
  return rows.filter(function (row) {
    return !gtgpNormalizeId_(row.values[gtgpConfig.joinKey]);
  }).length;
}

function gtgpBuildFields_(baseSheet) {
  var fieldsByKey = new Map();
  baseSheet.headers.forEach(function (header) {
    fieldsByKey.set(header.key, {
      key: header.key,
      label: gtgpHasOwn_(gtgpConfig.fieldLabels, header.key)
        ? gtgpConfig.fieldLabels[header.key]
        : gtgpText_(header.original),
      source: [baseSheet.name]
    });
  });
  return Array.from(fieldsByKey.values());
}

function gtgpBuildPeople_(baseRows, sourceSheetName) {
  var records = [];
  var seenIds = new Set();
  var serial = 0;

  baseRows.forEach(function (row) {
    serial += 1;
    var matricula = gtgpText_(row.values[gtgpConfig.joinKey]);
    var normalizedId = gtgpNormalizeId_(matricula);
    var duplicate = Boolean(normalizedId && seenIds.has(normalizedId));
    var id = normalizedId && !duplicate
      ? 'id:' + normalizedId
      : 'base:' + (row.sourceIndex + 2) + ':' + serial;
    records.push({
      id: id,
      matricula: matricula,
      values: Object.assign({}, row.values),
      sources: [sourceSheetName]
    });
    if (normalizedId) seenIds.add(normalizedId);
  });

  records.sort(function (left, right) {
    return String(left.values[gtgpConfig.nameKey] || '')
      .localeCompare(String(right.values[gtgpConfig.nameKey] || ''), 'pt-BR');
  });
  return records;
}
