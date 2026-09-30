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
    (workbook.simulated !== true && workbook.simulated !== false) ||
    !Array.isArray(workbook.sheets) ||
    (workbook.sheets.length !== 1 && workbook.sheets.length !== 2)
  ) {
    gtgpRaise_('WORKBOOK_SCHEMA_INVALID');
  }

  var baseSheet = workbook.sheets[0];
  if (!gtgpIsObject_(baseSheet) || typeof baseSheet.name !== 'string' || !baseSheet.name) {
    gtgpRaise_('WORKBOOK_SCHEMA_INVALID');
  }
  if (workbook.sheets.length === 2) {
    var legacyAgentSheet = workbook.sheets[1];
    if (
      baseSheet.name !== gtgpConfig.legacyBaseSheetName ||
      !gtgpIsObject_(legacyAgentSheet) ||
      legacyAgentSheet.name !== gtgpConfig.legacyAgentSheetName
    ) {
      gtgpRaise_('WORKBOOK_SCHEMA_INVALID');
    }
    gtgpValidateSheet_(legacyAgentSheet, [gtgpConfig.joinKey]);
  }
  gtgpValidateSheet_(baseSheet, [gtgpConfig.joinKey, gtgpConfig.nameKey]);

  return {
    fileName: workbook.fileName,
    version: workbook.hash,
    simulated: workbook.simulated,
    baseSheet: baseSheet
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
