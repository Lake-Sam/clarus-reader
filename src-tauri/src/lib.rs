use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    fs,
    path::PathBuf,
    time::{Duration, SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Manager};

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

#[derive(Debug, Clone, Deserialize, Serialize, Default)]
#[serde(rename_all = "camelCase")]
struct LibraryState {
    version: u8,
    projects: Vec<LibraryProject>,
    documents: Vec<LibraryDocument>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct LibraryProject {
    id: String,
    name: String,
    document_ids: Vec<String>,
    created_at: u64,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct LibraryDocument {
    id: String,
    name: String,
    size: u64,
    imported_at: u64,
    page_count: usize,
    indexed: bool,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
struct PageText {
    page: usize,
    text: String,
}

fn now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}
fn library_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("library");
    fs::create_dir_all(dir.join("documents")).map_err(|e| e.to_string())?;
    fs::create_dir_all(dir.join("indexes")).map_err(|e| e.to_string())?;
    Ok(dir)
}
fn state_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(library_dir(app)?.join("library.json"))
}
fn load_library(app: &AppHandle) -> Result<LibraryState, String> {
    let path = state_path(app)?;
    if !path.exists() {
        return Ok(LibraryState {
            version: 1,
            ..Default::default()
        });
    }
    serde_json::from_slice(&fs::read(path).map_err(|e| e.to_string())?).map_err(|e| e.to_string())
}
fn store_library(app: &AppHandle, state: &LibraryState) -> Result<(), String> {
    let path = state_path(app)?;
    fs::write(
        path,
        serde_json::to_vec_pretty(state).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
fn library_state(app: AppHandle) -> Result<LibraryState, String> {
    load_library(&app)
}

#[tauri::command]
fn create_project(app: AppHandle, name: String) -> Result<LibraryState, String> {
    let clean = name.trim();
    if clean.is_empty() {
        return Err("Project name cannot be empty".into());
    }
    let mut state = load_library(&app)?;
    state.projects.push(LibraryProject {
        id: uuid::Uuid::new_v4().to_string(),
        name: clean.to_string(),
        document_ids: vec![],
        created_at: now(),
    });
    store_library(&app, &state)?;
    Ok(state)
}

#[tauri::command]
fn delete_project(app: AppHandle, project_id: String) -> Result<LibraryState, String> {
    let mut state = load_library(&app)?;
    state.projects.retain(|project| project.id != project_id);
    store_library(&app, &state)?;
    Ok(state)
}

#[tauri::command]
fn import_document(
    app: AppHandle,
    source_path: String,
    project_id: Option<String>,
) -> Result<LibraryState, String> {
    let source = PathBuf::from(&source_path);
    if source
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.eq_ignore_ascii_case("pdf"))
        != Some(true)
    {
        return Err("Choose a PDF file".into());
    }
    let metadata = fs::metadata(&source).map_err(|e| e.to_string())?;
    let id = uuid::Uuid::new_v4().to_string();
    let name = source
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or("Invalid file name")?
        .to_string();
    let target = library_dir(&app)?
        .join("documents")
        .join(format!("{id}.pdf"));
    fs::copy(source, target)
        .map_err(|e| format!("Could not copy PDF into the Clarus library: {e}"))?;
    let mut state = load_library(&app)?;
    state.documents.push(LibraryDocument {
        id: id.clone(),
        name,
        size: metadata.len(),
        imported_at: now(),
        page_count: 0,
        indexed: false,
    });
    if let Some(project_id) = project_id {
        if let Some(project) = state
            .projects
            .iter_mut()
            .find(|project| project.id == project_id)
        {
            project.document_ids.push(id);
        }
    }
    store_library(&app, &state)?;
    Ok(state)
}

#[tauri::command]
fn add_document_to_project(
    app: AppHandle,
    document_id: String,
    project_id: String,
) -> Result<LibraryState, String> {
    let mut state = load_library(&app)?;
    let project = state
        .projects
        .iter_mut()
        .find(|project| project.id == project_id)
        .ok_or("Project not found")?;
    if !project.document_ids.contains(&document_id) {
        project.document_ids.push(document_id);
    }
    store_library(&app, &state)?;
    Ok(state)
}

#[tauri::command]
fn remove_document_from_project(
    app: AppHandle,
    document_id: String,
    project_id: String,
) -> Result<LibraryState, String> {
    let mut state = load_library(&app)?;
    if let Some(project) = state
        .projects
        .iter_mut()
        .find(|project| project.id == project_id)
    {
        project.document_ids.retain(|id| id != &document_id);
    }
    store_library(&app, &state)?;
    Ok(state)
}

#[tauri::command]
fn delete_document(app: AppHandle, document_id: String) -> Result<LibraryState, String> {
    let mut state = load_library(&app)?;
    state
        .documents
        .retain(|document| document.id != document_id);
    for project in &mut state.projects {
        project.document_ids.retain(|id| id != &document_id);
    }
    let dir = library_dir(&app)?;
    let _ = fs::remove_file(dir.join("documents").join(format!("{document_id}.pdf")));
    let _ = fs::remove_file(dir.join("indexes").join(format!("{document_id}.json")));
    store_library(&app, &state)?;
    Ok(state)
}

#[tauri::command]
fn read_document(app: AppHandle, document_id: String) -> Result<String, String> {
    let state = load_library(&app)?;
    if !state
        .documents
        .iter()
        .any(|document| document.id == document_id)
    {
        return Err("Document not found".into());
    }
    let bytes = fs::read(
        library_dir(&app)?
            .join("documents")
            .join(format!("{document_id}.pdf")),
    )
    .map_err(|e| e.to_string())?;
    Ok(BASE64.encode(bytes))
}

#[tauri::command]
fn save_document_index(
    app: AppHandle,
    document_id: String,
    pages: Vec<PageText>,
) -> Result<LibraryState, String> {
    let mut state = load_library(&app)?;
    let document = state
        .documents
        .iter_mut()
        .find(|document| document.id == document_id)
        .ok_or("Document not found")?;
    document.page_count = pages.len();
    document.indexed = true;
    fs::write(
        library_dir(&app)?
            .join("indexes")
            .join(format!("{document_id}.json")),
        serde_json::to_vec(&pages).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())?;
    store_library(&app, &state)?;
    Ok(state)
}

#[tauri::command]
fn load_document_index(app: AppHandle, document_id: String) -> Result<Vec<PageText>, String> {
    let path = library_dir(&app)?
        .join("indexes")
        .join(format!("{document_id}.json"));
    if !path.exists() {
        return Ok(vec![]);
    }
    serde_json::from_slice(&fs::read(path).map_err(|e| e.to_string())?).map_err(|e| e.to_string())
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
        if image.is_some() {
            return Err(format!("The configured vision model '{}' could not read this image. Choose a vision-capable model in Settings. Provider returned {status}: {detail}", request.model));
        }
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
            complete_ai,
            library_state,
            create_project,
            delete_project,
            import_document,
            add_document_to_project,
            remove_document_from_project,
            delete_document,
            read_document,
            save_document_index,
            load_document_index
        ])
        .run(tauri::generate_context!())
        .expect("error while running Clarus Reader");
}
