package main

import (
	"fmt"
	"regexp"
)

func main() {
	re := regexp.MustCompile(`(?i)[;&|` + "`" + `]\s*(ls|cat|wget|curl|nc|netcat|bash|sh|cmd|powershell|eval|exec)`)
	fmt.Println(re.MatchString(";ls"))
}
