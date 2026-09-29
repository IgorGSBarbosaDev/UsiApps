var gtgpApiErrors = {
  WORKBOOK_DATA_UNAVAILABLE: 'A fonte canônica não foi carregada pelo importador do workbook.',
  WORKBOOK_SCHEMA_INVALID: 'A fonte canônica está incompatível com o contrato de dados.',
  INVALID_EXPORT_PAYLOAD: 'Envie somente as listas de identificadores e campos.',
  INVALID_EXPORT_IDS: 'A seleção contém registros indisponíveis para exportação.',
  INVALID_EXPORT_FIELDS: 'A seleção contém campos não autorizados para exportação.',
  INTERNAL_ERROR: 'Não foi possível concluir a solicitação.'
};

function gtgpApiSuccess_(data) {
  return { ok: true, data: data };
}

function gtgpApiFailure_(error) {
  var code = error && error.gtgpCode;
  if (!code || !Object.prototype.hasOwnProperty.call(gtgpApiErrors, code)) {
    code = 'INTERNAL_ERROR';
  }

  return {
    ok: false,
    error: {
      code: code,
      message: gtgpApiErrors[code]
    }
  };
}

function gtgpRaise_(code) {
  var error = new Error(gtgpApiErrors[code] || gtgpApiErrors.INTERNAL_ERROR);
  error.gtgpCode = Object.prototype.hasOwnProperty.call(gtgpApiErrors, code)
    ? code
    : 'INTERNAL_ERROR';
  throw error;
}
