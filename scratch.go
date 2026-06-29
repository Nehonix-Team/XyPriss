package main

import (
	"bytes"
	"fmt"
	"github.com/bytedance/sonic"
)

func main() {
	m := map[string]interface{}{
		"a": 1,
		"b": 2,
		"c": 3,
		"d": 4,
	}
	b1, _ := sonic.ConfigStd.Marshal(m)
	b2, _ := sonic.ConfigStd.Marshal(m)
	fmt.Printf("b1: %s\n", b1)
	fmt.Printf("b2: %s\n", b2)
	fmt.Printf("Equal: %v\n", bytes.Equal(b1, b2))
}
