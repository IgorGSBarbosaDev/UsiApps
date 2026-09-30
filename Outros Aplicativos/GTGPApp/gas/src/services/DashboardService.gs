function gtgpBuildDashboardData_() {
  var workbook = gtgpReadWorkbook_();
  var baseRows = gtgpGetNonEmptyRows_(workbook.baseSheet);
  var agentRows = gtgpGetNonEmptyRows_(workbook.agentSheet);
  var baseIds = gtgpIdSet_(baseRows);
  var agentIds = gtgpIdSet_(agentRows);
  var quality = {
    baseRows: baseRows.length,
    agentRows: agentRows.length,
    duplicateBaseIds: gtgpDuplicateCount_(baseRows),
    duplicateAgentIds: gtgpDuplicateCount_(agentRows),
    missingBaseIds: gtgpMissingIdCount_(baseRows),
    missingAgentIds: gtgpMissingIdCount_(agentRows),
    unmatchedBaseRows: gtgpUnmatchedCount_(baseRows, agentIds),
    unmatchedAgentRows: gtgpUnmatchedCount_(agentRows, baseIds),
    blankNames: baseRows.filter(function (row) {
      return !gtgpText_(row.values[gtgpConfig.nameKey]);
    }).length
  };

  return {
    source: {
      fileName: workbook.fileName,
      version: workbook.version,
      simulated: workbook.simulated
    },
    fields: gtgpBuildFields_(workbook.baseSheet, workbook.agentSheet),
    people: gtgpBuildPeople_(baseRows, agentRows),
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

function gtgpIdSet_(rows) {
  var ids = new Set();
  rows.forEach(function (row) {
    var id = gtgpNormalizeId_(row.values[gtgpConfig.joinKey]);
    if (id) ids.add(id);
  });
  return ids;
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

function gtgpUnmatchedCount_(rows, otherIds) {
  return rows.filter(function (row) {
    var id = gtgpNormalizeId_(row.values[gtgpConfig.joinKey]);
    return Boolean(id) && !otherIds.has(id);
  }).length;
}

function gtgpBuildFields_(baseSheet, agentSheet) {
  var fieldsByKey = new Map();
  [baseSheet, agentSheet].forEach(function (sheet) {
    sheet.headers.forEach(function (header) {
      var field = fieldsByKey.get(header.key);
      if (!field) {
        field = {
          key: header.key,
          label: gtgpHasOwn_(gtgpConfig.fieldLabels, header.key)
            ? gtgpConfig.fieldLabels[header.key]
            : gtgpText_(header.original),
          source: []
        };
        fieldsByKey.set(header.key, field);
      }
      if (field.source.indexOf(sheet.name) < 0) field.source.push(sheet.name);
    });
  });
  return Array.from(fieldsByKey.values());
}

function gtgpBuildPeople_(baseRows, agentRows) {
  var records = [];
  var firstBaseById = new Map();
  var serial = 0;

  baseRows.forEach(function (row) {
    serial += 1;
    var matricula = gtgpText_(row.values[gtgpConfig.joinKey]);
    var normalizedId = gtgpNormalizeId_(matricula);
    var duplicate = Boolean(normalizedId && firstBaseById.has(normalizedId));
    var id = normalizedId && !duplicate
      ? 'id:' + normalizedId
      : 'base:' + (row.sourceIndex + 2) + ':' + serial;
    var person = {
      id: id,
      matricula: matricula,
      values: Object.assign({}, row.values),
      sources: [gtgpConfig.baseSheetName]
    };
    records.push(person);
    if (normalizedId && !firstBaseById.has(normalizedId)) {
      firstBaseById.set(normalizedId, person);
    }
  });

  agentRows.forEach(function (row) {
    var matricula = gtgpText_(row.values[gtgpConfig.joinKey]);
    var normalizedId = gtgpNormalizeId_(matricula);
    var target = normalizedId ? firstBaseById.get(normalizedId) : null;

    if (!target) {
      serial += 1;
      target = {
        id: normalizedId
          ? 'agent:' + normalizedId + ':' + (row.sourceIndex + 2)
          : 'agent:' + (row.sourceIndex + 2) + ':' + serial,
        matricula: matricula,
        values: {},
        sources: []
      };
      records.push(target);
    }

    Object.keys(row.values).forEach(function (key) {
      var value = row.values[key];
      if (value !== '' && (target.values[key] === undefined || target.values[key] === '')) {
        target.values[key] = value;
      }
    });
    if (target.sources.indexOf(gtgpConfig.agentSheetName) < 0) {
      target.sources.push(gtgpConfig.agentSheetName);
    }
  });

  records.sort(function (left, right) {
    return String(left.values[gtgpConfig.nameKey] || '')
      .localeCompare(String(right.values[gtgpConfig.nameKey] || ''), 'pt-BR');
  });
  return records;
}
