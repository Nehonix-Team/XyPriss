use matchit::Router;

fn main() {
    let mut router = Router::new();
    router.insert("/api/users/:id", "old").ok();
    router.insert("/api/users/{id}", "new").ok();
    
    let matched_old = router.at("/api/users/42");
    println!("Match old (:id): {:?}", matched_old.is_ok());
    
    let matched_new = router.at("/api/users/42");
    // If I inserted both, matchit might complain or one will win.
    // Let's try one by one.
}
