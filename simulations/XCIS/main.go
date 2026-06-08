package main
import (
	"fmt"
	"strings"
)
func main() {
	cond := "\"\"\"\" != \"\""
	parts := strings.SplitN(cond, "!=", 2)
	p0 := strings.Trim(parts[0], "\"' ")
	p1 := strings.Trim(parts[1], "\"' ")
	fmt.Printf("p0: '%s', p1: '%s', p0!=p1: %v\n", p0, p1, p0 != p1)
}
