# Produto — Painel GT/GP

## Plataforma

Web App do Google Apps Script com `HtmlService`, JavaScript, HTML e CSS nativos. Node.js/npm são usados somente para `clasp`, importação do workbook e geração da prévia local.

## Propósito

Apresentar os registros GT/GP em uma interface de consulta com visão geral, pesquisa de pessoas, avaliações, qualidade dos dados e exportação XLSX. O painel é somente leitura: não altera a fonte nem recebe edição de registros.

## Fonte e dados

- Fonte canônica: `dashboardGTGP/Base GTGP.xlsx`.
- Abas de origem: `Base_Principal` e `TB_Agente`.
- Chave de junção: `Matricula`, transportada como texto.
- Todos os registros são simulados. O snapshot é gerado para o Apps Script e para a prévia local; não há leitura de Google Sheets em tempo de execução.
- Campos vazios permanecem vazios e não são tratados como zero.

## Pessoas usuárias e contexto

O painel atende à consulta da base GT/GP e à revisão de lacunas nos registros. O workbook canônico contém somente dados simulados. A prévia local usa os artefatos gerados e pode ser aberta como arquivo HTML independente.

## Capacidades

- Visão geral de totais e distribuições.
- Pesquisa e filtros de pessoas, seleção de colunas e perfil com os campos disponíveis.
- Resumo de avaliações e campos ausentes.
- Verificações de matrículas, correspondências entre abas e nomes vazios.
- Exportação XLSX dos registros e campos selecionados, sem escrita na fonte.

## Limites operacionais

- Atualizar `dashboardGTGP/Base GTGP.xlsx` exige regenerar `WorkbookData.gs` e o JSON local com `npm run import:workbook`.
- O snapshot incorporado ao Apps Script só chega ao projeto remoto após sincronização com `clasp`; a implantação versionada precisa ser atualizada separadamente.
- `gas/appsscript.json` preserva `executeAs: USER_DEPLOYING` e `access: ANYONE`. A configuração de acesso não foi alterada nesta etapa e os registros permanecem simulados.

## Diretrizes de interface

- Manter verde Usiminas `#84bd00` e verde escuro.
- Usar navegação simples, hierarquia legível e HTML semântico.
- Distinguir campos ausentes de valores zero e mostrar a origem dos dados.
