//go:build tools

// Keeps golang.org/x/mobile in go.mod; gomobile bind needs it in the module graph.
package tailnet

import _ "golang.org/x/mobile/bind"
