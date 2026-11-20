// Package nodetest runs an in-process control server, DERP and STUN for
// tests, following tailscale.com/tsnet's own tests.
package nodetest

import (
	"net/http/httptest"
	"testing"

	"tailscale.com/net/netns"
	"tailscale.com/tailcfg"
	"tailscale.com/tstest/integration"
	"tailscale.com/tstest/integration/testcontrol"
	"tailscale.com/types/logger"
)

// AuthKey is the only auth key the test control server accepts.
const AuthKey = "tskey-auth-tesseract-test"

// MagicDNSDomain is the test tailnet's MagicDNS suffix.
const MagicDNSDomain = "tesseract.test"

// StartControl starts a control server that requires AuthKey and returns its URL.
func StartControl(t testing.TB) (string, *testcontrol.Server) {
	return startControl(t, AuthKey)
}

// StartOpenControl starts a control server that accepts any registration.
// testcontrol requires the auth key on every register request, including a
// restarted node re-registering from saved state, which real control servers
// (and Headscale) do not; use this for restart tests.
func StartOpenControl(t testing.TB) (string, *testcontrol.Server) {
	return startControl(t, "")
}

func startControl(t testing.TB, requireKey string) (string, *testcontrol.Server) {
	t.Helper()
	netns.SetEnabled(false)
	t.Cleanup(func() { netns.SetEnabled(true) })

	derpMap := integration.RunDERPAndSTUN(t, logger.Discard, "127.0.0.1")
	control := &testcontrol.Server{
		DERPMap:        derpMap,
		DNSConfig:      &tailcfg.DNSConfig{Proxied: true},
		MagicDNSDomain: MagicDNSDomain,
		RequireAuthKey: requireKey,
		AllOnline:      true,
		Logf:           logger.Discard,
	}
	control.HTTPTestServer = httptest.NewUnstartedServer(control)
	control.HTTPTestServer.Start()
	t.Cleanup(control.HTTPTestServer.Close)
	return control.HTTPTestServer.URL, control
}
