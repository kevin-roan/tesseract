package tailnet

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
	"time"

	"tesseract/native/tailnet/internal/nodetest"
)

func status(t *testing.T) map[string]any {
	t.Helper()
	var m map[string]any
	if err := json.Unmarshal([]byte(StatusJSON()), &m); err != nil {
		t.Fatal(err)
	}
	return m
}

func TestSingletonLifecycle(t *testing.T) {
	if got := StatusJSON(); got != `{"state":"stopped","hostName":null,"dnsName":null,"ips":[],"magicDnsSuffix":null,"loginServer":null,"error":null,"peers":[]}` {
		t.Fatalf("initial status = %s", got)
	}
	if _, err := Forward("100.64.0.1", 80); err == nil {
		t.Fatal("Forward without a node succeeded")
	}
	if err := Serve(80, "127.0.0.1:80"); err == nil {
		t.Fatal("Serve without a node succeeded")
	}
	CloseForward("100.64.0.1", 80) // no-op
	if err := Stop(); err != nil {
		t.Fatal(err)
	}
	if err := Start("", "http://x", "", "h"); err == nil {
		t.Fatal("Start with empty stateDir succeeded")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()
	controlURL, _ := nodetest.StartControl(t)
	stateDir := filepath.Join(t.TempDir(), "state")
	if err := Start(stateDir, controlURL, nodetest.AuthKey, "single"); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { Stop() })
	for status(t)["state"] != "running" {
		if ctx.Err() != nil {
			t.Fatalf("not running: %s", StatusJSON())
		}
		time.Sleep(50 * time.Millisecond)
	}
	// Same parameters while running: no restart.
	if err := Start(stateDir, controlURL, "", "single"); err != nil {
		t.Fatal(err)
	}
	if status(t)["state"] != "running" {
		t.Fatalf("Start again restarted the node: %s", StatusJSON())
	}
	p1, err := Forward("100.64.0.1", 80)
	if err != nil {
		t.Fatal(err)
	}
	p2, _ := Forward("100.64.0.1", 80)
	if p1 != p2 || p1 == 0 {
		t.Fatalf("Forward ports %d, %d", p1, p2)
	}
	if err := Logout(); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(stateDir); !os.IsNotExist(err) {
		t.Fatalf("state dir survived Logout: %v", err)
	}
	if status(t)["state"] != "stopped" {
		t.Fatalf("status after Logout = %s", StatusJSON())
	}
}
