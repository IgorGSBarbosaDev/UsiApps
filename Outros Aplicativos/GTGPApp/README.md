# Painel GT/GP

Painel somente leitura implementado com Google Apps Script nativo: `HtmlService`, JavaScript, HTML e CSS. O painel exibe um snapshot importado de um workbook XLSX externo; não lê nem grava uma Google Sheet em tempo de execução.

## Fonte de dados

A pasta do repositório não mantém uma cópia do workbook. Para regenerar os dados, informe em `GTGP_WORKBOOK_PATH` o caminho de um arquivo XLSX mantido fora do repositório. O importador usa somente a primeira aba, mantém `Matricula` como texto e ignora as demais abas. Os dados são tratados como não simulados por padrão; para uma fonte de demonstração, defina `GTGP_WORKBOOK_SIMULATED=true` durante a importação.

O snapshot já incluído no código Apps Script e os artefatos locais são derivados de um workbook. Remover o arquivo-fonte do repositório não remove esse snapshot nem altera o painel publicado. O contrato, as validações e o formato dos artefatos estão em [docs/DATA_CONTRACT.md](docs/DATA_CONTRACT.md).

## Regenerar dados e abrir a prévia

Execute na pasta `Outros Aplicativos/GTGPApp`:

```powershell
npm install
$env:GTGP_WORKBOOK_PATH = "C:\caminho\fora-do-repositorio\Base GTGP.xlsx"
npm run import:workbook
npm run preview:local
Remove-Item Env:GTGP_WORKBOOK_PATH
```

O caminho pode apontar para um XLSX autorizado fora do repositório. O importador gera `gas/src/data/WorkbookData.gs` e `.artifacts/gtgp-workbook.json`. Depois, o gerador monta a prévia local independente em `preview.html`. Abra esse arquivo diretamente no navegador; a prévia usa o snapshot importado e não precisa de Apps Script nem de servidor de desenvolvimento.

## Organização

- `gas/src/Code.gs`: entrada do Web App e inclusão de templates HTML.
- `gas/src/controllers/`: funções públicas do Apps Script para leitura dos dados e exportação XLSX.
- `gas/src/services/`: regras para montar o painel e gerar o arquivo exportado.
- `gas/src/repositories/`: validação e leitura do snapshot incorporado ao código.
- `gas/src/data/WorkbookData.gs`: snapshot da primeira aba gerado pelo importador.
- `gas/src/views/`: HTML, CSS e JavaScript do navegador, separados em views e controladores de interface.
- `scripts/import-workbook.mjs`: importação do XLSX informado em `GTGP_WORKBOOK_PATH`.
- `gas/scripts/build-local-preview.mjs`: montagem da prévia sem framework de frontend.

## Sincronização e publicação

`npx @google/clasp push`, executado na raiz de `GTGPApp`, sincroniza os arquivos locais de `gas/` com o projeto Apps Script indicado pelo `.clasp.json` local. Essa operação não envia alterações ao Git e não atualiza, por si só, a implantação Web App versionada. Para publicar código novo, é necessário criar uma versão e atualizar a implantação separadamente. Os passos estão em [docs/IMPLEMENTATION.md](docs/IMPLEMENTATION.md).

O `.clasp.json` permanece local e ignorado pelo Git. O manifesto usa `access: MYSELF` enquanto a fonte não estiver explicitamente classificada como demonstração. O envio ao Apps Script e a atualização da implantação são etapas separadas e não são executadas pela importação local.
