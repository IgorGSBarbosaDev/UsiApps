# Contrato de dados do GTGP

## Fonte canônica e atualização

- A fonte canônica é `dashboardGTGP/Base GTGP.xlsx`, localizada dois níveis acima da raiz deste projeto. O importador resolve esse caminho a partir de `scripts/import-workbook.mjs`; não depende do diretório atual do terminal.
- Todos os registros desta fonte são simulados. O artefato gerado mantém `simulated: true` para identificá-los em toda resposta do painel.
- Para atualizar a fonte, substitua ou atualize somente o workbook canônico, mantendo as abas `Base_Principal` e `TB_Agente`. `Base_Principal` requer `Matricula` e `Nome`; `TB_Agente` requer `Matricula`. Cabeçalhos precisam ser preenchidos e produzir chaves normalizadas únicas em cada aba.
- `Matricula` deve ser interpretada e transportada como texto. O importador converte todos os valores de célula em texto e usa os valores formatados do XLSX; não converte matrículas para números nem regrava o workbook.
- Depois de atualizar a fonte, execute `npm run import:workbook`. Isso gera `gas/src/data/WorkbookData.gs` para o Apps Script e `.artifacts/gtgp-workbook.json` para a prévia local. Ambos são derivados e nunca devem ser editados manualmente.
- `hash` é o SHA-256 dos bytes do arquivo. No contrato público, `source.version` é esse mesmo hash hexadecimal em minúsculas. Uma alteração nos bytes da fonte produz uma nova versão.
- Mantenha `simulated: true` enquanto os registros forem simulados. Uma eventual troca para dados reais exige revisão e autorização próprias; não altere esse indicador como parte de uma atualização comum do workbook.

O importador falha com uma mensagem de incompatibilidade se faltar uma aba ou cabeçalho obrigatório, se houver cabeçalhos vazios ou chaves normalizadas duplicadas, ou se houver dados além das colunas cabeçalhadas. Ele não imprime linhas nem valores da planilha no terminal.

## Artefato de origem para Apps Script

`GTGP_WORKBOOK_DATA` é um objeto global gerado em `gas/src/data/WorkbookData.gs`:

```js
{
  fileName: "Base GTGP.xlsx",
  hash: "<sha256 hexadecimal>",
  simulated: true,
  sheets: [
    {
      name: "Base_Principal",
      headers: [{ key: "matricula", original: "Matricula" }],
      rows: [{ matricula: "<texto>" }]
    }
  ]
}
```

`headers[].original` preserva o texto original do cabeçalho; `headers[].key` usa a normalização compatível com o painel atual: remover diacríticos, converter para minúsculas e retirar caracteres que não sejam letras ASCII ou números. Cada objeto em `rows` usa essas chaves, e todos os valores, inclusive matrícula, são strings. Linhas totalmente vazias são omitidas. Só as duas abas de dados requeridas são exportadas para o artefato.

## API pública do Apps Script

### Leitura

Função pública: `gtgpGetDashboardData()`.

Sucesso:

```js
{
  ok: true,
  data: {
    source: { fileName, version, simulated },
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

`fields` é uma lista de `{ key, label, source }`. `key` é a chave normalizada; `label` é um rótulo de apresentação (com o cabeçalho original como alternativa); `source` é uma lista com os nomes das abas que fornecem o campo.

`people` é uma lista de `{ id, matricula, values, sources }`. `id` identifica unicamente o registro de pessoa na resposta; `matricula` é sempre texto; `values` é um mapa de chaves de campo para valores textuais; e `sources` lista as abas que contribuíram com valores para a pessoa. Valores vazios permanecem vazios, sem serem convertidos em zero.

Quando a mesma pessoa aparece nas duas abas, `Base_Principal` é a fonte prioritária: um valor já preenchido nela é preservado. `TB_Agente` complementa os campos que estiverem vazios na base e também mantém registros sem correspondência. Essa regra vale igualmente para qualquer campo compartilhado pelas abas.

`quality` preserva as métricas atuais:

| Chave | Significado |
| --- | --- |
| `baseRows` / `agentRows` | Linhas de dados não vazias em `Base_Principal` / `TB_Agente`. |
| `duplicateBaseIds` / `duplicateAgentIds` | Ocorrências repetidas de matrícula não vazia depois da primeira em cada aba. |
| `missingBaseIds` / `missingAgentIds` | Linhas de dados sem matrícula em cada aba. |
| `unmatchedBaseRows` / `unmatchedAgentRows` | Linhas com matrícula que não encontra correspondência na outra aba. |
| `blankNames` | Linhas de `Base_Principal` com `Nome` vazio. |

Os códigos de erro são identificadores estáveis em maiúsculas com `_`; a mensagem explica o problema sem expor valores de linhas.

### Exportação

Função pública: `gtgpExportDashboardXlsx(payload)`. O payload contém apenas `{ ids, fields }`, em que ambos são listas: `ids` contém identificadores de pessoas retornados pela leitura e `fields` contém chaves permitidas em `data.fields`. O Apps Script deve validar as duas listas contra os dados e a lista de campos permitidos; não deve receber cópias de registros ou valores de campo enviados pelo cliente.

## Limite desta etapa

Este contrato fixa o formato dos dados e das funções públicas para os Planos 2 e 3. Não define nem implementa controllers, services, repositories, telas ou a exportação em si.
