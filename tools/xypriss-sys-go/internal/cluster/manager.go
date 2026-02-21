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
	"runtime"
	"sync"
	"time"

	"github.com/shirou/gopsutil/v3/process"
)

type ClusterManager struct {
	Config       *ClusterConfig
	Workers      []*Worker
	Intelligence *IntelligenceManager
	mu           sync.RWMutex
}

func NewClusterManager(config *ClusterConfig) *ClusterManager {
	count := config.Workers
	if count == 0 {
		count = runtime.NumCPU()
	}

	workers := make([]*Worker, count)
	for i := 0; i < count; i++ {
		workers[i] = NewWorker(i)
	}

	var intel *IntelligenceManager
	if config.IntelligenceEnabled {
		intel = NewIntelligenceManager(config)
	}

	return &ClusterManager{
		Config:       config,
		Workers:      workers,
		Intelligence: intel,
	}
}

func (m *ClusterManager) Start() error {
	m.mu.Lock()
	defer m.mu.Unlock()

	for _, w := range m.Workers {
		if err := w.Spawn(m.Config); err != nil {
			log.Printf("Failed to spawn worker %d: %v", w.ID, err)
		}
	}

	// Monitoring loop
	go m.monitorLoop()

	return nil
}

func (m *ClusterManager) monitorLoop() {
	interval := time.Duration(m.Config.MemoryCheckInterval) * time.Millisecond
	if interval == 0 {
		interval = 5 * time.Second
	}

	for {
		time.Sleep(interval)

		m.mu.Lock()
		maxMemBytes := uint64(m.Config.MaxMemory) * 1024 * 1024
		var currentTotalMem uint64
		aliveCount := 0

		for _, w := range m.Workers {
			// 1. Check if alive
			if !w.IsAlive() {
				log.Printf("Worker %d died", w.ID)
				if m.Config.Respawn {
					w.Restarts++
					log.Printf("Respawning worker %d (Attempt %d)", w.ID, w.Restarts)
					_ = w.Spawn(m.Config)
				}
				continue
			}
			aliveCount++

			// 2. Resource Enforcement (Memory & CPU)
			p, err := process.NewProcess(int32(w.PID()))
			if err == nil {
				// Memory
				mem, err := p.MemoryInfo()
				if err == nil {
					currentTotalMem += mem.RSS
					if maxMemBytes > 0 && mem.RSS > maxMemBytes {
						if m.Config.EnforceHardLimits {
							log.Printf("Worker %d exceeded memory limit (%d MB > %d MB). Killing.", 
								w.ID, mem.RSS/1024/1024, maxMemBytes/1024/1024)
							_ = w.Process.Kill()
						} else {
							log.Printf("Worker %d is near memory limit (%d MB / %d MB)", 
								w.ID, mem.RSS/1024/1024, maxMemBytes/1024/1024)
						}
					}
				}

				// CPU
				cpuPerc, err := p.CPUPercent()
				if err == nil && m.Config.MaxCPU > 0 && int(cpuPerc) > m.Config.MaxCPU {
					if m.Config.EnforceHardLimits {
						log.Printf("Worker %d exceeded CPU limit (%.1f%% > %d%%). Killing.", 
							w.ID, cpuPerc, m.Config.MaxCPU)
						_ = w.Process.Kill()
					} else {
						log.Printf("Worker %d is near CPU limit (%.1f%% / %d%%)", 
							w.ID, cpuPerc, m.Config.MaxCPU)
					}
				}
			}
		}

		// 3. Intelligence Logic
		if m.Intelligence != nil {
			if aliveCount == 0 && m.Config.RescueMode {
				m.Intelligence.SetRescueActive(true)
			} else if aliveCount > 0 && m.Intelligence.IsRescueActive() {
				m.Intelligence.SetRescueActive(false)
			}

			totalMaxMemMB := uint64(m.Config.MaxMemory * len(m.Workers))
			m.Intelligence.OptimizeRuntime(currentTotalMem/1024/1024, totalMaxMemMB)
		}

		m.mu.Unlock()
	}
}

func (m *ClusterManager) GetWorkerPIDs() []int {
	m.mu.RLock()
	defer m.mu.RUnlock()

	pids := make([]int, 0, len(m.Workers))
	for _, w := range m.Workers {
		if pid := w.PID(); pid != 0 {
			pids = append(pids, pid)
		}
	}
	return pids
}
