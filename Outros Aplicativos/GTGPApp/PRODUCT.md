# Produto — Painel GT/GP

## Plataforma

Web App do Google Apps Script com `HtmlService`, JavaScript, HTML e CSS nativos. Node.js/npm são usados somente para `clasp`, importação do workbook e geração da prévia local.

## Propósito

Apresentar os registros GT/GP em uma interface de consulta com visão geral, pesquisa de pessoas, avaliações, qualidade dos dados e exportação XLSX. O painel é somente leitura: não altera a fonte nem recebe edição de registros.

## Fonte e dados

- Fonte de importação: workbook XLSX autorizado fornecido fora do repositório por `GTGP_WORKBOOK_PATH`.
- Aba de origem: somente a primeira aba do workbook; as demais não são consideradas nem unidas.
- `Matricula` é transportada como texto e identifica as linhas sem descartar duplicatas ou matrículas vazias.
- O snapshot é gerado para o Apps Script e para a prévia local; não há leitura de Google Sheets em tempo de execução. Os dados são considerados não simulados por padrão, a menos que `GTGP_WORKBOOK_SIMULATED=true` seja informado.
- Campos vazios permanecem vazios e não são tratados como zero.

## Pessoas usuárias e contexto

O painel atende à consulta da base GT/GP e à revisão de lacunas nos registros da primeira aba importada. A prévia local usa os artefatos gerados e pode ser aberta como arquivo HTML independente.

## Capacidades

- Visão geral com Ativos, percentual de APs, percentual de Mulheres, percentual Industrial e percentual do Pool RH.
- Distribuição por programa e distribuição organizacional pela estrutura final do CEO, com agrupamento por VP.
- Pesquisa e filtros de pessoas, seleção de colunas e perfil com os campos disponíveis.
- Resumo de avaliações e campos ausentes.
- Verificações de matrículas duplicadas ou vazias e nomes vazios.
- Exportação XLSX dos registros e campos selecionados, sem escrita na fonte.

## Regras da visão geral

- Ativos conta as linhas de pessoas da primeira aba importada. Os percentuais usam todas essas pessoas como denominador.
- APs prioriza `Potencial 2026.1`; quando vazio, usa o potencial preenchido mais recente disponível para aquela pessoa. A quantidade sem avaliação registrada aparece no apoio do indicador.
- Mulheres conta `Sexo` feminino. Industrial conta `Industrial` em `Industrial/Staff`; qualquer outro valor, inclusive vazio, conta como Staff. Pool RH conta `Status Trainee` igual a `Pool RH`.
- O gráfico organizacional considera somente `AreaFimCEO1` a `AreaFimCEO5`. Para `VP`, se `AreaFimCEO1` não for Siderurgia, agrupa diretamente por `AreaFimCEO1`; caso contrário usa `AreaFimCEO3`, exceto quando esse campo indicar CEO-Presidency, situação em que usa `AreaFimCEO4`.
- A Visão geral mantém a distribuição por programa e não apresenta etapas do ciclo 2026.2 nem a amostra tabular de registros.

## Limites operacionais

- Atualizar os dados exige fornecer o novo XLSX externo por `GTGP_WORKBOOK_PATH` e regenerar `WorkbookData.gs` e o JSON local com `npm run import:workbook`.
- O snapshot incorporado ao Apps Script só chega ao projeto remoto após sincronização com `clasp`; a implantação versionada precisa ser atualizada separadamente.
- `gas/appsscript.json` usa `executeAs: USER_DEPLOYING` e `access: MYSELF`; sincronização Apps Script e atualização de implantação continuam separadas da importação local.

## Diretrizes de interface

- Manter verde Usiminas `#84bd00` e verde escuro.
- Usar navegação simples, hierarquia legível e HTML semântico.
- Distinguir campos ausentes de valores zero e mostrar a origem dos dados.
