package server

import (
	"os"
	"path/filepath"
)

var XyprissTempDir = filepath.Join(os.TempDir(), "nehonix.xypriss.data")