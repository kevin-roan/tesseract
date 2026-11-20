// Package node runs one embedded tailnet node on top of tsnet. The public
// package tailnet wraps a single Node per process for gomobile; tests and the
// desktop CLI use Node directly.
package node

import (
	"context"
	"errors"
	"fmt"
	"net"
	"os"
	"strconv"
	"sync"
	"time"

	"tailscale.com/client/local"
	"tailscale.com/envknob"
	"tailscale.com/ipn"
	"tailscale.com/logtail"
	"tailscale.com/tsnet"
	"tailscale.com/types/logger"
)

func init() {
	// The Tesseract Network runs on a self-hosted control server; never
	// upload client logs to Tailscale's log catcher.
	envknob.SetNoLogsNoSupport()
	logtail.Disable()
}

// ErrNotStarted is returned by operations that need a running node.
var ErrNotStarted = errors.New("tailnet: node is not started")

const (
	dialTimeout    = 15 * time.Second
	logoutTimeout  = 10 * time.Second
	refreshEvery   = 15 * time.Second
	watchRetryWait = time.Second
)

// Config describes a node.
type Config struct {
	StateDir   string // required; holds tailscaled.state
	ControlURL string // login server; empty means the tsnet default
	AuthKey    string // may be empty when StateDir already holds a node
	Hostname   string

	Ephemeral bool

	// Logf receives verbose backend logs. Nil discards them.
	Logf logger.Logf
	// UserLogf receives tsnet's user-facing messages. Nil discards them.
	UserLogf logger.Logf
	// OnChange, if set, is called with the status JSON each time it changes.
	// Calls are serialized. It must not call Stop or Logout synchronously.
	OnChange func(statusJSON string)
}

// Node is one running tsnet node.
type Node struct {
	cfg    Config
	srv    *tsnet.Server
	lc     *local.Client
	ctx    context.Context
	cancel context.CancelFunc
	kick   chan struct{}
	wg     sync.WaitGroup

	mu       sync.Mutex
	closed   bool
	status   Status
	errMsg   string
	forwards map[string]*proxy
	serves   map[int]*serveEntry

	emitMu   sync.Mutex // serializes refresh + OnChange
	lastJSON string
}

type serveEntry struct {
	localAddr string
	p         *proxy
}

// Start creates the node and starts connecting it. It returns once tsnet is
// started, not once the node is running; Status reports progress.
func Start(cfg Config) (*Node, error) {
	if cfg.StateDir == "" {
		return nil, errors.New("tailnet: stateDir is required")
	}
	if err := os.MkdirAll(cfg.StateDir, 0o700); err != nil {
		return nil, fmt.Errorf("tailnet: create state dir: %w", err)
	}
	logf := cfg.Logf
	if logf == nil {
		logf = logger.Discard
	}
	userLogf := cfg.UserLogf
	if userLogf == nil {
		userLogf = logger.Discard
	}
	srv := &tsnet.Server{
		Dir:        cfg.StateDir,
		ControlURL: cfg.ControlURL,
		Hostname:   cfg.Hostname,
		AuthKey:    cfg.AuthKey,
		Ephemeral:  cfg.Ephemeral,
		Logf:       logf,
		UserLogf:   userLogf,
	}
	if err := srv.Start(); err != nil {
		return nil, fmt.Errorf("tailnet: start: %w", err)
	}
	lc, err := srv.LocalClient()
	if err != nil {
		srv.Close()
		return nil, fmt.Errorf("tailnet: local client: %w", err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	n := &Node{
		cfg:      cfg,
		srv:      srv,
		lc:       lc,
		ctx:      ctx,
		cancel:   cancel,
		kick:     make(chan struct{}, 1),
		forwards: map[string]*proxy{},
		serves:   map[int]*serveEntry{},
	}
	n.status = Status{
		State:       StateStarting,
		HostName:    strOrNil(cfg.Hostname),
		IPs:         []string{},
		LoginServer: strOrNil(cfg.ControlURL),
		Peers:       []Peer{},
	}
	n.emit(n.status)
	n.wg.Add(2)
	go n.watch()
	go n.refresher()
	n.requestRefresh()
	return n, nil
}

// Config returns the node's configuration.
func (n *Node) Config() Config { return n.cfg }

// Status returns the latest status.
func (n *Node) Status() Status {
	n.mu.Lock()
	defer n.mu.Unlock()
	return n.status
}

// StatusJSON returns the latest status as JSON.
func (n *Node) StatusJSON() string { return n.Status().JSON() }

// Wait polls the status until ok returns true or ctx ends.
func (n *Node) Wait(ctx context.Context, ok func(Status) bool) (Status, error) {
	t := time.NewTicker(50 * time.Millisecond)
	defer t.Stop()
	for {
		st := n.Status()
		if ok(st) {
			return st, nil
		}
		select {
		case <-ctx.Done():
			return st, ctx.Err()
		case <-t.C:
		}
	}
}

// watch follows the IPN bus and requests a status refresh on relevant changes.
func (n *Node) watch() {
	defer n.wg.Done()
	mask := ipn.NotifyInitialState | ipn.NotifyPeerChanges | ipn.NotifyPeerPatches
	for n.ctx.Err() == nil {
		w, err := n.lc.WatchIPNBus(n.ctx, mask)
		if err != nil {
			if !n.sleep(watchRetryWait) {
				return
			}
			continue
		}
		for {
			msg, err := w.Next()
			if err != nil {
				break
			}
			relevant := false
			if msg.ErrMessage != nil {
				n.mu.Lock()
				n.errMsg = *msg.ErrMessage
				n.mu.Unlock()
				relevant = true
			}
			if msg.State != nil {
				if *msg.State == ipn.Running {
					n.mu.Lock()
					n.errMsg = ""
					n.mu.Unlock()
				}
				relevant = true
			}
			if msg.LoginFinished != nil || msg.BrowseToURL != nil || msg.SelfChange != nil ||
				len(msg.PeersChanged) > 0 || len(msg.PeersRemoved) > 0 || len(msg.PeerChangedPatch) > 0 {
				relevant = true
			}
			if relevant {
				n.requestRefresh()
			}
		}
		w.Close()
		if !n.sleep(watchRetryWait) {
			return
		}
	}
}

func (n *Node) sleep(d time.Duration) bool {
	select {
	case <-n.ctx.Done():
		return false
	case <-time.After(d):
		return true
	}
}

func (n *Node) requestRefresh() {
	select {
	case n.kick <- struct{}{}:
	default:
	}
}

// refresher rebuilds the status on request and periodically (peer online
// state, for instance, is cheap to poll and easy to miss).
func (n *Node) refresher() {
	defer n.wg.Done()
	t := time.NewTicker(refreshEvery)
	defer t.Stop()
	for {
		select {
		case <-n.ctx.Done():
			return
		case <-n.kick:
		case <-t.C:
		}
		n.refresh()
	}
}

func (n *Node) refresh() {
	n.emitMu.Lock()
	defer n.emitMu.Unlock()
	ctx, cancel := context.WithTimeout(n.ctx, 5*time.Second)
	defer cancel()
	st, err := n.lc.Status(ctx)
	if err != nil {
		return
	}
	n.mu.Lock()
	if n.closed {
		n.mu.Unlock()
		return
	}
	usingAuthKey := n.cfg.AuthKey != "" && st.AuthURL == ""
	n.status = buildStatus(st, n.cfg, usingAuthKey, n.errMsg)
	out := n.status
	n.mu.Unlock()
	n.emitLocked(out)
}

func (n *Node) emit(st Status) {
	n.emitMu.Lock()
	defer n.emitMu.Unlock()
	n.emitLocked(st)
}

func (n *Node) emitLocked(st Status) {
	js := st.JSON()
	if js == n.lastJSON {
		return
	}
	n.lastJSON = js
	if n.cfg.OnChange != nil {
		n.cfg.OnChange(js)
	}
}

// Stop closes forwarders, listeners and the node. It is idempotent.
func (n *Node) Stop() error {
	n.mu.Lock()
	if n.closed {
		n.mu.Unlock()
		return nil
	}
	n.closed = true
	forwards, serves := n.forwards, n.serves
	n.forwards, n.serves = map[string]*proxy{}, map[int]*serveEntry{}
	n.mu.Unlock()

	for _, p := range forwards {
		p.close()
	}
	for _, s := range serves {
		s.p.close()
	}
	n.cancel()
	err := n.srv.Close()
	n.wg.Wait()

	n.mu.Lock()
	n.status = StoppedStatus()
	st := n.status
	n.mu.Unlock()
	n.emit(st)
	if err != nil && !errors.Is(err, net.ErrClosed) {
		return fmt.Errorf("tailnet: stop: %w", err)
	}
	return nil
}

// Logout logs the node out of the control server, stops it and removes its
// state directory. A failed control-server logout (offline, say) is logged
// and does not prevent wiping local state.
func (n *Node) Logout() error {
	ctx, cancel := context.WithTimeout(context.Background(), logoutTimeout)
	err := n.lc.Logout(ctx)
	cancel()
	if err != nil && n.cfg.UserLogf != nil {
		n.cfg.UserLogf("tailnet: logout: %v", err)
	}
	stopErr := n.Stop()
	if err := os.RemoveAll(n.cfg.StateDir); err != nil {
		return fmt.Errorf("tailnet: remove state: %w", err)
	}
	return stopErr
}

func forwardKey(host string, port int) string {
	return net.JoinHostPort(host, strconv.Itoa(port))
}

func validPort(port int) bool { return port > 0 && port < 65536 }

// Forward listens on 127.0.0.1:<random> and proxies each connection to
// host:port over the tailnet. It returns the same local port for repeated
// calls with the same host and port.
func (n *Node) Forward(host string, port int) (int, error) {
	if host == "" || !validPort(port) {
		return 0, fmt.Errorf("tailnet: invalid forward target %q:%d", host, port)
	}
	key := forwardKey(host, port)
	n.mu.Lock()
	defer n.mu.Unlock()
	if n.closed {
		return 0, ErrNotStarted
	}
	if p, ok := n.forwards[key]; ok {
		return p.port(), nil
	}
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return 0, fmt.Errorf("tailnet: forward listen: %w", err)
	}
	srv := n.srv
	p := newProxy(n.ctx, ln, func(ctx context.Context) (net.Conn, error) {
		ctx, cancel := context.WithTimeout(ctx, dialTimeout)
		defer cancel()
		return srv.Dial(ctx, "tcp", key)
	}, n.userLogf())
	n.forwards[key] = p
	return p.port(), nil
}

// CloseForward stops the forwarder for host:port, if any, and closes its
// connections.
func (n *Node) CloseForward(host string, port int) {
	key := forwardKey(host, port)
	n.mu.Lock()
	p := n.forwards[key]
	delete(n.forwards, key)
	n.mu.Unlock()
	if p != nil {
		p.close()
	}
}

// Serve accepts tailnet TCP connections on tailnetPort and proxies them to
// localAddr. Calling it again for the same port with the same address is a
// no-op; a different address replaces the previous one.
func (n *Node) Serve(tailnetPort int, localAddr string) error {
	if !validPort(tailnetPort) {
		return fmt.Errorf("tailnet: invalid port %d", tailnetPort)
	}
	if _, _, err := net.SplitHostPort(localAddr); err != nil {
		return fmt.Errorf("tailnet: invalid local address %q: %w", localAddr, err)
	}
	n.mu.Lock()
	defer n.mu.Unlock()
	if n.closed {
		return ErrNotStarted
	}
	if old, ok := n.serves[tailnetPort]; ok {
		if old.localAddr == localAddr {
			return nil
		}
		old.p.close()
		delete(n.serves, tailnetPort)
	}
	ln, err := n.srv.Listen("tcp", ":"+strconv.Itoa(tailnetPort))
	if err != nil {
		return fmt.Errorf("tailnet: serve listen: %w", err)
	}
	p := newProxy(n.ctx, ln, func(ctx context.Context) (net.Conn, error) {
		d := net.Dialer{Timeout: dialTimeout}
		return d.DialContext(ctx, "tcp", localAddr)
	}, n.userLogf())
	n.serves[tailnetPort] = &serveEntry{localAddr: localAddr, p: p}
	return nil
}

func (n *Node) userLogf() logger.Logf {
	if n.cfg.UserLogf != nil {
		return n.cfg.UserLogf
	}
	return logger.Discard
}
