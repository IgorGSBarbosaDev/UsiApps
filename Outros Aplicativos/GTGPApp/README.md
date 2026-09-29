# Painel GT/GP

Painel somente leitura implementado com Google Apps Script nativo: `HtmlService`, JavaScript, HTML e CSS. A versão atual usa um snapshot derivado de dados inteiramente simulados; não lê nem grava uma Google Sheet em tempo de execução.

## Fonte de dados

A fonte canônica é [`dashboardGTGP/Base GTGP.xlsx`](../../dashboardGTGP/Base%20GTGP.xlsx), na raiz deste repositório. O importador consome as abas `Base_Principal` e `TB_Agente` e une os registros por `Matricula`, mantida como texto. Todos os dados são simulados.

O snapshot incluído no Apps Script e os artefatos locais são derivados do workbook. Atualizar o arquivo XLSX não altera automaticamente o painel publicado. O contrato, validações e formato dos artefatos estão em [docs/DATA_CONTRACT.md](docs/DATA_CONTRACT.md).

## Regenerar dados e abrir a prévia

Execute na pasta `Outros Aplicativos/GTGPApp`:

```powershell
npm install
npm run import:workbook
npm run preview:local
```

O importador gera `gas/src/data/WorkbookData.gs` e `.artifacts/gtgp-workbook.json`. Depois, o gerador monta a prévia local independente em `preview.html`. Abra esse arquivo diretamente no navegador; a prévia usa o snapshot simulado local e não precisa de Apps Script nem de servidor de desenvolvimento.

## Organização

- `gas/src/Code.gs`: entrada do Web App e inclusão de templates HTML.
- `gas/src/controllers/`: funções públicas do Apps Script para leitura dos dados e exportação XLSX.
- `gas/src/services/`: regras para montar o painel e gerar o arquivo exportado.
- `gas/src/repositories/`: validação e leitura do snapshot incorporado ao código.
- `gas/src/data/WorkbookData.gs`: dados simulados gerados pelo importador.
- `gas/src/views/`: HTML, CSS e JavaScript do navegador, separados em views e controladores de interface.
- `scripts/import-workbook.mjs`: importação do XLSX canônico.
- `gas/scripts/build-local-preview.mjs`: montagem da prévia sem framework de frontend.

## Sincronização e publicação

`npx @google/clasp push`, executado na raiz de `GTGPApp`, sincroniza os arquivos locais de `gas/` com o projeto Apps Script indicado pelo `.clasp.json` local. Essa operação não envia alterações ao Git e não atualiza, por si só, a implantação Web App versionada. Para publicar código novo, é necessário criar uma versão e atualizar a implantação separadamente. Os passos estão em [docs/IMPLEMENTATION.md](docs/IMPLEMENTATION.md).

O `.clasp.json` permanece local e ignorado pelo Git. O manifesto preserva os valores atuais de `executeAs` e `access`; os dados devem continuar simulados enquanto o acesso estiver configurado como `ANYONE`.
