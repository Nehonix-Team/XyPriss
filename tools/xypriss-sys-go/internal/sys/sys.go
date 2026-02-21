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

import (
	"fmt"
	"net"
	"os"
	"os/user"
	"runtime"
	"strconv"
	"strings"
	"time"

	"github.com/distatus/battery"
	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/disk"
	"github.com/shirou/gopsutil/v3/host"
	"github.com/shirou/gopsutil/v3/load"
	"github.com/shirou/gopsutil/v3/mem"
	psnet "github.com/shirou/gopsutil/v3/net"
	"github.com/shirou/gopsutil/v3/process"
)

type XyPrissSys struct{}

func NewXyPrissSys() *XyPrissSys {
	return &XyPrissSys{}
}

func (s *XyPrissSys) GetSystemInfo() (SysInfo, error) {
	hInfo, _ := host.Info()
	vMem, _ := mem.VirtualMemory()
	sMem, _ := mem.SwapMemory()
	lAvg, _ := load.Avg()
	cInfos, _ := cpu.Info()

	var brand string
	if len(cInfos) > 0 {
		brand = cInfos[0].ModelName
	}

	return SysInfo{
		Hostname:        hInfo.Hostname,
		OSName:          hInfo.OS,
		OSVersion:       hInfo.OS,
		OSEdition:       hInfo.Platform,
		KernelVersion:   hInfo.KernelVersion,
		Architecture:    runtime.GOARCH,
		CPUCount:        runtime.NumCPU(),
		CPUBrand:        brand,
		CPUVendor:       "",
		CPUFrequency:    uint64(cInfos[0].Mhz),
		TotalMemory:     vMem.Total,
		UsedMemory:      vMem.Used,
		AvailableMemory: vMem.Available,
		TotalSwap:       sMem.Total,
		UsedSwap:        sMem.Used,
		Uptime:          hInfo.Uptime,
		BootTime:        hInfo.BootTime,
		LoadAverage: LoadAverage{
			One:     lAvg.Load1,
			Five:    lAvg.Load5,
			Fifteen: lAvg.Load15,
		},
	}, nil
}

func (s *XyPrissSys) GetCpuInfo() ([]CpuInfo, error) {
	cInfos, err := cpu.Info()
	if err != nil {
		return nil, err
	}
	usages, _ := cpu.Percent(time.Millisecond*500, true)

	var res []CpuInfo
	for i, info := range cInfos {
		usage := 0.0
		if i < len(usages) {
			usage = usages[i]
		}
		res = append(res, CpuInfo{
			Index:     i,
			VendorID:  info.VendorID,
			ModelName: info.ModelName,
			Mhz:       info.Mhz,
			Usage:     usage,
		})
	}
	return res, nil
}

func (s *XyPrissSys) GetMemoryInfo() (MemoryInfo, error) {
	vMem, err := mem.VirtualMemory()
	if err != nil {
		return MemoryInfo{}, err
	}
	sMem, _ := mem.SwapMemory()

	return MemoryInfo{
		Total:        vMem.Total,
		Available:    vMem.Available,
		Used:         vMem.Used,
		Free:         vMem.Free,
		UsagePercent: vMem.UsedPercent,
		SwapTotal:    sMem.Total,
		SwapUsed:     sMem.Used,
		SwapFree:     sMem.Free,
		SwapPercent:  sMem.UsedPercent,
	}, nil
}

func (s *XyPrissSys) GetDisksInfo() ([]DiskInfo, error) {
	partitions, err := disk.Partitions(true)
	if err != nil {
		return nil, err
	}

	var res []DiskInfo
	for _, p := range partitions {
		usage, err := disk.Usage(p.Mountpoint)
		if err != nil {
			continue
		}
		res = append(res, DiskInfo{
			Name:           p.Device,
			MountPoint:     p.Mountpoint,
			FileSystem:     p.Fstype,
			TotalSpace:     usage.Total,
			AvailableSpace: usage.Free,
			UsedSpace:      usage.Used,
			UsagePercent:   usage.UsedPercent,
		})
	}
	return res, nil
}

func (s *XyPrissSys) GetProcesses() ([]ProcessInfo, error) {
	ps, err := process.Processes()
	if err != nil {
		return nil, err
	}

	var res []ProcessInfo
	for _, p := range ps {
		name, _ := p.Name()
		exe, _ := p.Exe()
		cmd, _ := p.CmdlineSlice()
		cpu, _ := p.CPUPercent()
		mem, _ := p.MemoryInfo()
		status, _ := p.Status()
		createTime, _ := p.CreateTime()
		uids, _ := p.Uids()

		uidStr := ""
		if len(uids) > 0 {
			uidStr = fmt.Sprintf("%d", uids[0])
		}

		res = append(res, ProcessInfo{
			Pid:           uint32(p.Pid),
			Name:          name,
			Exe:           exe,
			Cmd:           cmd,
			CpuUsage:      float32(cpu),
			Memory:        mem.RSS,
			VirtualMemory: mem.VMS,
			Status:        status[0],
			StartTime:     uint64(createTime / 1000),
			UserID:        uidStr,
		})
	}
	return res, nil
}

func (s *XyPrissSys) KillProcess(pid uint32) error {
	p, err := process.NewProcess(int32(pid))
	if err != nil {
		return err
	}
	return p.Kill()
}

func (s *XyPrissSys) GetEnvVars() map[string]string {
	res := make(map[string]string)
	for _, e := range os.Environ() {
		pair := strings.SplitN(e, "=", 2)
		if len(pair) == 2 {
			res[pair[0]] = pair[1]
		}
	}
	return res
}

func (s *XyPrissSys) GetCurrentUser() (*UserInfo, error) {
	u, err := user.Current()
	if err != nil {
		return nil, err
	}
	groups, _ := u.GroupIds()
	return &UserInfo{
		Username: u.Username,
		Uid:      u.Uid,
		Gid:      u.Gid,
		Home:     u.HomeDir,
		Groups:   groups,
	}, nil
}

func (s *XyPrissSys) GetNetworkInterfaces() ([]NetworkInterface, error) {
	ifaces, err := net.Interfaces()
	if err != nil {
		return nil, err
	}

	var res []NetworkInterface
	for _, iface := range ifaces {
		addrs, _ := iface.Addrs()
		var ipAddrs []string
		for _, addr := range addrs {
			ipAddrs = append(ipAddrs, addr.String())
		}

		res = append(res, NetworkInterface{
			Name:       iface.Name,
			MacAddress: iface.HardwareAddr.String(),
			IPAddresses: ipAddrs,
		})
	}
	return res, nil
}

func (s *XyPrissSys) GetSystemHealthScore() int {
	// Simple heuristic: 100 - (CPU % + Mem % / 2)
	c, _ := cpu.Percent(time.Millisecond*100, false)
	m, _ := mem.VirtualMemory()
	
	cpuUsage := 0.0
	if len(c) > 0 {
		cpuUsage = c[0]
	}
	
	score := 100 - int((cpuUsage + m.UsedPercent) / 2)
	if score < 0 { score = 0 }
	return score
}

func (s *XyPrissSys) MonitorSystem(duration, interval time.Duration, callback func(SystemSnapshot)) {
	end := time.Now().Add(duration)
	for time.Now().Before(end) {
		vMem, _ := mem.VirtualMemory()
		cpuPercent, _ := cpu.Percent(0, false)
		ps, _ := process.Pids()

		callback(SystemSnapshot{
			Timestamp:    uint64(time.Now().Unix()),
			CpuUsage:     cpuPercent[0],
			MemoryUsed:   vMem.Used,
			MemoryTotal:  vMem.Total,
			ProcessCount: len(ps),
		})
		time.Sleep(interval)
	}
}

func (s *XyPrissSys) MonitorProcess(pid uint32, duration, interval time.Duration, callback func(ProcessSnapshot)) {
	p, err := process.NewProcess(int32(pid))
	if err != nil {
		return
	}

	end := time.Now().Add(duration)
	for time.Now().Before(end) {
		cpu, _ := p.CPUPercent()
		mem, _ := p.MemoryInfo()
		io, _ := p.IOCounters()

		callback(ProcessSnapshot{
			Timestamp: uint64(time.Now().Unix()),
			CpuUsage:  cpu,
			Memory:    mem.RSS,
			DiskRead:  io.ReadBytes,
			DiskWrite: io.WriteBytes,
		})
		time.Sleep(interval)
	}
}
func (s *XyPrissSys) GetTempInfo() ([]TemperatureInfo, error) {
	// host.SensorsTemperatures() can be used for Linux
	// For other OS, it might return empty
	sensors, err := host.SensorsTemperatures()
	if err != nil {
		return nil, err
	}

	var res []TemperatureInfo
	for _, sensor := range sensors {
		res = append(res, TemperatureInfo{
			Sensor: sensor.SensorKey,
			Value:  sensor.Temperature,
		})
	}
	return res, nil
}

func (s *XyPrissSys) GetPathDirs() []string {
	pathEnv := os.Getenv("PATH")
	return strings.Split(pathEnv, string(os.PathListSeparator))
}

func (s *XyPrissSys) GetPorts() ([]PortInfo, error) {
	// Using net.Interfaces or netstat-like logic
	// For simplicity, we can use gopsutil net.Connections
	const (
		TCP = "tcp"
		UDP = "udp"
	)
	
	connections, err := psnet.Connections("all")
	if err != nil {
		return nil, err
	}

	var res []PortInfo
	for _, conn := range connections {
		if conn.Status == "LISTEN" {
			proto := TCP
			if conn.Type == 2 { // UDP
				proto = UDP
			}
			res = append(res, PortInfo{
				Protocol:      proto,
				LocalAddress:  conn.Laddr.IP,
				LocalPort:     uint16(conn.Laddr.Port),
				RemoteAddress: conn.Raddr.IP,
				RemotePort:    uint16(conn.Raddr.Port),
				State:         conn.Status,
			})
		}
	}
	return res, nil
}

func (s *XyPrissSys) GetBatteryInfo() (BatteryInfo, error) {
	// Try Linux sysfs first for high precision (matching Rust behavior)
	if runtime.GOOS == "linux" {
		readSys := func(name string) string {
			data, err := os.ReadFile("/sys/class/power_supply/BAT0/" + name)
			if err != nil {
				return ""
			}
			return strings.TrimSpace(string(data))
		}

		if capStr := readSys("capacity"); capStr != "" {
			percentage, _ := strconv.ParseFloat(capStr, 64)
			stateStr := readSys("status")
			
			return BatteryInfo{
				IsPresent:        true,
				State:            stateStr,
				Percentage:       percentage,
				Technology:       readSys("technology"),
				Vendor:           readSys("manufacturer"),
				Model:            readSys("model_name"),
				Serial:           readSys("serial_number"),
				PowerConsumption: 0,
			}, nil
		}
	}

	// Fallback to cross-platform library
	batteries, err := battery.GetAll()
	if err != nil || len(batteries) == 0 {
		return BatteryInfo{IsPresent: false}, nil
	}

	b := batteries[0]
	return BatteryInfo{
		IsPresent:  true,
		State:      b.State.String(),
		Percentage: (b.Current / b.Full) * 100,
	}, nil
}
