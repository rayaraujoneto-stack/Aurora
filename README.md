# Aurora Stream

Repositório do projeto Aurora Stream, com a edição Android e a edição desktop para Windows.

## Android
O código-fonte Android permanece em [Aurora_Stream_Android_2.0_Fonte](./Aurora_Stream_Android_2.0_Fonte/). A compilação do APK continua configurada pelo workflow Android existente.

## Windows — Aurora Stream Desktop 3.0
O pacote-fonte desktop deve ser adicionado à raiz deste repositório com o nome **Aurora_Stream_Desktop_3.0_Windows.zip**. O arquivo contém o projeto Electron completo.

Após adicionar o ZIP e enviar o commit para a branch `main`, o GitHub Actions executará automaticamente o workflow [Compilar Aurora Stream Desktop para Windows](./.github/workflows/desktop-windows.yml).

Também é possível iniciar a compilação manualmente em **Actions → Compilar Aurora Stream Desktop para Windows → Run workflow**.

Quando a execução terminar, abra a execução do workflow e baixe o artefato **Aurora-Stream-Desktop-3.0-Windows**. Ele conterá o instalador Windows e a versão portátil.

**Requisitos locais:** Windows 10/11 x64 e Node.js 24.x para executar ou compilar manualmente. O MPV é opcional e não é incorporado ao instalador.

**Observação:** o instalador ainda não possui assinatura Authenticode; o Windows pode exibir o aviso do SmartScreen.
