# Plano de implementação — MVP GT/GP

## Decisões do escopo

- **Fonte editável:** uma Google Sheet preparada com as abas `Base_Principal`, `TB_Agente`, `Controle` e `Instruções`. As duas abas de dados começam somente com cabeçalhos; a pessoa usuária cola os dados a partir da linha 2.
- **Sem integração Microsoft no MVP:** sem Microsoft Graph, SharePoint, Power Automate ou importação automática. O único caminho de dados da versão conectada é Google Sheets → Apps Script → painel.
- **Dados de demonstração:** os registros do workbook fornecido são simulados. Eles ficam na prévia local independente e não são copiados para a planilha editável.
- **Painel somente leitura:** edição e correção acontecem na planilha; o app consulta as abas e oferece exportação XLSX no navegador.
- **Conta do Apps Script:** o projeto independente `Dashboard GTGP` e a implantação pertencem à conta `appusiminastp@gmail.com`.
- **Acesso à planilha:** a conta do Apps Script recebe acesso de leitor à planilha de dados; o painel não grava nela.
- **Acesso de teste:** o manifesto usa `ANYONE` e executa como `appusiminastp@gmail.com`; qualquer conta Google conectada que tenha o link pode abrir o Web App e ver os dados carregados. Manter somente dados simulados até restringir novamente o acesso.
- **Visual:** layout desktop com sidebar, navegação simples, cores Usiminas `#84bd00` e verde escuro, com componentes shadcn locais.

## Experiência e telas

1. **Visão geral:** totais da base, preenchimento dos ciclos, correspondência entre abas, distribuição por programa e etapa, além de amostra de registros.
2. **Pessoas:** busca por nome, matrícula ou cargo; filtros por programa e localidade; seleção de colunas; paginação e perfil completo.
3. **Avaliações:** cobertura e distribuição das notas, potenciais e etapas de 2026.1/2026.2. Campos ausentes ficam em branco e não contam como zero.
4. **Qualidade dos dados:** matrículas ausentes ou duplicadas, linhas sem correspondência, nomes vazios e campos de avaliação pendentes.
5. **Exportação:** gera um XLSX local a partir das pessoas exibidas no painel, preservando matrícula como texto.

## Arquitetura

- `src/`: React, TypeScript, Tailwind e componentes shadcn; normalização dos cabeçalhos, cruzamento pela matrícula, métricas e exportação.
- `src/data/synthetic-preview.json`: fixture simulada usada apenas em `preview.html`.
- `gas/Code.gs`: `doGet` e leitura das duas abas configuradas usando valores de exibição; não grava células nem adiciona interface dentro da planilha.
- `gas/Config.gs`: ID da planilha e nomes fixos das abas de dados.
- `gas/Index.html`: bundle HTML independente gerado para Apps Script.
- `gas/appsscript.json`: fuso `America/Sao_Paulo`, execução privada e escopo Sheets necessário para ler pelo ID fixo.
- `preview.html`: build independente que abre direto no navegador e usa exclusivamente a amostra simulada.

## Sequência de implementação e aceite

1. Preparar a Google Sheet com as quatro abas, cabeçalhos, instruções de colagem e formatação básica; confirmar que as duas abas de dados não têm registros.
2. Implementar as telas, filtros, perfil, estados vazio/carregando/erro, indicadores, visualizações e leitura somente das duas abas de dados.
3. Gerar `preview.html` com dados simulados, sem depender de Apps Script ou rede, para revisão visual local.
4. Gerar `gas/Index.html` sem incorporar a fixture sintética; configurar o Apps Script para ler apenas a planilha e as abas fixadas no projeto.
5. Sincronizar com `clasp` o projeto independente `Dashboard GTGP` autenticado como `appusiminastp@gmail.com`, criar uma versão e implantar como Web App privado. A conta precisa ter acesso de leitor à planilha.
6. Conferir planilha vazia, testar a colagem das bases autorizadas, verificar indicadores e qualidade, revisar a exportação, conferir o escopo, então commitar e enviar somente os arquivos de `Outros Aplicativos/GTGPApp`.

### Critérios de aceite

- A prévia local identifica visivelmente os dados simulados e funciona ao abrir o arquivo HTML.
- O build do Apps Script não inclui o JSON de demonstração.
- Quando a planilha não contém registros, as telas orientam a colagem sem sugerir que filtros precisam ser limpos.
- Quando há dados, busca, filtros, perfil completo, métricas, gráficos, qualidade e exportação usam todos os campos mapeados.
- Dados ausentes não são convertidos em zero e o painel não grava na fonte.
- Durante o teste, qualquer conta Google conectada pode abrir o link; antes de inserir dados reais, trocar `access` para `MYSELF` e publicar uma nova versão.
- A planilha fica compartilhada com a conta `appusiminastp@gmail.com` com permissão de leitura.
- Todos os artefatos do produto ficam dentro desta pasta `GTGPApp`.

## Operação local

Com Node.js:

```powershell
npm install
npm run typecheck
npm run build
npm run dev -- --mode preview
```

Abra `preview.html` para usar a prévia offline. `npm run build` atualiza a prévia e `gas/Index.html`. O arquivo `.clasp.json` aponta para um projeto Apps Script e é ignorado pelo Git; `.clasprc.json` guarda credenciais e também não deve ser versionado.

## Sincronização e implantação Google

O projeto independente `Dashboard GTGP` foi criado na conta `appusiminastp@gmail.com`; essa conta também deve ter permissão de leitor na planilha. O arquivo `.clasp.json`, ignorado pelo Git na raiz deste aplicativo, aponta `rootDir` para `gas/` e identifica o projeto remoto. `.clasprc.json` guarda credenciais e nunca deve ser versionado.

Execute `npx clasp push --force` na raiz de `GTGPApp` para enviar os arquivos de `gas/`, depois crie uma versão e atualize a implantação. Durante a fase de teste, `access` fica em `ANYONE`, exigindo apenas uma conta Google conectada; `executeAs` continua em `USER_DEPLOYING`, usando a conta `appusiminastp@gmail.com` para ler a planilha. Antes de usar dados reais, voltar `access` para `MYSELF`, enviar o manifesto e publicar uma nova versão. O envio ao Apps Script, commit/push Git e implantação do Web App são operações distintas. O Google pode solicitar autorização de acesso ao Sheets por conta do escopo declarado.

O Web App abre a planilha fixa pelo ID usando `SpreadsheetApp.openById`, que a documentação do Apps Script associa ao escopo `spreadsheets`. Esse escopo permite leitura e escrita no nível OAuth, mas o aplicativo só chama métodos de leitura (`getDataRange` e `getDisplayValues`); não há função de gravação, edição ou compartilhamento no código.

## Entrega Git

O trabalho fica na branch `feature/gtgp-mvp-appscript`. Revisar o diff e confirmar que `.clasp.json`, `.clasprc.json`, `node_modules/` e `.artifacts/` não entram no commit. Somente `Outros Aplicativos/GTGPApp/` faz parte do escopo.
