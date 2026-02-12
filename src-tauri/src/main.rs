#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use lettre::message::{header, Attachment, MultiPart, SinglePart};
use lettre::transport::smtp::authentication::Credentials;
use lettre::{Message, SmtpTransport, Transport};
use serde::{Deserialize, Serialize};
use std::fs;

#[derive(Deserialize)]
struct EmailRequest {
    title: String,
    message: String,
    emails: Vec<String>,
    smtp_username: String,
    smtp_password: String,
    attachment_path: Option<String>,
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

    let attachment_data = if let Some(path) = &request.attachment_path {
        match fs::read(path) {
            Ok(data) => {
                let filename = std::path::Path::new(path)
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("attachment")
                    .to_string();
                Some((filename, data))
            }
            Err(_) => None,
        }
    } else {
        None
    };

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
                        .singlepart(SinglePart::plain(request.message.clone()))
                        .singlepart(attachment),
                )
                .map_err(|e| e.to_string())?
        } else {
            email_builder
                .body(request.message.clone())
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
