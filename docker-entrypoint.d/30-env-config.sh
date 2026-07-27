#!/bin/sh
set -e

envsubst < /env-config.js.template > /usr/share/nginx/html/env-config.js
