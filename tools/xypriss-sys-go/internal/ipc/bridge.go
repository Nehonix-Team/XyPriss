/* *****************************************************************************
 * Nehonix XyPriss System CLI
 *
 * ACCESS RESTRICTIONS:
 * - This software is exclusively for use by Authorized Personnel of NEHONIX
 * - Intended for Internal Use only within NEHONIX operations
 * - No rights granted to unauthorized individuals or entities
 * - All modifications are works made for hire assigned to NEHONIX
 *
 * PROHIBITED ACTIVITIES:
 * - Copying, distributing, or sublicensing without written permission
 * - Reverse engineering, decompiling, or disassembling
 * - Creating derivative works without explicit authorization
 * - External use or commercial distribution outside NEHONIX
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 * For questions or permissions, contact:
 * NEHONIX Legal Department
 * Email: legal@nehonix.com
 * Website: www.nehonix.com
 ***************************************************************************** */

package ipc

import (
	"encoding/binary"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net"
	"os"
	"sync"
	"sync/atomic"
	"time"

	"github.com/Nehonix-Team/XyPriss/tools/xypriss-sys-go/internal/cluster"
	"github.com/Nehonix-Team/XyPriss/tools/xypriss-sys-go/internal/router"
)

const MaxMessageSize = 100 * 1024 * 1024 // 100MB

type WorkerConnection struct {
	ID                string
	Conn              net.Conn
	ActiveRequests    int64
	TotalResponseTime int64
	CompletedRequests int64
	Weight            int
	SendCh            chan IpcMessage
}

type IpcBridge struct {
	SocketPath       string
	Workers          []*WorkerConnection
	WorkersMu        sync.RWMutex
	PendingResponses sync.Map // map[string]chan JsResponse
	NextWorker       uint64
	Stats            struct {
		TotalRequests  uint64
		FailedRequests uint64
	}
	TimeoutSec     uint64
	CircuitBreaker *CircuitBreaker
	RetryMax       int
	RetryDelay     time.Duration
	Strategy       cluster.BalancingStrategy
	Router         *router.XyRouter
}

func NewIpcBridge(socketPath string, timeoutSec uint64) *IpcBridge {
	return &IpcBridge{
		SocketPath:     socketPath,
		TimeoutSec:     timeoutSec,
		CircuitBreaker: NewCircuitBreaker(false, 5, 60),
		Strategy:       cluster.StrategyRoundRobin,
		Router:         router.NewXyRouter(),
	}
}

func (b *IpcBridge) StartServer() error {
	_ = os.Remove(b.SocketPath)

	listener, err := net.Listen("unix", b.SocketPath)
	if err != nil {
		return fmt.Errorf("failed to bind IPC socket: %w", err)
	}

	log.Printf("IPC Server listening on socket: %s", b.SocketPath)

	go func() {
		for {
			conn, err := listener.Accept()
			if err != nil {
				log.Printf("Error accepting connection: %v", err)
				continue
			}
			go b.handleWorkerStream(conn)
		}
	}()

	return nil
}

func (b *IpcBridge) handleWorkerStream(conn net.Conn) {
	sendCh := make(chan IpcMessage, 128) // Increased buffer
	worker := &WorkerConnection{
		Conn:   conn,
		SendCh: sendCh,
		Weight: 1,
	}

	// Writer loop
	go func() {
		encoder := json.NewEncoder(conn)
		for msg := range sendCh {
			if err := b.writeMessageToStream(conn, encoder, msg); err != nil {
				log.Printf("Error writing to worker: %v", err)
				conn.Close()
				break
			}
		}
	}()

	var workerID string
	for {
		// Read message size (4 bytes big-endian)
		var size uint32
		if err := binary.Read(conn, binary.BigEndian, &size); err != nil {
			if err != io.EOF {
				log.Printf("Error reading message size: %v", err)
			}
			break
		}

		if size > MaxMessageSize {
			log.Printf("Message too large: %d", size)
			break
		}

		// Read payload
		payload := make([]byte, size)
		if _, err := io.ReadFull(conn, payload); err != nil {
			log.Printf("Error reading payload: %v", err)
			break
		}

		var msg IpcMessage
		if err := json.Unmarshal(payload, &msg); err != nil {
			log.Printf("Error unmarshaling message: %v", err)
			continue
		}

		switch msg.Type {
		case MsgTypeRegisterWorker:
			var p RegisterWorkerPayload
			if err := json.Unmarshal(msg.Payload, &p); err == nil {
				workerID = p.ID
				worker.ID = workerID
				b.WorkersMu.Lock()
				b.Workers = append(b.Workers, worker)
				b.WorkersMu.Unlock()
				log.Printf("Worker %s registered", workerID)
			}
		case MsgTypeResponse:
			var res JsResponse
			if err := json.Unmarshal(msg.Payload, &res); err == nil {
				if ch, ok := b.PendingResponses.Load(res.ID); ok {
					ch.(chan JsResponse) <- res
				}
			}
		case MsgTypeSyncRoutes:
			var routes []RouteConfig
			if err := json.Unmarshal(msg.Payload, &routes); err == nil {
				log.Printf("Received %d routes from worker %s", len(routes), workerID)
				for _, rc := range routes {
					target := router.RouteTarget{Type: router.TargetJsWorker}
					if rc.Target == "static" && rc.FilePath != nil {
						target = router.RouteTarget{
							Type: router.TargetStaticFile,
							Path: *rc.FilePath,
						}
					}
					b.Router.AddRoute(router.RouteInfo{
						Method: rc.Method,
						Path:   rc.Path,
						Target: target,
					})
				}
			}
		case MsgTypePing:
			sendCh <- IpcMessage{Type: MsgTypePong}
		}
	}

	if workerID != "" {
		b.WorkersMu.Lock()
		newWorkers := make([]*WorkerConnection, 0, len(b.Workers))
		for _, w := range b.Workers {
			if w.ID != workerID {
				newWorkers = append(newWorkers, w)
			}
		}
		b.Workers = newWorkers
		b.WorkersMu.Unlock()
		log.Printf("Worker %s disconnected", workerID)
	}
	close(sendCh)
}

func (b *IpcBridge) writeMessageToStream(conn net.Conn, enc *json.Encoder, msg IpcMessage) error {
	payload, err := json.Marshal(msg)
	if err != nil {
		return err
	}

	size := uint32(len(payload))
	if err := binary.Write(conn, binary.BigEndian, size); err != nil {
		return err
	}

	_, err = conn.Write(payload)
	return err
}

func (b *IpcBridge) Dispatch(req JsRequest) (JsResponse, error) {
	atomic.AddUint64(&b.Stats.TotalRequests, 1)

	if !b.CircuitBreaker.Check() {
		atomic.AddUint64(&b.Stats.FailedRequests, 1)
		return JsResponse{}, fmt.Errorf("circuit breaker open")
	}

	// Load balancing
	worker, err := b.selectWorker()
	if err != nil {
		atomic.AddUint64(&b.Stats.FailedRequests, 1)
		return JsResponse{}, err
	}

	atomic.AddInt64(&worker.ActiveRequests, 1)
	defer atomic.AddInt64(&worker.ActiveRequests, -1)

	respCh := make(chan JsResponse, 1)
	b.PendingResponses.Store(req.ID, respCh)
	defer b.PendingResponses.Delete(req.ID)

	payload, _ := json.Marshal(req)
	select {
	case worker.SendCh <- IpcMessage{
		Type:    MsgTypeRequest,
		Payload: payload,
	}:
	default:
		return JsResponse{}, fmt.Errorf("worker send channel full")
	}

	start := time.Now()
	select {
	case res := <-respCh:
		elapsed := time.Since(start).Milliseconds()
		atomic.AddInt64(&worker.TotalResponseTime, elapsed)
		atomic.AddInt64(&worker.CompletedRequests, 1)
		return res, nil
	case <-time.After(time.Duration(b.TimeoutSec) * time.Second):
		atomic.AddUint64(&b.Stats.FailedRequests, 1)
		return JsResponse{}, fmt.Errorf("request timed out")
	}
}

func (b *IpcBridge) selectWorker() (*WorkerConnection, error) {
	b.WorkersMu.RLock()
	defer b.WorkersMu.RUnlock()

	if len(b.Workers) == 0 {
		return nil, fmt.Errorf("no workers available")
	}

	switch b.Strategy {
	case cluster.StrategyLeastConnections:
		var best *WorkerConnection
		for _, w := range b.Workers {
			if best == nil || atomic.LoadInt64(&w.ActiveRequests) < atomic.LoadInt64(&best.ActiveRequests) {
				best = w
			}
		}
		return best, nil

	case cluster.StrategyRoundRobin:
		idx := atomic.AddUint64(&b.NextWorker, 1) % uint64(len(b.Workers))
		return b.Workers[idx], nil

	default:
		idx := atomic.AddUint64(&b.NextWorker, 1) % uint64(len(b.Workers))
		return b.Workers[idx], nil
	}
}

func (b *IpcBridge) Broadcast(msg IpcMessage) {
	b.WorkersMu.RLock()
	defer b.WorkersMu.RUnlock()

	for _, w := range b.Workers {
		select {
		case w.SendCh <- msg:
		default:
			log.Printf("Worker %s send channel full, skipping broadcast", w.ID)
		}
	}
}

func (b *IpcBridge) GetWorkerCount() int {
	b.WorkersMu.RLock()
	defer b.WorkersMu.RUnlock()
	return len(b.Workers)
}
