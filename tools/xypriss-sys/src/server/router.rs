use matchit::Router as MatchRouter;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use parking_lot::RwLock;
use lru::LruCache;
use std::num::NonZeroUsize;
use tracing::{debug, info, warn};

const ROUTE_CACHE_SIZE: usize = 1000;

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
    
    // LRU cache for route lookups
    cache: Arc<RwLock<LruCache<String, CachedRoute>>>,
    
    // Statistics
    stats: Arc<RouterStats>,
    
    // Tracking list for all routes (to support listing and removal)
    routes_list: Arc<RwLock<Vec<Arc<RouteInfo>>>>,
}

#[derive(Clone)]
struct CachedRoute {
    info: Arc<RouteInfo>,
    params: std::collections::HashMap<String, String>,
}

#[derive(Default)]
struct RouterStats {
    total_lookups: std::sync::atomic::AtomicU64,
    cache_hits: std::sync::atomic::AtomicU64,
    cache_misses: std::sync::atomic::AtomicU64,
    failed_lookups: std::sync::atomic::AtomicU64,
}

impl RouterStats {
    fn record_lookup(&self) {
        self.total_lookups.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    }

    fn record_cache_hit(&self) {
        self.cache_hits.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    }

    fn record_cache_miss(&self) {
        self.cache_misses.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    }

    fn record_failed(&self) {
        self.failed_lookups.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    }

    fn get_hit_rate(&self) -> f64 {
        let hits = self.cache_hits.load(std::sync::atomic::Ordering::Relaxed);
        let total = self.total_lookups.load(std::sync::atomic::Ordering::Relaxed);
        if total > 0 {
            (hits as f64 / total as f64) * 100.0
        } else {
            0.0
        }
    }
}

impl Default for XyRouter {
    fn default() -> Self {
        Self::new()
    }
}

impl XyRouter {
    pub fn new() -> Self {
        info!("Initializing XyRouter with route caching");
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
            cache: Arc::new(RwLock::new(
                LruCache::new(NonZeroUsize::new(ROUTE_CACHE_SIZE).unwrap())
            )),
            stats: Arc::new(RouterStats::default()),
            routes_list: Arc::new(RwLock::new(Vec::new())),
        }
    }

    pub fn add_route(&mut self, info: RouteInfo) -> anyhow::Result<()> {
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

        // Invalidate cache for this route pattern
        self.invalidate_cache_for_pattern(&method, &info.path);

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

    pub fn add_routes(&mut self, routes: Vec<RouteInfo>) -> Vec<anyhow::Result<()>> {
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
        
        let cache_key = format!("{}:{}", method, path);
        
        // Check cache first
        {
            let mut cache = self.cache.write();
            if let Some(cached) = cache.get(&cache_key) {
                self.stats.record_cache_hit();
                debug!("Cache HIT for {} {}", method, path);
                return Some((cached.info.clone(), cached.params.clone()));
            }
        }

        self.stats.record_cache_miss();
        debug!("Cache MISS for {} {}", method, path);

        let method_upper = method.to_uppercase();
        let router = match self.get_router_for_method(&method_upper) {
            Ok(r) => r,
            Err(_) => {
                self.stats.record_failed();
                warn!("Unsupported method: {}", method);
                return None;
            }
        };

        let router_lock = router.read();
        match router_lock.at(path) {
            Ok(matched) => {
                let mut params = std::collections::HashMap::new();
                for (k, v) in matched.params.iter() {
                    params.insert(k.to_string(), v.to_string());
                }
                
                let info = matched.value.clone();
                debug!("✓ Matched: {} {} (params: {:?})", method, path, params);

                // Store in cache
                let cached = CachedRoute {
                    info: info.clone(),
                    params: params.clone(),
                };
                
                {
                    let mut cache = self.cache.write();
                    cache.put(cache_key, cached);
                }

                Some((info, params))
            },
            Err(e) => {
                self.stats.record_failed();
                debug!("✗ No match for {} {}: {:?}", method, path, e);
                None
            },
        }
    }

    fn invalidate_cache_for_pattern(&self, method: &str, pattern: &str) {
        let mut cache = self.cache.write();
        let prefix = format!("{}:", method);
        
        // For exact patterns, just remove the key
        // For patterns with params (e.g., /users/:id), we need to clear broader cache
        if pattern.contains(':') || pattern.contains('*') {
            // Clear entire cache for this method as pattern matching is complex
            let keys_to_remove: Vec<_> = cache.iter()
                .filter(|(k, _)| k.starts_with(&prefix))
                .map(|(k, _)| k.clone())
                .collect();
            
            for key in keys_to_remove {
                cache.pop(&key);
            }
            debug!("Invalidated cache for pattern: {} {}", method, pattern);
        } else {
            let key = format!("{}:{}", method, pattern);
            cache.pop(&key);
            debug!("Invalidated cache key: {}", key);
        }
    }

    pub fn remove_route(&mut self, method: &str, path: &str) -> anyhow::Result<()> {
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
        
        self.invalidate_cache_for_pattern(&method_upper, path);
        info!("Route removed and router rebuilt: {} {}", method_upper, path);
        
        Ok(())
    }

    pub fn clear_cache(&self) {
        let mut cache = self.cache.write();
        cache.clear();
        info!("Route cache cleared");
    }

    pub fn get_stats(&self) -> RouterStatsSnapshot {
        RouterStatsSnapshot {
            total_lookups: self.stats.total_lookups.load(std::sync::atomic::Ordering::Relaxed),
            cache_hits: self.stats.cache_hits.load(std::sync::atomic::Ordering::Relaxed),
            cache_misses: self.stats.cache_misses.load(std::sync::atomic::Ordering::Relaxed),
            failed_lookups: self.stats.failed_lookups.load(std::sync::atomic::Ordering::Relaxed),
            hit_rate: self.stats.get_hit_rate(),
            cache_size: self.cache.read().len(),
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
    pub cache_hits: u64,
    pub cache_misses: u64,
    pub failed_lookups: u64,
    pub hit_rate: f64,
    pub cache_size: usize,
}

impl Drop for XyRouter {
    fn drop(&mut self) {
        let stats = self.get_stats();
        info!(
            "XyRouter shutdown. Stats: {} lookups, {:.2}% cache hit rate, {} failed",
            stats.total_lookups, stats.hit_rate, stats.failed_lookups
        );
    }
}