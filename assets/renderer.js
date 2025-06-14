let contacts = []
let sessions = []
let isManagerReady = false

const countryCodes = {
    '62': { name: 'Indonesia', length: [10, 11, 12] },
}

function initTabs() {
    const navButtons = document.querySelectorAll('.nav-item')
    const tabContents = document.querySelectorAll('.tab-content')
    
    navButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.dataset.tab
            
            navButtons.forEach(btn => btn.classList.remove('active'))
            tabContents.forEach(content => content.classList.remove('active'))
            
            button.classList.add('active')
            document.getElementById(targetTab).classList.add('active')
            
            if (targetTab === 'blast') {
                updateSessionCheckboxes(true) // Force update when switching to blast tab
            } else if (targetTab === 'send') {
                updateSendSessionSelect()
            } else if (targetTab === 'sessions') {
                if (isManagerReady) {
                    loadSessions()
                } else {
                    checkManagerStatus()
                }
            }
        })
    })
}

function formatPhoneNumber(input) {
    let value = input.value.replace(/[^\d+]/g, '')
    
    if (value && !value.startsWith('+')) {
        value = '+' + value
    }
    
    if (value.length > 1) {
        let formatted = value.substring(0, 1)
        let remaining = value.substring(1)
        
        if (remaining.length > 0) {
            formatted += remaining.substring(0, 4)
            if (remaining.length > 4) {
                formatted += ' ' + remaining.substring(4, 8)
                if (remaining.length > 8) {
                    formatted += ' ' + remaining.substring(8, 12)
                    if (remaining.length > 12) {
                        formatted += ' ' + remaining.substring(12, 16)
                    }
                }
            }
        }
        input.value = formatted
    } else {
        input.value = value
    }
    
    validatePhoneNumber(input)
}

function handlePhonePaste(event) {
    setTimeout(() => {
        formatPhoneNumber(event.target)
    }, 10)
}

function validatePhoneNumber(input) {
    const value = input.value.replace(/[^\d+]/g, '')
    const errorElement = document.getElementById(input.id + 'Error')
    
    input.classList.remove('is-invalid', 'is-valid')
    
    if (!value) {
        return false
    }
    
    if (!value.startsWith('+')) {
        showFieldError(input, errorElement, 'Phone number must start with country code (+)')
        return false
    }
    
    const numberWithoutPlus = value.substring(1)
    
    if (numberWithoutPlus.length < 7) {
        showFieldError(input, errorElement, 'Phone number is too short')
        return false
    }
    
    let countryCode = ''
    let phoneNumber = ''
    let isValidCountryCode = false
    
    for (let i = 1; i <= 4; i++) {
        const potentialCode = numberWithoutPlus.substring(0, i)
        if (countryCodes[potentialCode]) {
            countryCode = potentialCode
            phoneNumber = numberWithoutPlus.substring(i)
            isValidCountryCode = true
            break
        }
    }
    
    if (!isValidCountryCode) {
        showFieldError(input, errorElement, 'Invalid country code')
        return false
    }
    
    const countryInfo = countryCodes[countryCode]
    const phoneLength = phoneNumber.length
    
    if (!countryInfo.length.includes(phoneLength)) {
        showFieldError(input, errorElement, 
            `Invalid phone number length for ${countryInfo.name}. Expected ${countryInfo.length.join(' or ')} digits after country code`)
        return false
    }
    
    if (!/^\d+$/.test(phoneNumber)) {
        showFieldError(input, errorElement, 'Phone number can only contain digits')
        return false
    }
    
    showFieldSuccess(input, errorElement)
    return true
}

function showFieldError(input, errorElement, message) {
    input.classList.add('is-invalid')
    input.classList.remove('is-valid')
    if (errorElement) {
        errorElement.textContent = message
    }
}

function showFieldSuccess(input, errorElement) {
    input.classList.add('is-valid')
    input.classList.remove('is-invalid')
    if (errorElement) {
        errorElement.textContent = ''
    }
}

function validateSessionName(input) {
    const value = input.value.trim()
    const errorElement = document.getElementById('sessionNameError')
    
    input.classList.remove('is-invalid', 'is-valid')
    
    if (!value) {
        showFieldError(input, errorElement, 'Session name is required')
        return false
   }
   
   if (value.length < 3) {
       showFieldError(input, errorElement, 'Session name must be at least 3 characters')
       return false
   }
   
   if (value.length > 50) {
       showFieldError(input, errorElement, 'Session name must be less than 50 characters')
       return false
   }
   
   if (!/^[a-zA-Z0-9\s\-_]+$/.test(value)) {
       showFieldError(input, errorElement, 'Session name can only contain letters, numbers, spaces, hyphens, and underscores')
       return false
   }
   
   showFieldSuccess(input, errorElement)
   return true
}

async function checkManagerStatus() {
 try {
   const result = await window.electronAPI.getManagerStatus()
   if (result.success) {
     isManagerReady = result.data.isInitialized && result.data.hasManager
     
     if (!isManagerReady) {
       document.getElementById('sessionsList').innerHTML = `
         <div class="text-center py-4">
           <div class="spinner-border text-primary mb-3" role="status">
             <span class="visually-hidden">Loading...</span>
           </div>
           <p class="text-muted">Initializing WhatsApp Manager...</p>
         </div>
       `
       setTimeout(checkManagerStatus, 2000)
     } else {
       console.log('Manager is ready, loading sessions...')
       loadSessions()
     }
   }
 } catch (error) {
   console.error('Error checking manager status:', error)
   setTimeout(checkManagerStatus, 2000)
 }
}

function togglePhoneNumber() {
   const connectionType = document.getElementById('connectionType').value
   const phoneNumberGroup = document.getElementById('phoneNumberGroup')
   
   if (connectionType === 'pairing') {
       phoneNumberGroup.classList.remove('d-none')
       setTimeout(() => {
           document.getElementById('phoneNumber').focus()
       }, 100)
   } else {
       phoneNumberGroup.classList.add('d-none')
       const phoneInput = document.getElementById('phoneNumber')
       phoneInput.classList.remove('is-invalid', 'is-valid')
       phoneInput.value = ''
   }
}

async function createSession() {
   if (!isManagerReady) {
       showAlert('warning', 'WhatsApp Manager is still initializing. Please wait a moment and try again.')
       return
   }
   
   const sessionNameInput = document.getElementById('sessionName')
   const connectionType = document.getElementById('connectionType').value
   const phoneNumberInput = document.getElementById('phoneNumber')
   
   if (!validateSessionName(sessionNameInput)) {
       sessionNameInput.focus()
       return
   }
   
   if (connectionType === 'pairing') {
       if (!phoneNumberInput.value.trim()) {
           showFieldError(phoneNumberInput, document.getElementById('phoneNumberError'), 'Phone number is required for pairing')
           phoneNumberInput.focus()
           return
       }
       
       if (!validatePhoneNumber(phoneNumberInput)) {
           phoneNumberInput.focus()
           return
       }
   }
   
   const sessionName = sessionNameInput.value.trim()
   const existingSession = sessions.find(s => s.sessionName.toLowerCase() === sessionName.toLowerCase())
   if (existingSession) {
       showFieldError(sessionNameInput, document.getElementById('sessionNameError'), 'A session with this name already exists')
       sessionNameInput.focus()
       return
   }
   
   try {
       console.log('Creating session...')
       const createButton = document.querySelector('button[onclick="createSession()"]')
       createButton.disabled = true
       createButton.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status"></span>Creating...'
       
       const result = await window.electronAPI.createSession({
           userId: 1,
           type: connectionType,
           phoneNumber: phoneNumberInput.value.replace(/[^\d+]/g, ''),
           sessionName: sessionName
       })
       
       if (result.success) {
           console.log('Session created successfully:', result.data)
           
           if (result.data.qrImage) {
               document.getElementById('qrImage').src = result.data.qrImage
               document.getElementById('qrCode').classList.remove('d-none')
               document.getElementById('pairingCode').classList.add('d-none')
               showAlert('success', 'QR Code generated! Scan with WhatsApp to connect.')
           } else if (result.data.pairingCode) {
               document.getElementById('pairingCodeText').textContent = result.data.pairingCode
               document.getElementById('pairingCode').classList.remove('d-none')
               document.getElementById('qrCode').classList.add('d-none')
               showAlert('success', `Pairing code: ${result.data.pairingCode}`)
           }
           
           sessionNameInput.value = ''
           phoneNumberInput.value = ''
           sessionNameInput.classList.remove('is-valid')
           phoneNumberInput.classList.remove('is-valid')
           
           startConnectionCheck(sessionName)
           
       } else {
           showAlert('danger', 'Error creating session: ' + result.error)
       }
   } catch (error) {
       showAlert('danger', 'Error: ' + error.message)
   } finally {
       const createButton = document.querySelector('button[onclick="createSession()"]')
       createButton.disabled = false
       createButton.innerHTML = '<i class="bi bi-play-circle me-2"></i>Create Session'
   }
}

function startConnectionCheck(sessionName) {
    const checkInterval = setInterval(async () => {
        try {
            const result = await window.electronAPI.getSessions()
            if (result.success) {
                const targetSession = result.data.find(s => s.sessionName === sessionName)
                
                if (targetSession && targetSession.isConnected) {
                    document.getElementById('qrCode').classList.add('d-none')
                    document.getElementById('pairingCode').classList.add('d-none')
                    
                    showAlert('success', `Session "${sessionName}" connected successfully!`)
                    
                    sessions = result.data
                    displaySessions(sessions)
                    
                    clearInterval(checkInterval)
                }
            }
        } catch (error) {
            console.error('Error checking connection status:', error)
        }
    }, 2000)
    
    setTimeout(() => {
        clearInterval(checkInterval)
    }, 120000)
}

function hideConnectionPrompts() {
    document.getElementById('qrCode').classList.add('d-none')
    document.getElementById('pairingCode').classList.add('d-none')
}

async function loadSessions() {
  if (!isManagerReady) {
      return
  }
  
  try {
      const result = await window.electronAPI.getSessions()
      
      if (result.success) {
          sessions = result.data
          displaySessions(sessions)
      } else {
          document.getElementById('sessionsList').innerHTML = `
            <div class="alert alert-danger">
              <i class="bi bi-exclamation-triangle me-2"></i>
              Error loading sessions: ${result.error}
            </div>
          `
      }
  } catch (error) {
      document.getElementById('sessionsList').innerHTML = `
        <div class="alert alert-warning">
          <i class="bi bi-exclamation-triangle me-2"></i>
          Error loading sessions. Retrying...
        </div>
      `
  }
}

function displaySessions(sessionList) {
  const sessionsList = document.getElementById('sessionsList')
  
  if (sessionList.length === 0) {
      sessionsList.innerHTML = `
        <div class="empty-state">
          <i class="bi bi-chat-dots"></i>
          <h6 class="text-muted mb-2">No sessions found</h6>
          <p class="text-muted small mb-0">Create a new session to get started</p>
        </div>
      `
      return
  }
  
  sessionsList.innerHTML = sessionList.map(session => {
      const statusText = session.isConnected ? 'Connected' : session.status
      const statusClass = session.isConnected ? 'status-connected' : 
                         session.status === 'active' ? 'status-connected' :
                         session.status === 'pending' ? 'status-pending' : 'status-disconnected'
      const icon = session.isConnected ? 'bi-check-circle-fill' : 'bi-clock'
      
      return `
          <div class="session-item">
              <div class="d-flex align-items-center justify-content-between">
                  <div class="flex-grow-1">
                      <div class="d-flex align-items-center gap-3 mb-2">
                          <div class="contact-avatar">
                              <i class="${session.isConnected ? 'bi-whatsapp' : 'bi-clock'} text-white"></i>
                          </div>
                          <div>
                              <h6 class="mb-1">${session.sessionName}</h6>
                              <span class="status-badge ${statusClass}">
                                  <i class="${icon}"></i>${statusText}
                              </span>
                          </div>
                      </div>
                      <div class="session-meta">
                          <div>ID: ${session.sessionKey}</div>
                          <div>Created: ${new Date(session.createdAt).toLocaleString()}</div>
                          ${session.lastActive ? `<div>Last Active: ${new Date(session.lastActive).toLocaleString()}</div>` : ''}
                      </div>
                  </div>
                  <div class="session-actions">
                      <button class="btn btn-outline-danger btn-sm ${!session.isConnected ? 'disabled' : ''}" 
                              onclick="logoutSession('${session.sessionKey}')"
                              ${!session.isConnected ? 'disabled' : ''}>
                          <i class="bi bi-box-arrow-right"></i>
                      </button>
                  </div>
              </div>
          </div>
      `
  }).join('')
}

async function logoutSession(sessionId) {
  if (confirm('Are you sure you want to logout this session?')) {
   try {
         const result = await window.electronAPI.logoutSession(sessionId)
         
         if (result.success) {
             showAlert('success', 'Session logged out successfully')
             setTimeout(loadSessions, 1000)
         } else {
             showAlert('danger', 'Error logging out session: ' + (result.error || 'Unknown error'))
         }
     } catch (error) {
         showAlert('danger', 'Error: ' + error.message)
     }
 }
}

async function importContacts() {
 try {
     const result = await window.electronAPI.importContacts()
     
     if (result.success) {
         contacts = result.data
         displayContacts(contacts)
         showAlert('success', `${contacts.length} contacts imported successfully`)
     } else {
         showAlert('danger', 'Error importing contacts: ' + result.error)
     }
 } catch (error) {
     showAlert('danger', 'Error: ' + error.message)
 }
}

function displayContacts(contactList) {
 const contactsList = document.getElementById('contactsList')
 
 if (contactList.length === 0) {
     contactsList.innerHTML = `
       <div class="empty-state">
         <i class="bi bi-people"></i>
         <h6 class="text-muted mb-2">No contacts imported</h6>
         <p class="text-muted small mb-0">Upload an Excel file to import contacts</p>
       </div>
     `
     return
 }
 
 contactsList.innerHTML = `
   <div class="alert alert-success d-flex align-items-center mb-3">
     <i class="bi bi-check-circle me-2"></i>
     <span>${contactList.length} contacts imported successfully</span>
   </div>
   ${contactList.slice(0, 20).map(contact => `
     <div class="contact-item">
         <div class="d-flex align-items-center gap-3">
             <div class="contact-avatar">
                 <i class="bi bi-person"></i>
             </div>
             <div class="flex-grow-1">
                 <h6 class="mb-0">${contact.name || contact.Name || 'N/A'}</h6>
                 <small class="text-muted">${contact.phone || contact.number || contact.phoneNumber || contact.Phone || contact.Number || 'No phone'}</small>
             </div>
         </div>
     </div>
   `).join('')}
   ${contactList.length > 20 ? `<div class="text-center mt-3"><small class="text-muted">... and ${contactList.length - 20} more contacts</small></div>` : ''}
 `
}

function selectAllSessions() {
    const checkboxes = document.querySelectorAll('#sessionCheckboxes input[type="checkbox"]')
    checkboxes.forEach(checkbox => {
        checkbox.checked = true
    })
    
    if (checkboxes.length > 0) {
        showAlert('success', `All ${checkboxes.length} sessions selected`)
    }
}

function selectRandomSession() {
    const checkboxes = document.querySelectorAll('#sessionCheckboxes input[type="checkbox"]')
    
    if (checkboxes.length === 0) {
        showAlert('warning', 'No sessions available to select')
        return
    }
    
    clearAllSessions()
    
    const randomIndex = Math.floor(Math.random() * checkboxes.length)
    checkboxes[randomIndex].checked = true
    
    const sessionName = checkboxes[randomIndex].nextElementSibling.textContent.trim()
    showAlert('success', `Random session selected: ${sessionName}`)
}

function clearAllSessions() {
    const checkboxes = document.querySelectorAll('#sessionCheckboxes input[type="checkbox"]')
    checkboxes.forEach(checkbox => {
        checkbox.checked = false
    })
}

function updateSessionCheckboxes(forceUpdate = false) {
    const sessionCheckboxes = document.getElementById('sessionCheckboxes')
    const connectedSessions = sessions.filter(s => s.isConnected)
    
    const currentSessionIds = connectedSessions.map(s => s.sessionKey).sort()
    const existingCheckboxes = Array.from(document.querySelectorAll('#sessionCheckboxes input[type="checkbox"]'))
    const existingSessionIds = existingCheckboxes.map(cb => cb.value).sort()
    
    if (!forceUpdate && JSON.stringify(currentSessionIds) === JSON.stringify(existingSessionIds)) {
        console.log('No session changes detected, preserving current state')
        return
    }
    
    const previouslySelected = existingCheckboxes
        .filter(checkbox => checkbox.checked)
        .map(checkbox => checkbox.value)
    
    console.log(`Updating session checkboxes: ${connectedSessions.length} connected sessions`)
    console.log(`Previously selected sessions:`, previouslySelected)
    
    if (connectedSessions.length === 0) {
        sessionCheckboxes.innerHTML = `
          <div class="alert alert-warning d-flex align-items-center mb-0">
            <i class="bi bi-exclamation-triangle me-2"></i>
            <span>No active sessions available. Please create and connect a session first.</span>
          </div>
        `
        return
    }
    
    sessionCheckboxes.innerHTML = connectedSessions.map(session => {
        const isChecked = previouslySelected.includes(session.sessionKey)
        return `
            <div class="form-check mb-2">
                <input class="form-check-input" type="checkbox" id="session_${session.sessionKey}" 
                       value="${session.sessionKey}" ${isChecked ? 'checked' : ''}>
                <label class="form-check-label d-flex align-items-center" for="session_${session.sessionKey}">
                    <i class="bi bi-check-circle text-success me-2"></i>
                    <span class="flex-grow-1">${session.sessionName}</span>
                    <span class="badge bg-success bg-opacity-25 text-success">Connected</span>
                </label>
            </div>
        `
    }).join('')
}


function updateSendSessionSelect() {
 const sendSessionSelect = document.getElementById('sendSessionSelect')
 const connectedSessions = sessions.filter(s => s.isConnected)
 
 console.log(`Updating send session select: ${connectedSessions.length} connected sessions`)
 
 sendSessionSelect.innerHTML = '<option value="">Choose a session</option>' + 
     connectedSessions.map(session => 
         `<option value="${session.sessionKey}">${session.sessionName}</option>`
     ).join('')
}

async function sendBlastMessage() {
    if (!isManagerReady) {
        showAlert('warning', 'WhatsApp Manager is still initializing. Please wait a moment and try again.')
        return
    }
    
    if (contacts.length === 0) {
        showAlert('warning', 'Please import contacts first')
        return
    }
    
    const message = document.getElementById('blastMessage').value.trim()
    if (!message) {
        showAlert('warning', 'Please enter a message')
        document.getElementById('blastMessage').focus()
        return
    }
    
    const selectedSessions = Array.from(document.querySelectorAll('#sessionCheckboxes input:checked'))
        .map(checkbox => checkbox.value)
    
    if (selectedSessions.length === 0) {
        showAlert('warning', 'Please select at least one session')
        return
    }
    
    const sessionNames = Array.from(document.querySelectorAll('#sessionCheckboxes input:checked'))
        .map(checkbox => checkbox.nextElementSibling.textContent.trim().replace('Connected', '').trim())
    
    if (!confirm(`Send message to ${contacts.length} contacts using ${selectedSessions.length} session(s)?\n\nSelected sessions: ${sessionNames.join(', ')}`)) {
        return
    }
    
    try {
        const blastButton = document.querySelector('button[onclick="sendBlastMessage()"]')
        blastButton.disabled = true
        blastButton.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status"></span>Sending...'
        
        document.getElementById('blastProgress').classList.remove('d-none')
        
        const result = await window.electronAPI.blastMessage({
            contacts: contacts,
            message: message,
            sessionIds: selectedSessions
        })
        
        if (result.success) {
            const successCount = result.data.filter(r => r.status === 'sent').length
            const failedCount = result.data.filter(r => r.status === 'failed').length
            
            showAlert('success', `Blast message completed!<br>✅ Sent: ${successCount}<br>❌ Failed: ${failedCount}`)
            
            document.getElementById('blastMessage').value = ''
            clearAllSessions()
        } else {
            showAlert('danger', 'Error sending blast message: ' + result.error)
        }
    } catch (error) {
        showAlert('danger', 'Error: ' + error.message)
    } finally {
        const blastButton = document.querySelector('button[onclick="sendBlastMessage()"]')
        blastButton.disabled = false
        blastButton.innerHTML = '<i class="bi bi-send-fill me-2"></i>Send Blast Message'
        document.getElementById('blastProgress').classList.add('d-none')
    }
}

async function sendSingleMessage() {
 if (!isManagerReady) {
     showAlert('warning', 'WhatsApp Manager is still initializing. Please wait a moment and try again.')
     return
 }
 
 const sessionId = document.getElementById('sendSessionSelect').value
 const recipientInput = document.getElementById('recipient')
 const messageInput = document.getElementById('singleMessage')
 
 if (!sessionId) {
     showAlert('warning', 'Please select a session')
     document.getElementById('sendSessionSelect').focus()
     return
 }
 
 if (!recipientInput.value.trim()) {
     showFieldError(recipientInput, document.getElementById('recipientError'), 'Please enter recipient phone number')
     recipientInput.focus()
     return
 }
 
 if (!validatePhoneNumber(recipientInput)) {
     recipientInput.focus()
     return
 }
 
 if (!messageInput.value.trim()) {
     showAlert('warning', 'Please enter a message')
     messageInput.focus()
     return
 }
 
 try {
     const sendButton = document.querySelector('button[onclick="sendSingleMessage()"]')
     sendButton.disabled = true
     sendButton.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status"></span>Sending...'
     
     const result = await window.electronAPI.sendMessage({
         sessionId: sessionId,
         recipient: recipientInput.value.replace(/[^\d+]/g, ''),
         message: messageInput.value.trim()
     })
     
     if (result.success) {
         showAlert('success', 'Message sent successfully!')
         recipientInput.value = ''
         messageInput.value = ''
         recipientInput.classList.remove('is-valid')
     } else {
         showAlert('danger', 'Error sending message: ' + result.error)
     }
 } catch (error) {
     showAlert('danger', 'Error: ' + error.message)
 } finally {
     const sendButton = document.querySelector('button[onclick="sendSingleMessage()"]')
     sendButton.disabled = false
     sendButton.innerHTML = '<i class="bi bi-send me-2"></i>Send Message'
 }
}

function showAlert(type, message) {
 const alert = document.createElement('div')
 alert.className = `alert alert-${type} alert-dismissible fade show floating-alert`
 alert.innerHTML = `
     ${message}
     <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
 `
 document.body.appendChild(alert)
 
 setTimeout(() => {
     if (alert.parentNode) {
         alert.remove()
     }
 }, 5000)
}

document.addEventListener('DOMContentLoaded', function() {
 initTabs()
 
 const sessionNameInput = document.getElementById('sessionName')
 sessionNameInput.addEventListener('input', function() {
     validateSessionName(this)
 })
 
 const phoneNumberInput = document.getElementById('phoneNumber')
 phoneNumberInput.addEventListener('input', function() {
     formatPhoneNumber(this)
 })
 
 const recipientInput = document.getElementById('recipient')
 recipientInput.addEventListener('input', function() {
     formatPhoneNumber(this)
 })
 
 checkManagerStatus()
})

if (window.electronAPI && window.electronAPI.onSessionsUpdated) {
  window.electronAPI.onSessionsUpdated((updatedSessions) => {
      console.log('Received session update:', updatedSessions)
      if (isManagerReady) {
          const previousSessions = [...sessions]
          sessions = updatedSessions
          
          const newlyConnectedSession = sessions.find(session => {
              const prevSession = previousSessions.find(prev => prev.sessionKey === session.sessionKey)
              return session.isConnected && (!prevSession || !prevSession.isConnected)
          })
          
          if (newlyConnectedSession) {
              hideConnectionPrompts()
              showAlert('success', `Session "${newlyConnectedSession.sessionName}" connected successfully!`)
          }
          
          const activeTab = document.querySelector('.tab-content.active')
          if (activeTab && activeTab.id === 'sessions') {
              displaySessions(sessions)
          }
          
          if (activeTab && activeTab.id === 'blast') {
              updateSessionCheckboxes()
          }
          
          if (activeTab && activeTab.id === 'send') {
              updateSendSessionSelect()
          }
      }
  })
}

setInterval(() => {
 if (isManagerReady) {
     const activeTab = document.querySelector('.tab-content.active')
     if (activeTab && activeTab.id === 'sessions') {
         console.log('Auto-refreshing sessions...')
         loadSessions()
     }
 }
}, 10000)