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

use crate::server::router::{XyRouter, RouteTarget};
use crate::server::ipc::{IpcBridge, JsRequest};

#[derive(Clone)]
pub struct ServerState {
    pub router: Arc<XyRouter>,
    pub ipc: Option<Arc<IpcBridge>>,
    pub root: std::path::PathBuf,
}

pub fn start_server(host: String, port: u16, ipc_path: Option<String>) -> Result<()> {
    println!("Initializing XHSC (XyPriss Hybrid Server Core)...");
    
    let mut router = XyRouter::new();
    let ipc = ipc_path.map(|p| Arc::new(IpcBridge::new(p)));
    
    let rt = Runtime::new()?;
    rt.block_on(async {
        // 1. Initial configuration sync if IPC is available
        if let Some(ipc_bridge) = &ipc {
            println!("Syncing routes with Node.js...");
            match ipc_bridge.sync_routes().await {
                Ok(routes) => {
                    println!("Synced {} routes from Node.js", routes.len());
                    for route in routes {
                        let target = match route.target.as_str() {
                            "js" => RouteTarget::JsWorker,
                            "static" => RouteTarget::StaticFile { path: route.path.clone() },
                            _ => RouteTarget::JsWorker,
                        };
                        
                        if let Err(e) = router.add_route(crate::server::router::RouteInfo {
                            method: route.method,
                            path: route.path,
                            target,
                            middlewares: vec![],
                        }) {
                            eprintln!("Failed to add route: {}", e);
                        }
                    }
                },
                Err(e) => {
                    eprintln!("Initial route sync failed: {}. Continuing with empty router.", e);
                }
            }
        }

        let state = ServerState {
            router: Arc::new(router),
            ipc,
            root: std::env::current_dir().unwrap(),
        };

        let app = Router::new()
            .route("/status", get(|| async { "XHSC Online" }))
            .fallback(handle_any_request)
            .with_state(state);

        let addr: SocketAddr = format!("{}:{}", host, port).parse().unwrap();
        println!("XHSC listening on http://{}", addr);

        let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
        axum::serve(listener, app).await.unwrap();
    });

    Ok(())
}

async fn handle_any_request(
    State(state): State<ServerState>,
    req: Request,
) -> impl IntoResponse {
    let method = req.method().to_string();
    let path = req.uri().path().to_string();
    let query_str = req.uri().query().unwrap_or("").to_string();
    
    let headers_map: std::collections::HashMap<String, String> = req.headers()
        .iter()
        .map(|(k, v)| (k.to_string(), v.to_str().unwrap_or("").to_string()))
        .collect();

    let query: std::collections::HashMap<String, String> = serde_urlencoded::from_str(&query_str).unwrap_or_default();

    // 1. Try to match route
    if let Some((info, params)) = state.router.match_route(&method, &path) {
        match &info.target {
            RouteTarget::JsWorker => {
                if let Some(ipc) = &state.ipc {
                    // Read the body
                    let body_bytes = axum::body::to_bytes(req.into_body(), 10 * 1024 * 1024) // 10MB limit
                        .await
                        .ok()
                        .map(|b| b.to_vec());

                    // Prepare JS request
                    let js_req = JsRequest {
                        id: uuid::Uuid::new_v4().to_string(),
                        method,
                        url: path,
                        headers: headers_map,
                        query,
                        params,
                        body: body_bytes,
                    };

                    match ipc.dispatch(js_req).await {
                        Ok(res) => {
                            let mut builder = Response::builder().status(res.status);
                            for (k, v) in res.headers {
                                builder = builder.header(k, v);
                            }
                            builder.body(Body::from(res.body.unwrap_or_default())).unwrap()
                        },
                        Err(e) => {
                            (StatusCode::INTERNAL_SERVER_ERROR, format!("IPC Error: {}", e)).into_response()
                        }
                    }
                } else {
                    (StatusCode::SERVICE_UNAVAILABLE, "IPC Bridge not configured").into_response()
                }
            },
            RouteTarget::StaticFile { path: file_path } => {
                // TODO: Solid static file serving with caching
                (StatusCode::NOT_IMPLEMENTED, format!("Static file serving for {} not implemented yet", file_path)).into_response()
            },
            _ => (StatusCode::NOT_IMPLEMENTED, "Target not implemented").into_response()
        }
    } else {
        (StatusCode::NOT_FOUND, "XHSC: Route Not Found").into_response()
    }
}
