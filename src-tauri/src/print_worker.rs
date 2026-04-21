use std::io::{BufReader, Read, Write};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::thread;
use std::time::{Duration, Instant};

use crate::print_job::{
    create_debug_print_job_request, write_print_job_manifest, PrintJobRequest, PrintWorkerMessage,
};

fn workspace_root() -> Result<PathBuf, String> {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    manifest_dir
        .parent()
        .map(Path::to_path_buf)
        .ok_or_else(|| "workspace root를 찾을 수 없습니다".to_string())
}

fn print_worker_script_path() -> Result<PathBuf, String> {
    Ok(workspace_root()?.join("scripts").join("print-worker.ts"))
}

fn parse_worker_messages(stdout_output: &str) -> Result<Vec<PrintWorkerMessage>, String> {
    let mut messages = Vec::new();
    for line in stdout_output.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        let message = serde_json::from_str::<PrintWorkerMessage>(trimmed)
            .map_err(|error| format!("print worker stdout parse failed: {error}; raw={trimmed}"))?;
        messages.push(message);
    }

    Ok(messages)
}

pub fn run_print_worker_echo_with_timeout(
    request: &PrintJobRequest,
    timeout: Duration,
) -> Result<Vec<PrintWorkerMessage>, String> {
    run_print_worker_with_timeout(request, timeout, WorkerRequestMode::Stdin)
}

#[derive(Debug, Clone, Copy)]
enum WorkerRequestMode {
    Stdin,
    Manifest,
}

fn run_print_worker_with_timeout(
    request: &PrintJobRequest,
    timeout: Duration,
    mode: WorkerRequestMode,
) -> Result<Vec<PrintWorkerMessage>, String> {
    let script_path = print_worker_script_path()?;
    if !script_path.exists() {
        return Err(format!("print worker script not found: {}", script_path.display()));
    }

    let started_at = Instant::now();
    let mut command = Command::new("node");
    command
        .arg("--experimental-strip-types")
        .arg(script_path)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let manifest_path = match mode {
        WorkerRequestMode::Stdin => {
            command.stdin(Stdio::piped());
            None
        }
        WorkerRequestMode::Manifest => {
            command.stdin(Stdio::null());
            let manifest_path = write_print_job_manifest(request)?;
            command.arg(&manifest_path);
            Some(manifest_path)
        }
    };

    let mut child = command
        .spawn()
        .map_err(|error| format!("print worker spawn failed: {error}"))?;

    if matches!(mode, WorkerRequestMode::Stdin) {
        let payload = serde_json::to_string(request)
            .map_err(|error| format!("print worker request serialize failed: {error}"))?;

        if let Some(mut stdin) = child.stdin.take() {
            stdin
                .write_all(payload.as_bytes())
                .and_then(|_| stdin.write_all(b"\n"))
                .map_err(|error| format!("print worker stdin write failed: {error}"))?;
        }
    }
    let status = loop {
        match child
            .try_wait()
            .map_err(|error| format!("print worker try_wait failed: {error}"))?
        {
            Some(status) => break status,
            None => {
                if started_at.elapsed() >= timeout {
                    child
                        .kill()
                        .map_err(|error| format!("print worker kill failed: {error}"))?;
                    let _ = child.wait();
                    if let Some(path) = &manifest_path {
                        let _ = std::fs::remove_file(path);
                    }
                    return Err(format!(
                        "print worker timed out after {}ms and was terminated",
                        timeout.as_millis()
                    ));
                }
                thread::sleep(Duration::from_millis(10));
            }
        }
    };

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "print worker stdout pipe is missing".to_string())?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| "print worker stderr pipe is missing".to_string())?;

    let mut stdout_output = String::new();
    BufReader::new(stdout)
        .read_to_string(&mut stdout_output)
        .map_err(|error| format!("print worker stdout read failed: {error}"))?;

    let mut stderr_output = String::new();
    BufReader::new(stderr)
        .read_to_string(&mut stderr_output)
        .map_err(|error| format!("print worker stderr read failed: {error}"))?;

    if !status.success() {
        if let Some(path) = &manifest_path {
            let _ = std::fs::remove_file(path);
        }
        return Err(format!(
            "print worker exited with status {:?} after {}ms{}",
            status.code(),
            started_at.elapsed().as_millis(),
            if stderr_output.is_empty() {
                String::new()
            } else {
                format!(": {stderr_output}")
            }
        ));
    }

    let messages = parse_worker_messages(&stdout_output);
    if let Some(path) = &manifest_path {
        let _ = std::fs::remove_file(path);
    }
    messages
}

pub fn run_print_worker_echo(request: &PrintJobRequest) -> Result<Vec<PrintWorkerMessage>, String> {
    run_print_worker_echo_with_timeout(request, Duration::from_secs(5))
}

pub fn run_print_worker_manifest_echo(
    request: &PrintJobRequest,
) -> Result<Vec<PrintWorkerMessage>, String> {
    run_print_worker_with_timeout(request, Duration::from_secs(5), WorkerRequestMode::Manifest)
}

pub fn run_print_worker_runtime_probe() -> Result<Vec<PrintWorkerMessage>, String> {
    let script_path = print_worker_script_path()?;
    if !script_path.exists() {
        return Err(format!("print worker script not found: {}", script_path.display()));
    }

    let started_at = Instant::now();
    let mut child = Command::new("node")
        .arg("--experimental-strip-types")
        .arg(script_path)
        .arg("--probe-browser")
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| format!("print worker probe spawn failed: {error}"))?;

    let status = child
        .wait()
        .map_err(|error| format!("print worker probe wait failed: {error}"))?;

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "print worker probe stdout pipe is missing".to_string())?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| "print worker probe stderr pipe is missing".to_string())?;

    let mut stdout_output = String::new();
    BufReader::new(stdout)
        .read_to_string(&mut stdout_output)
        .map_err(|error| format!("print worker probe stdout read failed: {error}"))?;

    let mut stderr_output = String::new();
    BufReader::new(stderr)
        .read_to_string(&mut stderr_output)
        .map_err(|error| format!("print worker probe stderr read failed: {error}"))?;

    if !status.success() {
        return Err(format!(
            "print worker probe exited with status {:?} after {}ms{}",
            status.code(),
            started_at.elapsed().as_millis(),
            if stderr_output.is_empty() {
                String::new()
            } else {
                format!(": {stderr_output}")
            }
        ));
    }

    parse_worker_messages(&stdout_output)
}

#[tauri::command]
pub fn debug_run_print_worker_echo() -> Result<Vec<PrintWorkerMessage>, String> {
    let request = create_debug_print_job_request("debug-print-worker-echo", 12, None)?;
    run_print_worker_echo(&request)
}

#[tauri::command]
pub fn debug_run_print_worker_timeout_echo() -> Result<Vec<PrintWorkerMessage>, String> {
    let request =
        create_debug_print_job_request("debug-print-worker-timeout-echo", 12, Some(250))?;
    run_print_worker_echo_with_timeout(&request, Duration::from_millis(100))
}

#[tauri::command]
pub fn debug_run_print_worker_manifest_echo() -> Result<Vec<PrintWorkerMessage>, String> {
    let request = create_debug_print_job_request("debug-print-worker-manifest-echo", 12, None)?;
    run_print_worker_manifest_echo(&request)
}

#[tauri::command]
pub fn debug_probe_print_worker_runtime() -> Result<Vec<PrintWorkerMessage>, String> {
    run_print_worker_runtime_probe()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn echo_worker_returns_progress_and_result_messages() {
        let request =
            create_debug_print_job_request("unit-test-job", 10, None).expect("debug request");

        let messages = run_print_worker_echo(&request).expect("echo worker should respond");
        assert!(messages.len() >= 2);
        assert!(matches!(messages.first(), Some(PrintWorkerMessage::Progress { .. })));
        assert!(matches!(messages.last(), Some(PrintWorkerMessage::Result { .. })));
    }

    #[test]
    fn echo_worker_times_out_and_reports_termination() {
        let request = create_debug_print_job_request("unit-test-timeout-job", 10, Some(250))
            .expect("debug timeout request");

        let error = run_print_worker_echo_with_timeout(&request, Duration::from_millis(100))
            .expect_err("echo worker should time out");
        assert!(error.contains("timed out"));
    }

    #[test]
    fn echo_worker_reads_request_from_manifest_file() {
        let request = create_debug_print_job_request("unit-test-manifest-job", 10, None)
            .expect("debug manifest request");

        let messages =
            run_print_worker_manifest_echo(&request).expect("manifest echo worker should respond");
        assert!(messages.len() >= 2);
        assert!(matches!(messages.first(), Some(PrintWorkerMessage::Progress { .. })));
        assert!(matches!(messages.last(), Some(PrintWorkerMessage::Result { .. })));
    }

    #[test]
    fn probe_worker_returns_progress_and_result_messages() {
        let messages = run_print_worker_runtime_probe().expect("probe worker should respond");
        assert!(messages.len() >= 2);
        assert!(matches!(messages.first(), Some(PrintWorkerMessage::Progress { .. })));
        assert!(matches!(messages.last(), Some(PrintWorkerMessage::Result { .. })));
    }
}
