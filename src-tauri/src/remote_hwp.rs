use std::fs;
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use reqwest::blocking::{Client, Response};
use reqwest::header::{CONTENT_DISPOSITION, CONTENT_TYPE};
use reqwest::redirect::Policy;
use serde::Serialize;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteHwpOpenResult {
    pub file_name: String,
    pub final_url: String,
    pub temp_path: String,
    pub bytes: Vec<u8>,
    pub content_type: Option<String>,
    pub content_disposition: Option<String>,
    pub detection_method: String,
}

#[derive(Debug)]
struct RemoteProbe {
    file_name: String,
    final_url: String,
    content_type: Option<String>,
    content_disposition: Option<String>,
    detection_method: String,
}

fn build_client() -> Result<Client, String> {
    Client::builder()
        .timeout(Duration::from_secs(30))
        .redirect(Policy::limited(10))
        .build()
        .map_err(|error| format!("HTTP 클라이언트 초기화 실패: {error}"))
}

fn ensure_http_url(url: &str) -> Result<(), String> {
    let lower = url.to_ascii_lowercase();
    if lower.starts_with("http://") || lower.starts_with("https://") {
        Ok(())
    } else {
        Err("HTTP/HTTPS 링크만 지원합니다.".to_string())
    }
}

fn lower_path_from_url(url: &str) -> String {
    let base = url.split(['#', '?']).next().unwrap_or(url);
    base.to_ascii_lowercase()
}

fn file_name_from_url(url: &str) -> Option<String> {
    let base = url.split(['#', '?']).next().unwrap_or(url);
    let segment = base.rsplit('/').next()?;
    if segment.is_empty() {
        return None;
    }
    Some(segment.to_string())
}

fn sanitize_file_name(name: &str) -> String {
    let trimmed = name.trim();
    let fallback = "downloaded-document.hwp";
    if trimmed.is_empty() {
        return fallback.to_string();
    }

    let mut sanitized = trimmed
        .chars()
        .map(|ch| match ch {
            '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*' => '_',
            c if c.is_control() => '_',
            c => c,
        })
        .collect::<String>();

    if sanitized.is_empty() {
        sanitized = fallback.to_string();
    }

    let lower = sanitized.to_ascii_lowercase();
    if !lower.ends_with(".hwp") && !lower.ends_with(".hwpx") {
        sanitized.push_str(".hwp");
    }

    sanitized
}

fn extract_filename_from_content_disposition(value: &str) -> Option<String> {
    value
        .split(';')
        .find_map(|part| {
            let trimmed = part.trim();
            let (_, filename) = trimmed.split_once('=')?;
            if !trimmed.to_ascii_lowercase().starts_with("filename=") {
                return None;
            }
            Some(filename.trim_matches('"').to_string())
        })
}

fn is_hwp_like_content_type(content_type: Option<&str>) -> bool {
    let Some(value) = content_type else {
        return false;
    };

    let lower = value.to_ascii_lowercase();
    lower.contains("hwp")
        || lower.contains("hwpx")
        || lower.contains("haansoft")
        || lower.contains("hancom")
}

fn is_hwp_file_name(name: &str) -> bool {
    let lower = name.to_ascii_lowercase();
    lower.ends_with(".hwp") || lower.ends_with(".hwpx")
}

fn direct_file_extension_probe(url: &str) -> Option<RemoteProbe> {
    let lower = lower_path_from_url(url);
    if !lower.ends_with(".hwp") && !lower.ends_with(".hwpx") {
        return None;
    }

    let file_name = file_name_from_url(url)
        .map(|name| sanitize_file_name(&name))
        .unwrap_or_else(|| "downloaded-document.hwp".to_string());

    Some(RemoteProbe {
        file_name,
        final_url: url.to_string(),
        content_type: None,
        content_disposition: None,
        detection_method: "direct-extension".to_string(),
    })
}

fn headers_from_response(response: &Response) -> (Option<String>, Option<String>) {
    let content_type = response
        .headers()
        .get(CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .map(|value| value.to_string());
    let content_disposition = response
        .headers()
        .get(CONTENT_DISPOSITION)
        .and_then(|value| value.to_str().ok())
        .map(|value| value.to_string());
    (content_type, content_disposition)
}

fn probe_remote_hwp(client: &Client, url: &str) -> Result<RemoteProbe, String> {
    if let Some(probe) = direct_file_extension_probe(url) {
        return Ok(probe);
    }

    let mut head_error: Option<String> = None;

    match client.head(url).send() {
        Ok(response) => {
            if response.status().is_success() {
                let final_url = response.url().to_string();
                let (content_type, content_disposition) = headers_from_response(&response);
                let disposition_name = content_disposition
                    .as_deref()
                    .and_then(extract_filename_from_content_disposition);

                if is_hwp_like_content_type(content_type.as_deref())
                    || disposition_name.as_deref().map(is_hwp_file_name).unwrap_or(false)
                {
                    let file_name = disposition_name
                        .or_else(|| file_name_from_url(&final_url))
                        .map(|name| sanitize_file_name(&name))
                        .unwrap_or_else(|| "downloaded-document.hwp".to_string());

                    return Ok(RemoteProbe {
                        file_name,
                        final_url,
                        content_type,
                        content_disposition,
                        detection_method: "response-headers".to_string(),
                    });
                }
            }
        }
        Err(error) => {
            head_error = Some(error.to_string());
        }
    }

    let response = client
        .get(url)
        .send()
        .map_err(|error| format!("다운로드 링크 확인 실패: {error}"))?;
    let status = response.status();
    if !status.is_success() {
        return Err(format!("다운로드 링크 응답 실패: HTTP {}", status.as_u16()));
    }

    let final_url = response.url().to_string();
    let (content_type, content_disposition) = headers_from_response(&response);
    let disposition_name = content_disposition
        .as_deref()
        .and_then(extract_filename_from_content_disposition);

    if is_hwp_like_content_type(content_type.as_deref())
        || disposition_name.as_deref().map(is_hwp_file_name).unwrap_or(false)
    {
        let file_name = disposition_name
            .or_else(|| file_name_from_url(&final_url))
            .map(|name| sanitize_file_name(&name))
            .unwrap_or_else(|| "downloaded-document.hwp".to_string());

        Ok(RemoteProbe {
            file_name,
            final_url,
            content_type,
            content_disposition,
            detection_method: "header-fallback-get".to_string(),
        })
    } else {
        Err(match head_error {
            Some(error) => format!("지원되지 않는 링크입니다. (HEAD 실패: {error})"),
            None => "지원되지 않는 링크입니다. HWP/HWPX 파일로 확인되지 않았습니다.".to_string(),
        })
    }
}

fn temp_download_path(file_name: &str) -> Result<PathBuf, String> {
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| format!("시간 계산 실패: {error}"))?
        .as_millis();
    let dir = std::env::temp_dir()
        .join("bbdg-hwp-link-drop")
        .join(format!("drop-{timestamp}"));
    fs::create_dir_all(&dir).map_err(|error| format!("임시 디렉터리 생성 실패: {error}"))?;
    Ok(dir.join(file_name))
}

fn write_downloaded_bytes(path: &Path, bytes: &[u8]) -> Result<(), String> {
    fs::write(path, bytes).map_err(|error| format!("임시 파일 저장 실패: {error}"))
}

#[tauri::command]
pub fn resolve_remote_hwp_url(url: String) -> Result<RemoteHwpOpenResult, String> {
    ensure_http_url(&url)?;
    let client = build_client()?;
    let probe = probe_remote_hwp(&client, &url)?;

    let response = client
        .get(&probe.final_url)
        .send()
        .map_err(|error| format!("파일 다운로드 실패: {error}"))?;

    let status = response.status();
    if !status.is_success() {
        return Err(format!("파일 다운로드 실패: HTTP {}", status.as_u16()));
    }

    let mut bytes = response
        .bytes()
        .map_err(|error| format!("다운로드 데이터 읽기 실패: {error}"))?
        .to_vec();

    if bytes.is_empty() {
        return Err("다운로드된 파일이 비어 있습니다.".to_string());
    }

    let file_name = sanitize_file_name(&probe.file_name);
    let temp_path = temp_download_path(&file_name)?;
    if let Err(error) = write_downloaded_bytes(&temp_path, &bytes) {
        let _ = fs::remove_file(&temp_path);
        return Err(error);
    }

    Ok(RemoteHwpOpenResult {
        file_name,
        final_url: probe.final_url,
        temp_path: temp_path.to_string_lossy().to_string(),
        bytes: std::mem::take(&mut bytes),
        content_type: probe.content_type,
        content_disposition: probe.content_disposition,
        detection_method: probe.detection_method,
    })
}
