#!/usr/bin/env bash
# Build the backend image, load it into the kind cluster, and apply all manifests.
set -euo pipefail

CLUSTER_NAME="monitoring"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

if ! kind get clusters | grep -qx "${CLUSTER_NAME}"; then
  echo "==> Creating kind cluster '${CLUSTER_NAME}'"
  kind create cluster --config "${ROOT_DIR}/k8s/kind-config.yaml"
fi

echo "==> Building backend image"
docker build -t monitoring-backend:local "${ROOT_DIR}/backend"

echo "==> Loading image into kind cluster"
kind load docker-image monitoring-backend:local --name "${CLUSTER_NAME}"

echo "==> Generating config maps from source files"
kubectl create configmap postgres-init \
  --from-file="${ROOT_DIR}/db/migrations/001_init_schema.sql" \
  --from-file="${ROOT_DIR}/db/migrations/002_indexes.sql" \
  --from-file=003_seed_users_products.sql="${ROOT_DIR}/db/seed/001_seed_users_products.sql" \
  --from-file=004_seed_orders.sql="${ROOT_DIR}/db/seed/002_seed_orders.sql" \
  --dry-run=client -o yaml | kubectl apply -f -

kubectl create configmap prometheus-config \
  --from-file="${ROOT_DIR}/prometheus/prometheus.yml" \
  --dry-run=client -o yaml | kubectl apply -f -

kubectl create configmap grafana-datasource \
  --from-file="${ROOT_DIR}/grafana/provisioning/datasources/datasource.yml" \
  --dry-run=client -o yaml | kubectl apply -f -

kubectl create configmap grafana-dashboard-provider \
  --from-file="${ROOT_DIR}/grafana/provisioning/dashboards/dashboard.yml" \
  --dry-run=client -o yaml | kubectl apply -f -

kubectl create configmap grafana-dashboard-json \
  --from-file="${ROOT_DIR}/grafana/dashboards/backend-overview.json" \
  --dry-run=client -o yaml | kubectl apply -f -

kubectl create configmap k6-script \
  --from-file="${ROOT_DIR}/k6/baseline.js" \
  --dry-run=client -o yaml | kubectl apply -f -

echo "==> Applying manifests"
kubectl apply -k "${ROOT_DIR}/k8s"

echo "==> Restarting prometheus/grafana so config map edits take effect"
echo "    (mounted config map changes don't trigger a rollout on their own)"
kubectl rollout restart deployment/prometheus deployment/grafana

echo "==> Waiting for rollouts"
kubectl rollout status deployment/postgres
kubectl rollout status deployment/postgres-exporter
kubectl rollout status deployment/backend
kubectl rollout status deployment/prometheus
kubectl rollout status deployment/grafana
kubectl rollout status daemonset/node-exporter

echo "==> Done."
