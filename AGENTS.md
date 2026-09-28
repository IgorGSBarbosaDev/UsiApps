# AGENTS.md

## Propósito do repositório

Este repositório reúne aplicativos e protótipos independentes, principalmente Google Apps Script com HTML, CSS e JavaScript, além de soluções construídas com produtos Microsoft. Ajude a criar, ajustar, configurar e manter cada aplicativo com mudanças pequenas, compreensíveis e fáceis de revisar.

## Como trabalhar

- Siga as instruções da solicitação atual e os `AGENTS.md` mais próximos dos arquivos alterados. Instruções do usuário e políticas da plataforma têm prioridade.
- Antes de editar, identifique o aplicativo e examine apenas os arquivos relevantes: estado do Git, instruções locais, documentação, configuração e código relacionados à tarefa. Preserve alterações preexistentes e não reformate arquivos sem necessidade.
- Trate cada aplicativo como um projeto independente. Preserve sua estrutura, convenções, dependências e fonte de verdade. Não mova nem misture arquivos entre aplicativos sem necessidade.
- Para uma solicitação Microsoft, identifique o produto e a tecnologia envolvidos (por exemplo, Power Apps, Office Scripts ou SharePoint) antes de escolher uma implementação. Se o contexto não permitir distingui-los, peça essa informação.
- Consulte documentação oficial atual do fornecedor quando a tarefa depender de comportamento, configuração, permissões ou APIs. Não invente comandos, opções, capacidades ou requisitos ausentes do projeto.
- Implemente o escopo pedido de ponta a ponta. Faça modificações manuais locais quando a automação não cobrir a necessidade e descreva claramente qualquer etapa que dependa do usuário.

## Apps Script e automação

- Preserve a organização e o fluxo de implantação já usados pelo aplicativo. Confira arquivos de configuração, como `appsscript.json` e `clasp.json`, quando existirem e forem relevantes.
- Antes de usar Nuclidex, procure sua configuração e documentação disponíveis neste ambiente e determine exatamente se a ação sincroniza Git, envia código ao Apps Script, altera configurações ou publica uma implantação. Use apenas fluxos documentados; não presuma que esses passos sejam equivalentes.
- Se Nuclidex ou a configuração necessária não estiver disponível, não simule a automação nem invente comandos. Termine o trabalho local possível e informe a etapa manual exata.
- Revise escopos OAuth, identificadores de projeto, destino e ambiente antes de qualquer alteração remota. Não amplie permissões nem publique uma implantação de produção sem isso fazer parte da solicitação.

## Acesso e credenciais

- Nunca solicite, registre, exiba ou inclua senhas, tokens, cookies, códigos MFA, chaves ou dados corporativos sensíveis em mensagens, código, documentação, logs, capturas de tela ou argumentos de comandos.
- Para entrar em uma conta, prefira uma sessão já autenticada ou a tela oficial de login, deixando o usuário inserir senha e MFA diretamente. Se for necessário configurar um segredo local, use o gerenciador de credenciais aprovado ou uma variável de ambiente/arquivo local ignorado pelo Git; compartilhe somente o nome da variável, nunca seu valor.
- Antes de criar ou alterar arquivos com configuração sensível, confirme que não serão versionados. Nunca desative verificações de segurança para facilitar o acesso.
- Não use dados reais de funcionários, clientes ou da empresa em exemplos, fixtures ou capturas. Se um segredo aparecer acidentalmente, não o repita; avise o usuário para revogá-lo/rotacioná-lo e remova-o do estado local afetado quando seguro.

## Git, sincronização e publicação

- Preserve trabalho não relacionado e faça mudanças somente no aplicativo solicitado.
- Quando a tarefa incluir sincronização, push ou publicação, confira o diff, os arquivos selecionados, a branch, o remoto e o destino exato antes da operação. Não envie segredos ou dados internos a um destino não autorizado; nunca use force push.
- Diferencie commit/push do Git, envio do código ao Apps Script e publicação de uma implantação. Execute somente as ações necessárias ao resultado solicitado e informe o que foi enviado, para onde e o que ainda depende do usuário.

## Verificação e entrega

- Use os comandos de validação já definidos pelo aplicativo quando a solicitação pedir verificação ou quando forem necessários para confirmar uma operação solicitada. Não adicione ferramentas ou dependências só para validar uma alteração pequena.
- Na resposta final, resuma o aplicativo e os arquivos alterados, as verificações realmente feitas, qualquer sincronização/publicação realizada e os passos manuais pendentes. Não declare como publicado ou validado algo que não foi observado.
- Atualize a documentação do aplicativo somente quando a mudança alterar instruções, configuração ou comportamento que futuros trabalhos precisem conhecer.

## Referência de orientação

Estas instruções seguem a recomendação da OpenAI de manter `AGENTS.md` curto, atual e contextual: indique documentos conforme a tarefa, evite exigir a leitura do repositório inteiro antes de qualquer mudança e explicite limites e condições de conclusão.

- [Rethinking skills and prompts for GPT-6 Astra — OpenAI Developers](https://developers.openai.com/blog/rethinking-skills-and-prompts-for-gpt-6-astra)
