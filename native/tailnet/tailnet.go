// Package tailnet embeds one Tesseract Network (tsnet) node in the process.
//
// The API is gomobile-compatible: only package-level functions with string,
// int and error types. See docs/adr/0014-embedded-tailnet-and-tesseract-accounts.md.
package tailnet

import (
	"fmt"
	"log"
	"os"
	"sync"

	"tesseract/native/tailnet/internal/node"
)

var (
	mu           sync.Mutex
	current      *node.Node
	lastStateDir string
	stderrLog    = log.New(os.Stderr, "tailnet: ", log.LstdFlags)
)

func userLogf(format string, args ...any) { stderrLog.Printf(format, args...) }

func verboseLogf() func(string, ...any) {
	if os.Getenv("TESSERACT_TAILNET_VERBOSE") != "" {
		return userLogf
	}
	return nil
}

// Start starts the node, or returns nil when a node with the same stateDir,
// controlURL and hostname is already starting or running. authKey may be ""
// when stateDir already holds a registered node. Start returns once the node
// is started; poll StatusJSON for progress.
func Start(stateDir, controlURL, authKey, hostname string) error {
	mu.Lock()
	defer mu.Unlock()
	if current != nil {
		cfg := current.Config()
		st := current.Status().State
		same := cfg.StateDir == stateDir && cfg.ControlURL == controlURL && cfg.Hostname == hostname
		if same && (st == node.StateRunning || st == node.StateStarting) {
			return nil
		}
		if err := current.Stop(); err != nil {
			userLogf("stop previous node: %v", err)
		}
		current = nil
	}
	n, err := node.Start(node.Config{
		StateDir:   stateDir,
		ControlURL: controlURL,
		AuthKey:    authKey,
		Hostname:   hostname,
		Logf:       verboseLogf(),
		UserLogf:   userLogf,
	})
	if err != nil {
		return err
	}
	current = n
	lastStateDir = stateDir
	return nil
}

// Stop stops the node, closing all forwarders and served ports. It is a
// no-op when no node is running.
func Stop() error {
	mu.Lock()
	defer mu.Unlock()
	if current == nil {
		return nil
	}
	err := current.Stop()
	current = nil
	return err
}

// Logout logs the node out of the control server and wipes its state
// directory. Without a running node it wipes the last used state directory.
func Logout() error {
	mu.Lock()
	defer mu.Unlock()
	if current == nil {
		if lastStateDir == "" {
			return nil
		}
		if err := os.RemoveAll(lastStateDir); err != nil {
			return fmt.Errorf("tailnet: remove state: %w", err)
		}
		return nil
	}
	err := current.Logout()
	current = nil
	return err
}

// StatusJSON returns the node status as a TailnetStatus JSON object
// (packages/protocol/src/schemas/account.ts).
func StatusJSON() string {
	mu.Lock()
	n := current
	mu.Unlock()
	if n == nil {
		return node.StoppedStatus().JSON()
	}
	return n.StatusJSON()
}

// Forward listens on 127.0.0.1 and proxies to host:port over the tailnet.
// host is a MagicDNS name or a tailnet IP. It returns the local port, the
// same one for repeated calls with the same host and port.
func Forward(host string, port int) (int, error) {
	mu.Lock()
	n := current
	mu.Unlock()
	if n == nil {
		return 0, node.ErrNotStarted
	}
	return n.Forward(host, port)
}

// CloseForward stops the forwarder for host:port, if any.
func CloseForward(host string, port int) {
	mu.Lock()
	n := current
	mu.Unlock()
	if n != nil {
		n.CloseForward(host, port)
	}
}

// Serve exposes localAddr (host:port) on the node's tailnet port.
func Serve(tailnetPort int, localAddr string) error {
	mu.Lock()
	n := current
	mu.Unlock()
	if n == nil {
		return node.ErrNotStarted
	}
	return n.Serve(tailnetPort, localAddr)
}
