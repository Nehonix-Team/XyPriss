use matchit::Router as MatchRouter;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use parking_lot::RwLock;
use tracing::{debug, info};

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
    // Dynamic routers per method with RwLock for concurrent reads
    get: Arc<RwLock<MatchRouter<Arc<RouteInfo>>>>,
    head: Arc<RwLock<MatchRouter<Arc<RouteInfo>>>>,
    post: Arc<RwLock<MatchRouter<Arc<RouteInfo>>>>,
    put: Arc<RwLock<MatchRouter<Arc<RouteInfo>>>>,
    patch: Arc<RwLock<MatchRouter<Arc<RouteInfo>>>>,
    delete: Arc<RwLock<MatchRouter<Arc<RouteInfo>>>>,
    options: Arc<RwLock<MatchRouter<Arc<RouteInfo>>>>,
    connect: Arc<RwLock<MatchRouter<Arc<RouteInfo>>>>,
    trace: Arc<RwLock<MatchRouter<Arc<RouteInfo>>>>,
    
    // Statistics
    stats: Arc<RouterStats>,
    
    // Tracking list for all routes (to support listing and removal)
    routes_list: Arc<RwLock<Vec<Arc<RouteInfo>>>>,
}

#[derive(Default)]
struct RouterStats {
    total_lookups: std::sync::atomic::AtomicU64,
    failed_lookups: std::sync::atomic::AtomicU64,
}

impl RouterStats {
    fn record_lookup(&self) {
        self.total_lookups.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    }

    fn record_failed(&self) {
        self.failed_lookups.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    }
}

impl Default for XyRouter {
    fn default() -> Self {
        Self::new()
    }
}

impl XyRouter {
    pub fn new() -> Self {
        info!("Initializing XyRouter (High-Performance Mode)");
        Self {
            get: Arc::new(RwLock::new(MatchRouter::new())),
            head: Arc::new(RwLock::new(MatchRouter::new())),
            post: Arc::new(RwLock::new(MatchRouter::new())),
            put: Arc::new(RwLock::new(MatchRouter::new())),
            patch: Arc::new(RwLock::new(MatchRouter::new())),
            delete: Arc::new(RwLock::new(MatchRouter::new())),
            options: Arc::new(RwLock::new(MatchRouter::new())),
            connect: Arc::new(RwLock::new(MatchRouter::new())),
            trace: Arc::new(RwLock::new(MatchRouter::new())),
            stats: Arc::new(RouterStats::default()),
            routes_list: Arc::new(RwLock::new(Vec::new())),
        }
    }

    pub fn add_route(&self, info: RouteInfo) -> anyhow::Result<()> {
        let arc_info = Arc::new(info.clone());
        let method = info.method.to_uppercase();
        
        debug!("Adding route: {} {} -> {:?}", method, info.path, info.target);

        // Add to tracking list
        {
            let mut list = self.routes_list.write();
            // Remove existing route if any (simple path match)
            list.retain(|r| !(r.method == method && r.path == info.path));
            list.push(arc_info.clone());
        }

        let router = self.get_router_for_method(&method)?;
        let mut router_lock = router.write();
        router_lock.insert(&info.path, arc_info)
            .map_err(|e| anyhow::anyhow!("Router insert error for {} {}: {}", method, info.path, e))?;

        info!("✓ Route added: {} {}", method, info.path);
        Ok(())
    }

    fn get_router_for_method(&self, method: &str) -> anyhow::Result<&Arc<RwLock<MatchRouter<Arc<RouteInfo>>>>> {
        match method {
            "GET" => Ok(&self.get),
            "HEAD" => Ok(&self.head),
            "POST" => Ok(&self.post),
            "PUT" => Ok(&self.put),
            "PATCH" => Ok(&self.patch),
            "DELETE" => Ok(&self.delete),
            "OPTIONS" => Ok(&self.options),
            "CONNECT" => Ok(&self.connect),
            "TRACE" => Ok(&self.trace),
            _ => anyhow::bail!("Unsupported HTTP method: {}", method),
        }
    }

    pub fn add_routes(&self, routes: Vec<RouteInfo>) -> Vec<anyhow::Result<()>> {
        info!("Batch adding {} routes", routes.len());
        let results: Vec<_> = routes.into_iter()
            .map(|route| self.add_route(route))
            .collect();
        
        let success_count = results.iter().filter(|r| r.is_ok()).count();
        info!("Successfully added {}/{} routes", success_count, results.len());
        
        results
    }

    pub fn match_route(&self, method: &str, path: &str) -> Option<(Arc<RouteInfo>, std::collections::HashMap<String, String>)> {
        self.stats.record_lookup();
        
        let method_upper = method.to_uppercase();
        
        // Optimize: Direct Radix Tree lookup.
        // Radix trees are extremely fast (ns scale). 
        // Avoiding the LRU cache avoids the Write Lock required to update LRU positions,
        // allowing this method to be fully concurrent (Read Locks only).
        
        let router = match self.get_router_for_method(&method_upper) {
            Ok(r) => r,
            Err(_) => {
                self.stats.record_failed();
                // warn!("Unsupported method: {}", method); // Removed log spam for perf
                return None;
            }
        };

        // Acquire READ lock - Allows multiple readers simultaneously
        let router_lock = router.read();
        
        match router_lock.at(path) {
            Ok(matched) => {
                let mut params = std::collections::HashMap::new();
                for (k, v) in matched.params.iter() {
                    params.insert(k.to_string(), v.to_string());
                }
                
                // No cloning of 'info' here beyond the Arc bump, which is atomic but cheap.
                // We return a new HashMap for params.
                
                Some((matched.value.clone(), params))
            },
            Err(_) => {
                self.stats.record_failed();
                None
            },
        }
    }

    pub fn remove_route(&self, method: &str, path: &str) -> anyhow::Result<()> {
        let method_upper = method.to_uppercase();
        
        // 1. Remove from tracking list
        {
            let mut list = self.routes_list.write();
            list.retain(|r| !(r.method == method_upper && r.path == path));
        }

        // 2. Clear method router and rebuild it
        // matchit doesn't have a remove method, so we MUST rebuild
        let router = self.get_router_for_method(&method_upper)?;
        let mut router_lock = router.write();
        *router_lock = MatchRouter::new();
        
        // 3. Re-insert all routes for this method from the list
        {
            let list = self.routes_list.read();
            for route_info in list.iter() {
                if route_info.method == method_upper {
                    router_lock.insert(&route_info.path, route_info.clone())
                        .map_err(|e| anyhow::anyhow!("Router rebuild error: {}", e))?;
                }
            }
        }
        
        info!("Route removed: {} {}", method_upper, path);
        Ok(())
    }

    pub fn clear_cache(&self) {
        // No-op in lock-free mode
    }

    pub fn get_stats(&self) -> RouterStatsSnapshot {
        RouterStatsSnapshot {
            total_lookups: self.stats.total_lookups.load(std::sync::atomic::Ordering::Relaxed),
            failed_lookups: self.stats.failed_lookups.load(std::sync::atomic::Ordering::Relaxed),
        }
    }

    pub fn list_routes(&self) -> Vec<RouteInfo> {
        let list = self.routes_list.read();
        list.iter().map(|arc| (**arc).clone()).collect()
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct RouterStatsSnapshot {
    pub total_lookups: u64,
    pub failed_lookups: u64,
}

impl Drop for XyRouter {
    fn drop(&mut self) {
        let stats = self.get_stats();
        info!(
            "XyRouter shutdown. Stats: {} lookups, {} failed",
            stats.total_lookups, stats.failed_lookups
        );
    }
}