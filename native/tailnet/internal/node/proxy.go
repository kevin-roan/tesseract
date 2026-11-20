package node

import (
	"context"
	"errors"
	"io"
	"net"
	"sync"
	"time"

	"tailscale.com/types/logger"
)

// proxy accepts connections on ln and pipes each one to a connection made by
// dial. It is used for both directions: loopback -> tailnet (Forward) and
// tailnet -> loopback (Serve).
type proxy struct {
	ln     net.Listener
	dial   func(context.Context) (net.Conn, error)
	logf   logger.Logf
	ctx    context.Context
	cancel context.CancelFunc

	mu     sync.Mutex
	closed bool
	conns  map[net.Conn]struct{}
}

func newProxy(parent context.Context, ln net.Listener, dial func(context.Context) (net.Conn, error), logf logger.Logf) *proxy {
	ctx, cancel := context.WithCancel(parent)
	p := &proxy{ln: ln, dial: dial, logf: logf, ctx: ctx, cancel: cancel, conns: map[net.Conn]struct{}{}}
	go p.acceptLoop()
	return p
}

func (p *proxy) port() int {
	if a, ok := p.ln.Addr().(*net.TCPAddr); ok {
		return a.Port
	}
	_, portStr, err := net.SplitHostPort(p.ln.Addr().String())
	if err != nil {
		return 0
	}
	port, _ := net.LookupPort("tcp", portStr)
	return port
}

func (p *proxy) acceptLoop() {
	backoff := 5 * time.Millisecond
	for {
		c, err := p.ln.Accept()
		if err != nil {
			if p.ctx.Err() != nil || errors.Is(err, net.ErrClosed) {
				return
			}
			p.logf("tailnet: accept on %v: %v", p.ln.Addr(), err)
			select {
			case <-p.ctx.Done():
				return
			case <-time.After(backoff):
			}
			if backoff < time.Second {
				backoff *= 2
			}
			continue
		}
		backoff = 5 * time.Millisecond
		go p.handle(c)
	}
}

func (p *proxy) track(c net.Conn) bool {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.closed {
		return false
	}
	p.conns[c] = struct{}{}
	return true
}

func (p *proxy) untrack(c net.Conn) {
	p.mu.Lock()
	delete(p.conns, c)
	p.mu.Unlock()
}

func (p *proxy) handle(in net.Conn) {
	if !p.track(in) {
		in.Close()
		return
	}
	defer p.untrack(in)
	out, err := p.dial(p.ctx)
	if err != nil {
		if p.ctx.Err() == nil {
			p.logf("tailnet: proxy dial from %v: %v", p.ln.Addr(), err)
		}
		in.Close()
		return
	}
	if !p.track(out) {
		in.Close()
		out.Close()
		return
	}
	defer p.untrack(out)
	pipe(in, out)
}

type closeWriter interface{ CloseWrite() error }

// pipe copies in both directions, propagating half-closes where the
// connection supports them, and closes both ends when done.
func pipe(a, b net.Conn) {
	var wg sync.WaitGroup
	cp := func(dst, src net.Conn) {
		defer wg.Done()
		io.Copy(dst, src)
		if cw, ok := dst.(closeWriter); ok {
			if cw.CloseWrite() == nil {
				return
			}
		}
		dst.Close()
		src.Close()
	}
	wg.Add(2)
	go cp(a, b)
	go cp(b, a)
	wg.Wait()
	a.Close()
	b.Close()
}

func (p *proxy) close() {
	p.mu.Lock()
	if p.closed {
		p.mu.Unlock()
		return
	}
	p.closed = true
	conns := p.conns
	p.conns = map[net.Conn]struct{}{}
	p.mu.Unlock()
	p.cancel()
	p.ln.Close()
	for c := range conns {
		c.Close()
	}
}
