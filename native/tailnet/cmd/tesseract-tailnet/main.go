// Command tesseract-tailnet runs an embedded Tesseract Network node for
// desktop hosts. See docs/adr/0014-embedded-tailnet-and-tesseract-accounts.md.
//
//	tesseract-tailnet up --state-dir D --login-server URL [--auth-key K] --hostname H [--serve 7701=127.0.0.1:7701 ...]
//	tesseract-tailnet version
//
// `up` prints one TailnetStatus JSON object per line on stdout whenever the
// status changes. Logs go to stderr. SIGTERM or SIGINT stops the node.
package main

import (
	"bufio"
	"errors"
	"flag"
	"fmt"
	"log"
	"os"
	"os/signal"
	"runtime"
	"runtime/debug"
	"strconv"
	"strings"
	"sync"
	"syscall"

	"tesseract/native/tailnet/internal/node"
)

// version is set at build time with -ldflags "-X main.version=...".
var version = "dev"

func main() {
	if len(os.Args) < 2 {
		usage()
		os.Exit(2)
	}
	switch os.Args[1] {
	case "up":
		os.Exit(up(os.Args[2:]))
	case "version", "--version", "-v":
		fmt.Println(versionString())
	case "help", "--help", "-h":
		usage()
	default:
		fmt.Fprintf(os.Stderr, "tesseract-tailnet: unknown command %q\n", os.Args[1])
		usage()
		os.Exit(2)
	}
}

func usage() {
	fmt.Fprint(os.Stderr, `usage:
  tesseract-tailnet up --state-dir DIR --login-server URL [--auth-key KEY] --hostname NAME [--serve PORT=ADDR ...]
  tesseract-tailnet version
`)
}

func versionString() string {
	ts := "unknown"
	if bi, ok := debug.ReadBuildInfo(); ok {
		for _, d := range bi.Deps {
			if d.Path == "tailscale.com" {
				ts = d.Version
				if d.Replace != nil {
					ts = d.Replace.Version
				}
			}
		}
	}
	return fmt.Sprintf("tesseract-tailnet %s (tailscale.com %s, %s %s/%s)", version, ts, runtime.Version(), runtime.GOOS, runtime.GOARCH)
}

type serveSpec struct {
	port int
	addr string
}

type serveFlags []serveSpec

func (s *serveFlags) String() string {
	parts := make([]string, len(*s))
	for i, v := range *s {
		parts[i] = fmt.Sprintf("%d=%s", v.port, v.addr)
	}
	return strings.Join(parts, ",")
}

func (s *serveFlags) Set(v string) error {
	portStr, addr, ok := strings.Cut(v, "=")
	if !ok || addr == "" {
		return errors.New("want PORT=HOST:PORT")
	}
	port, err := strconv.Atoi(portStr)
	if err != nil || port <= 0 || port > 65535 {
		return fmt.Errorf("invalid port %q", portStr)
	}
	*s = append(*s, serveSpec{port: port, addr: addr})
	return nil
}

func up(args []string) int {
	fs := flag.NewFlagSet("up", flag.ContinueOnError)
	stateDir := fs.String("state-dir", "", "directory for the node state (required)")
	loginServer := fs.String("login-server", "", "control server URL")
	authKey := fs.String("auth-key", "", "pre-auth key; may be omitted when state exists")
	hostname := fs.String("hostname", "", "node hostname")
	verbose := fs.Bool("verbose", false, "print backend logs to stderr")
	var serves serveFlags
	fs.Var(&serves, "serve", "expose ADDR on the tailnet port PORT, as PORT=ADDR (repeatable)")
	if err := fs.Parse(args); err != nil {
		return 2
	}
	if fs.NArg() > 0 {
		fmt.Fprintf(os.Stderr, "tesseract-tailnet: unexpected arguments: %v\n", fs.Args())
		return 2
	}
	if *stateDir == "" {
		fmt.Fprintln(os.Stderr, "tesseract-tailnet: --state-dir is required")
		return 2
	}
	if *authKey == "" {
		*authKey = os.Getenv("TESSERACT_TAILNET_AUTH_KEY")
	}

	logger := log.New(os.Stderr, "tesseract-tailnet: ", log.LstdFlags)
	out := bufio.NewWriter(os.Stdout)
	var outMu sync.Mutex
	cfg := node.Config{
		StateDir:   *stateDir,
		ControlURL: *loginServer,
		AuthKey:    *authKey,
		Hostname:   *hostname,
		UserLogf:   logger.Printf,
		OnChange: func(js string) {
			outMu.Lock()
			defer outMu.Unlock()
			out.WriteString(js)
			out.WriteByte('\n')
			out.Flush()
		},
	}
	if *verbose {
		cfg.Logf = logger.Printf
	}

	sigs := make(chan os.Signal, 1)
	signal.Notify(sigs, syscall.SIGTERM, syscall.SIGINT)

	n, err := node.Start(cfg)
	if err != nil {
		logger.Print(err)
		return 1
	}
	code := 0
	for _, s := range serves {
		if err := n.Serve(s.port, s.addr); err != nil {
			logger.Printf("serve %d=%s: %v", s.port, s.addr, err)
			code = 1
		}
	}
	if code == 0 {
		sig := <-sigs
		logger.Printf("received %v, stopping", sig)
	}
	if err := n.Stop(); err != nil {
		logger.Print(err)
	}
	return code
}
