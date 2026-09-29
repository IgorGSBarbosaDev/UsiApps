# Painel GT/GP — MVP

Aplicativo Google Apps Script com visual desktop, navegação lateral e painéis de pessoas, avaliações e qualidade dos dados.

## Fonte de dados

A planilha editável **GT-GP - Base de Dados (MVP)** está [neste Google Sheets](https://docs.google.com/spreadsheets/d/1LU6Vej6ZgEx_urYH-I4JyDss2Tl8fsWNc2NvZAtIBdw/edit). Ela contém `Base_Principal`, `TB_Agente`, `Controle` e `Instruções`. As duas abas de dados começam sem registros; cole seus dados a partir da linha 2 e mantenha a linha de cabeçalhos.

O workbook fornecido tem dados inteiramente simulados. Eles aparecem somente na prévia local `preview.html` e não foram copiados para a planilha editável. O MVP não integra com Microsoft Graph, SharePoint ou outros produtos Microsoft. O painel conectado lê as abas e não grava nelas.

## Prévia local

Abra `preview.html` diretamente no navegador para ver o painel com a amostra simulada, sem Apps Script ou conexão à rede. A prévia identifica a fonte sintética e os botões refletem que a amostra local foi atualizada.

## Desenvolvimento e operação

```powershell
npm install
npm run typecheck
npm run build
npm run dev -- --mode preview
```

O build atualiza a prévia e `gas/Index.html`. Consulte [o plano e as instruções de operação](docs/IMPLEMENTATION.md). O código do Apps Script está em `gas/`; sincronização e implantação aguardam o Clasp estar autenticado na mesma conta Google que tem acesso à planilha. `.clasp.json`, `.clasprc.json`, `.artifacts/` e credenciais ficam fora do Git.
