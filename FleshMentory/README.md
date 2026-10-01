# Flash Mentoring

MVP em Google Apps Script com duas experiências no mesmo projeto:

- `?app=admin`: painel restrito a RH/Talent.
- `?app=portal`: portal de mentores e mentorados.

Os dados ficam em uma planilha Google privada. O projeto cria as abas e os cabeçalhos, mas não importa a base de pessoas nem cria registros reais.

## Preparação para teste

1. Crie uma planilha de teste privada e sem dados reais de funcionários.
2. No projeto Apps Script, configure a Script Property `SPREADSHEET_ID` com o ID dessa planilha.
3. No editor Apps Script, execute `setupFlashMentoringData_()` para criar as abas e validar os cabeçalhos.
4. Preencha `PEOPLE_MASTER` somente com dados sintéticos. `active` deve ser um valor booleano e `careerLevel` deve conter níveis como `C2`, `C3` ou `C3+`.
5. Atribua perfis em `ACCESS_ROLES`; `RH` e `TALENT` podem acessar o Admin, enquanto os perfis de participante controlam as ações do Portal.

As abas existentes precisam ter exatamente os cabeçalhos definidos em `src/utils/Schema.gs`. O setup interrompe a criação se encontrar cabeçalhos divergentes.

## Acesso do Web App

O manifesto configura acesso `ANYONE` (qualquer conta Google autenticada) com execução como a pessoa que publicou. Os endpoints validam a identidade da sessão contra `PEOPLE_MASTER` e exigem perfil apropriado; se o e-mail da sessão não estiver disponível, o acesso falha fechado. A disponibilidade desse e-mail depende da conta e das políticas do Workspace.

O arquivo `.clasp.json` guarda o identificador local do projeto Apps Script e é ignorado pelo Git. O `.claspignore` também exclui o DOCX e os arquivos de instrução do envio ao Apps Script. O DOCX da proposta permanece local porque o remoto Git deste repositório é público.
