function gtgpReadWorkbook_() {
  if (typeof GTGP_WORKBOOK_DATA === 'undefined') {
    gtgpRaise_('WORKBOOK_DATA_UNAVAILABLE');
  }

  var workbook = GTGP_WORKBOOK_DATA;
  if (
    !gtgpIsObject_(workbook) ||
    typeof workbook.fileName !== 'string' ||
    !workbook.fileName ||
    typeof workbook.hash !== 'string' ||
    !/^[a-f0-9]{64}$/.test(workbook.hash) ||
    workbook.simulated !== true ||
    !Array.isArray(workbook.sheets) ||
    workbook.sheets.length !== 2
  ) {
    gtgpRaise_('WORKBOOK_SCHEMA_INVALID');
  }

  var baseSheet = null;
  var agentSheet = null;
  workbook.sheets.forEach(function (sheet) {
    if (!gtgpIsObject_(sheet)) gtgpRaise_('WORKBOOK_SCHEMA_INVALID');
    if (sheet.name === gtgpConfig.baseSheetName) {
      if (baseSheet) gtgpRaise_('WORKBOOK_SCHEMA_INVALID');
      baseSheet = sheet;
    } else if (sheet.name === gtgpConfig.agentSheetName) {
      if (agentSheet) gtgpRaise_('WORKBOOK_SCHEMA_INVALID');
      agentSheet = sheet;
    } else {
      gtgpRaise_('WORKBOOK_SCHEMA_INVALID');
    }
  });

  gtgpValidateSheet_(baseSheet, [gtgpConfig.joinKey, gtgpConfig.nameKey]);
  gtgpValidateSheet_(agentSheet, [gtgpConfig.joinKey]);

  return {
    fileName: workbook.fileName,
    version: workbook.hash,
    simulated: workbook.simulated,
    baseSheet: baseSheet,
    agentSheet: agentSheet
  };
}

function gtgpValidateSheet_(sheet, requiredKeys) {
  if (!sheet || !Array.isArray(sheet.headers) || !Array.isArray(sheet.rows)) {
    gtgpRaise_('WORKBOOK_SCHEMA_INVALID');
  }

  var headerKeys = Object.create(null);
  sheet.headers.forEach(function (header) {
    if (
      !gtgpIsObject_(header) ||
      typeof header.key !== 'string' ||
      !header.key ||
      typeof header.original !== 'string' ||
      !header.original ||
      header.key !== gtgpNormalizeFieldKey_(header.original) ||
      gtgpHasOwn_(headerKeys, header.key)
    ) {
      gtgpRaise_('WORKBOOK_SCHEMA_INVALID');
    }
    headerKeys[header.key] = true;
  });

  requiredKeys.forEach(function (key) {
    if (!gtgpHasOwn_(headerKeys, key)) gtgpRaise_('WORKBOOK_SCHEMA_INVALID');
  });

  sheet.rows.forEach(function (row) {
    if (!gtgpIsObject_(row)) gtgpRaise_('WORKBOOK_SCHEMA_INVALID');
    Object.keys(row).forEach(function (key) {
      if (!gtgpHasOwn_(headerKeys, key) || typeof row[key] !== 'string') {
        gtgpRaise_('WORKBOOK_SCHEMA_INVALID');
      }
    });
  });
}
