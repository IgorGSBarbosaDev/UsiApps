---
name: "GT/GP · Painel de gestão"
description: "Painel operacional de leitura da base de programas GT/GP."
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

**Direção visual: “Da planilha à leitura operacional.”** O painel organiza uma planilha editável em navegação, indicadores, avaliações e verificações de qualidade. A aparência é sóbria e utilitária: navegação verde escura, destaque Usiminas concentrado em seleção e dados, e conteúdo em superfícies claras com alta legibilidade.

**Características:** shell desktop recolhível; hierarquia por títulos, divisores e painéis; gráficos e tabelas compactos; estados sempre identificam ausência, carga ou falha.

## Colors

A paleta usa verde escuro para estrutura e ações principais, verde Usiminas para seleção e destaque, e neutros claros para separar conteúdo sem competir com os dados.

### Primary
- **Verde profundo** (deep-green): sidebar, botões principais e uma série de gráficos.
- **Verde Usiminas** (usiminas-lime): marca, navegação ativa, pontos de status e primeira série de gráficos.

### Neutral
- **Canvas** (canvas): fundo da área de trabalho.
- **Superfície** (surface): cartões, painéis e tabelas.
- **Texto** (foreground) e **texto secundário** (muted-foreground): títulos e valores; descrições, rótulos e metadados.
- **Divisor** (border): contornos de painéis e separadores internos.

### Named Rules
**Regra do acento funcional.** Reserve o verde Usiminas para seleção, identidade e dados; mantenha a estrutura da navegação no verde profundo e as áreas de leitura neutras.

## Typography

**Interface:** pilha de sistema definida no tema; não há fonte externa nem família display separada.

### Hierarchy
- **Título de página** (peso 670; 26px no desktop, 23px em telas até 820px; line-height 1.2): nome da seção atual.
- **Título de painel** (15px; peso 650): nome do gráfico, tabela ou grupo.
- **Texto de apoio** (13px na introdução da página; normalmente 11–12px em painéis): explicação curta e contextual.
- **Rótulos e células** (10–11px): cabeçalhos, metadados e valores de tabela; números usam algarismos tabulares para facilitar comparação.

## Layout

O primeiro viewport desktop segue o contrato de index.html: sidebar à esquerda, barra superior com contexto e atualização, quatro indicadores em uma faixa e gráficos de distribuição antes da tabela. A sidebar é recolhível por ícone; em telas estreitas vira navegação móvel acionada pela barra superior.

Centralize o conteúdo com largura máxima de 1640px. A página usa margens laterais de 34px no desktop, 24px até 1120px e 14px até 600px; mantenha cerca de 20px entre blocos principais. Indicadores passam de quatro colunas para uma grade 2×2 até 1120px. Gráficos e esqueletos passam de duas colunas para uma até 820px; os dois ciclos também empilham no mobile.

Até 600px, a barra superior fica mais baixa, ações mostram somente ícones e o indicador de sincronização some. Filtros quebram em linhas; resumos e paginação ficam verticais. Tabelas largas rolam horizontalmente em vez de comprimir células ou ocultar campos.

## Elevation & Depth

A profundidade vem da alternância entre o canvas e painéis brancos, contornos sutis e divisores internos. Cartões de dados, tabelas e qualidade não usam sombra; menus e superfícies flutuantes podem manter a sombra discreta dos componentes shadcn.

## Shapes

Use os raios nomeados no frontmatter: painéis arredondados, itens de navegação menos arredondados e badges compactos. Contornos finos definem grupos; tabelas usam linhas divisórias e não viram cartões separados por linha.

## Components

- **Sidebar:** identidade “GT / GP”, navegação com ícones e item ativo preenchido pelo acento; status da fonte e atalho para abrir a planilha ficam no rodapé.
- **Barra superior:** botão de menu, contexto da tela, estado/horário dos dados, atualizar e exportar XLSX. Em mobile, preservar as ações por ícone.
- **Indicadores e Cards:** indicadores relacionados ficam agrupados em faixas com divisores. Cards de gráfico/tabela/qualidade usam cabeçalho com título e descrição, seguido pelo conteúdo.
- **Botões e badges shadcn:** botão principal usa verde profundo; variante outline serve para ações secundárias. Badges identificam demonstração, conexão e resultado sem competir com o título.
- **Gráficos:** Recharts dentro de ChartContainer; prefira barras com rótulos diretos, grade pontilhada discreta, tooltip e legenda quando houver categorias. A distribuição categórica segue a ordem de CHART_COLORS em src/App.tsx; os tokens chart-1–chart-5 ficam em src/index.css.
- **Tabelas e filtros:** componentes shadcn locais para tabela, busca, selects e menu de colunas. Cabeçalho claro, linhas compactas, hover suave, valores ausentes em tom atenuado e paginação visível.
- **Estados:** carregamento usa Skeleton no formato aproximado dos painéis; gráfico sem valores mostra ícone e mensagem centralizados; base vazia explica como preencher as abas e oferece link à planilha. Falha de carga usa Alert destrutivo com ação de tentar novamente; filtro sem resultados informa como recuperar.
- **Perfil:** Sheet lateral apresenta todos os campos agrupados por origem; campos ausentes aparecem como “Sem preenchimento”. É uma visualização de consulta.

## Do's and Don'ts

- Mantenha Google Sheets em branco como fonte real e editável; os dados são atualizados na planilha, e a tela do painel é somente leitura.
- Trate a amostra sintética local apenas como prévia visual offline e mantenha o rótulo de demonstração explícito.
- Não introduza integração Microsoft no MVP.
- Preserve campos ausentes como ausentes; nunca represente ausência como nota zero.
- Mantenha busca, filtros, perfil e exportação como operações de leitura; não ofereça edição de registros no painel.
- Preserve texto curto, contraste entre títulos e metadados e largura legível das tabelas.
