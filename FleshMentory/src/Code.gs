function doGet(e) {
  var requestedApp = e && e.parameter && e.parameter.app
    ? String(e.parameter.app).trim().toLowerCase()
    : 'portal';
  var routeFiles = {
    admin: 'src/views/AdminApp',
    portal: 'src/views/PortalApp'
  };
  var templateFile = routeFiles[requestedApp];

  if (!templateFile) {
    throw new Error('Parametro "app" invalido. Use "admin" ou "portal".');
  }

  return HtmlService.createTemplateFromFile(templateFile)
    .evaluate()
    .setTitle(requestedApp === 'admin'
      ? 'Flash Mentoring | Admin RH'
      : 'Flash Mentoring | Portal');
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
