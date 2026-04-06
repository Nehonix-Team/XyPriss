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
	"sync"
	"sync/atomic"
	"time"
)

type CircuitBreaker struct {
	enabled     bool
	threshold   uint32
	timeout     time.Duration
	failures    uint32
	lastFailure time.Time
	mu          sync.Mutex
}

func NewCircuitBreaker(enabled bool, threshold uint32, timeoutSec uint64) *CircuitBreaker {
	return &CircuitBreaker{
		enabled:   enabled,
		threshold: threshold,
		timeout:   time.Duration(timeoutSec) * time.Second,
	}
}

func (cb *CircuitBreaker) Check() bool {
	if !cb.enabled {
		return true
	}

	failures := atomic.LoadUint32(&cb.failures)
	if failures < cb.threshold {
		return true
	}

	cb.mu.Lock()
	defer cb.mu.Unlock()

	if time.Since(cb.lastFailure) > cb.timeout {
		// Half-open logic simplified as in Rust: allow check if timeout passed
		return true
	}

	return false
}

func (cb *CircuitBreaker) RecordSuccess() {
	if !cb.enabled {
		return
	}
	atomic.StoreUint32(&cb.failures, 0)
}

func (cb *CircuitBreaker) RecordFailure() {
	if !cb.enabled {
		return
	}
	prev := atomic.AddUint32(&cb.failures, 1)
	if prev >= cb.threshold {
		cb.mu.Lock()
		cb.lastFailure = time.Now()
		cb.mu.Unlock()
	}
}
