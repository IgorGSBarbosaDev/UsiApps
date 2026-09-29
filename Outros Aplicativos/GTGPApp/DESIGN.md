---
name: "GT/GP · Painel de gestão"
description: "Painel de consulta da base simulada de programas GT/GP."
colors:
  deep-green: "#123d2a"
  usiminas-lime: "#84bd00"
  canvas: "#f5f7f3"
  surface: "#ffffff"
  foreground: "#19251c"
  muted-foreground: "#536055"
  border: "#d9e0d6"
  destructive: "#b42318"
  chart-green: "#537d3b"
  chart-sage: "#9bb583"
  chart-ochre: "#d1a12b"
typography:
  interface:
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
rounded:
  panel: "0.75rem"
  sidebar-item: "8px"
  badge: "6px"
---

# Design System: GT/GP

## Overview

O painel transforma o snapshot simulado do workbook canônico em telas de consulta. A identidade visual usa navegação verde escura, acentos Usiminas e superfícies claras. A hierarquia prioriza a visão geral, a busca de pessoas, as avaliações e as verificações de qualidade.

## Colors and typography

Use verde escuro para estrutura e ações principais; reserve o verde Usiminas para identidade, seleção e destaque. Neutros claros separam conteúdo sem competir com os dados.

A interface usa a pilha de fontes do sistema, sem fontes externas. Títulos de página ficam entre 23 e 26px; títulos de painel, próximos de 15px; descrições e rótulos usam tamanhos menores com contraste legível. Números comparáveis usam algarismos tabulares.

## Layout

O shell desktop tem navegação lateral, barra superior e área principal limitada em largura. A visão geral começa com indicadores em grade, segue com distribuições e termina com uma amostra de registros. Em telas estreitas, indicadores e gráficos se reorganizam; tabelas largas mantêm rolagem horizontal para preservar campos.

## Surfaces and components

- **Navegação:** marca GT/GP, acesso às quatro telas e indicação do nome/versão da fonte simulada.
- **Barra superior:** contexto da tela, estado dos dados, atualização do snapshot e exportação XLSX.
- **Visão geral:** indicadores, distribuições em SVG, resumos e amostra de pessoas.
- **Pessoas:** busca, filtros, seleção de colunas, tabela paginada e acesso ao perfil completo.
- **Avaliações:** resumo de cobertura e barras para valores preenchidos. Ausência nunca é nota zero.
- **Qualidade:** contagens de matrícula, duplicidades, correspondências e nomes, com estados compreensíveis.
- **Perfil:** diálogo com os campos disponíveis agrupados para leitura.
- **Estados:** carregamento, erro, fonte vazia e resultados de filtro vazios devem explicar o estado e oferecer a próxima ação aplicável.

## Do's and Don'ts

- Mantenha `dashboardGTGP/Base GTGP.xlsx` como fonte canônica dos dados simulados.
- Preserve todos os campos e trate `Matricula` como texto ao unir as abas `Base_Principal` e `TB_Agente`.
- Mantenha valores ausentes em branco e preserve a natureza somente leitura do painel.
- Identifique a demonstração como simulada na interface e na prévia local.
- Não apresente edição de registros no painel nem introduza dados reais no snapshot de demonstração.
- Preserve texto curto, contraste entre títulos e metadados e largura legível das tabelas.
