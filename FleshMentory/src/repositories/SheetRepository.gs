function getSheetSchema_(sheetName) {
  var schema = FLASH_MENTORING_SCHEMAS[sheetName];
  if (!schema) {
    throw new Error('Schema nao definido para a aba "' + sheetName + '".');
  }
  return schema;
}

function getConfiguredSpreadsheet_() {
  var propertyName = FLASH_MENTORING_CONFIG.spreadsheetIdProperty;
  var spreadsheetId = PropertiesService.getScriptProperties().getProperty(propertyName);
  if (!spreadsheetId || !String(spreadsheetId).trim()) {
    throw new Error(
      'Configuracao pendente: defina a Script Property "' + propertyName + '" ' +
      'com o ID aprovado da planilha de dados.'
    );
  }
  return SpreadsheetApp.openById(String(spreadsheetId).trim());
}

function getSheetHeaders_(sheet) {
  var lastColumn = sheet.getLastColumn();
  if (!lastColumn) return [];
  return sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map(function(value) {
    return value == null ? '' : String(value).trim();
  });
}

function assertSheetSchema_(sheet, sheetName) {
  var expected = getSheetSchema_(sheetName).columns;
  var actual = getSheetHeaders_(sheet);
  var matches = actual.length === expected.length && expected.every(function(header, index) {
    return actual[index] === header;
  });
  if (!matches) {
    throw new Error(
      'A aba "' + sheetName + '" tem cabecalho diferente do schema esperado. ' +
      'Nenhum dado foi alterado nessa aba.'
    );
  }
}

function getManagedSheet_(spreadsheet, sheetName) {
  var sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error(
      'A aba "' + sheetName + '" nao existe. Execute setupFlashMentoringData_ primeiro.'
    );
  }
  assertSheetSchema_(sheet, sheetName);
  return sheet;
}

function withDataWriteLock_(callback) {
  var lock = LockService.getScriptLock();
  lock.waitLock(FLASH_MENTORING_CONFIG.writeLockTimeoutMs);
  try {
    return callback();
  } finally {
    lock.releaseLock();
  }
}

function assertCompatibleExistingSchemas_(spreadsheet) {
  Object.keys(FLASH_MENTORING_SCHEMAS).forEach(function(sheetName) {
    var sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet) return;
    if (sheet.getLastRow() === 0 && sheet.getLastColumn() === 0) return;
    assertSheetSchema_(sheet, sheetName);
  });
}

function ensureSheetSchema_(spreadsheet, sheetName) {
  var schema = getSheetSchema_(sheetName);
  var sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) sheet = spreadsheet.insertSheet(sheetName);

  if (sheet.getLastRow() === 0 && sheet.getLastColumn() === 0) {
    sheet.getRange(1, 1, 1, schema.columns.length).setValues([schema.columns.slice()]);
  } else {
    assertSheetSchema_(sheet, sheetName);
  }
  if (sheet.getFrozenRows() !== 1) sheet.setFrozenRows(1);
  return sheet;
}

function ensureDatabaseSchema_(spreadsheet) {
  var sheetNames = Object.keys(FLASH_MENTORING_SCHEMAS);
  assertCompatibleExistingSchemas_(spreadsheet);
  sheetNames.forEach(function(sheetName) {
    ensureSheetSchema_(spreadsheet, sheetName);
  });
  return sheetNames;
}

function isEmptyRow_(row) {
  return row.every(function(value) {
    return value === '' || value == null;
  });
}

function rowToRecord_(columns, row) {
  var record = {};
  columns.forEach(function(column, index) {
    record[column] = row[index];
  });
  return record;
}

function toSheetCellValue_(value) {
  if (value == null) return '';
  if (typeof value === 'string' && value.charAt(0) === '=') {
    return "'" + value;
  }
  return value;
}

function validateRecordBatch_(records, schema, sheetName) {
  if (!Array.isArray(records)) {
    throw new Error('A gravacao em lote de "' + sheetName + '" exige um array de registros.');
  }

  var allowedFields = Object.create(null);
  schema.columns.forEach(function(column) {
    allowedFields[column] = true;
  });

  var seenKeys = Object.create(null);
  records.forEach(function(record, index) {
    if (!record || typeof record !== 'object' || Array.isArray(record)) {
      throw new Error('Registro invalido no indice ' + index + ' de "' + sheetName + '".');
    }
    Object.keys(record).forEach(function(field) {
      if (!allowedFields[field]) {
        throw new Error('Campo "' + field + '" nao pertence ao schema de "' + sheetName + '".');
      }
    });

    var keyValue = record[schema.keyField];
    var key = keyValue == null ? '' : String(keyValue).trim();
    if (!key) {
      throw new Error('Registro sem chave "' + schema.keyField + '" em "' + sheetName + '".');
    }
    if (seenKeys[key]) {
      throw new Error('Chave duplicada no lote de "' + sheetName + '": ' + key + '.');
    }
    seenKeys[key] = true;
  });
  return records;
}

function recordToRow_(record, columns, existingRow) {
  return columns.map(function(column, index) {
    var hasField = Object.prototype.hasOwnProperty.call(record, column);
    var value = hasField ? record[column] : (existingRow ? existingRow[index] : '');
    return toSheetCellValue_(value);
  });
}

function readRepositoryRows_(sheet, columns) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  return sheet.getRange(2, 1, lastRow - 1, columns.length).getValues();
}

function createSheetRepository_(sheetName) {
  var schema = getSheetSchema_(sheetName);
  var columns = schema.columns;
  var keyIndex = columns.indexOf(schema.keyField);

  function listAll() {
    var sheet = getManagedSheet_(getConfiguredSpreadsheet_(), sheetName);
    return readRepositoryRows_(sheet, columns)
      .filter(function(row) { return !isEmptyRow_(row); })
      .map(function(row) { return rowToRecord_(columns, row); });
  }

  function appendMany(records) {
    var batch = validateRecordBatch_(records, schema, sheetName);
    if (!batch.length) return 0;

    return withDataWriteLock_(function() {
      var sheet = getManagedSheet_(getConfiguredSpreadsheet_(), sheetName);
      var existingRows = readRepositoryRows_(sheet, columns);
      var existingKeys = Object.create(null);
      existingRows.forEach(function(row, index) {
        if (isEmptyRow_(row)) return;
        var key = row[keyIndex] == null ? '' : String(row[keyIndex]).trim();
        if (!key) {
          throw new Error('Linha ' + (index + 2) + ' sem chave em "' + sheetName + '".');
        }
        if (existingKeys[key]) {
          throw new Error('Chave duplicada na aba "' + sheetName + '": ' + key + '.');
        }
        existingKeys[key] = true;
      });
      batch.forEach(function(record) {
        var key = String(record[schema.keyField]).trim();
        if (existingKeys[key]) {
          throw new Error('A chave "' + key + '" ja existe em "' + sheetName + '".');
        }
        existingKeys[key] = true;
      });

      var values = batch.map(function(record) { return recordToRow_(record, columns); });
      sheet.getRange(sheet.getLastRow() + 1, 1, values.length, columns.length).setValues(values);
      return values.length;
    });
  }

  function upsertMany(records) {
    var batch = validateRecordBatch_(records, schema, sheetName);
    if (!batch.length) return { inserted: 0, updated: 0 };

    return withDataWriteLock_(function() {
      var sheet = getManagedSheet_(getConfiguredSpreadsheet_(), sheetName);
      var existingRows = readRepositoryRows_(sheet, columns);
      var rowByKey = Object.create(null);
      existingRows.forEach(function(row, index) {
        if (isEmptyRow_(row)) return;
        var key = row[keyIndex] == null ? '' : String(row[keyIndex]).trim();
        if (!key) {
          throw new Error('Linha ' + (index + 2) + ' sem chave em "' + sheetName + '".');
        }
        if (Object.prototype.hasOwnProperty.call(rowByKey, key)) {
          throw new Error('Chave duplicada na aba "' + sheetName + '": ' + key + '.');
        }
        rowByKey[key] = index;
      });

      var inserted = 0;
      var updated = 0;
      batch.forEach(function(record) {
        var key = String(record[schema.keyField]).trim();
        if (Object.prototype.hasOwnProperty.call(rowByKey, key)) {
          var rowIndex = rowByKey[key];
          existingRows[rowIndex] = recordToRow_(record, columns, existingRows[rowIndex]);
          updated += 1;
        } else {
          rowByKey[key] = existingRows.length;
          existingRows.push(recordToRow_(record, columns));
          inserted += 1;
        }
      });

      if (existingRows.length) {
        sheet.getRange(2, 1, existingRows.length, columns.length).setValues(existingRows);
      }
      return { inserted: inserted, updated: updated };
    });
  }

  return Object.freeze({
    listAll: listAll,
    appendMany: appendMany,
    upsertMany: upsertMany
  });
}
