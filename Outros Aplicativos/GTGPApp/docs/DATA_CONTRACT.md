# Contrato de dados do GTGP

## Fonte de dados e atualização

- O repositório não contém o workbook de origem. O importador recebe o caminho do XLSX pela variável de ambiente `GTGP_WORKBOOK_PATH`; forneça um arquivo autorizado mantido fora do repositório.
- O importador lê e exporta somente a primeira aba, pela ordem do workbook. As demais abas não são usadas nem unidas aos registros exibidos.
- Em tempo de execução, o painel também aceita snapshots antigos com as abas `Base_Principal` e `TB_Agente`; valida a estrutura antiga e usa somente `Base_Principal`, sem combinar dados de `TB_Agente`.
- A primeira aba precisa ter `Matricula` e `Nome`. Todos os cabeçalhos devem estar preenchidos e produzir chaves normalizadas únicas; dados em colunas sem cabeçalho causam erro.
- `Matricula` deve ser interpretada e transportada como texto. O importador converte todos os valores de célula em texto e usa os valores formatados do XLSX; não converte matrículas para números nem regrava o workbook.
- `GTGP_WORKBOOK_SIMULATED` aceita `true` ou `false`; o padrão é `false`. Use `true` somente para uma fonte de demonstração.
- Informe o caminho externo em `GTGP_WORKBOOK_PATH` e execute `npm run import:workbook`. Isso gera `gas/src/data/WorkbookData.gs` para o Apps Script e `.artifacts/gtgp-workbook.json` para a prévia local. Ambos são derivados e nunca devem ser editados manualmente.
- `hash` é o SHA-256 dos bytes do arquivo. No contrato público, `source.version` é esse mesmo hash hexadecimal em minúsculas. Uma alteração nos bytes da fonte produz uma nova versão.
- O manifesto Apps Script usa `access: MYSELF` enquanto a fonte não estiver classificada como demonstração. Envio e publicação são etapas manuais separadas da importação local.

O importador exige `GTGP_WORKBOOK_PATH` e falha com uma mensagem de incompatibilidade se não houver uma primeira aba, se faltar um cabeçalho obrigatório, se houver cabeçalhos vazios ou chaves normalizadas duplicadas, ou se houver dados além das colunas cabeçalhadas. Ele não imprime linhas nem valores da planilha no terminal.

## Artefato de origem para Apps Script

`GTGP_WORKBOOK_DATA` é um objeto global gerado em `gas/src/data/WorkbookData.gs`:

```js
{
  fileName: "<nome do arquivo XLSX fornecido>",
  hash: "<sha256 hexadecimal>",
  simulated: false,
  sheets: [
    {
      name: "Base_Principal",
      headers: [{ key: "matricula", original: "Matricula" }],
      rows: [{ matricula: "<texto>" }]
    }
  ]
}
```

`headers[].original` preserva o texto original do cabeçalho; `headers[].key` usa a normalização compatível com o painel atual: remover diacríticos, converter para minúsculas e retirar caracteres que não sejam letras ASCII ou números. Cada objeto em `rows` usa essas chaves, e todos os valores, inclusive matrícula, são strings. Linhas totalmente vazias são omitidas. O artefato contém exatamente a primeira aba.

## API pública do Apps Script

### Leitura

Função pública: `gtgpGetDashboardData()`.

Sucesso:

```js
{
  ok: true,
  data: {
    source: { fileName, sheetName, version, simulated },
    fields,
    people,
    quality
  }
}
```

Erro:

```js
{ ok: false, error: { code, message } }
```

`fields` é uma lista de `{ key, label, source }`. `key` é a chave normalizada; `label` usa o rótulo de apresentação configurado ou o cabeçalho original; `source` contém somente o nome da primeira aba.

`people` é uma lista de `{ id, matricula, values, sources }`. `id` identifica cada linha da primeira aba; `matricula` é sempre texto; `values` contém os campos dessa linha; `sources` contém somente a primeira aba. Valores vazios permanecem vazios, sem serem convertidos em zero. Matrículas ausentes ou repetidas não removem linhas.

`quality` contém as seguintes contagens da primeira aba:

| Chave | Significado |
| --- | --- |
| `rowCount` | Linhas de dados não vazias. |
| `duplicateIds` | Ocorrências repetidas de matrícula não vazia depois da primeira. |
| `missingIds` | Linhas de dados sem matrícula. |
| `blankNames` | Linhas com `Nome` vazio. |

Os códigos de erro são identificadores estáveis em maiúsculas com `_`; a mensagem explica o problema sem expor valores de linhas.

### Exportação

Função pública: `gtgpExportDashboardXlsx(payload)`. O payload contém apenas `{ ids, fields }`, em que ambos são listas: `ids` contém identificadores de pessoas retornados pela leitura e `fields` contém chaves permitidas em `data.fields`. O Apps Script deve validar as duas listas contra os dados e a lista de campos permitidos; não deve receber cópias de registros ou valores de campo enviados pelo cliente.
