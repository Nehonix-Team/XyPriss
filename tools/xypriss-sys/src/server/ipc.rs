use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use anyhow::Result;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::UnixStream;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JsRequest {
    pub id: String,
    pub method: String,
    pub url: String,
    pub headers: HashMap<String, String>,
    pub query: HashMap<String, String>,
    pub params: HashMap<String, String>,
    pub body: Option<Vec<u8>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JsResponse {
    pub id: String,
    pub status: u16,
    pub headers: HashMap<String, String>,
    pub body: Option<Vec<u8>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RouteConfig {
    pub method: String,
    pub path: String,
    pub target: String, // "js", "static", etc.
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "payload")]
pub enum IpcMessage {
    Request(JsRequest),
    SyncRoutes(Vec<RouteConfig>),
}

pub struct IpcBridge {
    socket_path: String,
}

impl IpcBridge {
    pub fn new(socket_path: String) -> Self {
        Self { socket_path }
    }

    pub async fn dispatch(&self, request: JsRequest) -> Result<JsResponse> {
        // Connect to the Unix Domain Socket (Node.js must be listening)
        let mut stream = UnixStream::connect(&self.socket_path).await?;
        
        // Serialize request wrapped in IpcMessage
        let message = IpcMessage::Request(request);
        let payload = serde_json::to_vec(&message)?;
        
        // Write size prefix (4 bytes)
        let size = payload.len() as u32;
        stream.write_all(&size.to_be_bytes()).await?;
        
        // Write payload
        stream.write_all(&payload).await?;
        stream.flush().await?;

        // Read response size
        let mut size_buf = [0u8; 4];
        stream.read_exact(&mut size_buf).await?;
        let res_size = u32::from_be_bytes(size_buf) as usize;

        // Read response payload
        let mut res_payload = vec![0u8; res_size];
        stream.read_exact(&mut res_payload).await?;

        // Deserialize response
        let response: JsResponse = serde_json::from_slice(&res_payload)?;
        Ok(response)
    }

    pub async fn sync_routes(&self) -> Result<Vec<RouteConfig>> {
        let mut stream = UnixStream::connect(&self.socket_path).await?;
        
        // Handshake message
        let handshake = serde_json::json!({
            "type": "SyncRoutesHandshake",
            "payload": {}
        });
        
        let payload = serde_json::to_vec(&handshake)?;
        let size = payload.len() as u32;
        stream.write_all(&size.to_be_bytes()).await?;
        stream.write_all(&payload).await?;
        stream.flush().await?;

        // Read response
        let mut size_buf = [0u8; 4];
        stream.read_exact(&mut size_buf).await?;
        let res_size = u32::from_be_bytes(size_buf) as usize;

        let mut res_payload = vec![0u8; res_size];
        stream.read_exact(&mut res_payload).await?;

        let routes: Vec<RouteConfig> = serde_json::from_slice(&res_payload)?;
        Ok(routes)
    }
}
