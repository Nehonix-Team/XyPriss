use which::which;

pub fn get_best_runtime() -> String {
    if which("bun").is_ok() {
        "bun".to_string()
    } else {
        "node".to_string()
    }
}
