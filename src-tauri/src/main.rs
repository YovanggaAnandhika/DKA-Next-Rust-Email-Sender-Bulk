#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use oauth2::{
    AuthUrl, AuthorizationCode, ClientId, ClientSecret, CsrfToken,
    RedirectUrl, Scope, TokenResponse as OAuth2TokenResponse, TokenUrl,
};
use oauth2::basic::BasicClient;
use oauth2::reqwest::async_http_client;
use serde::{Deserialize, Serialize};
use std::fs;
use reqwest::multipart;
use base64::{Engine as _, engine::general_purpose};

const GOOGLE_CLIENT_ID: &str = "YOUR_CLIENT_ID.apps.googleusercontent.com";
const GOOGLE_CLIENT_SECRET: &str = "YOUR_CLIENT_SECRET";
const REDIRECT_URI: &str = "http://localhost:8888/callback";

#[derive(Deserialize)]
struct EmailRequest {
    title: String,
    message: String,
    emails: Vec<String>,
    access_token: String,
    attachment_path: Option<String>,
}

#[derive(Serialize)]
struct EmailResponse {
    success: bool,
    message: String,
}

#[derive(Serialize)]
struct OAuthUrlResponse {
    auth_url: String,
    csrf_token: String,
}

#[derive(Serialize)]
struct TokenData {
    access_token: String,
    refresh_token: Option<String>,
    expires_in: i64,
}

#[derive(Deserialize)]
struct DriveUploadResponse {
    id: String,
    #[serde(rename = "webViewLink")]
    web_view_link: Option<String>,
}

#[tauri::command]
async fn start_oauth_flow() -> Result<OAuthUrlResponse, String> {
    let client = BasicClient::new(
        ClientId::new(GOOGLE_CLIENT_ID.to_string()),
        Some(ClientSecret::new(GOOGLE_CLIENT_SECRET.to_string())),
        AuthUrl::new("https://accounts.google.com/o/oauth2/v2/auth".to_string())
            .map_err(|e| e.to_string())?,
        Some(
            TokenUrl::new("https://oauth2.googleapis.com/token".to_string())
                .map_err(|e| e.to_string())?,
        ),
    )
    .set_redirect_uri(RedirectUrl::new(REDIRECT_URI.to_string()).map_err(|e| e.to_string())?);

    let (auth_url, csrf_token) = client
        .authorize_url(CsrfToken::new_random)
        .add_scope(Scope::new("https://www.googleapis.com/auth/gmail.send".to_string()))
        .add_scope(Scope::new("https://www.googleapis.com/auth/drive.file".to_string()))
        .add_scope(Scope::new("https://www.googleapis.com/auth/userinfo.email".to_string()))
        .url();

    // Start local server to listen for callback
    tokio::spawn(async move {
        start_callback_server().await;
    });

    Ok(OAuthUrlResponse {
        auth_url: auth_url.to_string(),
        csrf_token: csrf_token.secret().clone(),
    })
}

async fn start_callback_server() {
    use tiny_http::{Server, Response};
    
    let server = match Server::http("127.0.0.1:8888") {
        Ok(s) => s,
        Err(_) => return,
    };

    if let Ok(request) = server.recv() {
        let url = request.url().to_string();
        
        // Extract code from URL
        if let Some(code_start) = url.find("code=") {
            let code_part = &url[code_start + 5..];
            let code = if let Some(amp_pos) = code_part.find('&') {
                &code_part[..amp_pos]
            } else {
                code_part
            };

            // Store code for retrieval first
            std::fs::write("/tmp/oauth_code.txt", code).ok();

            // Send success response to browser
            let html = r#"
                <!DOCTYPE html>
                <html>
                <head><title>Success</title></head>
                <body style="font-family: Arial; text-align: center; padding: 50px;">
                    <h1>✓ Login Berhasil!</h1>
                    <p>Anda bisa menutup tab ini dan kembali ke aplikasi.</p>
                    <script>window.close();</script>
                </body>
                </html>
            "#;
            
            let _ = request.respond(Response::from_string(html).with_header(
                tiny_http::Header::from_bytes(&b"Content-Type"[..], &b"text/html"[..]).unwrap()
            ));
        }
    }
}

#[tauri::command]
async fn get_oauth_code() -> Result<String, String> {
    // Wait for code file to exist (max 60 seconds)
    for _ in 0..60 {
        if let Ok(code) = std::fs::read_to_string("/tmp/oauth_code.txt") {
            std::fs::remove_file("/tmp/oauth_code.txt").ok();
            return Ok(code);
        }
        tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
    }
    Err("Timeout waiting for authorization".to_string())
}

#[tauri::command]
async fn exchange_code_for_token(code: String) -> Result<TokenData, String> {
    let client = BasicClient::new(
        ClientId::new(GOOGLE_CLIENT_ID.to_string()),
        Some(ClientSecret::new(GOOGLE_CLIENT_SECRET.to_string())),
        AuthUrl::new("https://accounts.google.com/o/oauth2/v2/auth".to_string())
            .map_err(|e| e.to_string())?,
        Some(
            TokenUrl::new("https://oauth2.googleapis.com/token".to_string())
                .map_err(|e| e.to_string())?,
        ),
    )
    .set_redirect_uri(RedirectUrl::new(REDIRECT_URI.to_string()).map_err(|e| e.to_string())?);

    let token_result = client
        .exchange_code(AuthorizationCode::new(code))
        .request_async(async_http_client)
        .await
        .map_err(|e| format!("Token exchange failed: {}", e))?;

    Ok(TokenData {
        access_token: token_result.access_token().secret().clone(),
        refresh_token: token_result.refresh_token().map(|t| t.secret().clone()),
        expires_in: token_result.expires_in().map(|d| d.as_secs() as i64).unwrap_or(3600),
    })
}

async fn upload_to_drive(file_path: &str, token: &str) -> Result<String, String> {
    let file_data = fs::read(file_path).map_err(|e| e.to_string())?;
    let filename = std::path::Path::new(file_path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("attachment")
        .to_string();

    let client = reqwest::Client::new();
    
    let metadata = serde_json::json!({
        "name": filename
    });

    let form = multipart::Form::new()
        .text("metadata", metadata.to_string())
        .part("file", multipart::Part::bytes(file_data).file_name(filename.clone()));

    let upload_response = client
        .post("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart")
        .bearer_auth(token)
        .multipart(form)
        .send()
        .await
        .map_err(|e| format!("Upload failed: {}", e))?;

    if !upload_response.status().is_success() {
        return Err(format!("Upload failed: {}", upload_response.status()));
    }

    let drive_response: DriveUploadResponse = upload_response
        .json()
        .await
        .map_err(|e| format!("Parse response failed: {}", e))?;

    let permission_body = serde_json::json!({
        "role": "reader",
        "type": "anyone"
    });

    client
        .post(&format!("https://www.googleapis.com/drive/v3/files/{}/permissions", drive_response.id))
        .bearer_auth(token)
        .json(&permission_body)
        .send()
        .await
        .map_err(|e| format!("Set permission failed: {}", e))?;

    let file_info = client
        .get(&format!("https://www.googleapis.com/drive/v3/files/{}?fields=webViewLink", drive_response.id))
        .bearer_auth(token)
        .send()
        .await
        .map_err(|e| format!("Get file info failed: {}", e))?
        .json::<DriveUploadResponse>()
        .await
        .map_err(|e| format!("Parse file info failed: {}", e))?;

    Ok(file_info.web_view_link.unwrap_or_else(|| format!("https://drive.google.com/file/d/{}/view", drive_response.id)))
}

#[tauri::command]
async fn send_emails(request: EmailRequest) -> Result<EmailResponse, String> {
    if request.emails.is_empty() {
        return Ok(EmailResponse {
            success: false,
            message: "Email list is empty".to_string(),
        });
    }

    let client = reqwest::Client::new();
    let mut email_body = request.message.clone();
    let mut attachment_data: Option<(String, Vec<u8>)> = None;

    // Handle attachment
    if let Some(path) = &request.attachment_path {
        match std::fs::metadata(path) {
            Ok(metadata) => {
                let size_mb = metadata.len() as f64 / (1024.0 * 1024.0);
                
                if size_mb > 25.0 {
                    match upload_to_drive(path, &request.access_token).await {
                        Ok(drive_link) => {
                            email_body.push_str(&format!("\n\n---\nFile attachment ({}): {}", 
                                std::path::Path::new(path).file_name().and_then(|n| n.to_str()).unwrap_or("file"),
                                drive_link
                            ));
                        }
                        Err(e) => {
                            return Ok(EmailResponse {
                                success: false,
                                message: format!("Gagal upload ke Google Drive: {}", e),
                            });
                        }
                    }
                } else {
                    match fs::read(path) {
                        Ok(data) => {
                            let filename = std::path::Path::new(path)
                                .file_name()
                                .and_then(|n| n.to_str())
                                .unwrap_or("attachment")
                                .to_string();
                            attachment_data = Some((filename, data));
                        }
                        Err(_) => {
                            return Ok(EmailResponse {
                                success: false,
                                message: "Cannot read attachment file".to_string(),
                            });
                        }
                    }
                }
            }
            Err(_) => {
                return Ok(EmailResponse {
                    success: false,
                    message: "Cannot read attachment file".to_string(),
                });
            }
        }
    }

    let mut success_count = 0;
    let mut failed_count = 0;

    for recipient in request.emails {
        // Build email in RFC 2822 format
        let mut email_content = format!(
            "To: {}\r\nSubject: {}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n{}",
            recipient, request.title, email_body
        );

        if let Some((filename, data)) = &attachment_data {
            let encoded = general_purpose::STANDARD.encode(data);
            email_content = format!(
                "To: {}\r\nSubject: {}\r\nMIME-Version: 1.0\r\nContent-Type: multipart/mixed; boundary=\"boundary\"\r\n\r\n--boundary\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n{}\r\n\r\n--boundary\r\nContent-Type: application/octet-stream\r\nContent-Disposition: attachment; filename=\"{}\"\r\nContent-Transfer-Encoding: base64\r\n\r\n{}\r\n--boundary--",
                recipient, request.title, email_body, filename, encoded
            );
        }

        let encoded_email = general_purpose::URL_SAFE_NO_PAD.encode(email_content.as_bytes());

        let send_body = serde_json::json!({
            "raw": encoded_email
        });

        let response = client
            .post("https://gmail.googleapis.com/gmail/v1/users/me/messages/send")
            .bearer_auth(&request.access_token)
            .json(&send_body)
            .send()
            .await;

        match response {
            Ok(resp) if resp.status().is_success() => success_count += 1,
            _ => failed_count += 1,
        }
    }

    Ok(EmailResponse {
        success: true,
        message: format!("Terkirim: {}, Gagal: {}", success_count, failed_count),
    })
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            start_oauth_flow,
            get_oauth_code,
            exchange_code_for_token,
            send_emails
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
