#!/usr/bin/env bash
# Ctrl+C stops all forwards.
set -euo pipefail

trap 'kill 0' EXIT

kubectl port-forward svc/backend 4000:4000 &
kubectl port-forward svc/prometheus 9090:9090 &
kubectl port-forward svc/grafana 3000:3000 &
kubectl port-forward svc/postgres 5432:5432 &

echo "backend:    http://localhost:4000"
echo "prometheus: http://localhost:9090"
echo "grafana:    http://localhost:9090"
echo "postgres:   localhost:5432"

wait
