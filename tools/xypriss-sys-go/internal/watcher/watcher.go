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

package watcher

import (
	"log"

	"github.com/fsnotify/fsnotify"
)

type EventType string

const (
	EventCreated  EventType = "Created"
	EventModified EventType = "Modified"
	EventDeleted  EventType = "Deleted"
	EventRenamed  EventType = "Renamed"
)

type WatchEvent struct {
	Type EventType `json:"type"`
	Path string    `json:"path"`
}

type XyWatcher struct {
	watcher *fsnotify.Watcher
}

func NewXyWatcher() (*XyWatcher, error) {
	w, err := fsnotify.NewWatcher()
	if err != nil {
		return nil, err
	}
	return &XyWatcher{watcher: w}, nil
}

func (w *XyWatcher) Watch(path string, callback func(WatchEvent)) error {
	err := w.watcher.Add(path)
	if err != nil {
		return err
	}

	go func() {
		for {
			select {
			case event, ok := <-w.watcher.Events:
				if !ok {
					return
				}
				var et EventType
				if event.Has(fsnotify.Write) {
					et = EventModified
				} else if event.Has(fsnotify.Create) {
					et = EventCreated
				} else if event.Has(fsnotify.Remove) {
					et = EventDeleted
				} else if event.Has(fsnotify.Rename) {
					et = EventRenamed
				} else {
					continue
				}
				callback(WatchEvent{Type: et, Path: event.Name})
			case err, ok := <-w.watcher.Errors:
				if !ok {
					return
				}
				log.Printf("Watcher error: %v", err)
			}
		}
	}()

	return nil
}

func (w *XyWatcher) Close() error {
	return w.watcher.Close()
}
