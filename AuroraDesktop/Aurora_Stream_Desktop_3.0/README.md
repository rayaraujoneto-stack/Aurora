# Aurora Stream Desktop 3.0 (Windows)

Aplicativo desktop baseado no Aurora Stream 2.1 Web, empacotado com Electron. Esta edição preserva as telas de TV ao vivo, vídeo, música, guia, favoritos, importação M3U/XMLTV e catálogo Pluto/Saimo.

## Requisitos
- Windows 10/11 de 64 bits para o instalador disponibilizado pelo workflow.
- Node.js 24.x e npm para executar/compilar localmente.
- MPV para usar o botão **Abrir no MPV** (opcional). O player interno HLS/DASH continua disponível sem MPV.

## Executar no VS Code
1. Extraia/abra a pasta `Aurora_Stream_Desktop_3.0` no VS Code.
2. Abra o terminal integrado.
3. Instale o Node.js 24.x (se ainda não estiver instalado).
4. Execute `npm install`.
5. Execute `npm start`.

Atalho: clique duas vezes em `INICIAR_DESKTOP_WINDOWS.bat` para instalar dependências e abrir o aplicativo.

Não use Live Server para a edição desktop: o Electron abre a interface diretamente e disponibiliza a ponte segura para integração com o sistema.

## Gerar o instalador Windows
- `npm run dist:win` gera instalador NSIS e versão portátil.
- `npm run dist:win:installer` gera apenas o instalador.
- `npm run dist:win:portable` gera apenas o executável portátil.

O workflow `.github/workflows/desktop-windows.yml` gera os executáveis automaticamente no GitHub Actions. Se esta pasta for a raiz do repositório, o workflow será reconhecido automaticamente. Se você copiar a pasta como subdiretório do repositório Aurora existente, copie também esse arquivo de workflow para a pasta `.github/workflows/` da raiz do repositório. No término, baixe o artefato `Aurora-Stream-Desktop-3.0-Windows`.

## Reprodução
- Player interno: HLS.js, dash.js e HTML5, sujeito aos formatos/codecs suportados e às políticas das fontes.
- Player externo: botão **Abrir no MPV** inicia o MPV instalado no Windows com o endereço HTTP/HTTPS selecionado. O MPV é um programa externo e não é distribuído neste pacote. Instalação oficial: https://mpv.io/installation/.
- O botão **Obter MPV** abre a página oficial de instalação. Após instalar o MPV, reinicie o Aurora Stream Desktop.
- O MPV abre em uma janela própria. O player interno permanece dentro do Aurora.

## Listas e dados
- Pluto e Saimo são buscados por `net.fetch` no processo principal do Electron, usando uma lista fechada de URLs permitidas. Isso evita depender de CORS para baixar esses dois arquivos.
- M3U e XMLTV podem ser importados a partir de arquivos locais.
- Favoritos e biblioteca ficam no armazenamento local persistente do perfil Electron deste computador. Não são sincronizados automaticamente com o APK Android nem com outro PC.

## Segurança
- `contextIsolation: true`, `nodeIntegration: false` e `sandbox: true`.
- A interface não recebe acesso direto ao Node.js ou ao sistema de arquivos.
- A comunicação com o processo principal ocorre por funções específicas no preload.
- URLs de mídia aceitas pelo MPV precisam ser HTTP ou HTTPS; o processo é iniciado sem shell.
- Não há contorno de DRM, autenticação, CORS ou restrições de acesso. Use apenas fontes cujo acesso e reprodução sejam autorizados.

## Observações de distribuição
- O instalador não é assinado com certificado Authenticode; o Windows pode exibir um aviso do SmartScreen em computadores onde o arquivo ainda não tem reputação.
- O aplicativo é preparado inicialmente para Windows x64. macOS e Linux podem ser adicionados em workflows separados.
- O MPV é opcional e segue a licença própria do projeto; não é incorporado ao instalador do Aurora.

## Licenças
O código original do Aurora Stream está sob MIT. Electron está sob MIT; electron-builder está sob MIT. HLS.js e dash.js mantêm suas licenças próprias e são carregados conforme os scripts declarados em `index.html`.
