function doGet() {
  return HtmlService.createTemplateFromFile('src/views/Index').evaluate()
    .setTitle('GT/GP · Painel de gestão')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function gtgpInclude(fileName) {
  return HtmlService.createHtmlOutputFromFile(fileName).getContent();
}
