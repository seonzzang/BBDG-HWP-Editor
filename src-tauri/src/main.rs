#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod print_worker;
mod print_job;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            print_worker::debug_run_print_worker_echo,
            print_worker::debug_run_print_worker_timeout_echo,
            print_worker::debug_run_print_worker_manifest_echo,
            print_worker::debug_probe_print_worker_runtime,
            print_worker::debug_run_print_worker_pdf_export,
            print_worker::debug_run_print_worker_pdf_export_for_current_doc
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
