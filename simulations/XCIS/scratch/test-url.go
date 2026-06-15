package main

import (
	"fmt"
	"net/url"
)

func main() {
	ref, _ := url.Parse("http://localhost:8085/")
	fmt.Printf("ref.Host: '%s', scheme: '%s'\n", ref.Host, ref.Scheme)
}
