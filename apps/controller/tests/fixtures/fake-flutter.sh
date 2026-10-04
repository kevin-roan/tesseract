#!/usr/bin/env bash
# Stand-in for `flutter run --machine …` (daemon JSON protocol on stdout/stdin) and `flutter test`.
# `app.restart` with fullRestart:false answers a result, fullRestart:true answers an error.
# With a `flutter-fail` file in the project the app stops with an error before it starts.
set -u

if [[ "${1:-}" == "test" ]]; then
  echo "00:01 +1: All tests passed!"
  exit 0
fi

echo "ARGS: $*"
if [[ -e flutter-fail ]]; then
  echo '[{"event":"app.start","params":{"appId":"fake-app","deviceId":"web-server"}}]'
  echo '[{"event":"daemon.showMessage","params":{"level":"error","title":"Build","message":"Compilation failed"}}]'
  echo '[{"event":"app.stop","params":{"appId":"fake-app","error":"lib/main.dart:3: Error: Expected a type"}}]'
  exit 1
fi
echo '[{"event":"daemon.connected","params":{"version":"0.6.1","pid":'$$'}}]'
echo '[{"event":"app.start","params":{"appId":"fake-app","deviceId":"web-server","supportsRestart":true,"launchMode":"run","mode":"debug"}}]'
echo '[{"event":"app.progress","params":{"appId":"fake-app","id":"1","progressId":"hot.compile","message":"Compiling application"}}]'
echo '[{"event":"app.log","params":{"appId":"fake-app","log":"hello from flutter"}}]'
echo '[{"event":"app.debugPort","params":{"appId":"fake-app","port":1234}}]'
echo '[{"event":"app.started","params":{"appId":"fake-app"}}]'

while IFS= read -r line; do
  id=$(sed -E 's/.*"id":([0-9]+).*/\1/' <<<"$line")
  if [[ "$line" == *'"appId":"fake-app"'*'"fullRestart":false'* ]]; then
    echo '[{"event":"daemon.logMessage","params":{"level":"status","message":"Reloaded 1 of 2 libraries"}}]'
    echo '[{"id":'"$id"',"result":{"code":0,"message":""}}]'
  else
    echo '[{"id":'"$id"',"error":"Restart is not supported"}]'
  fi
done
