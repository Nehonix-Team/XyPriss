use axum::{
    body::Body,
    extract::{Request, State},
    http::{StatusCode, Response},
    routing::get,
    Router,
    response::IntoResponse,
};
use std::net::SocketAddr;
use std::sync::Arc;
use anyhow::Result;
use tokio::runtime::Runtime;
use tower::ServiceBuilder;
use tower_http::{
    trace::TraceLayer,
    timeout::TimeoutLayer,
    compression::CompressionLayer,
    cors::CorsLayer,
};
use std::time::Duration;
use tracing::{info, error, warn};
use metrics::{counter, histogram};

use crate::server::router::{XyRouter, RouteTarget};
use crate::server::ipc::{IpcBridge, JsRequest};

#[derive(Clone)]
pub struct ServerState {
    pub router: Arc<XyRouter>,
    pub ipc: Option<Arc<IpcBridge>>,
    pub root: std::path::PathBuf,
    pub metrics: Arc<MetricsCollector>,
    pub max_body_size: usize,
}

pub struct MetricsCollector {
    requests_total: Arc<std::sync::atomic::AtomicU64>,
    errors_total: Arc<std::sync::atomic::AtomicU64>,
}

impl MetricsCollector {
    pub fn new() -> Self {
        Self {
            requests_total: Arc::new(std::sync::atomic::AtomicU64::new(0)),
            errors_total: Arc::new(std::sync::atomic::AtomicU64::new(0)),
        }
    }

    pub fn increment_requests(&self) {
        self.requests_total.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        // counter!("xhsc.requests.total", 1);
    }

    pub fn increment_errors(&self) {
        self.errors_total.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        // counter!("xhsc.errors.total", 1);
    }


    pub fn get_requests(&self) -> u64 {
        self.requests_total.load(std::sync::atomic::Ordering::Relaxed)
    }

    pub fn get_errors(&self) -> u64 {
        self.errors_total.load(std::sync::atomic::Ordering::Relaxed)
    }
}

pub fn start_server(host: String, port: u16, ipc_path: Option<String>, timeout_sec: u64, max_body_size: usize) -> Result<()> {
    // Initialize tracing subscriber
    tracing_subscriber::fmt()
        .with_max_level(tracing::Level::INFO)
        .with_target(false)
        .with_thread_ids(true)
        .with_line_number(true)
        .init();

    info!("Initializing XHSC (XyPriss Hybrid Server Core) - Enterprise Edition");
    
    let mut router = XyRouter::new();
    let ipc = ipc_path.map(|p| Arc::new(IpcBridge::new(p)));
    let metrics = Arc::new(MetricsCollector::new());
    
    let rt = Runtime::new()?;
    rt.block_on(async {
        // Initial configuration sync if IPC is available
        if let Some(ipc_bridge) = &ipc {
            info!("Syncing routes with Node.js via IPC...");
            match tokio::time::timeout(
                Duration::from_secs(10),
                ipc_bridge.sync_routes()
            ).await {
                Ok(Ok(routes)) => {
                    info!("Successfully synced {} routes from Node.js", routes.len());
                    for route in routes {
                        info!("  ✓ {} {} -> {}", route.method, route.path, route.target);
                        let target = match route.target.as_str() {
                            "js" => RouteTarget::JsWorker,
                            "static" => RouteTarget::StaticFile { 
                                path: route.file_path.unwrap_or_else(|| route.path.clone()) 
                            },
                            "redirect" => RouteTarget::Redirect { 
                                destination: "/".to_string(), 
                                code: 302 
                            },
                            _ => RouteTarget::JsWorker,
                        };
                        
                        if let Err(e) = router.add_route(crate::server::router::RouteInfo {
                            method: route.method,
                            path: route.path,
                            target,
                            middlewares: vec![],
                        }) {
                            error!("Failed to add route: {}", e);
                            metrics.increment_errors();
                        }
                    }
                },
                Ok(Err(e)) => {
                    error!("Initial route sync failed: {}. Continuing with empty router.", e);
                    metrics.increment_errors();
                }
                Err(_) => {
                    error!("Route sync timeout after 10 seconds. Continuing with empty router.");
                    metrics.increment_errors();
                }
            }
        }

        let state = ServerState {
            router: Arc::new(router),
            ipc,
            root: std::env::current_dir().unwrap_or_else(|_| std::path::PathBuf::from(".")),
            metrics: metrics.clone(),
            max_body_size,
        };

        // Enterprise-grade middleware stack
        let middleware = ServiceBuilder::new()
            .layer(TraceLayer::new_for_http())
            .layer(CompressionLayer::new())
            .layer(TimeoutLayer::new(Duration::from_secs(timeout_sec)))
            .layer(CorsLayer::permissive());


        let app = Router::new()
            .route("/status", get(status_handler))
            .route("/health", get(health_handler))
            .route("/metrics", get(metrics_handler))
            .fallback(handle_any_request)
            .layer(middleware)
            .with_state(state.clone());

        let addr: SocketAddr = format!("{}:{}", host, port)
            .parse()
            .map_err(|e| anyhow::anyhow!("Invalid address: {}", e))?;
        
        info!("   XHSC Edition listening on http://{}", addr);
        info!("   Status endpoint: http://{}/status", addr);
        info!("   Health endpoint: http://{}/health", addr);
        info!("   Metrics endpoint: http://{}/metrics", addr);

        let listener = tokio::net::TcpListener::bind(addr).await
            .map_err(|e| anyhow::anyhow!("Failed to bind to {}: {}", addr, e))?;
        
        axum::serve(listener, app).await
            .map_err(|e| anyhow::anyhow!("Server error: {}", e))?;

        Ok::<(), anyhow::Error>(())
    })?;

    Ok(())
}

async fn status_handler(State(state): State<ServerState>) -> impl IntoResponse {
    let uptime = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();

    axum::Json(serde_json::json!({
        "status": "online",
        "service": "XHSC Enterprise Edition",
        "version": env!("CARGO_PKG_VERSION"),
        "uptime_seconds": uptime,
        "ipc_enabled": state.ipc.is_some(),
        "requests_total": state.metrics.get_requests(),
        "errors_total": state.metrics.get_errors(),
    }))
}

async fn health_handler(State(state): State<ServerState>) -> impl IntoResponse {
    let healthy = state.metrics.get_errors() < 1000; // Basic health check
    
    if healthy {
        (StatusCode::OK, axum::Json(serde_json::json!({
            "status": "healthy",
            "checks": {
                "ipc": state.ipc.is_some(),
                "router": true,
            }
        })))
    } else {
        (StatusCode::SERVICE_UNAVAILABLE, axum::Json(serde_json::json!({
            "status": "unhealthy",
            "reason": "too many errors"
        })))
    }
}

async fn metrics_handler(State(state): State<ServerState>) -> impl IntoResponse {
    let requests = state.metrics.get_requests();
    let errors = state.metrics.get_errors();
    let error_rate = if requests > 0 {
        (errors as f64 / requests as f64) * 100.0
    } else {
        0.0
    };

    axum::Json(serde_json::json!({
        "requests_total": requests,
        "errors_total": errors,
        "error_rate": error_rate
    }))
}

async fn handle_any_request(
    State(state): State<ServerState>,
    req: Request,
) -> impl IntoResponse {
    let start = std::time::Instant::now();
    state.metrics.increment_requests();

    let method = req.method().to_string();
    let path = req.uri().path().to_string();
    let full_url = req.uri().to_string();
    let query_str = req.uri().query().unwrap_or("").to_string();
    
    info!("→ {} {}", method, path);
    
    let headers_map: std::collections::HashMap<String, String> = req.headers()
        .iter()
        .filter_map(|(k, v)| {
            v.to_str().ok().map(|s| (k.to_string(), s.to_string()))
        })
        .collect();

    let query: std::collections::HashMap<String, String> = 
        serde_urlencoded::from_str(&query_str).unwrap_or_default();

    let response = match state.router.match_route(&method, &path) {
        Some((info, params)) => {
            match &info.target {
                RouteTarget::JsWorker => {
                    handle_js_worker(state.clone(), req, method.clone(), full_url, headers_map, query, params).await
                },
                RouteTarget::StaticFile { path: file_path } => {
                    handle_static_file(req, file_path).await
                },
                RouteTarget::Redirect { destination, code } => {
                    handle_redirect(destination, *code)
                },
                RouteTarget::Internal { action } => {
                    handle_internal_action(action).await
                }
            }
        },
        None => {
            // Fallback to JS Worker for unknown routes (allows Node.js to handle 404s or wildcards)
             if let Some(_) = &state.ipc {
                // Pass empty params
                let params = std::collections::HashMap::new();
                handle_js_worker(state.clone(), req, method.clone(), full_url, headers_map, query, params).await
            } else {
                warn!("✗ Route not found: {} {}", method, path);
                state.metrics.increment_errors();
                (StatusCode::NOT_FOUND, "Route Not Found").into_response()
            }
        }
    };

    let duration = start.elapsed();
    // histogram!("xhsc.request.duration", duration.as_secs_f64());
    info!("← {} {} - {}ms", method, path, duration.as_millis());

    response
}

async fn handle_js_worker(
    state: ServerState,
    req: Request,
    method: String,
    full_url: String,
    headers_map: std::collections::HashMap<String, String>,
    query: std::collections::HashMap<String, String>,
    params: std::collections::HashMap<String, String>,
) -> Response<Body> {
    if let Some(ipc) = &state.ipc {
        match axum::body::to_bytes(req.into_body(), state.max_body_size).await {
            Ok(body_bytes) => {
                let js_req = JsRequest {
                    id: uuid::Uuid::new_v4().to_string(),
                    method,
                    url: full_url,
                    headers: headers_map,
                    query,
                    params,
                    body: if body_bytes.is_empty() { None } else { Some(body_bytes.to_vec()) },
                };

                match tokio::time::timeout(Duration::from_secs(25), ipc.dispatch(js_req)).await {
                    Ok(Ok(res)) => {
                        let mut builder = Response::builder().status(res.status);
                        for (k, v) in res.headers {
                            builder = builder.header(k, v);
                        }
                        builder.body(Body::from(res.body.unwrap_or_default())).unwrap()
                    },
                    Ok(Err(e)) => {
                        error!("IPC dispatch error: {}", e);
                        state.metrics.increment_errors();
                        (StatusCode::INTERNAL_SERVER_ERROR, format!("IPC Error: {}", e)).into_response()
                    },
                    Err(_) => {
                        error!("IPC dispatch timeout");
                        state.metrics.increment_errors();
                        (StatusCode::GATEWAY_TIMEOUT, "Request timeout").into_response()
                    }
                }
            },
            Err(e) => {
                error!("Failed to read request body: {}", e);
                state.metrics.increment_errors();
                (StatusCode::BAD_REQUEST, "Failed to read request body").into_response()
            }
        }
    } else {
        error!("IPC Bridge not configured");
        state.metrics.increment_errors();
        (StatusCode::SERVICE_UNAVAILABLE, "IPC Bridge not configured").into_response()
    }
}

async fn handle_static_file(req: Request, file_path: &str) -> Response<Body> {
    use tower::ServiceExt;
    use tower_http::services::ServeFile;
    
    // Check if file exists to provide better error messages (optional, ServeFile handles 404 generally)
    if !std::path::Path::new(file_path).exists() {
        warn!("Static file not found: {}", file_path);
        return (StatusCode::NOT_FOUND, "File not found").into_response();
    }

    info!("Serving static file: {}", file_path);

    let service = ServeFile::new(file_path);
    match service.oneshot(req).await {
        Ok(response) => response.into_response(),
        Err(err) => {
            error!("Failed to serve static file {}: {}", file_path, err);
            (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to serve file: {}", err)).into_response()
        }
    }
}

fn handle_redirect(destination: &str, code: u16) -> Response<Body> {
    Response::builder()
        .status(code)
        .header("Location", destination)
        .body(Body::empty())
        .unwrap()
}

async fn handle_internal_action(action: &str) -> Response<Body> {
    info!("Internal action: {}", action);
    (StatusCode::OK, format!("Internal action: {}", action)).into_response()
}