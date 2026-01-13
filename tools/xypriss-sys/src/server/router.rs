use matchit::Router as MatchRouter;
use serde::{Deserialize, Serialize};
use std::sync::Arc;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RouteTarget {
    StaticFile { path: String },
    JsWorker,
    Redirect { destination: String, code: u16 },
    Internal { action: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RouteInfo {
    pub method: String,
    pub path: String,
    pub target: RouteTarget,
    pub middlewares: Vec<String>,
}

pub struct XyRouter {
    // Dynamic routers per method
    get: MatchRouter<Arc<RouteInfo>>,
    post: MatchRouter<Arc<RouteInfo>>,
    put: MatchRouter<Arc<RouteInfo>>,
    delete: MatchRouter<Arc<RouteInfo>>,
    patch: MatchRouter<Arc<RouteInfo>>,
}

impl Default for XyRouter {
    fn default() -> Self {
        Self::new()
    }
}

impl XyRouter {
    pub fn new() -> Self {
        Self {
            get: MatchRouter::new(),
            post: MatchRouter::new(),
            put: MatchRouter::new(),
            delete: MatchRouter::new(),
            patch: MatchRouter::new(),
        }
    }

    pub fn add_route(&mut self, info: RouteInfo) -> anyhow::Result<()> {
        let arc_info = Arc::new(info.clone());
        let router = match info.method.to_uppercase().as_str() {
            "GET" => &mut self.get,
            "POST" => &mut self.post,
            "PUT" => &mut self.put,
            "DELETE" => &mut self.delete,
            "PATCH" => &mut self.patch,
            _ => anyhow::bail!("Unsupported method: {}", info.method),
        };

        router.insert(info.path, arc_info).map_err(|e| anyhow::anyhow!("Router insert error: {}", e))?;
        Ok(())
    }

    pub fn match_route(&self, method: &str, path: &str) -> Option<(Arc<RouteInfo>, std::collections::HashMap<String, String>)> {
        let router = match method.to_uppercase().as_str() {
            "GET" => &self.get,
            "POST" => &self.post,
            "PUT" => &self.put,
            "DELETE" => &self.delete,
            "PATCH" => &self.patch,
            _ => return None,
        };

        match router.at(path) {
            Ok(m) => {
                let mut params = std::collections::HashMap::new();
                for (k, v) in m.params.iter() {
                    params.insert(k.to_string(), v.to_string());
                }
                Some((m.value.clone(), params))
            },
            Err(_) => None,
        }
    }
}
