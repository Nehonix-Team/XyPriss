package main

import (
	"fmt"
	"net/url"
)

func main() {
	q, _ := url.ParseQuery("cmd=;ls")
	fmt.Printf("%#v\n", q)
}
