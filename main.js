require('./crypto-polyfill')

const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const fs = require('fs')
const XLSX = require('xlsx')

let mainWindow
let whatsappManager
let isManagerInitialized = false

// Development/Production detection
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

// Get proper resource paths
function getResourcePath(...pathSegments) {
  if (isDev) {
    return path.join(__dirname, ...pathSegments)
  }
  return path.join(process.resourcesPath, ...pathSegments)
}

// Get user data paths
function getUserDataPath(...pathSegments) {
  return path.join(app.getPath('userData'), ...pathSegments)
}

// Ensure directories exist
function ensureDirectoriesExist() {
  const dirs = [
    getUserDataPath('sessions'),
    getUserDataPath('database'),
    getUserDataPath('logs')
  ]
  
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
      console.log(`Created directory: ${dir}`)
    }
  })
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    icon: isDev ? path.join(__dirname, 'build', 'icon.png') : undefined,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      enableRemoteModule: false,
      webSecurity: true
    },
    show: false, // Don't show until ready
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default'
  })

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
    
    if (isDev) {
      mainWindow.webContents.openDevTools()
    }
  })
  mainWindow.setMenuBarVisibility(false)
  mainWindow.loadFile('index.html')
  
  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    require('electron').shell.openExternal(url)
    return { action: 'deny' }
  })
}

function sendSessionUpdate() {
  if (mainWindow && !mainWindow.isDestroyed() && isManagerInitialized && whatsappManager) {
    try {
      const sessions = whatsappManager.getAllSessions()
      mainWindow.webContents.send('sessions-updated', sessions)
      console.log(`Sent session update to UI: ${sessions.length} sessions`)
    } catch (error) {
      console.error('Error sending session updates:', error)
    }
  }
}

async function initializeWhatsAppManager() {
  try {
    console.log('Initializing WhatsApp Manager...')
    
    // Ensure required directories exist
    ensureDirectoriesExist()
    
    // Initialize WhatsApp Manager with proper paths
    const WhatsappManager = require('./services/whatsapp-manager')
    whatsappManager = new WhatsappManager({
      sessionsDir: getUserDataPath('sessions'),
      databaseDir: getUserDataPath('database'),
      isDev: isDev
    })
    
    // Listen for session changes
    whatsappManager.on('sessionStatusChanged', () => {
      console.log('Session status changed, updating UI...')
      sendSessionUpdate()
    })
    
    // Initialize the manager
    await whatsappManager.initialize()
    isManagerInitialized = true
    console.log('WhatsApp Manager initialized successfully')
    
    // Send initial session update
    sendSessionUpdate()
    
    // Set up periodic updates
    const updateInterval = setInterval(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        sendSessionUpdate()
      } else {
        clearInterval(updateInterval)
      }
    }, 5000)
    
    // Clean up on window close
    if (mainWindow) {
      mainWindow.on('closed', () => {
        clearInterval(updateInterval)
      })
    }
    
  } catch (error) {
    console.error('Failed to initialize WhatsApp Manager:', error)
    isManagerInitialized = false
    
    // Show error dialog to user
    if (mainWindow && !mainWindow.isDestroyed()) {
      dialog.showErrorBox(
        'Initialization Error',
        `Failed to initialize WhatsApp Manager: ${error.message}`
      )
    }
  }
}

// App event handlers
app.whenReady().then(async () => {
  // Set app user model ID for Windows
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.whatsappblast.manager')
  }
  
  createWindow()
  await initializeWhatsAppManager()
})

app.on('window-all-closed', () => {
  // On macOS, keep app running even when all windows are closed
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  // On macOS, re-create window when dock icon is clicked
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.on('before-quit', async () => {
  // Cleanup before quitting
  if (whatsappManager) {
    try {
      console.log('Cleaning up WhatsApp Manager...')
      // Add cleanup method to manager if needed
      if (typeof whatsappManager.cleanup === 'function') {
        await whatsappManager.cleanup()
      }
    } catch (error) {
      console.error('Error during cleanup:', error)
    }
  }
})

// Security: Prevent new window creation
app.on('web-contents-created', (event, contents) => {
  contents.on('new-window', (event, navigationUrl) => {
    event.preventDefault()
    require('electron').shell.openExternal(navigationUrl)
  })
})

// Utility functions
function ensureManagerInitialized() {
  if (!isManagerInitialized || !whatsappManager) {
    throw new Error('WhatsApp Manager is not initialized yet. Please wait a moment and try again.')
  }
}

function logError(operation, error) {
  const timestamp = new Date().toISOString()
  const logMessage = `[${timestamp}] ${operation} error: ${error.message}\n${error.stack}\n`
  
  try {
    const logFile = getUserDataPath('logs', 'error.log')
    fs.appendFileSync(logFile, logMessage)
  } catch (logError) {
    console.error('Failed to write to log file:', logError)
  }
  
  console.error(`${operation} error:`, error)
}

// IPC Handlers
ipcMain.handle('create-session', async (event, data) => {
  try {
    ensureManagerInitialized()
    
    // Validate input data
    if (!data || !data.sessionName) {
      throw new Error('Session name is required')
    }
    
    if (data.type === 'pairing' && !data.phoneNumber) {
      throw new Error('Phone number is required for pairing')
    }
    
    const result = await whatsappManager.createSession(
      data.userId || 1, 
      data.type || 'qr', 
      data.phoneNumber, 
      data.sessionName
    )
    
    setTimeout(sendSessionUpdate, 1000)
    return { success: true, data: result }
  } catch (error) {
    logError('Create session', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('get-sessions', async () => {
  try {
    ensureManagerInitialized()
    const sessions = whatsappManager.getAllSessions()
    console.log(`Returning ${sessions.length} sessions to UI`)
    return { success: true, data: sessions }
  } catch (error) {
    logError('Get sessions', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('send-message', async (event, data) => {
  try {
    ensureManagerInitialized()
    
    // Validate input
    if (!data || !data.sessionId || !data.recipient || !data.message) {
      throw new Error('Session ID, recipient, and message are required')
    }
    
    const result = await whatsappManager.sendTextMessage(data.sessionId, data.recipient, data.message)
    return { success: true, data: result }
  } catch (error) {
    logError('Send message', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('logout-session', async (event, sessionId) => {
  try {
    ensureManagerInitialized()
    
    if (!sessionId) {
      throw new Error('Session ID is required')
    }
    
    const result = await whatsappManager.logoutSession(sessionId)
    setTimeout(sendSessionUpdate, 1000)
    return { success: result }
  } catch (error) {
    logError('Logout session', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('import-contacts', async () => {
  try {
    if (!mainWindow || mainWindow.isDestroyed()) {
      throw new Error('Main window is not available')
    }
    
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [
        { name: 'Excel Files', extensions: ['xlsx', 'xls'] },
        { name: 'CSV Files', extensions: ['csv'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      title: 'Select Contact File'
    })

    if (result.canceled) {
      return { success: false, error: 'File selection canceled' }
    }

    const filePath = result.filePaths[0]
    
    // Validate file exists
    if (!fs.existsSync(filePath)) {
      throw new Error('Selected file does not exist')
    }
    
    // Check file size (limit to 10MB)
    const stats = fs.statSync(filePath)
    if (stats.size > 10 * 1024 * 1024) {
      throw new Error('File is too large. Please select a file smaller than 10MB.')
    }

    const workbook = XLSX.readFile(filePath)
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const contacts = XLSX.utils.sheet_to_json(worksheet)

    // Validate contacts
    if (!Array.isArray(contacts) || contacts.length === 0) {
      throw new Error('No valid contacts found in the file')
    }

    console.log(`Imported ${contacts.length} contacts from ${path.basename(filePath)}`)
    return { success: true, data: contacts }
  } catch (error) {
    logError('Import contacts', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('blast-message', async (event, data) => {
  try {
    ensureManagerInitialized()
    
    // Validate input
    if (!data || !Array.isArray(data.contacts) || !data.message || !Array.isArray(data.sessionIds)) {
      throw new Error('Contacts, message, and session IDs are required')
    }
    
    if (data.contacts.length === 0) {
      throw new Error('No contacts provided')
    }
    
    if (data.sessionIds.length === 0) {
      throw new Error('No sessions selected')
    }
    
    console.log(`Starting blast message to ${data.contacts.length} contacts using ${data.sessionIds.length} sessions`)
    
    const result = await whatsappManager.blastMessage(data.contacts, data.message, data.sessionIds)
    return { success: true, data: result }
  } catch (error) {
    logError('Blast message', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('check-session-status', async (event, sessionId) => {
  try {
    ensureManagerInitialized()
    
    if (!sessionId) {
      throw new Error('Session ID is required')
    }
    
    const isConnected = whatsappManager.isSessionConnected(sessionId)
    return { success: true, data: { isConnected } }
  } catch (error) {
    logError('Check session status', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('get-manager-status', async () => {
  try {
    return { 
      success: true, 
      data: { 
        isInitialized: isManagerInitialized,
        hasManager: !!whatsappManager,
        isDev: isDev,
        userDataPath: app.getPath('userData')
      } 
    }
  } catch (error) {
    logError('Get manager status', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('get-app-info', async () => {
  try {
    return {
      success: true,
      data: {
        name: app.getName(),
        version: app.getVersion(),
        platform: process.platform,
        arch: process.arch,
        electronVersion: process.versions.electron,
        nodeVersion: process.versions.node,
        userDataPath: app.getPath('userData')
      }
    }
  } catch (error) {
    logError('Get app info', error)
    return { success: false, error: error.message }
  }
})

// Global error handlers
process.on('unhandledRejection', (reason, promise) => {
  const error = new Error(`Unhandled Rejection: ${reason}`)
  logError('Unhandled Rejection', error)
})

process.on('uncaughtException', (error) => {
  logError('Uncaught Exception', error)
  
  // Show error dialog and quit gracefully
  if (app) {
    dialog.showErrorBox(
      'Unexpected Error',
      `An unexpected error occurred: ${error.message}\n\nThe application will now close.`
    )
    app.quit()
  }
})

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    // Someone tried to run a second instance, focus our window instead
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })
}