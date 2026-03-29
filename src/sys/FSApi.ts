/* *****************************************************************************
 * Nehonix XyPriss System
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
 * ***************************************************************************** */

import { FSExtended } from "./fs/FSExtended";

/**
 * **Professional Filesystem API (High Performance)**
 *
 * The `FSApi` class provides a unified, high-performance interface for all filesystem operations.
 * It is modularized into several specialized layers while maintaining a single cohesive API.
 *
 * **Modular Structure:**
 * - `FSCore`: Fundamental operations (ls, read, write, move, rm)
 * - `FSHelpers`: Convenience methods (JSON patterns, type checks)
 * - `FSSearch`: Regex-based discovery and grep
 * - `FSArchive`: Compression and TAR handling
 * - `FSWatch`: Real-time monitoring and streaming
 * - `FSExtended`: Advanced security and atomic operations
 *
 * @class FSApi
 * @extends FSExtended
 */
export class FSApi extends FSExtended {}

