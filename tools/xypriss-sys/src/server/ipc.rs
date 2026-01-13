use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use anyhow::{Result, Context};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::UnixStream;
use tokio::sync::Semaphore;
use std::sync::Arc;
use tracing::{debug, error, info, warn};

const MAX_CONNECTIONS: usize = 100;
const CONNECTION_TIMEOUT_SECS: u64 = 5;
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
}

pub struct IpcBridge {
    socket_path: String,
    connection_semaphore: Arc<Semaphore>,
    stats: Arc<IpcStats>,
}

#[derive(Default)]
struct IpcStats {
    total_requests: std::sync::atomic::AtomicU64,
    failed_requests: std::sync::atomic::AtomicU64,
    active_connections: std::sync::atomic::AtomicUsize,
}

impl IpcStats {
    fn increment_requests(&self) {
        self.total_requests.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    }

    fn increment_failures(&self) {
        self.failed_requests.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    }

    fn increment_active(&self) {
        self.active_connections.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    }

    fn decrement_active(&self) {
        self.active_connections.fetch_sub(1, std::sync::atomic::Ordering::Relaxed);
    }

    fn get_active(&self) -> usize {
        self.active_connections.load(std::sync::atomic::Ordering::Relaxed)
    }
}

impl IpcBridge {
    pub fn new(socket_path: String) -> Self {
        info!("Initializing IPC Bridge with socket: {}", socket_path);
        Self {
            socket_path,
            connection_semaphore: Arc::new(Semaphore::new(MAX_CONNECTIONS)),
            stats: Arc::new(IpcStats::default()),
        }
    }

    async fn connect_with_retry(&self, max_retries: u32) -> Result<UnixStream> {
        let mut attempts = 0;
        let mut last_error = None;

        while attempts < max_retries {
            match tokio::time::timeout(
                std::time::Duration::from_secs(CONNECTION_TIMEOUT_SECS),
                UnixStream::connect(&self.socket_path)
            ).await {
                Ok(Ok(stream)) => {
                    debug!("Successfully connected to IPC socket on attempt {}", attempts + 1);
                    return Ok(stream);
                }
                Ok(Err(e)) => {
                    last_error = Some(e);
                    attempts += 1;
                    if attempts < max_retries {
                        warn!("Connection attempt {} failed, retrying...", attempts);
                        tokio::time::sleep(std::time::Duration::from_millis(100 * attempts as u64)).await;
                    }
                }
                Err(_) => {
                    last_error = Some(std::io::Error::new(
                        std::io::ErrorKind::TimedOut,
                        "Connection timeout"
                    ));
                    attempts += 1;
                }
            }
        }

        Err(anyhow::anyhow!(
            "Failed to connect after {} attempts: {}",
            max_retries,
            last_error.unwrap()
        ))
    }

    async fn write_message(&self, stream: &mut UnixStream, message: &IpcMessage) -> Result<()> {
        let payload = serde_json::to_vec(&message)
            .context("Failed to serialize IPC message")?;
        
        if payload.len() > MAX_MESSAGE_SIZE {
            anyhow::bail!("Message size {} exceeds maximum {}", payload.len(), MAX_MESSAGE_SIZE);
        }

        let size = payload.len() as u32;
        stream.write_all(&size.to_be_bytes()).await
            .context("Failed to write message size")?;
        
        stream.write_all(&payload).await
            .context("Failed to write message payload")?;
        
        stream.flush().await
            .context("Failed to flush stream")?;

        debug!("Wrote {} bytes to IPC socket", payload.len());
        Ok(())
    }

    async fn read_message<T: for<'de> Deserialize<'de>>(&self, stream: &mut UnixStream) -> Result<T> {
        let mut size_buf = [0u8; 4];
        stream.read_exact(&mut size_buf).await
            .context("Failed to read message size")?;
        
        let size = u32::from_be_bytes(size_buf) as usize;
        
        if size > MAX_MESSAGE_SIZE {
            anyhow::bail!("Received message size {} exceeds maximum {}", size, MAX_MESSAGE_SIZE);
        }

        let mut payload = vec![0u8; size];
        stream.read_exact(&mut payload).await
            .context("Failed to read message payload")?;

        debug!("Read {} bytes from IPC socket", size);

        serde_json::from_slice(&payload)
            .context("Failed to deserialize IPC message")
    }

    pub async fn dispatch(&self, request: JsRequest) -> Result<JsResponse> {
        self.stats.increment_requests();
        
        // Acquire semaphore permit for connection pooling
        let _permit = self.connection_semaphore.acquire().await
            .context("Failed to acquire connection permit")?;
        
        self.stats.increment_active();
        let _guard = scopeguard::guard((), |_| {
            self.stats.decrement_active();
        });

        debug!("Dispatching request {} to JS worker (active: {})", 
               request.id, self.stats.get_active());

        let mut stream = self.connect_with_retry(3).await
            .context("Failed to establish IPC connection")?;

        self.write_message(&mut stream, &IpcMessage::Request(request)).await?;
        
        let response: JsResponse = self.read_message(&mut stream).await
            .context("Failed to read response from JS worker")?;

        debug!("Received response for request {}", response.id);
        Ok(response)
    }

    pub async fn sync_routes(&self) -> Result<Vec<RouteConfig>> {
        info!("Syncing routes with Node.js via IPC");

        let _permit = self.connection_semaphore.acquire().await
            .context("Failed to acquire connection permit")?;

        let mut stream = self.connect_with_retry(5).await
            .context("Failed to establish IPC connection for route sync")?;

        let handshake = serde_json::json!({
            "type": "SyncRoutesHandshake",
            "payload": {}
        });

        let payload = serde_json::to_vec(&handshake)?;
        let size = payload.len() as u32;
        
        stream.write_all(&size.to_be_bytes()).await?;
        stream.write_all(&payload).await?;
        stream.flush().await?;

        debug!("Sent route sync handshake");

        let routes: Vec<RouteConfig> = self.read_message(&mut stream).await
            .context("Failed to read routes from Node.js")?;

        info!("Successfully synced {} routes", routes.len());
        Ok(routes)
    }

    pub async fn health_check(&self) -> Result<bool> {
        debug!("Performing IPC health check");
        
        let _permit = match tokio::time::timeout(
            std::time::Duration::from_secs(2),
            self.connection_semaphore.acquire()
        ).await {
            Ok(Ok(p)) => p,
            _ => return Ok(false),
        };

        match self.connect_with_retry(1).await {
            Ok(mut stream) => {
                match self.write_message(&mut stream, &IpcMessage::Ping).await {
                    Ok(_) => {
                        debug!("IPC health check: OK");
                        Ok(true)
                    },
                    Err(e) => {
                        warn!("IPC health check failed: {}", e);
                        Ok(false)
                    }
                }
            },
            Err(_) => Ok(false),
        }
    }

    pub fn get_stats(&self) -> (u64, u64, usize) {
        (
            self.stats.total_requests.load(std::sync::atomic::Ordering::Relaxed),
            self.stats.failed_requests.load(std::sync::atomic::Ordering::Relaxed),
            self.stats.get_active(),
        )
    }
}

impl Drop for IpcBridge {
    fn drop(&mut self) {
        info!("IPC Bridge shutting down. Total requests: {}, Failed: {}", 
              self.stats.total_requests.load(std::sync::atomic::Ordering::Relaxed),
              self.stats.failed_requests.load(std::sync::atomic::Ordering::Relaxed));
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