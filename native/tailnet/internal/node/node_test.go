package node

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"reflect"
	"sort"
	"strings"
	"sync"
	"testing"
	"time"

	"tesseract/native/tailnet/internal/nodetest"
)

type recorder struct {
	mu     sync.Mutex
	states []string
	last   string
}

func (r *recorder) onChange(js string) {
	var st struct{ State string }
	json.Unmarshal([]byte(js), &st)
	r.mu.Lock()
	defer r.mu.Unlock()
	if len(r.states) == 0 || r.states[len(r.states)-1] != st.State {
		r.states = append(r.states, st.State)
	}
	r.last = js
}

func (r *recorder) snapshot() ([]string, string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	return append([]string(nil), r.states...), r.last
}

func startNode(t *testing.T, controlURL, hostname, authKey string) (*Node, *recorder) {
	t.Helper()
	rec := &recorder{}
	cfg := Config{
		StateDir:   filepath.Join(t.TempDir(), hostname),
		ControlURL: controlURL,
		AuthKey:    authKey,
		Hostname:   hostname,
		OnChange:   rec.onChange,
	}
	if os.Getenv("TAILNET_TEST_VERBOSE") != "" {
		cfg.Logf = t.Logf
		cfg.UserLogf = t.Logf
	}
	n, err := Start(cfg)
	if err != nil {
		t.Fatalf("Start(%s): %v", hostname, err)
	}
	t.Cleanup(func() { n.Stop() })
	return n, rec
}

func waitRunning(t *testing.T, ctx context.Context, n *Node) Status {
	t.Helper()
	st, err := n.Wait(ctx, func(s Status) bool { return s.State == StateRunning && len(s.IPs) > 0 })
	if err != nil {
		t.Fatalf("%s not running: %v (last status %s)", n.cfg.Hostname, err, st.JSON())
	}
	waitHomeDERP(t, ctx, n)
	return st
}

// waitHomeDERP waits until the node's home DERP connection is up, so fast
// tests don't race the DERP handshake (see tsnet's waitForHomeDERPConnected).
func waitHomeDERP(t *testing.T, ctx context.Context, n *Node) {
	t.Helper()
	h := n.srv.Sys().HealthTracker.Get()
	ms := n.srv.Sys().MagicSock.Get()
	for {
		if r := ms.GetLastNetcheckReport(ctx); r != nil && r.PreferredDERP != 0 &&
			!h.GetDERPRegionReceivedTime(r.PreferredDERP).IsZero() {
			return
		}
		select {
		case <-ctx.Done():
			t.Fatalf("home DERP for %s: %v", n.cfg.Hostname, ctx.Err())
		case <-time.After(20 * time.Millisecond):
		}
	}
}

func get(t *testing.T, ctx context.Context, url string) string {
	t.Helper()
	var lastErr error
	for ctx.Err() == nil {
		req, _ := http.NewRequestWithContext(ctx, "GET", url, nil)
		c := &http.Client{Timeout: 10 * time.Second}
		res, err := c.Do(req)
		if err == nil {
			b, err := io.ReadAll(res.Body)
			res.Body.Close()
			if err == nil && res.StatusCode == 200 {
				return string(b)
			}
			lastErr = fmt.Errorf("status %d, body %q, err %v", res.StatusCode, b, err)
		} else {
			lastErr = err
		}
		time.Sleep(200 * time.Millisecond)
	}
	t.Fatalf("GET %s: %v", url, lastErr)
	return ""
}

func TestTwoNodes(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
	defer cancel()
	controlURL, _ := nodetest.StartControl(t)

	a, recA := startNode(t, controlURL, "node-a", nodetest.AuthKey)
	b, _ := startNode(t, controlURL, "node-b", nodetest.AuthKey)

	stA := waitRunning(t, ctx, a)
	stB := waitRunning(t, ctx, b)

	// B serves a local HTTP server on its tailnet port 8080.
	web := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintf(w, "hello from b %s", r.URL.Path)
	}))
	defer web.Close()
	localAddr := strings.TrimPrefix(web.URL, "http://")
	if err := b.Serve(8080, localAddr); err != nil {
		t.Fatalf("Serve: %v", err)
	}
	if err := b.Serve(8080, localAddr); err != nil {
		t.Fatalf("Serve again (idempotent): %v", err)
	}

	// A forwards a loopback port to B by tailnet IP.
	bIP := stB.IPs[0]
	port, err := a.Forward(bIP, 8080)
	if err != nil {
		t.Fatalf("Forward: %v", err)
	}
	if got := get(t, ctx, fmt.Sprintf("http://127.0.0.1:%d/x", port)); got != "hello from b /x" {
		t.Fatalf("GET via IP forward = %q", got)
	}

	// Idempotent per host:port.
	port2, err := a.Forward(bIP, 8080)
	if err != nil || port2 != port {
		t.Fatalf("Forward again = %d, %v; want %d", port2, err, port)
	}

	// By MagicDNS name, once A's status lists B.
	stA, err = a.Wait(ctx, func(s Status) bool {
		for _, p := range s.Peers {
			if p.HostName == "node-b" && p.DNSName != nil {
				return true
			}
		}
		return false
	})
	if err != nil {
		t.Fatalf("peer node-b never appeared: %s", stA.JSON())
	}
	bName := "node-b." + nodetest.MagicDNSDomain
	namePort, err := a.Forward(bName, 8080)
	if err != nil {
		t.Fatalf("Forward by name: %v", err)
	}
	if namePort == port {
		t.Fatalf("name forward reused IP forward port %d", port)
	}
	if got := get(t, ctx, fmt.Sprintf("http://127.0.0.1:%d/name", namePort)); got != "hello from b /name" {
		t.Fatalf("GET via name forward = %q", got)
	}

	// CloseForward releases the listener; a new Forward opens a fresh one.
	a.CloseForward(bIP, 8080)
	c := &http.Client{Timeout: 2 * time.Second}
	if res, err := c.Get(fmt.Sprintf("http://127.0.0.1:%d/", port)); err == nil {
		res.Body.Close()
		t.Fatalf("closed forward still answers")
	}
	port3, err := a.Forward(bIP, 8080)
	if err != nil {
		t.Fatalf("Forward after close: %v", err)
	}
	if got := get(t, ctx, fmt.Sprintf("http://127.0.0.1:%d/again", port3)); got != "hello from b /again" {
		t.Fatalf("GET after reopen = %q", got)
	}

	// Status JSON shape.
	checkStatusShape(t, a.StatusJSON(), "node-a", controlURL)

	// State transitions seen by OnChange: starting ... running.
	states, last := recA.snapshot()
	if states[0] != StateStarting || states[len(states)-1] != StateRunning {
		t.Fatalf("A state sequence = %v", states)
	}
	if last != a.StatusJSON() {
		t.Fatalf("last OnChange JSON differs from StatusJSON:\n%s\n%s", last, a.StatusJSON())
	}

	// Logout wipes state and stops the node.
	stateDir := a.cfg.StateDir
	if _, err := os.Stat(filepath.Join(stateDir, "tailscaled.state")); err != nil {
		t.Fatalf("state file missing before logout: %v", err)
	}
	if err := a.Logout(); err != nil {
		t.Fatalf("Logout: %v", err)
	}
	if _, err := os.Stat(stateDir); !os.IsNotExist(err) {
		t.Fatalf("state dir still exists after Logout: %v", err)
	}
	if got := a.Status().State; got != StateStopped {
		t.Fatalf("state after Logout = %q", got)
	}
	if _, err := a.Forward(bIP, 8080); err != ErrNotStarted {
		t.Fatalf("Forward after Logout err = %v", err)
	}
	if states, _ := recA.snapshot(); states[len(states)-1] != StateStopped {
		t.Fatalf("A states after logout = %v", states)
	}
	if err := a.Stop(); err != nil {
		t.Fatalf("Stop after Logout: %v", err)
	}
}

func checkStatusShape(t *testing.T, js, hostname, controlURL string) {
	t.Helper()
	var m map[string]any
	if err := json.Unmarshal([]byte(js), &m); err != nil {
		t.Fatalf("status JSON: %v: %s", err, js)
	}
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	want := []string{"dnsName", "error", "hostName", "ips", "loginServer", "magicDnsSuffix", "peers", "state"}
	if !reflect.DeepEqual(keys, want) {
		t.Fatalf("status keys = %v, want %v", keys, want)
	}
	if m["state"] != StateRunning || m["hostName"] != hostname || m["loginServer"] != controlURL {
		t.Fatalf("status = %s", js)
	}
	if m["error"] != nil {
		t.Fatalf("error = %v, want null", m["error"])
	}
	if m["magicDnsSuffix"] != nodetest.MagicDNSDomain {
		t.Fatalf("magicDnsSuffix = %v, want %q", m["magicDnsSuffix"], nodetest.MagicDNSDomain)
	}
	if m["dnsName"] != hostname+"."+nodetest.MagicDNSDomain {
		t.Fatalf("dnsName = %v", m["dnsName"])
	}
	if ips, _ := m["ips"].([]any); len(ips) == 0 {
		t.Fatalf("ips = %v", m["ips"])
	}
	peers, _ := m["peers"].([]any)
	if len(peers) == 0 {
		t.Fatalf("no peers: %s", js)
	}
	for _, p := range peers {
		pm := p.(map[string]any)
		pk := make([]string, 0, len(pm))
		for k := range pm {
			pk = append(pk, k)
		}
		sort.Strings(pk)
		if want := []string{"dnsName", "hostName", "ips", "online", "os"}; !reflect.DeepEqual(pk, want) {
			t.Fatalf("peer keys = %v, want %v", pk, want)
		}
		if dn, _ := pm["dnsName"].(string); strings.HasSuffix(dn, ".") {
			t.Fatalf("peer dnsName has trailing dot: %q", dn)
		}
	}
}

func TestBadAuthKeyReportsError(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()
	controlURL, _ := nodetest.StartControl(t)
	n, _ := startNode(t, controlURL, "node-bad", "tskey-auth-wrong")
	st, err := n.Wait(ctx, func(s Status) bool { return s.State == StateError })
	if err != nil {
		t.Fatalf("never reached error: %s", st.JSON())
	}
	if st.Error == nil || !strings.Contains(*st.Error, "invalid authkey") {
		t.Fatalf("error = %v", st.JSON())
	}
}

func TestNoAuthKeyNeedsLogin(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()
	controlURL, control := nodetest.StartOpenControl(t)
	control.RequireAuth = true // interactive login, like a node with no key and no state
	n, _ := startNode(t, controlURL, "node-nokey", "")
	st, err := n.Wait(ctx, func(s Status) bool { return s.State == StateNeedsLogin })
	if err != nil {
		t.Fatalf("never reached needs_login: %s", st.JSON())
	}
	if st.Error != nil {
		t.Fatalf("needs_login with error: %s", st.JSON())
	}
}

func TestRestartFromState(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
	defer cancel()
	controlURL, _ := nodetest.StartOpenControl(t)
	n, _ := startNode(t, controlURL, "node-r", nodetest.AuthKey)
	first := waitRunning(t, ctx, n)
	cfg := n.cfg
	if err := n.Stop(); err != nil {
		t.Fatal(err)
	}
	// Restart with the same state and no auth key.
	cfg.AuthKey = ""
	cfg.OnChange = nil
	n2, err := Start(cfg)
	if err != nil {
		t.Fatal(err)
	}
	defer n2.Stop()
	second := waitRunning(t, ctx, n2)
	if first.IPs[0] != second.IPs[0] {
		t.Fatalf("IP changed across restart: %v -> %v", first.IPs, second.IPs)
	}
}

func TestStoppedStatusJSON(t *testing.T) {
	const want = `{"state":"stopped","hostName":null,"dnsName":null,"ips":[],"magicDnsSuffix":null,"loginServer":null,"error":null,"peers":[]}`
	if got := StoppedStatus().JSON(); got != want {
		t.Fatalf("got %s", got)
	}
	if got := (Status{State: StateStarting}).JSON(); !strings.Contains(got, `"ips":[]`) || !strings.Contains(got, `"peers":[]`) {
		t.Fatalf("nil slices not normalized: %s", got)
	}
}

func TestMapBackendState(t *testing.T) {
	cases := []struct {
		in      string
		authKey bool
		want    string
	}{
		{"NoState", false, StateStarting},
		{"Starting", false, StateStarting},
		{"NeedsLogin", false, StateNeedsLogin},
		{"NeedsLogin", true, StateStarting},
		{"NeedsMachineAuth", true, StateNeedsLogin},
		{"Running", false, StateRunning},
		{"Stopped", false, StateStopped},
	}
	for _, c := range cases {
		if got := mapBackendState(c.in, c.authKey); got != c.want {
			t.Errorf("mapBackendState(%q, %v) = %q, want %q", c.in, c.authKey, got, c.want)
		}
	}
}
