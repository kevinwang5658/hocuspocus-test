#!/bin/bash

docker build -t hocuspocus-test . --platform=linux/amd64

IMAGE_NAME=kevinwang5658/hocuspocus-test:$(uuidgen)
docker tag hocuspocus-test:latest ${IMAGE_NAME}
docker push ${IMAGE_NAME}

echo "Pushed new image: ${IMAGE_NAME}"
