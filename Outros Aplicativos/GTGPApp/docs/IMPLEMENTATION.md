# Implementação do Painel GT/GP

## Fonte de verdade e fluxo de dados

O repositório não contém o workbook de origem. Informe o caminho do XLSX externo por `GTGP_WORKBOOK_PATH`. O importador exige as abas `Base_Principal` e `TB_Agente`, valida cabeçalhos e chaves, transporta `Matricula` como texto e mantém `simulated: true`.

O painel junta as duas abas por `Matricula`. `scripts/import-workbook.mjs` gera `gas/src/data/WorkbookData.gs` para o Apps Script e `.artifacts/gtgp-workbook.json` para a prévia. Esses arquivos são derivados e não devem ser editados manualmente. O Apps Script consome o snapshot incluído no projeto e não consulta uma planilha remota.

## Regeneração e prévia local

Na pasta `Outros Aplicativos/GTGPApp`, após instalar as dependências npm necessárias, configure a variável para apontar a um workbook autorizado fora do repositório:

```powershell
$env:GTGP_WORKBOOK_PATH = "C:\caminho\fora-do-repositorio\Base GTGP.xlsx"
npm run import:workbook
npm run preview:local
Remove-Item Env:GTGP_WORKBOOK_PATH
```

O primeiro comando atualiza os dois artefatos derivados a partir do XLSX informado. O segundo carrega as regras dos arquivos `.gs` no runtime local do Node.js e as executa sobre o JSON derivado, depois compõe as views de `gas/src/views/` em `preview.html`. Assim, a prévia e o Apps Script compartilham as regras de domínio. Abra `preview.html` diretamente no navegador; a adaptação local simula apenas a ponte `google.script.run` e usa exclusivamente dados marcados como simulados.

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
| `scripts/import-workbook.mjs` | Lê e valida o XLSX indicado por `GTGP_WORKBOOK_PATH` e grava os artefatos derivados. |

## Sincronização com Apps Script e implantação

O `.clasp.json` fica local, ignorado pelo Git e não deve ser copiado para documentação. Na raiz de `GTGPApp`, `npx @google/clasp push` envia os arquivos locais de `gas/` ao projeto Apps Script configurado. Isso sincroniza o código remoto, mas não altera o repositório Git e não atualiza automaticamente uma implantação Web App versionada.

Para atualizar uma implantação existente, primeiro crie uma nova versão do projeto Apps Script e depois aponte a implantação para essa versão em **Deploy > Manage deployments**. `clasp version` e `clasp redeploy` também são operações separadas do `clasp push`. Uma nova implantação criada com `clasp deploy` não equivale a atualizar a implantação existente. Consulte a [documentação oficial do clasp](https://developers.google.com/apps-script/guides/clasp) e de [versões e implantações](https://developers.google.com/apps-script/concepts/deployments).

O push do Git é independente e sincroniza commits com o remoto Git. Para confirmar o estado do projeto Apps Script, consulte as implantações e versões com `npx @google/clasp deployments` e `npx @google/clasp versions`; esses comandos são somente de leitura. Registre separadamente os resultados de sincronização Git, envio de código e atualização de implantação.

## Configuração Apps Script

`gas/appsscript.json` mantém o fuso `America/Sao_Paulo`, `executeAs` e `access` existentes. O escopo OAuth de Sheets foi removido porque o painel usa o snapshot gerado e não acessa uma planilha em tempo de execução. Os dados continuam inteiramente simulados; mudanças para dados reais exigem revisão própria de dados e acesso.
