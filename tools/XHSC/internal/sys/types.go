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

package sys

type SysInfo struct {
	Hostname        string      `json:"hostname"`
	OSName          string      `json:"os_name"`
	OSVersion       string      `json:"os_version"`
	OSEdition       string      `json:"os_edition"`
	KernelVersion   string      `json:"kernel_version"`
	Architecture    string      `json:"architecture"`
	CPUCount        int         `json:"cpu_count"`
	CPUBrand        string      `json:"cpu_brand"`
	CPUVendor       string      `json:"cpu_vendor"`
	CPUFrequency    uint64      `json:"cpu_frequency"` // MHz
	TotalMemory     uint64      `json:"total_memory"`  // bytes
	UsedMemory      uint64      `json:"used_memory"`
	AvailableMemory uint64      `json:"available_memory"`
	TotalSwap       uint64      `json:"total_swap"`
	UsedSwap        uint64      `json:"used_swap"`
	Uptime          uint64      `json:"uptime"`     // seconds
	BootTime        uint64      `json:"boot_time"`   // unix timestamp
	LoadAverage     LoadAverage `json:"load_average"`
}

type LoadAverage struct {
	One     float64 `json:"one"`
	Five    float64 `json:"five"`
	Fifteen float64 `json:"fifteen"`
}

type CpuInfo struct {
	Index     int     `json:"index"`
	VendorID  string  `json:"vendor_id"`
	ModelName string  `json:"model_name"`
	Mhz       float64 `json:"mhz"`
	Usage     float64 `json:"usage"` // percentage
}

type MemoryInfo struct {
	Total         uint64  `json:"total"`
	Available     uint64  `json:"available"`
	Used          uint64  `json:"used"`
	Free          uint64  `json:"free"`
	UsagePercent  float64 `json:"usage_percent"`
	SwapTotal     uint64  `json:"swap_total"`
	SwapUsed      uint64  `json:"swap_used"`
	SwapFree      uint64  `json:"swap_free"`
	SwapPercent   float64 `json:"swap_percent"`
}

type DiskInfo struct {
	Name           string  `json:"name"`
	MountPoint     string  `json:"mount_point"`
	FileSystem     string  `json:"file_system"`
	TotalSpace     uint64  `json:"total_space"`
	AvailableSpace uint64  `json:"available_space"`
	UsedSpace      uint64  `json:"used_space"`
	UsagePercent   float64 `json:"usage_percent"`
	IsRemovable    bool    `json:"is_removable"`
	DiskType       string  `json:"disk_type"`
}

type NetworkInterface struct {
	Name               string   `json:"name"`
	Received           uint64   `json:"received"`
	Transmitted        uint64   `json:"transmitted"`
	PacketsReceived    uint64   `json:"packets_received"`
	PacketsTransmitted uint64   `json:"packets_transmitted"`
	ErrorsReceived     uint64   `json:"errors_received"`
	ErrorsTransmitted  uint64   `json:"errors_transmitted"`
	MacAddress         string   `json:"mac_address"`
	IPAddresses        []string `json:"ip_addresses"`
}

type ProcessInfo struct {
	Pid           uint32   `json:"pid"`
	Name          string   `json:"name"`
	Exe           string   `json:"exe"`
	Cmd           []string `json:"cmd"`
	CpuUsage      float32  `json:"cpu_usage"`
	Memory        uint64   `json:"memory"`
	VirtualMemory uint64   `json:"virtual_memory"`
	Status        string   `json:"status"`
	StartTime     uint64   `json:"start_time"`
	RunTime       uint64   `json:"run_time"`
	ParentPid     uint32   `json:"parent_pid"`
	UserID        string   `json:"user_id"`
}

type SystemSnapshot struct {
	Timestamp    uint64  `json:"timestamp"`
	CpuUsage     float64 `json:"cpu_usage"`
	MemoryUsed   uint64  `json:"memory_used"`
	MemoryTotal  uint64  `json:"memory_total"`
	ProcessCount int     `json:"process_count"`
}

type ProcessSnapshot struct {
	Timestamp uint64  `json:"timestamp"`
	CpuUsage  float64 `json:"cpu_usage"`
	Memory    uint64  `json:"memory"`
	DiskRead  uint64  `json:"disk_read"`
	DiskWrite uint64  `json:"disk_write"`
}

type BatteryInfo struct {
	State            string  `json:"state"`
	Percentage       float64 `json:"percentage"`
	TimeToFull       int64   `json:"time_to_full,omitempty"`
	TimeToEmpty      int64   `json:"time_to_empty,omitempty"`
	PowerConsumption float64 `json:"power_consumption"`
	IsPresent        bool    `json:"is_present"`
	Technology       string  `json:"technology"`
	Vendor           string  `json:"vendor"`
	Model            string  `json:"model"`
	Serial           string  `json:"serial"`
}

type PortInfo struct {
	Protocol      string `json:"protocol"`
	LocalAddress  string `json:"local_address"`
	LocalPort     uint16 `json:"local_port"`
	RemoteAddress string `json:"remote_address"`
	RemotePort    uint16 `json:"remote_port"`
	State         string `json:"state"`
}

type TemperatureInfo struct {
	Sensor string  `json:"sensor"`
	Value  float64 `json:"value"`
}

type UserInfo struct {
	Username string   `json:"username"`
	Uid      string   `json:"uid"`
	Gid      string   `json:"gid"`
	Home     string   `json:"home"`
	Groups   []string `json:"groups"`
}
