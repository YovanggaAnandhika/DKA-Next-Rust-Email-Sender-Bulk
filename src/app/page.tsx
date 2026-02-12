'use client'

import { useState, FormEvent, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/tauri'
import { open } from '@tauri-apps/api/dialog'

interface EmailAccount {
  id: string
  name: string
  email: string
  password: string
  driveToken?: string
  isValid: boolean
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
  const [accounts, setAccounts] = useState<EmailAccount[]>([])
  const [newAccountName, setNewAccountName] = useState('')
  const [newAccountEmail, setNewAccountEmail] = useState('')
  const [newAccountPassword, setNewAccountPassword] = useState('')
  const [newAccountDriveToken, setNewAccountDriveToken] = useState('')
  const [validating, setValidating] = useState(false)

  useEffect(() => {
    // Load accounts from localStorage
    const saved = localStorage.getItem('emailAccounts')
    if (saved) {
      setAccounts(JSON.parse(saved))
    }
  }, [])

  const saveAccounts = (newAccounts: EmailAccount[]) => {
    setAccounts(newAccounts)
    localStorage.setItem('emailAccounts', JSON.stringify(newAccounts))
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

  const validateAccount = async () => {
    if (!newAccountEmail || !newAccountPassword) {
      alert('Email dan password harus diisi')
      return
    }

    setValidating(true)
    try {
      const response: any = await invoke('validate_smtp', {
        email: newAccountEmail,
        password: newAccountPassword,
      })

      if (response.success) {
        const newAccount: EmailAccount = {
          id: Date.now().toString(),
          name: newAccountName || newAccountEmail,
          email: newAccountEmail,
          password: newAccountPassword,
          driveToken: newAccountDriveToken || undefined,
          isValid: true,
        }
        saveAccounts([...accounts, newAccount])
        setNewAccountName('')
        setNewAccountEmail('')
        setNewAccountPassword('')
        setNewAccountDriveToken('')
        alert('Account berhasil ditambahkan!')
      } else {
        alert('Validasi gagal: ' + response.message)
      }
    } catch (error) {
      alert('Error validasi: ' + error)
    } finally {
      setValidating(false)
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
          smtp_username: account.email,
          smtp_password: account.password,
          attachment_path: attachmentPath,
          google_drive_token: account.driveToken || null,
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
            {/* Kolom Kiri - Email Content */}
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
                  File > 25 MB akan otomatis diupload ke Google Drive (perlu token)
                </small>
              </div>
            </div>

            {/* Kolom Kanan - Recipients & Account */}
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
                      {acc.name} ({acc.email})
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
                {loading ? 'Mengirim...' : accounts.length === 0 ? 'Tambah Account Dulu' : 'Kirim Email'}
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
          <div style={{ marginBottom: '30px', padding: '20px', backgroundColor: '#f9f9f9', borderRadius: '5px' }}>
            <h3 style={{ marginBottom: '15px' }}>Tambah Account Baru</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Nama Account (opsional):</label>
                <input
                  type="text"
                  value={newAccountName}
                  onChange={(e) => setNewAccountName(e.target.value)}
                  placeholder="Contoh: Account Kantor"
                  style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '5px' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Gmail Email:</label>
                <input
                  type="email"
                  value={newAccountEmail}
                  onChange={(e) => setNewAccountEmail(e.target.value)}
                  placeholder="your-email@gmail.com"
                  required
                  style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '5px' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Gmail App Password:</label>
                <input
                  type="password"
                  value={newAccountPassword}
                  onChange={(e) => setNewAccountPassword(e.target.value)}
                  placeholder="App Password (16 karakter)"
                  required
                  style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '5px' }}
                />
              </div>
              <button
                onClick={validateAccount}
                disabled={validating}
                style={{
                  padding: '10px',
                  backgroundColor: validating ? '#ccc' : '#0070f3',
                  color: 'white',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: validating ? 'not-allowed' : 'pointer',
                  fontWeight: '500',
                }}
              >
                {validating ? 'Memvalidasi...' : 'Validasi & Tambah Account'}
              </button>
            </div>
          </div>

          <div>
            <h3 style={{ marginBottom: '15px' }}>Daftar Account</h3>
            {accounts.length === 0 ? (
              <p style={{ color: '#666', textAlign: 'center', padding: '20px' }}>
                Belum ada account. Tambahkan account baru di atas.
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
                      <div style={{ fontWeight: '500', marginBottom: '5px' }}>{acc.name}</div>
                      <div style={{ fontSize: '14px', color: '#666' }}>{acc.email}</div>
                      <div style={{ fontSize: '12px', color: acc.isValid ? '#28a745' : '#dc3545', marginTop: '5px' }}>
                        {acc.isValid ? '✓ Valid' : '✗ Invalid'}
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
            <p style={{ fontWeight: '500', marginBottom: '8px' }}>Cara membuat Gmail App Password:</p>
            <ol style={{ marginLeft: '20px', lineHeight: '1.6' }}>
              <li>Buka Google Account → Security</li>
              <li>Aktifkan 2-Step Verification</li>
              <li>Buka App passwords</li>
              <li>Generate password baru untuk "Mail"</li>
              <li>Copy password 16 karakter dan paste di form</li>
            </ol>
          </div>
        </div>
      )}
    </main>
  )
}
