'use strict';
const { app, BrowserWindow, ipcMain, net, shell, Menu } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { spawn, execFile } = require('node:child_process');

const APP_ID = 'com.aurorastream.desktop';
const ALLOWED_REMOTE = new Set([
  'https://raw.githubusercontent.com/iprtl/m3u/live/Pluto.m3u',
  'https://raw.githubusercontent.com/gabrielsaimo/SaimoPlayer/main/catalogo.txt'
]);
let mainWindow;

app.setAppUserModelId(APP_ID);

function isHttpUrl(value) {
  try { const url = new URL(value); return url.protocol === 'http:' || url.protocol === 'https:'; }
  catch { return false; }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1480,
    height: 940,
    minWidth: 1040,
    minHeight: 680,
    show: false,
    backgroundColor: '#080d18',
    title: 'Aurora Stream Desktop',
    autoHideMenuBar: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      partition: 'persist:aurora-stream-desktop'
    }
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') && new URL(url).hostname === 'mpv.io') shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file://')) event.preventDefault();
  });
  mainWindow.loadFile(path.join(__dirname, '..', 'index.html'));
  mainWindow.on('closed', () => { mainWindow = null; });
}

async function fetchAllowedText(url) {
  if (!ALLOWED_REMOTE.has(url)) throw new Error('Endereço remoto não autorizado pelo aplicativo.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);
  try {
    const response = await net.fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'AuroraStreamDesktop/3.0' }
    });
    if (!response.ok) throw new Error(`Falha HTTP ${response.status}`);
    const finalUrl = new URL(response.url || url);
    if (finalUrl.protocol !== 'https:' || finalUrl.hostname !== 'raw.githubusercontent.com') throw new Error('Redirecionamento remoto bloqueado.');
    const text = await response.text();
    const max = url.includes('catalogo.txt') ? 1024 * 1024 : 8 * 1024 * 1024;
    if (Buffer.byteLength(text, 'utf8') > max) throw new Error('O arquivo remoto excede o limite permitido.');
    return { ok: true, status: response.status, contentLength: Buffer.byteLength(text, 'utf8'), text };
  } finally { clearTimeout(timer); }
}

function candidateMpvPaths() {
  const paths = [];
  if (process.env.MPV_PATH) paths.push(process.env.MPV_PATH);
  const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
  const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
  const local = process.env.LOCALAPPDATA || '';
  paths.push(
    path.join(app.getPath('userData'), 'mpv', 'mpv.exe'),
    path.join(programFiles, 'mpv', 'mpv.exe'),
    path.join(programFilesX86, 'mpv', 'mpv.exe'),
    path.join(local, 'Programs', 'mpv', 'mpv.exe'),
    path.join(process.resourcesPath, 'mpv', 'mpv.exe')
  );
  return paths.filter(Boolean);
}

async function findMpv() {
  for (const candidate of candidateMpvPaths()) {
    try { if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate; } catch {}
  }
  if (process.platform === 'win32') {
    return await new Promise(resolve => {
      execFile('where.exe', ['mpv.exe'], { windowsHide: true, timeout: 3000 }, (error, stdout) => {
        if (error) return resolve(null);
        const first = String(stdout).split(/\r?\n/).map(s => s.trim()).find(Boolean);
        resolve(first || null);
      });
    });
  }
  return await new Promise(resolve => {
    execFile('which', ['mpv'], { timeout: 3000 }, (error, stdout) => resolve(error ? null : String(stdout).trim() || null));
  });
}

ipcMain.handle('aurora:fetch-text', async (_event, url) => fetchAllowedText(String(url || '')));
ipcMain.handle('aurora:play-mpv', async (_event, payload) => {
  const url = String(payload?.url || '');
  const title = String(payload?.title || 'Aurora Stream').replace(/[\r\n\0]/g, ' ').slice(0, 100);
  if (!isHttpUrl(url)) return { ok: false, code: 'INVALID_URL', message: 'O endereço da mídia não é HTTP/HTTPS.' };
  const executable = await findMpv();
  if (!executable) return { ok: false, code: 'MPV_NOT_FOUND', message: 'MPV não encontrado neste computador.' };
  try {
    const child = spawn(executable, ['--force-window=yes', `--title=${title}`, '--', url], {
      detached: true,
      stdio: 'ignore',
      windowsHide: false,
      shell: false
    });
    child.once('error', () => {});
    child.unref();
    return { ok: true, engine: 'mpv' };
  } catch (error) {
    return { ok: false, code: 'MPV_START_FAILED', message: error.message };
  }
});
ipcMain.handle('aurora:mpv-installed', async () => Boolean(await findMpv()));
ipcMain.handle('aurora:open-mpv-page', async () => {
  await shell.openExternal('https://mpv.io/installation/');
  return true;
});
ipcMain.handle('aurora:app-version', () => app.getVersion());

function buildMenu() {
  const template = [
    { label: 'Arquivo', submenu: [
      { label: 'Importar playlist M3U…', accelerator: 'Ctrl+O', click: () => mainWindow?.webContents.send('aurora:command', 'import-m3u') },
      { type: 'separator' },
      { role: 'quit', label: 'Sair' }
    ]},
    { label: 'Exibir', submenu: [
      { role: 'reload', label: 'Recarregar interface' },
      { role: 'togglefullscreen', label: 'Tela cheia' },
      { role: 'toggledevtools', label: 'Ferramentas de desenvolvimento' }
    ]},
    { label: 'Ajuda', submenu: [
      { label: 'Instalar / obter MPV', click: () => shell.openExternal('https://mpv.io/installation/') },
      { label: 'Sobre o Aurora Stream', click: () => mainWindow?.webContents.send('aurora:command', 'about') }
    ]}
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(() => {
  buildMenu();
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
