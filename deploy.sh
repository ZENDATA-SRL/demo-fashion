#!/usr/bin/env bash
# Build the image and deploy it to the Lightsail container service. Env vars come from .env and never enter the image.
set -euo pipefail
cd "$(dirname "$0")"

SERVICE=sartoria
REGION=eu-central-1

docker buildx build --platform linux/amd64 -t $SERVICE:latest --load .
IMAGE=$(aws lightsail push-container-image --region $REGION --service-name $SERVICE --label app --image $SERVICE:latest \
  | grep -o ":$SERVICE\.app\.[0-9]*" | tail -1)
echo "Pushed $IMAGE"

DEPLOY=$(mktemp)
IMAGE="$IMAGE" node -e '
const env = Object.fromEntries(require("fs").readFileSync(".env", "utf8").split("\n")
  .map(l => l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)).filter(m => m && m[2]).map(m => [m[1], m[2].replace(/^["\x27]|["\x27]$/g, "")]))
console.log(JSON.stringify({
  containers: { app: { image: process.env.IMAGE, environment: env, ports: { "8788": "HTTP" } } },
  publicEndpoint: { containerName: "app", containerPort: 8788,
    healthCheck: { path: "/api/garments", intervalSeconds: 10, timeoutSeconds: 5, healthyThreshold: 2, unhealthyThreshold: 3, successCodes: "200" } },
}))' > "$DEPLOY"

aws lightsail create-container-service-deployment --region $REGION --service-name $SERVICE --cli-input-json "file://$DEPLOY" \
  --query 'containerService.nextDeployment.state' --output text
rm -f "$DEPLOY"

echo "Waiting for the deployment..."
while :; do
  STATE=$(aws lightsail get-container-services --region $REGION --service-name $SERVICE --query 'containerServices[0].[state,currentDeployment.state,nextDeployment.state]' --output text)
  echo "  $STATE"
  case "$STATE" in RUNNING*ACTIVE*None) break ;; *FAILED*) echo "Deployment failed"; exit 1 ;; esac
  sleep 15
done
aws lightsail get-container-services --region $REGION --service-name $SERVICE --query 'containerServices[0].url' --output text
