var headers = { Authorization: 'Bearer ' + TESSERACT_TOKEN, 'Content-Type': 'application/json' };
var base = TESSERACT_URL.replace(/\/$/, '');

if (ACTION === 'start') {
  var res = http.post(base + '/v1/processes', {
    headers: headers,
    body: JSON.stringify({ projectId: 'hello-world', command: 'sleep 600', name: 'e2e-sleeper' }),
  });
  if (res.status >= 300) throw new Error('start failed: ' + res.status + ' ' + res.body);
  output.sleeperId = json(res.body).id;
} else {
  var list = json(http.get(base + '/v1/processes', { headers: headers }).body);
  var sleepers = list.filter(function (p) { return p.name === 'e2e-sleeper'; });
  var running = sleepers.filter(function (p) { return p.state === 'running' || p.state === 'starting'; });
  if (ACTION === 'cleanup') {
    running.forEach(function (p) { http.delete(base + '/v1/processes/' + p.id, { headers: headers }); });
  } else if (ACTION === 'assert-stopped') {
    var mine = sleepers.filter(function (p) { return p.id === output.sleeperId; })[0];
    if (!mine) throw new Error('e2e-sleeper ' + output.sleeperId + ' not found');
    if (mine.state !== 'stopped') throw new Error('e2e-sleeper state is ' + mine.state);
  }
}
