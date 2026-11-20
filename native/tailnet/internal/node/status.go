package node

import (
	"encoding/json"
	"sort"
	"strings"

	"tailscale.com/ipn/ipnstate"
)

// State values, matching TAILNET_STATES in @tesseract/protocol.
const (
	StateStopped    = "stopped"
	StateStarting   = "starting"
	StateNeedsLogin = "needs_login"
	StateRunning    = "running"
	StateError      = "error"
)

// Status mirrors TailnetStatusSchema in packages/protocol/src/schemas/account.ts.
// Nullable fields are pointers so they encode as null, never omitted.
type Status struct {
	State          string   `json:"state"`
	HostName       *string  `json:"hostName"`
	DNSName        *string  `json:"dnsName"`
	IPs            []string `json:"ips"`
	MagicDNSSuffix *string  `json:"magicDnsSuffix"`
	LoginServer    *string  `json:"loginServer"`
	Error          *string  `json:"error"`
	Peers          []Peer   `json:"peers"`
}

// Peer mirrors TailnetPeerSchema.
type Peer struct {
	HostName string   `json:"hostName"`
	DNSName  *string  `json:"dnsName"`
	IPs      []string `json:"ips"`
	OS       *string  `json:"os"`
	Online   bool     `json:"online"`
}

// JSON encodes the status. It never fails for this type.
func (s Status) JSON() string {
	if s.IPs == nil {
		s.IPs = []string{}
	}
	if s.Peers == nil {
		s.Peers = []Peer{}
	}
	for i := range s.Peers {
		if s.Peers[i].IPs == nil {
			s.Peers[i].IPs = []string{}
		}
	}
	b, err := json.Marshal(s)
	if err != nil {
		// Unreachable: all fields are plain strings, bools and slices.
		return `{"state":"error","hostName":null,"dnsName":null,"ips":[],"magicDnsSuffix":null,"loginServer":null,"error":"status encoding failed","peers":[]}`
	}
	return string(b)
}

// StoppedStatus is the status of a process with no node.
func StoppedStatus() Status {
	return Status{State: StateStopped, IPs: []string{}, Peers: []Peer{}}
}

func strOrNil(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

func trimDot(s string) string { return strings.TrimSuffix(s, ".") }

// mapBackendState converts an ipn.State name into a TailnetState.
// usingAuthKey hides the NeedsLogin state tailscaled briefly reports
// before it registers with an auth key.
func mapBackendState(backend string, usingAuthKey bool) string {
	switch backend {
	case "Running":
		return StateRunning
	case "Stopped":
		return StateStopped
	case "NeedsLogin":
		if usingAuthKey {
			return StateStarting
		}
		return StateNeedsLogin
	case "NeedsMachineAuth":
		return StateNeedsLogin
	default: // NoState, Starting
		return StateStarting
	}
}

// buildStatus converts an ipnstate.Status into a protocol Status.
func buildStatus(st *ipnstate.Status, cfg Config, usingAuthKey bool, errMsg string) Status {
	out := Status{
		State:       mapBackendState(st.BackendState, usingAuthKey),
		HostName:    strOrNil(cfg.Hostname),
		IPs:         []string{},
		LoginServer: strOrNil(cfg.ControlURL),
		Peers:       []Peer{},
	}
	if out.State != StateRunning && errMsg != "" {
		out.State = StateError
		out.Error = strOrNil(errMsg)
	}
	if st.Self != nil {
		// Before registration Self.HostName is the OS hostname; prefer ours.
		if cfg.Hostname == "" && st.Self.HostName != "" {
			out.HostName = strOrNil(st.Self.HostName)
		}
		out.DNSName = strOrNil(trimDot(st.Self.DNSName))
	}
	for _, ip := range st.TailscaleIPs {
		out.IPs = append(out.IPs, ip.String())
	}
	suffix := st.MagicDNSSuffix
	if st.CurrentTailnet != nil && st.CurrentTailnet.MagicDNSSuffix != "" {
		suffix = st.CurrentTailnet.MagicDNSSuffix
	}
	out.MagicDNSSuffix = strOrNil(trimDot(suffix))
	for _, p := range st.Peer {
		if p == nil {
			continue
		}
		peer := Peer{
			HostName: p.HostName,
			DNSName:  strOrNil(trimDot(p.DNSName)),
			IPs:      []string{},
			OS:       strOrNil(p.OS),
			Online:   p.Online,
		}
		for _, ip := range p.TailscaleIPs {
			peer.IPs = append(peer.IPs, ip.String())
		}
		out.Peers = append(out.Peers, peer)
	}
	sort.Slice(out.Peers, func(i, j int) bool {
		a, b := out.Peers[i], out.Peers[j]
		if a.HostName != b.HostName {
			return a.HostName < b.HostName
		}
		return strings.Join(a.IPs, ",") < strings.Join(b.IPs, ",")
	})
	return out
}
