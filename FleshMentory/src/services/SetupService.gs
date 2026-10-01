function setupFlashMentoringData_() {
  return withDataWriteLock_(function() {
    var spreadsheet = getConfiguredSpreadsheet_();
    var sheetNames = ensureDatabaseSchema_(spreadsheet);
    PropertiesService.getScriptProperties().setProperty(
      'FLASH_MENTORING_SCHEMA_VERSION',
      FLASH_MENTORING_CONFIG.schemaVersion
    );
    return {
      configured: true,
      schemaVersion: FLASH_MENTORING_CONFIG.schemaVersion,
      sheets: sheetNames
    };
  });
}
