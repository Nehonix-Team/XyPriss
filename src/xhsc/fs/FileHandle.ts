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
 ***************************************************************************** */

import { FileStats } from "../types";
import { SynapxClient } from "../synapx/SynapxClient";

/**
 * **High-Performance File Toolbox**
 * Exposed via __sys__.fs.open(path, callback)
 */
export class FileHandle {
    private synapx: SynapxClient;

    constructor(
        private id: number,
        private runner: any,
    ) {
        this.synapx = SynapxClient.getInstance();
    }

    /**
     * **Get Native Handle ID**
     */
    public get nativeId(): number {
        return this.id;
    }

    /**
     * **Read from File**
     * @param length - Max bytes to read
     */
    public async read(length: number): Promise<Buffer> {
        if (this.synapx.isAvailable()) {
            const res = await this.synapx.call<any>("fs", "read-handle", [
                String(this.id),
                String(length),
            ]);
            if (typeof res === "string") {
                return Buffer.from(res, "hex");
            }
            if (Buffer.isBuffer(res)) return res;
            if (res && res.content) {
                return Buffer.from(res.content, "base64");
            }
            return Buffer.from(res || "");
        }

        const res = (await this.runner.runAsync("fs", "read-handle", [
            String(this.id),
            String(length),
        ])) as any;
        return Buffer.from(res?.content || res || "", "hex");
    }

    /**
     * **Write to File**
     * @param data - Buffer or String
     */
    public async write(data: Buffer | string): Promise<number> {
        const raw = typeof data === "string" ? Buffer.from(data) : data;

        if (this.synapx.isAvailable()) {
            const res = await this.synapx.call<any>("fs", "write-handle", [
                String(this.id),
                raw.toString("hex"),
            ]);
            return typeof res === "number" ? res : (res?.n ?? raw.length);
        }

        const res = (await this.runner.runAsync("fs", "write-handle", [
            String(this.id),
            raw.toString("hex"),
        ])) as any;
        return typeof res === "number" ? res : (res?.n ?? raw.length);
    }

    /**
     * **Seek within File**
     * @param offset - Position
     * @param whence - 0: Start, 1: Current, 2: End
     */
    public async seek(offset: number, whence: number = 0): Promise<number> {
        if (this.synapx.isAvailable()) {
            const res = await this.synapx.call<any>("fs", "seek-handle", [
                String(this.id),
                String(offset),
                String(whence),
            ]);
            return typeof res === "number" ? res : (res?.pos ?? 0);
        }

        const res = (await this.runner.runAsync("fs", "seek-handle", [
            String(this.id),
            String(offset),
            String(whence),
        ])) as any;
        return typeof res === "number" ? res : (res?.pos ?? 0);
    }

    /**
     * **Get File Statistics**
     */
    public async stat(): Promise<FileStats> {
        if (this.synapx.isAvailable()) {
            return await this.synapx.call<FileStats>("fs", "stat-handle", [
                String(this.id),
            ]);
        }

        return (await this.runner.runAsync("fs", "stat-handle", [
            String(this.id),
        ])) as FileStats;
    }

    /**
     * **Close Handle**
     */
    public async close(): Promise<void> {
        if (this.synapx.isAvailable()) {
            await this.synapx.call("fs", "close", [String(this.id)]);
        } else {
            await this.runner.runAsync("fs", "close", [String(this.id)]);
        }
    }
}