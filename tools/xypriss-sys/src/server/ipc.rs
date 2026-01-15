use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use anyhow::{Result, Context};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{UnixListener, UnixStream};
use tokio::sync::{mpsc, Mutex};
use std::sync::Arc;
use tracing::{debug, info, warn, error};

const MAX_MESSAGE_SIZE: usize = 100 * 1024 * 1024; // 100MB

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JsRequest {
    pub id: String,
    pub method: String,
    pub url: String,
    pub headers: HashMap<String, String>,
    pub query: HashMap<String, String>,
    pub params: HashMap<String, String>,
    pub remote_addr: String,
    pub local_addr: String,
    #[serde(with = "serde_bytes")]
    pub body: Option<Vec<u8>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JsResponse {
    pub id: String,
    pub status: u16,
    pub headers: HashMap<String, String>,
    #[serde(with = "serde_bytes")]
    pub body: Option<Vec<u8>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RouteConfig {
    pub method: String,
    pub path: String,
    pub target: String,
    pub file_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "payload")]
pub enum IpcMessage {
    Request(JsRequest),
    Response(JsResponse),
    SyncRoutes(Vec<RouteConfig>),
    Ping,
    Pong,
    RegisterWorker { id: String },
}

pub struct WorkerConnection {
    pub id: String,
    pub tx: mpsc::Sender<IpcMessage>,
}

pub struct IpcBridge {
    socket_path: String,
    workers: Arc<Mutex<Vec<WorkerConnection>>>,
    pending_responses: Arc<Mutex<HashMap<String, mpsc::Sender<JsResponse>>>>,
    next_worker: std::sync::atomic::AtomicUsize,
    stats: Arc<IpcStats>,
    timeout_sec: u64,
}

#[derive(Default)]
struct IpcStats {
    total_requests: std::sync::atomic::AtomicU64,
    failed_requests: std::sync::atomic::AtomicU64,
}

impl IpcBridge {
    pub fn new(socket_path: String, timeout_sec: u64) -> Self {
        info!("Initializing IPC Server Bridge with socket: {}", socket_path);
        
        // Remove existing socket file if it exists
        let _ = std::fs::remove_file(&socket_path);

        Self {
            socket_path,
            workers: Arc::new(Mutex::new(Vec::new())),
            pending_responses: Arc::new(Mutex::new(HashMap::new())),
            next_worker: std::sync::atomic::AtomicUsize::new(0),
            stats: Arc::new(IpcStats::default()),
            timeout_sec,
        }
    }

    pub async fn start_server(&self) -> Result<()> {
        let listener = UnixListener::bind(&self.socket_path)
            .context("Failed to bind IPC socket")?;
        
        info!("IPC Server listening on {}", self.socket_path);

        let workers = self.workers.clone();
        let pending_responses = self.pending_responses.clone();

        tokio::spawn(async move {
            while let Ok((stream, _)) = listener.accept().await {
                let workers = workers.clone();
                let pending_responses = pending_responses.clone();
                tokio::spawn(async move {
                    if let Err(e) = Self::handle_worker_stream(stream, workers, pending_responses).await {
                        error!("Error handling worker stream: {}", e);
                    }
                });
            }
        });

        Ok(())
    }

    async fn handle_worker_stream(
        mut stream: UnixStream,
        workers: Arc<Mutex<Vec<WorkerConnection>>>,
        pending_responses: Arc<Mutex<HashMap<String, mpsc::Sender<JsResponse>>>>,
    ) -> Result<()> {
        let (mut reader, mut writer) = stream.into_split();
        let (tx, mut rx) = mpsc::channel::<IpcMessage>(32);
        
        let mut worker_id = String::new();

        // Send-to-worker loop
        let writer_handle = tokio::spawn(async move {
            while let Some(msg) = rx.recv().await {
                if let Err(e) = Self::write_message_to_stream(&mut writer, &msg).await {
                    error!("Failed to write to worker: {}", e);
                    break;
                }
            }
        });

        // Read-from-worker loop
        loop {
            match Self::read_message_from_stream::<IpcMessage, _>(&mut reader).await {
                Ok(msg) => match msg {
                    IpcMessage::RegisterWorker { id } => {
                        worker_id = id.clone();
                        let mut ws = workers.lock().await;
                        ws.push(WorkerConnection { id: id.clone(), tx: tx.clone() });
                        info!("Worker {} registered", id);
                    },
                    IpcMessage::Response(res) => {
                        let mut prs = pending_responses.lock().await;
                        if let Some(resp_tx) = prs.remove(&res.id) {
                            let _ = resp_tx.send(res).await;
                        }
                    },
                    IpcMessage::Ping => {
                        let _ = tx.send(IpcMessage::Pong).await;
                    },
                    _ => debug!("Unhandled message from worker"),
                },
                Err(e) => {
                    warn!("Worker connection closed: {}", e);
                    break;
                }
            }
        }

        // Cleanup
        if !worker_id.is_empty() {
            let mut ws = workers.lock().await;
            ws.retain(|w| w.id != worker_id);
            info!("Worker {} disconnected", worker_id);
        }
        writer_handle.abort();
        Ok(())
    }

    async fn write_message_to_stream<W: AsyncWriteExt + Unpin>(
        writer: &mut W,
        message: &IpcMessage,
    ) -> Result<()> {
        let payload = serde_json::to_vec(message)?;
        let size = payload.len() as u32;
        writer.write_all(&size.to_be_bytes()).await?;
        writer.write_all(&payload).await?;
        writer.flush().await?;
        Ok(())
    }

    async fn read_message_from_stream<T: for<'de> Deserialize<'de>, R: AsyncReadExt + Unpin>(
        reader: &mut R,
    ) -> Result<T> {
        let mut size_buf = [0u8; 4];
        reader.read_exact(&mut size_buf).await?;
        let size = u32::from_be_bytes(size_buf) as usize;
        
        if size > MAX_MESSAGE_SIZE {
            anyhow::bail!("Message too large");
        }

        let mut payload = vec![0u8; size];
        reader.read_exact(&mut payload).await?;
        Ok(serde_json::from_slice(&payload)?)
    }

    pub async fn dispatch(&self, request: JsRequest) -> Result<JsResponse> {
        self.stats.total_requests.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        
        let workers = self.workers.lock().await;
        if workers.is_empty() {
            self.stats.failed_requests.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
            anyhow::bail!("No workers available");
        }

        // Round-robin load balancing
        let idx = self.next_worker.fetch_add(1, std::sync::atomic::Ordering::Relaxed) % workers.len();
        let worker_tx = workers[idx].tx.clone();
        drop(workers);

        let (resp_tx, mut resp_rx) = mpsc::channel(1);
        let request_id = request.id.clone();
        
        {
            let mut prs = self.pending_responses.lock().await;
            prs.insert(request_id.clone(), resp_tx);
        }

        if let Err(e) = worker_tx.send(IpcMessage::Request(request)).await {
            let mut prs = self.pending_responses.lock().await;
            prs.remove(&request_id);
            self.stats.failed_requests.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
            anyhow::bail!("Failed to send request to worker: {}", e);
        }

        match tokio::time::timeout(std::time::Duration::from_secs(self.timeout_sec), resp_rx.recv()).await {
            Ok(Some(res)) => Ok(res),
            _ => {
                let mut prs = self.pending_responses.lock().await;
                prs.remove(&request_id);
                self.stats.failed_requests.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
                anyhow::bail!("Request timed out or worker disconnected")
            }
        }
    }

    pub async fn sync_routes(&self) -> Result<Vec<RouteConfig>> {
        // In the new system, we might want to wait for at least one worker to sync?
        // Or perhaps Node.js pushes routes to Rust.
        // For now, let's just return what we have or wait.
        Ok(vec![])
    }

    pub fn get_stats(&self) -> (u64, u64, usize) {
        let workers_count = if let Ok(ws) = self.workers.try_lock() {
            ws.len()
        } else {
            0
        };
        (
            self.stats.total_requests.load(std::sync::atomic::Ordering::Relaxed),
            self.stats.failed_requests.load(std::sync::atomic::Ordering::Relaxed),
            workers_count,
        )
    }
}

// Helper module for serde_bytes compatibility
mod serde_bytes {
    use serde::{Deserialize, Deserializer, Serializer};

    pub fn serialize<S>(bytes: &Option<Vec<u8>>, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        match bytes {
            Some(b) => serializer.serialize_bytes(b),
            None => serializer.serialize_none(),
        }
    }

    pub fn deserialize<'de, D>(deserializer: D) -> Result<Option<Vec<u8>>, D::Error>
    where
        D: Deserializer<'de>,
    {
        Option::<Vec<u8>>::deserialize(deserializer)
    }
}