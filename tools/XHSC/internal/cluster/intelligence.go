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

package cluster

import (
	"log"
	"sync"
	"sync/atomic"
	"time"
)

type OptimizationAction int

const (
	ActionNone OptimizationAction = iota
	ActionForceGC
	ActionReleaseReserveAndGC
)

type IntelligenceManager struct {
	Config                *ClusterConfig
	RescueActive          int32 // atomic bool
	PreAllocatedMemory    []byte
	RescueActivationCount uint64
	LastRescueActivation  time.Time
	GCNotify              chan struct{}
	mu                    sync.RWMutex
}

func NewIntelligenceManager(config *ClusterConfig) *IntelligenceManager {
	im := &IntelligenceManager{
		Config:   config,
		GCNotify: make(chan struct{}, 10),
	}

	if config.IntelligenceEnabled && config.PreAllocate && config.MaxMemory > 0 {
		im.allocateReservedMemory()
	}

	return im
}

func (im *IntelligenceManager) allocateReservedMemory() {
	mbToAllocate := im.Config.MaxMemory / 4
	if mbToAllocate == 0 {
		return
	}

	bytesToAllocate := mbToAllocate * 1024 * 1024
	log.Printf("Pre-allocating %d MB to reserve system resources", mbToAllocate)

	defer func() {
		if r := recover(); r != nil {
			log.Printf("Failed to pre-allocate memory: %v", r)
		}
	}()

	buffer := make([]byte, bytesToAllocate)
	// Force physical allocation by touching pages
	for i := 0; i < len(buffer); i += 4096 {
		buffer[i] = 0xFF
	}
	im.PreAllocatedMemory = buffer

	// Try to lock memory in RAM if possible
	im.tryMlock(buffer)
}

func (im *IntelligenceManager) IsRescueActive() bool {
	return atomic.LoadInt32(&im.RescueActive) == 1
}

func (im *IntelligenceManager) SetRescueActive(active bool) {
	var val int32
	if active {
		val = 1
	}

	old := atomic.SwapInt32(&im.RescueActive, val)
	if old != val {
		if active {
			atomic.AddUint64(&im.RescueActivationCount, 1)
			im.mu.Lock()
			im.LastRescueActivation = time.Now()
			im.mu.Unlock()
			log.Printf("Rescue Mode ACTIVATED - Workers are down")
		} else {
			log.Printf("Rescue Mode DEACTIVATED - Workers are back online")
		}
	}
}

func (im *IntelligenceManager) OptimizeRuntime(currentMemMB, maxMemMB uint64) OptimizationAction {
	if !im.Config.IntelligenceEnabled || maxMemMB == 0 {
		return ActionNone
	}

	usagePercent := (float64(currentMemMB) / float64(maxMemMB)) * 100.0

	if usagePercent > 90.0 {
		log.Printf("[INTELLIGENCE] Critical memory pressure detected (%.1f%%)", usagePercent)
		im.ReleaseReservedMemory()
		im.SignalGC()
		return ActionReleaseReserveAndGC
	}

	if usagePercent > 75.0 {
		im.SignalGC()
		return ActionForceGC
	}

	return ActionNone
}

func (im *IntelligenceManager) ReleaseReservedMemory() {
	im.mu.Lock()
	defer im.mu.Unlock()

	if im.PreAllocatedMemory != nil {
		mb := len(im.PreAllocatedMemory) / 1024 / 1024
		log.Printf("[INTELLIGENCE] Releasing %d MB of reserved memory due to critical pressure", mb)
		im.PreAllocatedMemory = nil
	}
}

func (im *IntelligenceManager) SignalGC() {
	select {
	case im.GCNotify <- struct{}{}:
	default:
		// Channel full, already signaled
	}
}
