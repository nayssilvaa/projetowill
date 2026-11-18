import { app, BrowserWindow, shell } from 'electron'
import { join } from 'node:path'
import { registrarHandlers } from './ipc.js'
import { Database } from '../core/database/Database.js'

const ehDesenvolvimento = !app.isPackaged

function criarJanela(): void {
  const janela = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1024,
    minHeight: 680,
    show: false,
    autoHideMenuBar: true,
    title: 'Estudio Manager',
    backgroundColor: '#13151c',
    webPreferences: {
      preload: join(import.meta.dirname, '../preload/index.mjs'),
      // Isolamento obrigatorio: o renderer nunca recebe acesso direto a Node nem ao banco.
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true
    }
  })

  janela.on('ready-to-show', () => janela.show())

  // Qualquer link externo abre no navegador do sistema, nunca dentro do app.
  janela.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
  janela.webContents.on('will-navigate', (evento, url) => {
    if (!url.startsWith('file://') && !url.startsWith('http://localhost')) {
      evento.preventDefault()
      shell.openExternal(url)
    }
  })

  const devServer = process.env.ELECTRON_RENDERER_URL
  if (ehDesenvolvimento && devServer) {
    janela.loadURL(devServer)
  } else {
    janela.loadFile(join(import.meta.dirname, '../renderer/index.html'))
  }
}

// Instancia unica: evita duas janelas disputando o mesmo banco.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const [janela] = BrowserWindow.getAllWindows()
    if (janela) {
      if (janela.isMinimized()) janela.restore()
      janela.focus()
    }
  })

  app.whenReady().then(async () => {
    registrarHandlers()

    try {
      await Database.getInstance().ping()
      console.info('[app] conexao com o MySQL estabelecida.')
    } catch (erro) {
      console.error('[app] nao foi possivel conectar ao MySQL:', erro)
    }

    criarJanela()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) criarJanela()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })

  app.on('before-quit', () => {
    Database.getInstance()
      .close()
      .catch(() => undefined)
  })
}
