function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('GT/GP · Painel de gestão')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function getDashboardData() {
  const spreadsheet = getSpreadsheet_();
  const sheets = DATA_TABS.map(function (name) {
    const sheet = spreadsheet.getSheetByName(name);
    if (!sheet) {
      throw new Error('A aba "' + name + '" não foi encontrada. Use as abas já criadas e mantenha seus nomes.');
    }

    const matrix = sheet.getDataRange().getDisplayValues();
    const headers = matrix.length ? matrix[0].map(function (value) { return String(value || '').trim(); }) : [];
    const rows = matrix.slice(1)
      .filter(function (row) {
        return row.some(function (value) { return String(value || '').trim() !== ''; });
      })
      .map(function (row) { return row.map(function (value) { return String(value || '').trim(); }); });

    if (!headers.length || headers.every(function (header) { return !header; })) {
      throw new Error('A aba "' + name + '" está sem cabeçalhos. Restaure a primeira linha conforme a aba Instruções.');
    }

    return { name: name, headers: headers, rows: rows };
  });

  return {
    sheets: sheets,
    spreadsheetUrl: SHEET_URL,
    updatedAt: new Date().toISOString(),
    sourceLabel: 'Planilha conectada'
  };
}

function getSpreadsheet_() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}
