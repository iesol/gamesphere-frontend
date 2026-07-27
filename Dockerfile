FROM node:latest AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --legacy-peer-deps
COPY . .
ARG VITE_GOOGLE_CLIENT_ID
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID
RUN npm run build

FROM nginx:1.27-alpine AS runtime
ENV PORT=8080
ENV BACKEND_URL=http://backend:3000
ENV GOOGLE_CLIENT_ID=
ENV API_URL=
COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
COPY env-config.js.template /env-config.js.template
COPY docker-entrypoint.d /docker-entrypoint.d
EXPOSE 8080
