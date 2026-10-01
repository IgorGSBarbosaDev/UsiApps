function getFlashMentoringRepositories_() {
  var repositories = {};
  Object.keys(FLASH_MENTORING_SCHEMAS).forEach(function(sheetName) {
    repositories[sheetName] = createSheetRepository_(sheetName);
  });
  return repositories;
}
