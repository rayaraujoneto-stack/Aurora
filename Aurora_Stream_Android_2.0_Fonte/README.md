# Aurora Stream Android 2.0 — projeto fonte

Este projeto Android utiliza a UI **da versao web 1.4** e abre os videos em uma **Activity nativa com AndroidX Media3 1.11.1**. Compativel com Android 7.0+ (API 24), celulares e Android TV com WebView atualizado.

## Conteudo

- `app/src/main/assets/`: HTML, CSS e JS do Aurora Stream 1.4. As alteracoes sao minimas: removemos Hls.js do Android e encaminhamos `openPlayer` ao player nativo.
- `MainActivity.java`: WebViewAssetLoader com origem local HTTPS, importacao de M3U/XMLTV por seletor de arquivo, ponte de mensagens restrita a origem local.
- `PlayerActivity.java`: Media3/ExoPlayer, HLS/DASH/progressivo, modo HLS manual, recarregar, erros explicitos, paisagem para video, tela em TV e controles do sistema.
- `.github/workflows/android-apk.yml`: opcao de compilacao via GitHub Actions.

## Gerar APK pelo Android Studio (sem Play Store)

1. Instale Android Studio com Android SDK Platform 36 e JDK 17.
2. Instale Gradle **8.13** na sua maquina, ou configure o Android Studio para usar Gradle 8.13. Este pacote de fontes **nao contem o `gradle-wrapper.jar`**, portanto nao e possivel usar `./gradlew` diretamente.
3. Abra a pasta **Aurora_Stream_Android_2.0_Fonte** no Android Studio. Deixe o Gradle sincronizar as dependencias.
4. Clique `Build > Build Bundle(s) / APK(s) > Build APK(s)` (ou execute `gradle :app:assembleDebug` no terminal, com o SDK e o Gradle configurados).
5. Instale `app/build/outputs/apk/debug/app-debug.apk` no Android. Esse APK e assinado automaticamente para teste (debug).

### Gerar APK pelo GitHub Actions (sem instalar Android Studio)

1. Crie um repositorio GitHub **privado** para seu projeto.
2. Envie o conteudo da pasta raiz (incluindo `.github/workflows/android-apk.yml`) para a branch `main`.
3. Na aba **Actions**, selecione `Compilar Aurora Stream APK > Run workflow`, ou faca um push para a branch `main`.
4. Apos o workflow concluir, abra a execucao e baixe o artefato `AuroraStream-2.0-APK-debug`. Descompacte o arquivo gerado para obter `app-debug.apk`.

### Instalar sem Play Store

Transfira o APK para o aparelho, toque no arquivo e autorize **Instalar apps desconhecidos** para o app que abriu o arquivo, se o Android solicitar. Se ja houver versao instalada com outra assinatura, talvez seja necessario desinstalar antes (isso pode apagar dados locais).

## Como usar

- Clique **Carregar lista Pluto** para buscar playlist do Github; tambem pode importar uma playlist `.m3u` pelo seletor de arquivos.
- Na lista, clique **Assistir**. O Aurora Stream abre o player nativo Media3.
- Caso a origem nao seja reconhecida e seja HLS com URL sem `.m3u8`, clique **Forcar HLS**.
- Botao voltar retorna ao guia.
- Favoritos e EPG permanecem locais ao dispositivo, sem sincronizacao com o navegador do PC.

## Limitacoes e privacidade

- **Nao ha APK compilado neste pacote.** E necessario compilar com Android SDK, Android Studio ou GitHub Actions.
- Nao testamos em um aparelho Android fisico. A compilacao ainda precisa ser executada em um ambiente com Android SDK.
- O app nao hospeda canais nem contorna DRM, login, geo-restricoes ou links expirados.
- O app pode reproduzir links **HTTP sem criptografia** se estiverem configurados em uma playlist; o manifesto autoriza esse tipo de trafego especificamente pela compatibilidade com streams legados. Prefira HTTPS.
- O WebView carrega somente recursos locais como pagina principal. A ponte JavaScript e limitada a essa origem e nao ha scripts CDN remotos.
- A importacao de M3U feita por `fetch` pode depender de CORS do servidor de playlist.
- Guia EPG precisa ser importado pelo usuario (XMLTV), ainda nao sincroniza automaticamente pela lista Pluto.
- A reproduçao pode falhar se o formato for desconhecido, o servidor nao estiver disponivel ou a fonte nao autorizar o acesso.
- Para producao, assine um **APK release** com uma chave sua, configure atualizacoes e execute testes em dispositivos reais. Nao distribua a chave de assinatura.

## Referencias oficiais

- [Android Media3](https://developer.android.com/jetpack/androidx/releases/media3)
- [WebViewAssetLoader](https://developer.android.com/develop/ui/views/layout/webapps/load-local-content)
- [Build APK](https://developer.android.com/build/building-cmdline)
