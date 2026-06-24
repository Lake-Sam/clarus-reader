use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::time::Duration;

const KEYRING_SERVICE: &str = "org.clarus.reader";

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AiRequest {
    provider: String,
    model: String,
    base_url: Option<String>,
    system: String,
    messages: Vec<ChatMessage>,
    image_data_url: Option<String>,
}

#[derive(Debug, Deserialize, Serialize)]
struct ChatMessage {
    role: String,
    content: String,
}

fn entry(provider: &str) -> Result<keyring::Entry, String> {
    keyring::Entry::new(KEYRING_SERVICE, provider).map_err(|e| e.to_string())
}

#[tauri::command]
fn save_api_key(provider: String, key: String) -> Result<(), String> {
    let trimmed = key.trim();
    if trimmed.is_empty() {
        return Err("API key cannot be empty".into());
    }
    entry(&provider)?
        .set_password(trimmed)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_api_key(provider: String) -> Result<(), String> {
    match entry(&provider)?.delete_credential() {
        Ok(_) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
fn has_api_key(provider: String) -> bool {
    entry(&provider)
        .and_then(|e| e.get_password().map_err(|x| x.to_string()))
        .is_ok()
}

fn text_from_openai(value: &Value) -> Option<String> {
    if let Some(text) = value.get("output_text").and_then(Value::as_str) {
        return Some(text.to_string());
    }
    value
        .get("output")?
        .as_array()?
        .iter()
        .flat_map(|item| {
            item.get("content")
                .and_then(Value::as_array)
                .into_iter()
                .flatten()
        })
        .find_map(|part| part.get("text").and_then(Value::as_str).map(str::to_string))
}

fn parse_data_url(value: &str) -> Option<(String, String)> {
    let (header, data) = value.split_once(',')?;
    let media_type = header.strip_prefix("data:")?.split(';').next()?.to_string();
    if !header.contains(";base64") || data.is_empty() {
        return None;
    }
    Some((media_type, data.to_string()))
}

#[tauri::command]
async fn complete_ai(request: AiRequest) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(120))
        .build()
        .map_err(|e| e.to_string())?;
    let provider = request.provider.as_str();
    let image = request.image_data_url.as_deref().and_then(parse_data_url);
    let key = if provider == "ollama" {
        String::new()
    } else {
        entry(provider)?
            .get_password()
            .map_err(|_| format!("No API key saved for {provider}"))?
    };

    let response = match provider {
        "openai" => {
            let url = format!("{}/responses", request.base_url.as_deref().unwrap_or("https://api.openai.com/v1").trim_end_matches('/'));
            let mut input = vec![json!({"role":"developer", "content": request.system})];
            let image_message = request.messages.iter().rposition(|message| message.role == "user");
            input.extend(request.messages.iter().enumerate().map(|(index, message)| {
                if image_message == Some(index) {
                    if let Some((_, data)) = image.as_ref() {
                        return json!({"role":message.role,"content":[
                            {"type":"input_text","text":message.content},
                            {"type":"input_image","image_url":format!("data:image/png;base64,{data}")}
                        ]});
                    }
                }
                json!({"role":message.role,"content":message.content})
            }));
            client.post(url).bearer_auth(key).json(&json!({
                "model": request.model, "input": input, "max_output_tokens": 1800
            })).send().await
        }
        "anthropic" => {
            let url = format!("{}/messages", request.base_url.as_deref().unwrap_or("https://api.anthropic.com/v1").trim_end_matches('/'));
            let image_message = request.messages.iter().rposition(|message| message.role == "user");
            let messages: Vec<Value> = request.messages.iter().enumerate().map(|(index, message)| {
                if image_message == Some(index) {
                    if let Some((media_type, data)) = image.as_ref() {
                        return json!({"role":message.role,"content":[
                            {"type":"text","text":message.content},
                            {"type":"image","source":{"type":"base64","media_type":media_type,"data":data}}
                        ]});
                    }
                }
                json!({"role":message.role,"content":message.content})
            }).collect();
            client.post(url)
                .header("x-api-key", key).header("anthropic-version", "2023-06-01")
                .json(&json!({"model":request.model,"system":request.system,"messages":messages,"max_tokens":1800}))
                .send().await
        }
        "compatible" => {
            let base = request.base_url.as_deref().ok_or("An endpoint URL is required")?.trim_end_matches('/');
            let mut messages = vec![json!({"role":"system","content":request.system})];
            let image_message = request.messages.iter().rposition(|message| message.role == "user");
            messages.extend(request.messages.iter().enumerate().map(|(index, message)| {
                if image_message == Some(index) {
                    if let Some((_, data)) = image.as_ref() {
                        return json!({"role":message.role,"content":[
                            {"type":"text","text":message.content},
                            {"type":"image_url","image_url":{"url":format!("data:image/png;base64,{data}")}}
                        ]});
                    }
                }
                json!({"role":message.role,"content":message.content})
            }));
            client.post(format!("{base}/chat/completions")).bearer_auth(key)
                .json(&json!({"model":request.model,"messages":messages})).send().await
        }
        "ollama" => {
            let base = request.base_url.as_deref().unwrap_or("http://127.0.0.1:11434").trim_end_matches('/');
            let mut messages = vec![json!({"role":"system","content":request.system})];
            let image_message = request.messages.iter().rposition(|message| message.role == "user");
            messages.extend(request.messages.iter().enumerate().map(|(index, message)| {
                if image_message == Some(index) {
                    if let Some((_, data)) = image.as_ref() {
                        return json!({"role":message.role,"content":message.content,"images":[data]});
                    }
                }
                json!({"role":message.role,"content":message.content})
            }));
            client.post(format!("{base}/api/chat"))
                .json(&json!({"model":request.model,"messages":messages,"stream":false})).send().await
        }
        _ => return Err("Unsupported AI provider".into()),
    }.map_err(|e| format!("Could not reach the model provider: {e}"))?;

    let status = response.status();
    let value: Value = response
        .json()
        .await
        .map_err(|e| format!("Invalid provider response: {e}"))?;
    if !status.is_success() {
        let detail = value
            .pointer("/error/message")
            .and_then(Value::as_str)
            .or_else(|| value.get("error").and_then(Value::as_str))
            .unwrap_or("Unknown provider error");
        return Err(format!("Provider returned {status}: {detail}"));
    }
    let text = match provider {
        "openai" => text_from_openai(&value),
        "anthropic" => value
            .pointer("/content/0/text")
            .and_then(Value::as_str)
            .map(str::to_string),
        "ollama" => value
            .pointer("/message/content")
            .and_then(Value::as_str)
            .map(str::to_string),
        _ => value
            .pointer("/choices/0/message/content")
            .and_then(Value::as_str)
            .map(str::to_string),
    };
    text.ok_or_else(|| "The provider returned no readable text".into())
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            save_api_key,
            delete_api_key,
            has_api_key,
            complete_ai
        ])
        .run(tauri::generate_context!())
        .expect("error while running Clarus Reader");
}
