# Implementação do Painel GT/GP

## Fonte de verdade e fluxo de dados

A fonte canônica é `dashboardGTGP/Base GTGP.xlsx`, na raiz do repositório. O importador exige as abas `Base_Principal` e `TB_Agente`, valida cabeçalhos e chaves, transporta `Matricula` como texto e mantém `simulated: true`.

O painel junta as duas abas por `Matricula`. `scripts/import-workbook.mjs` gera `gas/src/data/WorkbookData.gs` para o Apps Script e `.artifacts/gtgp-workbook.json` para a prévia. Esses arquivos são derivados e não devem ser editados manualmente. O Apps Script consome o snapshot incluído no projeto e não consulta uma planilha remota.

## Regeneração e prévia local

Na pasta `Outros Aplicativos/GTGPApp`, após instalar as dependências npm necessárias:

```powershell
npm run import:workbook
npm run preview:local
```

O primeiro comando atualiza os dois artefatos derivados a partir do XLSX. O segundo usa o JSON e as views de `gas/src/views/` para gerar `preview.html` como arquivo independente. Abra `preview.html` diretamente no navegador. A prévia simula no cliente as respostas do Apps Script e usa exclusivamente os dados marcados como simulados.

## Organização do código

| Pasta/arquivo | Responsabilidade |
| --- | --- |
| `gas/src/Code.gs` | `doGet`, montagem da resposta HTML e inclusão dos templates. |
| `gas/src/controllers/DashboardController.gs` | Entradas públicas do Apps Script e conversão de erros em respostas da API. |
| `gas/src/services/DashboardService.gs` | Campos, união dos registros por matrícula, ordenação e métricas de qualidade. |
| `gas/src/services/XlsxExportService.gs` | Validação da seleção e geração do XLSX para download. |
| `gas/src/repositories/WorkbookRepository.gs` | Validação do snapshot `GTGP_WORKBOOK_DATA` e acesso às abas derivadas. |
| `gas/src/config/GtgpConfig.gs` | Nomes das abas, chave de junção, rótulos e configuração da exportação. |
| `gas/src/utils/` | Normalização, conversão de valores e formato de resposta. |
| `gas/src/data/WorkbookData.gs` | Snapshot simulado gerado pelo importador. |
| `gas/src/views/` | `Index.html` compõe os templates; views renderizam as telas; `DashboardClient.html`, `ExportClient.html` e `AppController.html` coordenam chamadas e interação no navegador; `Styles.html` contém o CSS. |
| `gas/scripts/build-local-preview.mjs` | Gera a prévia HTML local usando as views e o JSON derivado. |
| `scripts/import-workbook.mjs` | Lê e valida o XLSX canônico e grava os artefatos derivados. |

## Sincronização com Apps Script e implantação

O `.clasp.json` fica local, ignorado pelo Git e não deve ser copiado para documentação. Na raiz de `GTGPApp`, `npx @google/clasp push` envia os arquivos locais de `gas/` ao projeto Apps Script configurado. Isso sincroniza o código remoto, mas não altera o repositório Git e não atualiza automaticamente uma implantação Web App versionada.

Para atualizar uma implantação existente, primeiro crie uma nova versão do projeto Apps Script e depois aponte a implantação para essa versão em **Deploy > Manage deployments**. `clasp version` e `clasp redeploy` também são operações separadas do `clasp push`. Uma nova implantação criada com `clasp deploy` não equivale a atualizar a implantação existente. Consulte a [documentação oficial do clasp](https://developers.google.com/apps-script/guides/clasp) e de [versões e implantações](https://developers.google.com/apps-script/concepts/deployments).

O push do Git também é independente: ele sincroniza commits com o remoto Git, não com o Apps Script. Nesta etapa, não foi executado `clasp push`, não foi criada versão Apps Script, não foi atualizada/publicada implantação e não foi feito commit ou push Git.

## Configuração Apps Script

`gas/appsscript.json` mantém o fuso `America/Sao_Paulo`, `executeAs` e `access` existentes. O escopo OAuth de Sheets foi removido porque o painel usa o snapshot gerado e não acessa uma planilha em tempo de execução. Os dados continuam inteiramente simulados; mudanças para dados reais exigem revisão própria de dados e acesso.
