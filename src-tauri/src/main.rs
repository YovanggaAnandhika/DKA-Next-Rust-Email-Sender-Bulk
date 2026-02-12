#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use lettre::message::{header, Attachment, MultiPart, SinglePart};
use lettre::transport::smtp::authentication::Credentials;
use lettre::{Message, SmtpTransport, Transport};
use serde::{Deserialize, Serialize};
use std::fs;
use reqwest::multipart;

#[derive(Deserialize)]
struct EmailRequest {
    title: String,
    message: String,
    emails: Vec<String>,
    smtp_username: String,
    smtp_password: String,
    attachment_path: Option<String>,
    google_drive_token: Option<String>,
}

#[derive(Serialize)]
struct EmailResponse {
    success: bool,
    message: String,
}

#[derive(Serialize)]
struct ValidateResponse {
    success: bool,
    message: String,
}

#[derive(Deserialize)]
struct DriveUploadResponse {
    id: String,
    #[serde(rename = "webViewLink")]
    web_view_link: Option<String>,
}

async fn upload_to_drive(file_path: &str, token: &str) -> Result<String, String> {
    let file_data = fs::read(file_path).map_err(|e| e.to_string())?;
    let filename = std::path::Path::new(file_path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("attachment")
        .to_string();

    let client = reqwest::Client::new();
    
    // Upload file
    let form = multipart::Form::new()
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

    // Make file public
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

    // Get shareable link
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
async fn validate_smtp(email: String, password: String) -> Result<ValidateResponse, String> {
    let creds = Credentials::new(email.clone(), password);
    
    match SmtpTransport::relay("smtp.gmail.com") {
        Ok(transport) => {
            let mailer = transport.credentials(creds).build();
            
            // Test connection by trying to send to self (won't actually send)
            let test_email = Message::builder()
                .from(email.parse().map_err(|e| format!("{:?}", e))?)
                .to(email.parse().map_err(|e| format!("{:?}", e))?)
                .subject("Test")
                .body("Test".to_string())
                .map_err(|e| e.to_string())?;
            
            match mailer.test_connection() {
                Ok(true) => Ok(ValidateResponse {
                    success: true,
                    message: "SMTP credentials valid".to_string(),
                }),
                Ok(false) => Ok(ValidateResponse {
                    success: false,
                    message: "Cannot connect to SMTP server".to_string(),
                }),
                Err(e) => Ok(ValidateResponse {
                    success: false,
                    message: format!("Connection error: {}", e),
                }),
            }
        }
        Err(e) => Ok(ValidateResponse {
            success: false,
            message: format!("SMTP setup error: {}", e),
        }),
    }
}

#[tauri::command]
async fn send_emails(request: EmailRequest) -> Result<EmailResponse, String> {
    if request.emails.is_empty() {
        return Ok(EmailResponse {
            success: false,
            message: "Email list is empty".to_string(),
        });
    }

    let creds = Credentials::new(request.smtp_username.clone(), request.smtp_password);
    let mailer = SmtpTransport::relay("smtp.gmail.com")
        .map_err(|e| e.to_string())?
        .credentials(creds)
        .build();

    let mut email_body = request.message.clone();
    let mut attachment_data: Option<(String, Vec<u8>)> = None;

    // Handle attachment
    if let Some(path) = &request.attachment_path {
        match std::fs::metadata(path) {
            Ok(metadata) => {
                let size_mb = metadata.len() as f64 / (1024.0 * 1024.0);
                
                if size_mb > 25.0 {
                    // Upload to Google Drive
                    if let Some(token) = &request.google_drive_token {
                        match upload_to_drive(path, token).await {
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
                        return Ok(EmailResponse {
                            success: false,
                            message: format!("File terlalu besar ({:.2} MB). Perlu Google Drive token untuk file > 25 MB.", size_mb),
                        });
                    }
                } else {
                    // Attach directly
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
        let email_builder = Message::builder()
            .from(request.smtp_username.parse().map_err(|e| format!("{:?}", e))?)
            .to(recipient.parse().map_err(|e| format!("{:?}", e))?)
            .subject(&request.title);

        let email = if let Some((filename, data)) = &attachment_data {
            let attachment = Attachment::new(filename.clone()).body(
                data.clone(),
                header::ContentType::parse("application/octet-stream")
                    .map_err(|e| e.to_string())?,
            );
            email_builder
                .multipart(
                    MultiPart::mixed()
                        .singlepart(SinglePart::plain(email_body.clone()))
                        .singlepart(attachment),
                )
                .map_err(|e| e.to_string())?
        } else {
            email_builder
                .body(email_body.clone())
                .map_err(|e| e.to_string())?
        };

        match mailer.send(&email) {
            Ok(_) => success_count += 1,
            Err(_) => failed_count += 1,
        }
    }

    Ok(EmailResponse {
        success: true,
        message: format!("Terkirim: {}, Gagal: {}", success_count, failed_count),
    })
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![send_emails, validate_smtp])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
