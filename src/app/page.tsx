'use client'

import { useState, FormEvent, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/tauri'
import { open } from '@tauri-apps/api/dialog'
import { listen } from '@tauri-apps/api/event'

interface GoogleAccount {
  id: string
  email: string
  accessToken: string
  refreshToken?: string
  expiresAt: number
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<'send' | 'settings'>('send')
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [emails, setEmails] = useState<string[]>([''])
  const [selectedAccount, setSelectedAccount] = useState<string>('')
  const [attachmentPath, setAttachmentPath] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [responseMessage, setResponseMessage] = useState('')

  // Settings state
  const [accounts, setAccounts] = useState<GoogleAccount[]>([])
  const [connecting, setConnecting] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('googleAccounts')
    if (saved) {
      setAccounts(JSON.parse(saved))
    }
  }, [])

  const saveAccounts = (newAccounts: GoogleAccount[]) => {
    setAccounts(newAccounts)
    localStorage.setItem('googleAccounts', JSON.stringify(newAccounts))
  }

  const addEmailField = () => {
    setEmails([...emails, ''])
  }

  const removeEmailField = (index: number) => {
    if (emails.length > 1) {
      setEmails(emails.filter((_, i) => i !== index))
    }
  }

  const updateEmail = (index: number, value: string) => {
    const newEmails = [...emails]
    newEmails[index] = value
    setEmails(newEmails)
  }

  const handleGoogleLogin = async () => {
    setConnecting(true)
    try {
      const response: any = await invoke('start_oauth_flow')
      
      // Open browser for OAuth
      window.open(response.auth_url, '_blank', 'width=600,height=700')
      
      // Wait for callback (automatic)
      const code: any = await invoke('get_oauth_code')
      
      if (code) {
        const tokenResponse: any = await invoke('exchange_code_for_token', { code })
        
        // Get user email from Google
        const userInfo = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: { Authorization: `Bearer ${tokenResponse.access_token}` }
        }).then(r => r.json())
        
        const newAccount: GoogleAccount = {
          id: Date.now().toString(),
          email: userInfo.email,
          accessToken: tokenResponse.access_token,
          refreshToken: tokenResponse.refresh_token,
          expiresAt: Date.now() + (tokenResponse.expires_in * 1000),
        }
        
        saveAccounts([...accounts, newAccount])
        alert('Account berhasil ditambahkan!')
      }
    } catch (error) {
      alert('Error: ' + error)
    } finally {
      setConnecting(false)
    }
  }

  const deleteAccount = (id: string) => {
    if (confirm('Hapus account ini?')) {
      saveAccounts(accounts.filter((acc) => acc.id !== id))
    }
  }

  const handleFileSelect = async () => {
    try {
      const selected = await open({
        multiple: false,
        title: 'Pilih File Attachment',
      })
      if (selected && typeof selected === 'string') {
        setAttachmentPath(selected)
      }
    } catch (error) {
      console.error('Error selecting file:', error)
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setResponseMessage('')

    const account = accounts.find((acc) => acc.id === selectedAccount)
    if (!account) {
      setResponseMessage('Pilih account pengirim terlebih dahulu')
      setLoading(false)
      return
    }

    const emailList = emails
      .map((e) => e.trim())
      .filter((e) => e.length > 0)

    try {
      const response: any = await invoke('send_emails', {
        request: {
          title,
          message,
          emails: emailList,
          access_token: account.accessToken,
          attachment_path: attachmentPath,
        },
      })

      setResponseMessage(response.message)
    } catch (error) {
      setResponseMessage(`Error: ${error}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '20px' }}>DKA Email Sender AI Automatically Tools</h1>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '2px solid #eee' }}>
        <button
          onClick={() => setActiveTab('send')}
          style={{
            padding: '10px 20px',
            backgroundColor: activeTab === 'send' ? '#0070f3' : 'transparent',
            color: activeTab === 'send' ? 'white' : '#666',
            border: 'none',
            borderBottom: activeTab === 'send' ? '2px solid #0070f3' : 'none',
            cursor: 'pointer',
            fontWeight: '500',
          }}
        >
          Kirim Email
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          style={{
            padding: '10px 20px',
            backgroundColor: activeTab === 'settings' ? '#0070f3' : 'transparent',
            color: activeTab === 'settings' ? 'white' : '#666',
            border: 'none',
            borderBottom: activeTab === 'settings' ? '2px solid #0070f3' : 'none',
            cursor: 'pointer',
            fontWeight: '500',
          }}
        >
          Settings Account
        </button>
      </div>

      {/* Send Email Tab */}
      {activeTab === 'send' && (
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            {/* Kolom Kiri */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Subject:</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '5px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Isi Pesan:</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  required
                  placeholder="Tulis isi pesan email di sini..."
                  rows={12}
                  style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '5px', resize: 'vertical' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Attachment (opsional):</label>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={handleFileSelect}
                    style={{
                      padding: '8px 15px',
                      backgroundColor: '#666',
                      color: 'white',
                      border: 'none',
                      borderRadius: '5px',
                      cursor: 'pointer',
                    }}
                  >
                    Pilih File
                  </button>
                  {attachmentPath && (
                    <>
                      <span style={{ fontSize: '14px', color: '#666', flex: 1 }}>
                        {attachmentPath.split(/[\\/]/).pop()}
                      </span>
                      <button
                        type="button"
                        onClick={() => setAttachmentPath(null)}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: '#dc3545',
                          color: 'white',
                          border: 'none',
                          borderRadius: '5px',
                          cursor: 'pointer',
                          fontSize: '12px',
                        }}
                      >
                        Hapus
                      </button>
                    </>
                  )}
                </div>
                <small style={{ display: 'block', marginTop: '5px', color: '#666' }}>
                  File > 25 MB akan otomatis diupload ke Google Drive
                </small>
              </div>
            </div>

            {/* Kolom Kanan */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Pilih Account Pengirim:</label>
                <select
                  value={selectedAccount}
                  onChange={(e) => setSelectedAccount(e.target.value)}
                  required
                  style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '5px' }}
                >
                  <option value="">-- Pilih Account --</option>
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.email}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Email Penerima:</label>
                <div style={{ maxHeight: '200px', overflowY: 'auto', marginBottom: '10px', padding: '5px', border: '1px solid #eee', borderRadius: '5px' }}>
                  {emails.map((email, index) => (
                    <div key={index} style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => updateEmail(index, e.target.value)}
                        required
                        placeholder="email@example.com"
                        style={{ flex: 1, padding: '8px', border: '1px solid #ddd', borderRadius: '5px' }}
                      />
                      {emails.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeEmailField(index)}
                          style={{
                            padding: '8px 12px',
                            backgroundColor: '#dc3545',
                            color: 'white',
                            border: 'none',
                            borderRadius: '5px',
                            cursor: 'pointer',
                          }}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={addEmailField}
                  style={{
                    padding: '8px 15px',
                    backgroundColor: '#28a745',
                    color: 'white',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    width: '100%',
                  }}
                >
                  + Tambah Email
                </button>
              </div>

              <button
                type="submit"
                disabled={loading || accounts.length === 0}
                style={{
                  padding: '12px',
                  backgroundColor: loading || accounts.length === 0 ? '#ccc' : '#0070f3',
                  color: 'white',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: loading || accounts.length === 0 ? 'not-allowed' : 'pointer',
                  fontSize: '16px',
                  fontWeight: '500',
                  marginTop: '10px',
                }}
              >
                {loading ? 'Mengirim...' : accounts.length === 0 ? 'Login Google Dulu' : 'Kirim Email'}
              </button>
            </div>
          </div>

          {responseMessage && (
            <div
              style={{
                marginTop: '20px',
                padding: '15px',
                backgroundColor: responseMessage.includes('Error') ? '#fee' : '#efe',
                border: `1px solid ${responseMessage.includes('Error') ? '#fcc' : '#cfc'}`,
                borderRadius: '5px',
              }}
            >
              {responseMessage}
            </div>
          )}
        </form>
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <div>
          <div style={{ marginBottom: '30px', padding: '20px', backgroundColor: '#f9f9f9', borderRadius: '5px', textAlign: 'center' }}>
            <h3 style={{ marginBottom: '15px' }}>Login dengan Google</h3>
            <p style={{ marginBottom: '20px', color: '#666' }}>
              Klik tombol di bawah untuk login dengan akun Google Anda.
              <br />
              Anda akan mendapatkan akses untuk mengirim email dan upload file ke Drive.
            </p>
            <button
              onClick={handleGoogleLogin}
              disabled={connecting}
              style={{
                padding: '12px 24px',
                backgroundColor: connecting ? '#ccc' : '#4285f4',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: connecting ? 'not-allowed' : 'pointer',
                fontWeight: '500',
                fontSize: '16px',
              }}
            >
              {connecting ? 'Connecting...' : '🔐 Login with Google'}
            </button>
          </div>

          <div>
            <h3 style={{ marginBottom: '15px' }}>Daftar Account</h3>
            {accounts.length === 0 ? (
              <p style={{ color: '#666', textAlign: 'center', padding: '20px' }}>
                Belum ada account. Login dengan Google di atas.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {accounts.map((acc) => (
                  <div
                    key={acc.id}
                    style={{
                      padding: '15px',
                      backgroundColor: '#fff',
                      border: '1px solid #ddd',
                      borderRadius: '5px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: '500', marginBottom: '5px' }}>{acc.email}</div>
                      <div style={{ fontSize: '12px', color: '#28a745' }}>
                        ✓ Connected
                      </div>
                    </div>
                    <button
                      onClick={() => deleteAccount(acc.id)}
                      style={{
                        padding: '8px 15px',
                        backgroundColor: '#dc3545',
                        color: 'white',
                        border: 'none',
                        borderRadius: '5px',
                        cursor: 'pointer',
                      }}
                    >
                      Hapus
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ marginTop: '30px', fontSize: '13px', color: '#666', backgroundColor: '#f9f9f9', padding: '15px', borderRadius: '5px' }}>
            <p style={{ fontWeight: '500', marginBottom: '8px' }}>Keuntungan Login dengan Google:</p>
            <ul style={{ marginLeft: '20px', lineHeight: '1.6' }}>
              <li>Tidak perlu App Password</li>
              <li>Lebih aman dengan OAuth2</li>
              <li>Support file besar (auto upload ke Drive)</li>
              <li>Bisa revoke akses kapan saja dari Google Account</li>
            </ul>
          </div>
        </div>
      )}
    </main>
  )
}
