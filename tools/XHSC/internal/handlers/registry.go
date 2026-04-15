package handlers

import (
	"fmt"
	"os"
	"sync"
	"sync/atomic"
)

type FileHandleRegistry struct {
	handles map[uint32]*os.File
	nextID  uint32
	mu      sync.RWMutex
}

var (
	globalRegistry *FileHandleRegistry
	once           sync.Once
)

func GetRegistry() *FileHandleRegistry {
	once.Do(func() {
		globalRegistry = &FileHandleRegistry{
			handles: make(map[uint32]*os.File),
			nextID:  1000, // Start high to avoid collisions with OS FDs
		}
	})
	return globalRegistry
}

func (r *FileHandleRegistry) Register(f *os.File) uint32 {
	r.mu.Lock()
	defer r.mu.Unlock()
	id := atomic.AddUint32(&r.nextID, 1)
	r.handles[id] = f
	return id
}

func (r *FileHandleRegistry) Get(id uint32) (*os.File, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	f, ok := r.handles[id]
	return f, ok
}

func (r *FileHandleRegistry) Unregister(id uint32) (*os.File, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	f, ok := r.handles[id]
	if !ok {
		return nil, fmt.Errorf("invalid handle: %d", id)
	}
	delete(r.handles, id)
	return f, nil
}
